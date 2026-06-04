/**
 * Rate Limiter — Per-provider request throttling.
 * 
 * Extracted from the old gemini.ts SimpleRateLimiter class.
 * Now supports independent limits per provider.
 */

class ProviderRateLimiter {
    private timestamps: number[] = [];
    private maxRpm: number;

    constructor(maxRpm: number = 15) {
        this.maxRpm = maxRpm;
    }

    async waitIfLimitReached(): Promise<void> {
        const now = Date.now();
        // Clear requests older than 1 minute (60000ms)
        this.timestamps = this.timestamps.filter(ts => now - ts < 60000);

        if (this.timestamps.length >= this.maxRpm) {
            const oldest = this.timestamps[0];
            const sleepMs = 60000 - (now - oldest) + 100; // safety buffer
            console.log(`[RateLimiter] Rate limit reached (${this.maxRpm} RPM). Delaying request by ${sleepMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, sleepMs));
            return this.waitIfLimitReached(); // Re-evaluate recursively
        }
        this.timestamps.push(Date.now());
    }
}

// Default RPM limits per provider
const PROVIDER_LIMITS: Record<string, number> = {
    gemini: 15,
    openai: 60,
    anthropic: 50,
};

// Singleton instances per provider
const limiters = new Map<string, ProviderRateLimiter>();

/**
 * Get the rate limiter for a specific provider.
 * Creates one lazily if it doesn't exist.
 */
export function getRateLimiter(provider: string): ProviderRateLimiter {
    if (!limiters.has(provider)) {
        const rpm = PROVIDER_LIMITS[provider] || 15;
        limiters.set(provider, new ProviderRateLimiter(rpm));
    }
    return limiters.get(provider)!;
}
