/**
 * AI Service Layer — Public API for all AI interactions.
 * 
 * This is the ONLY module that business routes should import.
 * It orchestrates: prompt resolution → sanitization → rate limiting → 
 * provider dispatch → cost calculation → audit logging.
 * 
 * Replaces the monolithic lib/ai/gemini.ts with a provider-agnostic facade.
 */

import { prisma } from '../prisma';
import { DEFAULT_PROMPTS, compilePrompt } from './prompts';
import { AiRequestOptions, AiServiceResponse, TokenUsage } from './types';
import { resolveRoute } from './router';
import { sanitizePrompt } from './guard';
import { logAiRequest } from './audit';
import { calculateCost } from './costs';
import { getRateLimiter } from './rate-limiter';
import { AIAttachment } from './providers/base';

// ─── generateObject<T> ─────────────────────────────────────────────────────────
// Text-in, structured JSON-out. Replaces the old generateContent<T>().

export async function generateObject<T = any>(
    promptKey: string,
    variables: Record<string, any>,
    options: AiRequestOptions = {}
): Promise<AiServiceResponse<T>> {
    const start = Date.now();
    const { provider, model, providerName } = resolveRoute(promptKey, options.model);

    let systemInstruction = '';
    let userPromptTemplate = '';
    let version = 1;

    try {
        // 1. Resolve prompt: database override or local default
        let dbPrompt = null;
        if (options.useDatabasePrompts) {
            dbPrompt = await prisma.aiPrompt.findUnique({ where: { key: promptKey } });
        }

        if (dbPrompt && dbPrompt.isActive) {
            userPromptTemplate = dbPrompt.template;
            version = dbPrompt.version;
            systemInstruction = dbPrompt.description || '';
        } else {
            const defaultPrompt = DEFAULT_PROMPTS[promptKey];
            if (!defaultPrompt) {
                throw new Error(`Prompt configuration not found for key: ${promptKey}`);
            }
            systemInstruction = defaultPrompt.systemInstruction;
            userPromptTemplate = defaultPrompt.template;
            version = defaultPrompt.version;
        }

        // 2. Compile and sanitize
        const compiledUserPrompt = compilePrompt(userPromptTemplate, variables);
        const sanitizedContent = sanitizePrompt(compiledUserPrompt);

        // 3. Rate limit
        await getRateLimiter(providerName).waitIfLimitReached();

        // 4. Dispatch to provider
        const response = await provider.generate({
            prompt: sanitizedContent,
            systemInstruction,
            model,
            responseMimeType: 'application/json',
            temperature: options.temperature ?? 0.2,
            maxOutputTokens: options.maxOutputTokens,
            timeoutMs: options.timeoutMs || 30000,
        });

        const latencyMs = Date.now() - start;
        const estimatedCost = calculateCost(response.model, response.inputTokens, response.outputTokens);

        const usage: TokenUsage = {
            inputTokens: response.inputTokens,
            outputTokens: response.outputTokens,
            totalTokens: response.totalTokens,
            estimatedCost
        };

        // 5. Parse structured JSON
        let parsedData: T | undefined = undefined;
        try {
            parsedData = JSON.parse(response.text);
        } catch (jsonError) {
            console.error(`[AiService] Failed to parse JSON response from ${providerName}:`, response.text);
            throw new Error('La respuesta de la IA no pudo ser formateada como un objeto JSON estructurado.');
        }

        // 6. Audit log
        await logAiRequest({
            action: promptKey,
            model: response.model,
            provider: response.provider,
            promptKey,
            promptVersion: version,
            inputTokens: response.inputTokens,
            outputTokens: response.outputTokens,
            totalTokens: response.totalTokens,
            estimatedCost,
            latencyMs,
            userId: options.userId,
            userName: options.userName,
            userRole: options.userRole,
            entity: options.entity,
            entityId: options.entityId,
            success: true
        });

        return { success: true, data: parsedData, text: response.text, usage, latencyMs };

    } catch (err: any) {
        const latencyMs = Date.now() - start;
        console.error(`[AiService] Error in generateObject for ${promptKey}:`, err);

        await logAiRequest({
            action: promptKey,
            model,
            provider: providerName,
            promptKey,
            promptVersion: version,
            inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0,
            latencyMs,
            userId: options.userId, userName: options.userName, userRole: options.userRole,
            entity: options.entity, entityId: options.entityId,
            success: false,
            errorMessage: err.message || String(err)
        }).catch(dbErr => console.error('[AiService] Failed to log failure in DB:', dbErr));

        return { success: false, error: err.message || 'Error desconocido al invocar la IA.', latencyMs };
    }
}

// ─── analyzeImage ───────────────────────────────────────────────────────────────
// Multimodal: image + text prompt → structured JSON. Replaces analyzeImageContent().

