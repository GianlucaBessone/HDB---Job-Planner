import { prisma } from '../lib/prisma';
import { generateSignatureId, generateSignatureHash } from '../lib/signature';
import { signEppDelivery, getMyEppData } from '../app/mis-epp/actions';
import { getEppMatrix } from '../app/rrhh/personal/epp/actions';

async function testSigningWorkflow() {
    console.log('--- TEST DE FIRMA ELECTRÓNICA CON CHECKSUM ---');

    // 1. Buscar una entrega pendiente
    const pendingDelivery = await prisma.eppDelivery.findFirst({
        where: { estado: 'PENDIENTE_FIRMA' },
        include: { items: true, operator: true }
    });

    if (!pendingDelivery) {
        console.log('No hay entregas pendientes de firma.');
        return;
    }

    console.log(`Entrega a firmar: ${pendingDelivery.codigoActa} para ${pendingDelivery.operator.nombreCompleto}`);
    const operator = pendingDelivery.operator;
    const itemIds = pendingDelivery.items.map(i => i.id);

    // 2. Generar firma estándar de la app con checksum
    const signatureId = generateSignatureId();
    const signedAtUTC = new Date();
    const hashSignature = generateSignatureHash(
        pendingDelivery.id,
        '1.0',
        operator.id,
        operator.nombreCompleto,
        operator.dni || '00000000',
        'DEV-TEST-SUITE',
        signedAtUTC
    );

    console.log(`Firma generada: ${signatureId}`);
    console.log(`Checksum SHA-256: ${hashSignature}`);

    // Crear registro en DocumentSignatureAudit
    await prisma.documentSignatureAudit.create({
        data: {
            SignatureID: signatureId,
            DocumentID: pendingDelivery.id,
            DocumentVersion: '1.0',
            UserID: operator.id,
            UserName: operator.nombreCompleto,
            DNI: operator.dni || '00000000',
            DeviceID: 'DEV-TEST-SUITE',
            IPAddress: '127.0.0.1',
            SignedAtUTC: signedAtUTC,
            HashSignature: hashSignature,
            VerificationStatus: 'VALIDA'
        }
    });

    // 3. Ejecutar signEppDelivery
    const signRes = await signEppDelivery({
        deliveryId: pendingDelivery.id,
        operatorId: operator.id,
        itemIdsConfirmed: itemIds,
        signatureId,
        signatureHash: hashSignature
    });

    if (signRes.success) {
        console.log(`Entrega ${pendingDelivery.codigoActa} firmada exitosamente.`);

        // 4. Comprobar que en getMyEppData figure como asignado activo
        const myData = await getMyEppData(operator.id);
        console.log(`Mis EPP de ${operator.nombreCompleto}:`, {
            pendientesDeFirma: myData.data?.pendingDeliveries.length,
            asignadosActivos: myData.data?.assignedItems.map(a => `${a.eppItem.nombre}: ${a.estadoVigencia} (${a.diasRestantes}d restantes)`),
            historialFirmadas: myData.data?.signedDeliveries.length
        });

        // 5. Comprobar que la matriz de RRHH ahora tiene celdas vigentes
        const matrixRes = await getEppMatrix();
        console.log('Nueva cobertura de la matriz:', matrixRes.data?.stats);
    } else {
        console.error('Error al firmar:', signRes.error);
    }

    console.log('--- TEST DE FIRMA COMPLETADO ---');
}

testSigningWorkflow().catch(console.error).finally(() => prisma.$disconnect());
