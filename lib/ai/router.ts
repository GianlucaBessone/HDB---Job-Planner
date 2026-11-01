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

const DEFAULT_PROVIDER = 'anthropic';
const DEFAULT_MODEL = 'claude-haiku-5-5';

/**
 * Route table: promptKey → provider + model + effort
 *
 * Currently all routes point to Claude Haiku 5.5. `effort` controls how much
 * the model thinks before answering: `low` for extraction and classification,
 * `medium` for drafting and conversation.
 *
 * To activate another provider:
 * 1. Install the target SDK (e.g. `npm install openai`)
 * 2. Create the provider in `providers/openai.ts`
 * 3. Register it in PROVIDERS below
 * 4. Change the entry here (e.g. ISO_DOC_GEN → { provider: 'openai', model: 'gpt-4o' })
 */
const ROUTE_TABLE: Record<string, RouteConfig> = {
    // TEXT_GENERATION
    'ISO_DOC_GEN':          { provider: 'anthropic', model: 'claude-haiku-5-5', effort: 'medium' },
    'GENERATE_OBS':         { provider: 'anthropic', model: 'claude-haiku-5-5', effort: 'low' },
    'SUGGESTION_ANALYSIS':  { provider: 'anthropic', model: 'claude-haiku-5-5', effort: 'medium' },
    'TICKET_TRIAGE':        { provider: 'anthropic', model: 'claude-haiku-5-5', effort: 'low' },
    'TICKET_RESOLUTION_RESPONSE': { provider: 'anthropic', model: 'claude-haiku-5-5', effort: 'low' },
    'CHECKLIST_GEN':        { provider: 'anthropic', model: 'claude-haiku-5-5', effort: 'medium' },
    'CV_PARSE':             { provider: 'anthropic', model: 'claude-haiku-5-5', effort: 'medium' },

    // VISION
    'IMAGE_ANALYSIS':       { provider: 'anthropic', model: 'claude-haiku-5-5', effort: 'low' },
    'CERTIFICATE_ANALYSIS': { provider: 'anthropic', model: 'claude-haiku-5-5', effort: 'low' },

    // OCR
    'OCR_ANALYSIS':         { provider: 'anthropic', model: 'claude-haiku-5-5', effort: 'low' },
    'INVOICE_OCR':          { provider: 'anthropic', model: 'claude-haiku-5-5', effort: 'low' },

    // RAG_SEARCH
    'TECH_ASSISTANT':       { provider: 'anthropic', model: 'claude-haiku-5-5', effort: 'medium' },
    'SEMANTIC_SEARCH':      { provider: 'anthropic', model: 'claude-haiku-5-5', effort: 'low' },
    'RCA_CHAT':             { provider: 'anthropic', model: 'claude-haiku-5-5', effort: 'medium' },

    // TRAINING
    'TRAINING_GEN':         { provider: 'anthropic', model: 'claude-haiku-5-5', effort: 'medium' },
};

// Provider registry (add new providers here when activated)
const PROVIDERS: Record<string, AIProvider> = {
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
