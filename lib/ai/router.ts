/**
 * Model Router — Maps use cases to providers and models.
 *
 * This is the single point of configuration that determines which
 * AI provider and model handles each use case. Business logic never
 * needs to know which provider is being used.
 *
 * To change a provider for a use case, edit the ROUTE_TABLE below.
 * No other code changes required.
 */

import { AIProvider, AIEffort } from './providers/base';
import { GeminiProvider } from './providers/gemini';
import { AnthropicProvider } from './providers/anthropic';

export interface RouteConfig {
    provider: string;
    model: string;
    effort?: AIEffort;
    fallback?: {
        provider: string;
        model: string;
    };
}

const DEFAULT_PROVIDER = 'gemini';
const DEFAULT_MODEL = 'gemini-2.5-flash';

/**
 * Route table: promptKey → provider + model + effort
 *
 * Currently all routes point to Gemini 2.5 Flash (GEMINI_API_KEY).
 *
 * Claude stays registered as an alternative provider (needs ANTHROPIC_API_KEY).
 * To move a use case to Claude, change its entry to
 * { provider: 'anthropic', model: 'claude-haiku-5-5', effort: 'low' | 'medium' }.
 * `effort` only applies to Claude; Gemini ignores it.
 *
 * To activate another provider:
 * 1. Install the target SDK (e.g. `npm install openai`)
 * 2. Create the provider in `providers/openai.ts`
 * 3. Register it in PROVIDERS below
 * 4. Change the entry here (e.g. ISO_DOC_GEN → { provider: 'openai', model: 'gpt-4o' })
 */
const ROUTE_TABLE: Record<string, RouteConfig> = {
    // TEXT_GENERATION
    'ISO_DOC_GEN':          { provider: 'gemini', model: 'gemini-2.5-flash' },
    'GENERATE_OBS':         { provider: 'gemini', model: 'gemini-2.5-flash' },
    'SUGGESTION_ANALYSIS':  { provider: 'gemini', model: 'gemini-2.5-flash' },
    'TICKET_TRIAGE':        { provider: 'gemini', model: 'gemini-2.5-flash' },
    'TICKET_RESOLUTION_RESPONSE': { provider: 'gemini', model: 'gemini-2.5-flash' },
    'CHECKLIST_GEN':        { provider: 'gemini', model: 'gemini-2.5-flash' },
    'CV_PARSE':             { provider: 'gemini', model: 'gemini-2.5-flash' },

    // VISION
    'IMAGE_ANALYSIS':       { provider: 'gemini', model: 'gemini-2.5-flash' },
    'CERTIFICATE_ANALYSIS': { provider: 'gemini', model: 'gemini-2.5-flash' },

    // OCR
    'OCR_ANALYSIS':         { provider: 'gemini', model: 'gemini-2.5-flash' },
    'INVOICE_OCR':          { provider: 'gemini', model: 'gemini-2.5-flash' },

    // RAG_SEARCH
    'TECH_ASSISTANT':       { provider: 'gemini', model: 'gemini-2.5-flash' },
    'SEMANTIC_SEARCH':      { provider: 'gemini', model: 'gemini-2.5-flash' },
    'RCA_CHAT':             { provider: 'gemini', model: 'gemini-2.5-flash' },

    // TRAINING
    'TRAINING_GEN':         { provider: 'gemini', model: 'gemini-2.5-flash' },
};

// Provider registry (add new providers here when activated)
const PROVIDERS: Record<string, AIProvider> = {
    gemini: new GeminiProvider(),
    anthropic: new AnthropicProvider(),
};

/**
 * Resolve which provider and model to use for a given prompt key.
 */
export function resolveRoute(promptKey: string, modelOverride?: string): {
    provider: AIProvider;
    model: string;
    providerName: string;
    effort?: AIEffort;
} {
    const route = ROUTE_TABLE[promptKey];

    if (!route) {
        console.warn(`[ModelRouter] No route configured for key "${promptKey}". Falling back to ${DEFAULT_PROVIDER}/${DEFAULT_MODEL}.`);
        return {
            provider: PROVIDERS[DEFAULT_PROVIDER],
            model: modelOverride || DEFAULT_MODEL,
            providerName: DEFAULT_PROVIDER,
        };
    }

    const providerName = route.provider;
    const provider = PROVIDERS[providerName];

    if (!provider) {
        // Provider not yet implemented — fallback
        if (route.fallback) {
            const fallbackProvider = PROVIDERS[route.fallback.provider];
            if (fallbackProvider) {
                console.warn(`[ModelRouter] Provider "${providerName}" not available. Using fallback: ${route.fallback.provider}/${route.fallback.model}`);
                return {
                    provider: fallbackProvider,
                    model: route.fallback.model,
                    providerName: route.fallback.provider,
                };
            }
        }
        throw new Error(`[ModelRouter] Provider "${providerName}" is not registered and no fallback is configured for key "${promptKey}".`);
    }

    return {
        provider,
        model: modelOverride || route.model,
        providerName,
        effort: route.effort,
    };
}

/**
 * Get the full route table for admin/audit purposes.
 */
export function getRouteTable(): Record<string, RouteConfig> {
    return { ...ROUTE_TABLE };
}