export async function analyzeImage(
    base64Image: string,
    mimeType: string,
    promptKey: string,
    variables: Record<string, any>,
    options: AiRequestOptions = {}
): Promise<AiServiceResponse> {
    const start = Date.now();
    const { provider, model, providerName } = resolveRoute(promptKey, options.model);

    try {
        const defaultPrompt = DEFAULT_PROMPTS[promptKey];
        if (!defaultPrompt) {
            throw new Error(`Prompt configuration not found for key: ${promptKey}`);
        }

        const userPrompt = compilePrompt(defaultPrompt.template, variables);

        await getRateLimiter(providerName).waitIfLimitReached();

        const attachment: AIAttachment = {
            data: base64Image.replace(/^data:image\/\w+;base64,/, ""),
            mimeType
        };

        const response = await provider.generate({
            prompt: userPrompt,
            systemInstruction: defaultPrompt.systemInstruction,
            model,
            responseMimeType: 'application/json',
            temperature: options.temperature ?? 0.2,
            attachments: [attachment],
            timeoutMs: options.timeoutMs || 45000,
        });

        const latencyMs = Date.now() - start;
        const estimatedCost = calculateCost(response.model, response.inputTokens, response.outputTokens);

        const usage: TokenUsage = {
            inputTokens: response.inputTokens,
            outputTokens: response.outputTokens,
            totalTokens: response.totalTokens,
            estimatedCost
        };

        let parsedData = undefined;
        try {
            parsedData = JSON.parse(response.text);
        } catch {
            throw new Error('La respuesta del análisis de imagen no pudo formatearse en JSON.');
        }

        await logAiRequest({
            action: 'IMAGE_ANOMALY',
            model: response.model,
            provider: response.provider,
            promptKey,
            promptVersion: defaultPrompt.version,
            inputTokens: response.inputTokens,
            outputTokens: response.outputTokens,
            totalTokens: response.totalTokens,
            estimatedCost,
            latencyMs,
            userId: options.userId, userName: options.userName, userRole: options.userRole,
            entity: options.entity, entityId: options.entityId,
            success: true
        });

        return { success: true, data: parsedData, text: response.text, usage, latencyMs };

    } catch (err: any) {
        const latencyMs = Date.now() - start;
        console.error(`[AiService] Error in analyzeImage:`, err);

        await logAiRequest({
            action: 'IMAGE_ANOMALY',
            model,
            provider: providerName,
            promptKey,
            promptVersion: 1,
            inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0,
            latencyMs,
            userId: options.userId, userName: options.userName, userRole: options.userRole,
            entity: options.entity, entityId: options.entityId,
            success: false,
            errorMessage: err.message || String(err)
        }).catch(dbErr => console.error('[AiService] Failed to log image analysis error:', dbErr));

        return { success: false, error: err.message || 'Error al analizar la imagen.', latencyMs };
    }
}

// ─── performOCR ─────────────────────────────────────────────────────────────────
// Document/image → structured JSON extraction. Replaces analyzeDocumentOcr() and analyzeCertificateOcr().

export async function performOCR(
    base64Data: string,
    mimeType: string,
    promptKey: string,
    options: AiRequestOptions = {},
    overrides?: {
        responseSchema?: object;
        promptSuffix?: string;
    }
): Promise<AiServiceResponse> {
    const start = Date.now();
    const { provider, model, providerName } = resolveRoute(promptKey, options.model);

    try {
        const defaultPrompt = DEFAULT_PROMPTS[promptKey];
        if (!defaultPrompt) {
            throw new Error(`Prompt configuration not found for key: ${promptKey}`);
        }

        let userPrompt = defaultPrompt.template;
        if (overrides?.promptSuffix) {
            userPrompt += overrides.promptSuffix;
        }

        await getRateLimiter(providerName).waitIfLimitReached();

        const attachment: AIAttachment = {
            data: base64Data.replace(/^data:(application|image)\/\w+;base64,/, ""),
            mimeType
        };

        const response = await provider.generate({
            prompt: userPrompt,
            systemInstruction: defaultPrompt.systemInstruction,
            model,
            responseMimeType: 'application/json',
            responseSchema: overrides?.responseSchema,
            temperature: 0.1,
            attachments: [attachment],
            timeoutMs: options.timeoutMs || 45000,
        });

        const latencyMs = Date.now() - start;
        const estimatedCost = calculateCost(response.model, response.inputTokens, response.outputTokens);

        const usage: TokenUsage = {
            inputTokens: response.inputTokens,
            outputTokens: response.outputTokens,
            totalTokens: response.totalTokens,
            estimatedCost
        };

        let parsedData = undefined;
        try {
            parsedData = JSON.parse(response.text);
        } catch {
            throw new Error('La respuesta de extracción OCR no pudo formatearse en JSON.');
        }

        await logAiRequest({
            action: 'OCR',
            model: response.model,
            provider: response.provider,
            promptKey,
            promptVersion: defaultPrompt.version,
            inputTokens: response.inputTokens,
            outputTokens: response.outputTokens,
            totalTokens: response.totalTokens,
            estimatedCost,
            latencyMs,
            userId: options.userId, userName: options.userName, userRole: options.userRole,
            entity: options.entity, entityId: options.entityId,
            success: true
        });

        return { success: true, data: parsedData, text: response.text, usage, latencyMs };

    } catch (err: any) {
        const latencyMs = Date.now() - start;
        console.error(`[AiService] Error in performOCR (${promptKey}):`, err);

        await logAiRequest({
            action: 'OCR',
            model,
            provider: providerName,
            promptKey,
            promptVersion: 1,
            inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0,
            latencyMs,
            userId: options.userId, userName: options.userName, userRole: options.userRole,
            entity: options.entity, entityId: options.entityId,
            success: false,
            errorMessage: err.message || String(err)
        }).catch(dbErr => console.error('[AiService] Failed to log OCR failure:', dbErr));

        return { success: false, error: err.message || 'Error al analizar el documento.', latencyMs };
    }
}
