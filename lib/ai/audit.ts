/**
 * AI Audit Logger — Persists AI request metadata to the database.
 * 
 * Extracted from the old gemini.ts logAiRequest() function.
 * Now includes a `provider` field for multi-provider tracking.
 */

import { prisma } from '../prisma';

export interface AiLogEntry {
    action: string;
    model: string;
    provider: string;
    promptKey?: string;
    promptVersion?: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCost: number;
    latencyMs: number;
    userId?: string;
    userName?: string;
    userRole?: string;
    entity?: string;
    entityId?: string;
    success: boolean;
    errorMessage?: string;
}

/**
 * Log an AI request to the database for auditing and cost control.
 */
export async function logAiRequest(params: AiLogEntry): Promise<void> {
    try {
        // Validate that the promptKey exists before creating the FK relation
        let actualPromptKey = params.promptKey;
        if (actualPromptKey) {
            const promptExists = await prisma.aiPrompt.findUnique({
                where: { key: actualPromptKey },
                select: { key: true }
            });
            if (!promptExists) {
                actualPromptKey = undefined;
            }
        }

        await prisma.aiRequestLog.create({
            data: {
                action: params.action,
                model: params.model,
                provider: params.provider,
                promptKey: actualPromptKey || null,
                promptVersion: params.promptVersion,
                inputTokens: params.inputTokens,
                outputTokens: params.outputTokens,
                totalTokens: params.totalTokens,
                estimatedCost: params.estimatedCost,
                latencyMs: params.latencyMs,
                userId: params.userId,
                userName: params.userName,
                userRole: params.userRole,
                entity: params.entity,
                entityId: params.entityId,
                success: params.success,
                errorMessage: params.errorMessage
            }
        });
    } catch (e) {
        console.error('[AiAudit] Failed to insert log in DB:', e);
    }
}
