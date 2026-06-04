/**
 * Input Guard — Prompt sanitization and injection protection.
 * 
 * Extracted from the old gemini.ts sanitizePrompt() function.
 * Provider-agnostic: runs before any content reaches any AI provider.
 */

const HIJACK_KEYWORDS = [
    "ignore previous instructions",
    "ignora las instrucciones anteriores",
    "system prompt bypass",
    "jailbreak",
    "new instructions:",
    "instrucciones del sistema:"
];

/**
 * Sanitize user-provided text to protect against basic prompt injection attempts.
 */
export function sanitizePrompt(prompt: string): string {
    let sanitized = prompt;
    for (const keyword of HIJACK_KEYWORDS) {
        const reg = new RegExp(keyword, 'gi');
        sanitized = sanitized.replace(reg, "[REDACTED_INJECTION_RISK]");
    }
    return sanitized;
}
