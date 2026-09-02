import { prisma } from '../lib/prisma';
import { 
    createEppPublicShare, 
    getPublicEppMatrixData, 
    getClientsForEppShare 
} from '../app/rrhh/personal/epp/actions';

async function testShareMatrix() {
    console.log('--- TEST DE MATRIZ COMPARTIDA CONFIGURABLE ---');

    // 1. Probar link de Matriz Completa (GENERAL)
    const generalShareRes = await createEppPublicShare({
        tipo: 'GENERAL',
        titulo: 'Matriz General de EPP - Auditoría Corporativa',
        creadoPor: 'Gianluca (QA Test)'
    });

    if (!generalShareRes.success || !generalShareRes.data) {
        console.error('Error al crear share general:', generalShareRes.error);
        return;
    }

    const generalToken = generalShareRes.data.token;
    console.log(`Enlace General Creado. Token: ${generalToken}`);

    // Consultar datos de matriz general
    const generalDataRes = await getPublicEppMatrixData(generalToken);
    console.log('Resultado Matriz General:', {
        success: generalDataRes.success,
        titulo: generalDataRes.data?.share?.titulo,
        tipo: generalDataRes.data?.share?.tipo,
        totalOperadores: generalDataRes.data?.stats?.totalOperadores,
        eppGlobales: generalDataRes.data?.eppGlobales?.map((e: any) => e.nombre),
        porcentajeCobertura: generalDataRes.data?.stats?.porcentajeCobertura,
        primerOperadorHistorial: generalDataRes.data?.rows?.[0]?.historialDeliveries?.length
    });

    // 2. Probar link Filtrado por Cliente
    const clientsRes = await getClientsForEppShare();
    console.log(`Clientes encontrados en sistema: ${clientsRes.data?.length}`);

    let client = clientsRes.data?.[0];
    if (!client) {
        // Crear cliente de prueba si no hay
        client = await prisma.hdbClient.create({
            data: { nombre: 'YPF S.A. - Yacimiento Vaca Muerta', activo: true }
        });
        console.log(`Cliente de prueba creado: ${client.nombre}`);
    }

    const clientShareRes = await createEppPublicShare({
        tipo: 'CLIENTE',
        clientId: client.id,
        titulo: `Matriz EPP - Personal Acreditado ${client.nombre}`,
        creadoPor: 'Gianluca'
    });

    if (clientShareRes.success && clientShareRes.data) {
        const clientToken = clientShareRes.data.token;
        console.log(`Enlace por Cliente Creado. Token: ${clientToken}`);

        const clientDataRes = await getPublicEppMatrixData(clientToken);
        console.log('Resultado Matriz Filtrada por Cliente (Últimos 3 meses):', {
            success: clientDataRes.success,
            titulo: clientDataRes.data?.share?.titulo,
            tipo: clientDataRes.data?.share?.tipo,
            clientNombre: clientDataRes.data?.share?.clientNombre,
            operadoresConHorasUltimos3Meses: clientDataRes.data?.stats?.totalOperadores
        });
    }

    console.log('--- TEST COMPLETADO CON ÉXITO ---');
}

testShareMatrix().catch(console.error).finally(() => prisma.$disconnect());
