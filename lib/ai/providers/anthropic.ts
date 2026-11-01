/**
 * Anthropic Provider — Adapts the @anthropic-ai/sdk Messages API to the AIProvider interface.
 *
 * No prompt logic, no auditing, no rate limiting here.
 * Base URL can be overridden with ANTHROPIC_BASE_URL (read by the SDK).
 */

import Anthropic from '@anthropic-ai/sdk';
import { BaseProvider, AICapability, AIProviderRequest, AIProviderResponse } from './base';

// maxRetries: 0 — retries are handled by BaseProvider.withRetries
const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || 'DUMMY_API_KEY_FOR_BUILD',
    maxRetries: 0,
});

const DEFAULT_MAX_TOKENS = 16000;

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
type ImageMimeType = typeof IMAGE_MIME_TYPES[number];

function checkApiKey() {
    if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY is not defined in environment variables. Please check your environment configuration or .env file.');
    }
}

/**
 * Converts an OpenAPI-style schema (the format used by Gemini: uppercase types,
 * `nullable: true`) into the JSON Schema subset accepted by structured outputs.
 * Every object gets `additionalProperties: false`, which the API requires.
 */
export function toJsonSchema(schema: any): any {
    if (!schema || typeof schema !== 'object') return schema;

    const { type, nullable, properties, items, ...rest } = schema;
    const out: any = { ...rest };

    if (type) out.type = String(type).toLowerCase();
    if (properties) {
        out.properties = Object.fromEntries(
            Object.entries(properties).map(([key, value]) => [key, toJsonSchema(value)])
        );
    }
    if (items) out.items = toJsonSchema(items);
    if (out.type === 'object') out.additionalProperties = false;

    if (nullable) {
        const { description, ...nonNull } = out;
        return {
            ...(description ? { description } : {}),
            anyOf: [nonNull, { type: 'null' }],
        };
    }
    return out;
}

/**
 * Without a schema the model answers in free text; strip Markdown fences and
 * any text around the JSON value so callers can JSON.parse() it.
 */
function extractJson(text: string): string {
    const trimmed = text.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (fenced) return fenced[1];

    const start = trimmed.search(/[[{]/);
    const end = Math.max(trimmed.lastIndexOf('}'), trimmed.lastIndexOf(']'));
    if (start !== -1 && end > start) return trimmed.slice(start, end + 1);
    return trimmed;
}

function buildAttachmentBlock(data: string, mimeType: string): Anthropic.ContentBlockParam {
    const base64 = data.replace(/^data:[\w/+.-]+;base64,/, '');

    if (mimeType === 'application/pdf') {
        return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } };
    }
    if ((IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)) {
        return { type: 'image', source: { type: 'base64', media_type: mimeType as ImageMimeType, data: base64 } };
    }
    throw new Error(`Tipo de archivo no soportado por la IA: ${mimeType}. Usá PDF, JPG, PNG, GIF o WEBP.`);
}

export class AnthropicProvider extends BaseProvider {
    readonly name = 'anthropic';
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
        const wantsJson = (request.responseMimeType || 'application/json') === 'application/json';

        // Attachments go before the text prompt
        const content: Anthropic.ContentBlockParam[] = [
            ...(request.attachments || []).map(att => buildAttachmentBlock(att.data, att.mimeType)),
            { type: 'text', text: request.prompt },
        ];

        let system = request.systemInstruction || '';
        if (wantsJson && !request.responseSchema) {
            system += '\n\nRespondé únicamente con un objeto JSON válido, sin bloques de código Markdown ni texto adicional.';
        }

        const outputConfig: Anthropic.OutputConfig = {};
        if (request.effort) outputConfig.effort = request.effort;
        if (wantsJson && request.responseSchema) {
            outputConfig.format = { type: 'json_schema', schema: toJsonSchema(request.responseSchema) };
        }

        // `temperature` is intentionally not sent: current Claude models only accept the default.
        const apiCall = () => client.messages.create(
            {
                model: request.model,
                max_tokens: request.maxOutputTokens || DEFAULT_MAX_TOKENS,
                system: system.trim() || undefined,
                messages: [{ role: 'user', content }],
                output_config: Object.keys(outputConfig).length ? outputConfig : undefined,
            },
            { timeout: timeoutMs }
        );

        const response = await this.withRetries(apiCall, retries, 1000);

        if (response.stop_reason === 'refusal') {
            throw new Error('La IA rechazó procesar esta solicitud.');
        }
        if (response.stop_reason === 'max_tokens') {
            throw new Error('La respuesta de la IA quedó incompleta: se alcanzó el límite de tokens de salida.');
        }

        const text = response.content
            .flatMap(block => (block.type === 'text' ? [block.text] : []))
            .join('');

        const inputTokens = response.usage.input_tokens
            + (response.usage.cache_creation_input_tokens || 0)
            + (response.usage.cache_read_input_tokens || 0);
        const outputTokens = response.usage.output_tokens;

        return {
            text: wantsJson ? extractJson(text) : text,
            inputTokens,
            outputTokens,
            totalTokens: inputTokens + outputTokens,
            model: request.model,
            provider: this.name,
        };
    }
}
