/**
 * Gemini Provider — Adapts the @google/genai SDK to the AIProvider interface.
 * 
 * This is a direct extraction of the SDK-specific logic from the old gemini.ts,
 * wrapped in the provider abstraction. No prompt logic, no auditing, no rate limiting here.
 */

import { GoogleGenAI } from '@google/genai';
import { BaseProvider, AICapability, AIProviderRequest, AIProviderResponse } from './base';

const apiKey = process.env.GEMINI_API_KEY || 'DUMMY_API_KEY_FOR_BUILD';
const ai = new GoogleGenAI({ apiKey });

function checkApiKey() {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not defined in environment variables. Please check your environment configuration or .env file.');
    }
}

export class GeminiProvider extends BaseProvider {
    readonly name = 'gemini';
    readonly supportedCapabilities: AICapability[] = [
        'TEXT_GENERATION',
        'VISION',
        'OCR',
        'RAG_SEARCH',
        'TRAINING',
        'CHAT',
    ];

    async generate(request: AIProviderRequest): Promise<AIProviderResponse> {
        checkApiKey();

        const timeoutMs = request.timeoutMs || 30000;
        const retries = request.attachments?.length ? 2 : 3;

        // Build contents: text-only or multimodal (attachments + text)
        let contents: any;
        if (request.attachments && request.attachments.length > 0) {
            const parts: any[] = request.attachments.map(att => ({
                inlineData: {
                    data: att.data.replace(/^data:(application|image)\/\w+;base64,/, ""),
                    mimeType: att.mimeType
                }
            }));
            parts.push({ text: request.prompt });
            contents = parts;
        } else {
            contents = request.prompt;
        }

        // Build config
        const config: any = {
            systemInstruction: request.systemInstruction,
            responseMimeType: request.responseMimeType || 'application/json',
            temperature: request.temperature ?? 0.2,
            maxOutputTokens: request.maxOutputTokens,
        };

        if (request.responseSchema) {
            config.responseSchema = request.responseSchema;
        }

        const apiCall = () => ai.models.generateContent({
            model: request.model,
            contents,
            config
        });

        const response = await this.withRetries(
            () => this.withTimeout(apiCall(), timeoutMs),
            retries,
            1000
        );

        return {
            text: response.text || '',
            inputTokens: response.usageMetadata?.promptTokenCount || 0,
            outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
            totalTokens: response.usageMetadata?.totalTokenCount || 0,
            model: request.model,
            provider: this.name,
        };
    }
}
