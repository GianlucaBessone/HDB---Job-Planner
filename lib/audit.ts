import { prisma } from './prisma';

/**
 * Registra una acción en la base de datos de auditoría.
 */
export async function logAudit(params: {
    userId?: string;
    userName?: string;
    userEmail?: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REJECT';
    entity: string;
    entityId?: string;
    oldValue?: any;
    newValue?: any;
    metadata?: any;
}) {
    try {
        await prisma.auditLog.create({
            data: {
                userId: params.userId,
                userName: params.userName,
                userEmail: params.userEmail,
                action: params.action,
                entity: params.entity,
                entityId: params.entityId,
                oldValue: params.oldValue ? params.oldValue : null,
                newValue: params.newValue ? params.newValue : null,
                metadata: params.metadata ? params.metadata : null,
            }
        });
    } catch (e) {
        console.error('[AuditLog] Failed to write log:', e);
    }
}
