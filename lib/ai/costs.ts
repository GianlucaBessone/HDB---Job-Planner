/**
 * Cost Calculator — Multi-model pricing for AI usage tracking.
 * 
 * Replaces the hardcoded constants from the old gemini.ts.
 * Pricing is per 1M tokens in USD.
 */

const PRICING: Record<string, { input: number; output: number }> = {
    // Google Gemini
    'gemini-2.5-flash':     { input: 0.075,  output: 0.30 },
    'gemini-2.5-pro':       { input: 1.25,   output: 10.00 },
    'gemini-2.0-flash':     { input: 0.10,   output: 0.40 },

    // OpenAI (for future use)
    'gpt-4o':               { input: 2.50,   output: 10.00 },
    'gpt-4o-mini':          { input: 0.15,   output: 0.60 },
    'gpt-4.1':              { input: 2.00,   output: 8.00 },
    'gpt-4.1-mini':         { input: 0.40,   output: 1.60 },

    // Anthropic (for future use)
    'claude-sonnet-4':      { input: 3.00,   output: 15.00 },
    'claude-haiku-3.5':     { input: 0.80,   output: 4.00 },
};

// Fallback pricing when model is unknown
const DEFAULT_PRICING = { input: 1.00, output: 4.00 };

/**
 * Calculate estimated cost in USD for a given model and token usage.
 */
export function calculateCost(
    model: string,
    inputTokens: number,
    outputTokens: number
): number {
    const pricing = PRICING[model] || DEFAULT_PRICING;
    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    return inputCost + outputCost;
}
