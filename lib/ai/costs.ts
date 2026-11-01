/**
 * Cost Calculator — Multi-model pricing for AI usage tracking.
 * 
 * Pricing is per 1M tokens in USD.
 */

const PRICING: Record<string, { input: number; output: number }> = {
    // Anthropic Claude (Haiku 5.5: prompts up to 100K tokens; longer ones cost $0.50 / $2.50)
    'claude-haiku-5-5':     { input: 0.10,   output: 0.50 },
    'claude-sonnet-5-5':    { input: 2.00,   output: 10.00 },
    'claude-opus-5-5':      { input: 4.00,   output: 20.00 },

    // Google Gemini (historical audit records)
    'gemini-2.5-flash':     { input: 0.075,  output: 0.30 },
    'gemini-2.5-pro':       { input: 1.25,   output: 10.00 },
    'gemini-2.0-flash':     { input: 0.10,   output: 0.40 },

    // OpenAI (for future use)
    'gpt-4o':               { input: 2.50,   output: 10.00 },
    'gpt-4o-mini':          { input: 0.15,   output: 0.60 },
    'gpt-4.1':              { input: 2.00,   output: 8.00 },
    'gpt-4.1-mini':         { input: 0.40,   output: 1.60 },
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
