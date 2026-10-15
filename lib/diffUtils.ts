/**
 * Diff utilities for line and word level granular comparison.
 * Implements Longest Common Subsequence (LCS) algorithm.
 */

export interface DiffPart {
    value: string;
    added?: boolean;
    removed?: boolean;
}

/**
 * Word-level tokenizer and diff algorithm.
 * Tokenizes strings preserving spaces and punctuation, with full Unicode support
 * for Spanish accented characters (á, é, í, ó, ú, ñ) and CRLF normalization.
 */
export function diffWords(oldStr: string, newStr: string): DiffPart[] {
    if (!oldStr && !newStr) return [];
    const cleanOld = (typeof oldStr === 'string' ? oldStr : String(oldStr || '')).replace(/\r\n/g, '\n');
    const cleanNew = (typeof newStr === 'string' ? newStr : String(newStr || '')).replace(/\r\n/g, '\n');

    if (!cleanOld) return [{ value: cleanNew, added: true }];
    if (!cleanNew) return [{ value: cleanOld, removed: true }];
    if (cleanOld === cleanNew) return [{ value: cleanOld }];

    // Match Latin and accented Spanish characters (á, é, í, ó, ú, ñ, etc.) without requiring ES6 /u flag
    const tokenRegex = /(\s+|[^\s\w\u00C0-\u017F]+|[\w\u00C0-\u017F]+)/g;
    const oldTokens = cleanOld.match(tokenRegex) || [cleanOld];
    const newTokens = cleanNew.match(tokenRegex) || [cleanNew];

    const m = oldTokens.length;
    const n = newTokens.length;

    // Safety guard for extremely large inputs
    if (m * n > 2500000) {
        return diffLines(cleanOld, cleanNew);
    }

    const dp: number[][] = Array.from({ length: m + 1 }, () => new Int32Array(n + 1) as any);

    for (let i = 0; i < m; i++) {
        for (let j = 0; j < n; j++) {
            if (oldTokens[i] === newTokens[j]) {
                dp[i + 1][j + 1] = dp[i][j] + 1;
            } else {
                dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
            }
        }
    }

    const stack: DiffPart[] = [];
    let i = m;
    let j = n;

    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && oldTokens[i - 1] === newTokens[j - 1]) {
            stack.push({ value: oldTokens[i - 1] });
            i--;
            j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            stack.push({ value: newTokens[j - 1], added: true });
            j--;
        } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
            stack.push({ value: oldTokens[i - 1], removed: true });
            i--;
        }
    }

    stack.reverse();

    // Group consecutive tokens with matching added/removed attributes
    const grouped: DiffPart[] = [];
    for (const part of stack) {
        const last = grouped[grouped.length - 1];
        if (last && Boolean(last.added) === Boolean(part.added) && Boolean(last.removed) === Boolean(part.removed)) {
            last.value += part.value;
        } else {
            grouped.push({ ...part });
        }
    }

    return grouped;
}

/**
 * Line-level diff algorithm for structured multi-line text (e.g. procedures, checklists)
 * with CRLF normalization.
 */
export function diffLines(oldStr: string, newStr: string): DiffPart[] {
    if (!oldStr && !newStr) return [];
    const cleanOld = (typeof oldStr === 'string' ? oldStr : String(oldStr || '')).replace(/\r\n/g, '\n');
    const cleanNew = (typeof newStr === 'string' ? newStr : String(newStr || '')).replace(/\r\n/g, '\n');

    if (!cleanOld) return [{ value: cleanNew, added: true }];
    if (!cleanNew) return [{ value: cleanOld, removed: true }];
    if (cleanOld === cleanNew) return [{ value: cleanOld }];

    const oldLines = cleanOld.split('\n');
    const newLines = cleanNew.split('\n');
    const m = oldLines.length;
    const n = newLines.length;

    // Safety guard
    if (m * n > 2500000) {
        return [
            { value: cleanOld, removed: true },
            { value: cleanNew, added: true }
        ];
    }

    const dp: number[][] = Array.from({ length: m + 1 }, () => new Int32Array(n + 1) as any);

    for (let i = 0; i < m; i++) {
        for (let j = 0; j < n; j++) {
            if (oldLines[i] === newLines[j]) {
                dp[i + 1][j + 1] = dp[i][j] + 1;
            } else {
                dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
            }
        }
    }

    const stack: DiffPart[] = [];
    let i = m;
    let j = n;

    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
            stack.push({ value: oldLines[i - 1] });
            i--;
            j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            stack.push({ value: newLines[j - 1], added: true });
            j--;
        } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
            stack.push({ value: oldLines[i - 1], removed: true });
            i--;
        }
    }

    stack.reverse();
    return stack;
}
