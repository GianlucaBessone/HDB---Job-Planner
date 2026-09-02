import { prisma } from '../lib/prisma';
import { updateEppItem } from '../app/rrhh/personal/epp/actions';

async function testEditAndAdjustment() {
    console.log('--- TEST DE EDICIÓN Y AJUSTE MANUAL DE STOCK ---');

    const item = await prisma.eppItem.findFirst({
        where: { codigo: 'EPP-001' }
    });

    if (!item) {
        console.log('Elemento EPP-001 no encontrado');
        return;
    }

    console.log(`Elemento actual: ${item.nombre}, Stock actual: ${item.stockActual}`);

    // Probar edición con ajuste manual de stock (+5 unidades por recuento)
    const nuevoStock = item.stockActual + 5;
    const res = await updateEppItem(item.id, {
        descripcion: 'Guante de alta resistencia mecánica N5 actualizado',
        ajusteStock: {
            nuevoStock,
            motivo: 'Recuento físico de inventario / Auditoría de pañol',
            registradoPor: 'Gianluca (Supervisor)',
            userId: 'test-user-id',
            userName: 'Gianluca Bessone'
        }
    });

    if (res.success) {
        console.log(`Elemento actualizado con éxito. Nuevo stock: ${res.data.stockActual}`);

        // Verificar el movimiento en Kardex
        const lastMovement = await prisma.eppStockMovement.findFirst({
            where: { eppItemId: item.id },
            orderBy: { createdAt: 'desc' }
        });

        console.log('Último movimiento Kardex generado:', {
            tipo: lastMovement?.tipo,
            cantidad: lastMovement?.cantidad,
            stockAnterior: lastMovement?.stockAnterior,
            stockPosterior: lastMovement?.stockPosterior,
            motivo: lastMovement?.motivo,
            registradoPor: lastMovement?.registradoPor
        });

        // Verificar registro de auditoría general
        const lastAudit = await prisma.auditLog.findFirst({
            where: { entity: 'EPP_STOCK_ADJUSTMENT', entityId: item.id },
            orderBy: { timestamp: 'desc' }
        });

        console.log('Auditoría general registrada:', {
            action: lastAudit?.action,
            entity: lastAudit?.entity,
            userName: lastAudit?.userName,
            oldValue: lastAudit?.oldValue,
            newValue: lastAudit?.newValue
        });
    } else {
        console.error('Error al editar y ajustar:', res.error);
    }

    console.log('--- FIN DEL TEST ---');
}

testEditAndAdjustment().catch(console.error).finally(() => prisma.$disconnect());
