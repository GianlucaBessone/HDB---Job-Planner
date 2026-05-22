import { GoogleGenAI } from '@google/genai';
import { prisma } from '../prisma';
import { DEFAULT_PROMPTS, compilePrompt } from './prompts';
import { AiRequestOptions, AiServiceResponse, TokenUsage } from './types';

// Initialize GenAI client
const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyA485ZmC5cOxmBuQz8Lwsjj061RKLFtPxM';
const ai = new GoogleGenAI({ apiKey });

// Cost constants for gemini-2.5-flash
const COST_PER_1M_INPUT_TOKENS = 0.075; // USD
const COST_PER_1M_OUTPUT_TOKENS = 0.30;  // USD

// In-memory rate limiter (free tier defaults: 15 RPM)
class SimpleRateLimiter {
    private timestamps: number[] = [];
    private maxRpm: number = 15;

    async waitIfLimitReached() {
        const now = Date.now();
        // Clear requests older than 1 minute (60000ms)
        this.timestamps = this.timestamps.filter(ts => now - ts < 60000);

        if (this.timestamps.length >= this.maxRpm) {
            const oldest = this.timestamps[0];
            const sleepMs = 60000 - (now - oldest) + 100; // adding safety buffer
            console.log(`[RateLimiter] Rate limit reached (${this.maxRpm} RPM). Delaying request by ${sleepMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, sleepMs));
            return this.waitIfLimitReached(); // Re-evaluate recursively
        }
        this.timestamps.push(Date.now());
    }
}

const rateLimiter = new SimpleRateLimiter();

/**
 * Helper to run a promise with a timeout
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(`AI Request timed out after ${timeoutMs}ms`));
        }, timeoutMs);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

/**
 * Secure retry handler for transient errors with exponential backoff
 */
async function withRetries<T>(
    fn: () => Promise<T>,
    retries = 3,
    delayMs = 1000
): Promise<T> {
    try {
        return await fn();
    } catch (error: any) {
        const isRateLimit = error?.status === 429 || error?.message?.includes('429');
        const isServerErr = error?.status >= 500 || error?.message?.includes('500') || error?.message?.includes('503');
        
        if (retries <= 0 || (!isRateLimit && !isServerErr)) {
            throw error;
        }

        console.warn(`[AiService] Request failed: "${error.message}". Retrying in ${delayMs}ms... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return withRetries(fn, retries - 1, delayMs * 2);
    }
}

/**
 * Estimate token cost in USD
 */
function calculateCost(inputTokens: number, outputTokens: number): number {
    const inputCost = (inputTokens / 1_000_000) * COST_PER_1M_INPUT_TOKENS;
    const outputCost = (outputTokens / 1_000_000) * COST_PER_1M_OUTPUT_TOKENS;
    return inputCost + outputCost;
}

/**
 * Centralized AI generation handler
 */
export async function generateContent<T = any>(
    promptKey: string,
    variables: Record<string, any>,
    options: AiRequestOptions = {}
): Promise<AiServiceResponse<T>> {
    const start = Date.now();
    const modelName = options.model || 'gemini-2.5-flash';
    const timeoutMs = options.timeoutMs || 30000;
    
    let dbPrompt = null;
    let systemInstruction = '';
    let userPromptTemplate = '';
    let version = 1;

    try {
        // Resolve prompts: either database prompt or default local
        if (options.useDatabasePrompts) {
            dbPrompt = await prisma.aiPrompt.findUnique({ where: { key: promptKey } });
        }

        if (dbPrompt && dbPrompt.isActive) {
            userPromptTemplate = dbPrompt.template;
            version = dbPrompt.version;
            systemInstruction = dbPrompt.description || ''; // default system instruction stored in desc for ease
        } else {
            const defaultPrompt = DEFAULT_PROMPTS[promptKey];
            if (!defaultPrompt) {
                throw new Error(`Prompt configuration not found for key: ${promptKey}`);
            }
            systemInstruction = defaultPrompt.systemInstruction;
            userPromptTemplate = defaultPrompt.template;
            version = defaultPrompt.version;
        }

        // Apply rate limit before proceeding
        await rateLimiter.waitIfLimitReached();

        // Compile prompt with variables
        const compiledUserPrompt = compilePrompt(userPromptTemplate, variables);

        // Sanitize input to protect against basic prompt injection
        const sanitizedContent = sanitizePrompt(compiledUserPrompt);

        // Invoke Gemini using official SDK inside Retry & Timeout wrappers
        const apiCall = () => ai.models.generateContent({
            model: modelName,
            contents: sanitizedContent,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: 'application/json',
                temperature: options.temperature ?? 0.2,
                maxOutputTokens: options.maxOutputTokens,
            }
        });

        const response = await withRetries(
            () => withTimeout(apiCall(), timeoutMs),
            3,
            1000
        );

        const latencyMs = Date.now() - start;
        const textResult = response.text || '';
        
        // Parse metadata and tokens
        const inputTokens = response.usageMetadata?.promptTokenCount || 0;
        const outputTokens = response.usageMetadata?.candidatesTokenCount || 0;
        const totalTokens = response.usageMetadata?.totalTokenCount || 0;
        const estimatedCost = calculateCost(inputTokens, outputTokens);
        
        const usage: TokenUsage = {
            inputTokens,
            outputTokens,
            totalTokens,
            estimatedCost
        };

        // Parse structured JSON response
        let parsedData: T | undefined = undefined;
        try {
            parsedData = JSON.parse(textResult);
        } catch (jsonError) {
            console.error(`[AiService] Failed to parse JSON response from model:`, textResult);
            throw new Error('La respuesta de la IA no pudo ser formateada como un objeto JSON estructurado.');
        }

        // Log request in the database for auditing and token control
        await logAiRequest({
            action: promptKey,
            model: modelName,
            promptKey,
            promptVersion: version,
            inputTokens,
            outputTokens,
            totalTokens,
            estimatedCost,
            latencyMs,
            userId: options.userId,
            userName: options.userName,
            userRole: options.userRole,
            entity: options.entity,
            entityId: options.entityId,
            success: true
        });

        return {
            success: true,
            data: parsedData,
            text: textResult,
            usage,
            latencyMs
        };

    } catch (err: any) {
        const latencyMs = Date.now() - start;
        console.error(`[AiService] Error generating content for action ${promptKey}:`, err);

        // Log failed request
        await logAiRequest({
            action: promptKey,
            model: modelName,
            promptKey,
            promptVersion: version,
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            estimatedCost: 0,
            latencyMs,
            userId: options.userId,
            userName: options.userName,
            userRole: options.userRole,
            entity: options.entity,
            entityId: options.entityId,
            success: false,
            errorMessage: err.message || String(err)
        }).catch(dbErr => console.error('[AiService] Failed to log failure in DB:', dbErr));

        return {
            success: false,
            error: err.message || 'Error desconocido al invocar la IA de Google Gemini.',
            latencyMs
        };
    }
}

/**
 * Service to analyze local/remote images (Multimodal Support)
 */
export async function analyzeImageContent(
    base64Image: string, // Base64 string of the image without headers (or standard format)
    mimeType: string,
    tipoInstalacion: string,
    contexto?: string,
    options: AiRequestOptions = {}
): Promise<AiServiceResponse> {
    const start = Date.now();
    const modelName = options.model || 'gemini-2.5-flash';
    const timeoutMs = options.timeoutMs || 45000;
    const promptKey = 'IMAGE_ANALYSIS';

    try {
        await rateLimiter.waitIfLimitReached();

        const defaultPrompt = DEFAULT_PROMPTS[promptKey];
        const userPrompt = compilePrompt(defaultPrompt.template, {
            tipoInstalacion,
            contexto: contexto || 'Inspección de campo'
        });

        const imagePart = {
            inlineData: {
                data: base64Image.replace(/^data:image\/\w+;base64,/, ""),
                mimeType: mimeType
            }
        };

        const apiCall = () => ai.models.generateContent({
            model: modelName,
            contents: [
                imagePart,
                { text: userPrompt }
            ],
            config: {
                systemInstruction: defaultPrompt.systemInstruction,
                responseMimeType: 'application/json',
                temperature: options.temperature ?? 0.2
            }
        });

        const response = await withRetries(
            () => withTimeout(apiCall(), timeoutMs),
            2,
            1000
        );

        const latencyMs = Date.now() - start;
        const textResult = response.text || '';
        
        const inputTokens = response.usageMetadata?.promptTokenCount || 0;
        const outputTokens = response.usageMetadata?.candidatesTokenCount || 0;
        const totalTokens = response.usageMetadata?.totalTokenCount || 0;
        const estimatedCost = calculateCost(inputTokens, outputTokens);

        const usage: TokenUsage = {
            inputTokens,
            outputTokens,
            totalTokens,
            estimatedCost
        };

        let parsedData = undefined;
        try {
            parsedData = JSON.parse(textResult);
        } catch {
            throw new Error('La respuesta del análisis de imagen no pudo formatearse en JSON.');
        }

        await logAiRequest({
            action: 'IMAGE_ANOMALY',
            model: modelName,
            promptKey,
            promptVersion: defaultPrompt.version,
            inputTokens,
            outputTokens,
            totalTokens,
            estimatedCost,
            latencyMs,
            userId: options.userId,
            userName: options.userName,
            userRole: options.userRole,
            entity: options.entity,
            entityId: options.entityId,
            success: true
        });

        return {
            success: true,
            data: parsedData,
            text: textResult,
            usage,
            latencyMs
        };

    } catch (err: any) {
        const latencyMs = Date.now() - start;
        console.error(`[AiService] Error in image analysis:`, err);

        await logAiRequest({
            action: 'IMAGE_ANOMALY',
            model: modelName,
            promptKey,
            promptVersion: 1,
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            estimatedCost: 0,
            latencyMs,
            userId: options.userId,
            userName: options.userName,
            userRole: options.userRole,
            entity: options.entity,
            entityId: options.entityId,
            success: false,
            errorMessage: err.message || String(err)
        }).catch(dbErr => console.error('[AiService] Failed to log image analysis error:', dbErr));

        return {
            success: false,
            error: err.message || 'Error al analizar la imagen.',
            latencyMs
        };
    }
}

/**
 * Service to analyze documents via OCR (e.g. PDFs, certificates, image receipts)
 */
export async function analyzeDocumentOcr(
    base64Data: string,
    mimeType: string,
    options: AiRequestOptions = {}
): Promise<AiServiceResponse> {
    const start = Date.now();
    const modelName = options.model || 'gemini-2.5-flash';
    const timeoutMs = options.timeoutMs || 45000;
    const promptKey = 'OCR_ANALYSIS';

    try {
        await rateLimiter.waitIfLimitReached();

        const defaultPrompt = DEFAULT_PROMPTS[promptKey];
        const userPrompt = defaultPrompt.template;

        const docPart = {
            inlineData: {
                data: base64Data.replace(/^data:(application|image)\/\w+;base64,/, ""),
                mimeType: mimeType
            }
        };

        const apiCall = () => ai.models.generateContent({
            model: modelName,
            contents: [
                docPart,
                { text: userPrompt }
            ],
            config: {
                systemInstruction: defaultPrompt.systemInstruction,
                responseMimeType: 'application/json',
                temperature: 0.1
            }
        });

        const response = await withRetries(
            () => withTimeout(apiCall(), timeoutMs),
            2,
            1000
        );

        const latencyMs = Date.now() - start;
        const textResult = response.text || '';
        
        const inputTokens = response.usageMetadata?.promptTokenCount || 0;
        const outputTokens = response.usageMetadata?.candidatesTokenCount || 0;
        const totalTokens = response.usageMetadata?.totalTokenCount || 0;
        const estimatedCost = calculateCost(inputTokens, outputTokens);

        const usage: TokenUsage = {
            inputTokens,
            outputTokens,
            totalTokens,
            estimatedCost
        };

        let parsedData = undefined;
        try {
            parsedData = JSON.parse(textResult);
        } catch {
            throw new Error('La respuesta de extracción OCR no pudo formatearse en JSON.');
        }

        await logAiRequest({
            action: 'OCR',
            model: modelName,
            promptKey,
            promptVersion: defaultPrompt.version,
            inputTokens,
            outputTokens,
            totalTokens,
            estimatedCost,
            latencyMs,
            userId: options.userId,
            userName: options.userName,
            userRole: options.userRole,
            entity: options.entity,
            entityId: options.entityId,
            success: true
        });

        return {
            success: true,
            data: parsedData,
            text: textResult,
            usage,
            latencyMs
        };

    } catch (err: any) {
        const latencyMs = Date.now() - start;
        console.error(`[AiService] Error in document OCR analysis:`, err);

        await logAiRequest({
            action: 'OCR',
            model: modelName,
            promptKey,
            promptVersion: 1,
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            estimatedCost: 0,
            latencyMs,
            userId: options.userId,
            userName: options.userName,
            userRole: options.userRole,
            entity: options.entity,
            entityId: options.entityId,
            success: false,
            errorMessage: err.message || String(err)
        }).catch(dbErr => console.error('[AiService] Failed to log OCR failure:', dbErr));

        return {
            success: false,
            error: err.message || 'Error al analizar el documento.',
            latencyMs
        };
    }
}

/**
 * Service to analyze certificates via OCR and extract course info
 */
export async function analyzeCertificateOcr(
    base64Data: string,
    mimeType: string,
    options: AiRequestOptions = {}
): Promise<AiServiceResponse> {
    const start = Date.now();
    const modelName = options.model || 'gemini-2.5-flash';
    const timeoutMs = options.timeoutMs || 45000;
    const promptKey = 'CERTIFICATE_ANALYSIS';

    try {
        await rateLimiter.waitIfLimitReached();

        const defaultPrompt = DEFAULT_PROMPTS[promptKey];
        const userPrompt = defaultPrompt.template;

        const docPart = {
            inlineData: {
                data: base64Data.replace(/^data:(application|image)\/\w+;base64,/, ""),
                mimeType: mimeType
            }
        };

        const apiCall = () => ai.models.generateContent({
            model: modelName,
            contents: [
                docPart,
                { text: userPrompt }
            ],
            config: {
                systemInstruction: defaultPrompt.systemInstruction,
                responseMimeType: 'application/json',
                temperature: 0.1
            }
        });

        const response = await withRetries(
            () => withTimeout(apiCall(), timeoutMs),
            2,
            1000
        );

        const latencyMs = Date.now() - start;
        const textResult = response.text || '';
        
        const inputTokens = response.usageMetadata?.promptTokenCount || 0;
        const outputTokens = response.usageMetadata?.candidatesTokenCount || 0;
        const totalTokens = response.usageMetadata?.totalTokenCount || 0;
        const estimatedCost = calculateCost(inputTokens, outputTokens);

        const usage: TokenUsage = {
            inputTokens,
            outputTokens,
            totalTokens,
            estimatedCost
        };

        let parsedData = undefined;
        try {
            parsedData = JSON.parse(textResult);
        } catch {
            throw new Error('La respuesta de extracción de certificado no pudo formatearse en JSON.');
        }

        await logAiRequest({
            action: 'OCR',
            model: modelName,
            promptKey,
            promptVersion: defaultPrompt.version,
            inputTokens,
            outputTokens,
            totalTokens,
            estimatedCost,
            latencyMs,
            userId: options.userId,
            userName: options.userName,
            userRole: options.userRole,
            entity: options.entity,
            entityId: options.entityId,
            success: true
        });

        return {
            success: true,
            data: parsedData,
            text: textResult,
            usage,
            latencyMs
        };

    } catch (err: any) {
        const latencyMs = Date.now() - start;
        console.error(`[AiService] Error in certificate OCR analysis:`, err);

        await logAiRequest({
            action: 'OCR',
            model: modelName,
            promptKey,
            promptVersion: 1,
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            estimatedCost: 0,
            latencyMs,
            userId: options.userId,
            userName: options.userName,
            userRole: options.userRole,
            entity: options.entity,
            entityId: options.entityId,
            success: false,
            errorMessage: err.message || String(err)
        }).catch(dbErr => console.error('[AiService] Failed to log certificate OCR failure:', dbErr));

        return {
            success: false,
            error: err.message || 'Error al analizar el certificado.',
            latencyMs
        };
    }
}

/**
 * Basic prompt injection protection
 */
function sanitizePrompt(prompt: string): string {
    // Avoid common prompt hijacking expressions
    const hijackKeywords = [
        "ignore previous instructions", 
        "ignora las instrucciones anteriores",
        "system prompt bypass", 
        "jailbreak",
        "new instructions:",
        "instrucciones del sistema:"
    ];
    
    let sanitized = prompt;
    for (const keyword of hijackKeywords) {
        const reg = new RegExp(keyword, 'gi');
        sanitized = sanitized.replace(reg, "[REDACTED_INJECTION_RISK]");
    }
    return sanitized;
}

/**
 * Log AI Request metadata to DB
 */
async function logAiRequest(params: {
    action: string;
    model: string;
    promptKey?: string;
    promptVersion?: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCost: number;
    latencyMs: number;
    userId?: string;
    userName?: string;
    userRole?: string;
    entity?: string;
    entityId?: string;
    success: boolean;
    errorMessage?: string;
}) {
    try {
        let actualPromptKey = params.promptKey;
        if (actualPromptKey) {
            const promptExists = await prisma.aiPrompt.findUnique({
                where: { key: actualPromptKey },
                select: { key: true }
            });
            if (!promptExists) {
                actualPromptKey = undefined;
            }
        }

        await prisma.aiRequestLog.create({
            data: {
                action: params.action,
                model: params.model,
                promptKey: actualPromptKey || null,
                promptVersion: params.promptVersion,
                inputTokens: params.inputTokens,
                outputTokens: params.outputTokens,
                totalTokens: params.totalTokens,
                estimatedCost: params.estimatedCost,
                latencyMs: params.latencyMs,
                userId: params.userId,
                userName: params.userName,
                userRole: params.userRole,
                entity: params.entity,
                entityId: params.entityId,
                success: params.success,
                errorMessage: params.errorMessage
            }
        });
    } catch (e) {
        console.error('[AiService] Failed to insert log in DB:', e);
    }
}
