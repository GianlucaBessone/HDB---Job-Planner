/**
 * AI Provider Abstraction Layer
 * 
 * Defines the contract that all AI providers must implement.
 * This enables multi-provider support without changing business logic.
 */

export type AICapability =
    | 'TEXT_GENERATION'
    | 'VISION'
    | 'OCR'
    | 'RAG_SEARCH'
    | 'TRAINING'
    | 'EMBEDDING'
    | 'CHAT';

export interface AIAttachment {
    data: string;       // base64 content (without data URI prefix)
    mimeType: string;   // e.g. 'image/jpeg', 'application/pdf'
}

export interface AIProviderRequest {
    prompt: string;
    systemInstruction?: string;
    model: string;
    temperature?: number;
    maxOutputTokens?: number;
    responseMimeType?: string;
    responseSchema?: object;
    attachments?: AIAttachment[];
    timeoutMs?: number;
}

export interface AIProviderResponse {
    text: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    model: string;
    provider: string;
}

/**
 * Contract for all AI providers (Gemini, OpenAI, Anthropic, etc.)
 */
export interface AIProvider {
    readonly name: string;
    readonly supportedCapabilities: AICapability[];

    /**
     * Execute a generation request against this provider's API.
     * Implementations handle SDK-specific details internally.
     */
    generate(request: AIProviderRequest): Promise<AIProviderResponse>;

    /**
     * Check if this provider supports a given capability.
     */
    supportsCapability(capability: AICapability): boolean;
}

/**
 * Base class with shared retry/timeout logic for all providers.
 */
export abstract class BaseProvider implements AIProvider {
    abstract readonly name: string;
    abstract readonly supportedCapabilities: AICapability[];

    abstract generate(request: AIProviderRequest): Promise<AIProviderResponse>;

    supportsCapability(capability: AICapability): boolean {
        return this.supportedCapabilities.includes(capability);
    }

    /**
     * Run a promise with a timeout
     */
    protected async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
        let timeoutId: NodeJS.Timeout;
        const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
                reject(new Error(`AI Request timed out after ${timeoutMs}ms`));
            }, timeoutMs);
        });
        return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
    }

    /**
     * Retry handler with exponential backoff for transient errors
     */
    protected async withRetries<T>(
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

            console.warn(`[${this.name}] Request failed: "${error.message}". Retrying in ${delayMs}ms... (${retries} retries left)`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            return this.withRetries(fn, retries - 1, delayMs * 2);
        }
    }
}
