import { prisma } from '../lib/prisma';
import { getEppMatrix, getEppCatalog, addEppStock, createEppDelivery } from '../app/rrhh/personal/epp/actions';
import { getMyEppData } from '../app/mis-epp/actions';

async function testEppWorkflow() {
    console.log('--- INICIANDO TEST DEL FLUJO DE EPP ---');

    // 1. Obtener operadores existentes
    const operators = await prisma.operator.findMany({
        where: { activo: true },
        take: 3
    });

    if (operators.length === 0) {
        console.log('No se encontraron operadores activos en la base de datos.');
        return;
    }
    console.log(`Operadores encontrados para test: ${operators.map(o => o.nombreCompleto).join(', ')}`);

    // 2. Crear o asegurar EPP Globales de prueba
    const testItems = [
        {
            nombre: 'Casco de Seguridad con Barbijo',
            codigo: 'EPP-CASCO-01',
            categoria: 'Cabeza',
            esGlobal: true,
            diasValidez: 365,
            stockActual: 25,
            stockMinimo: 5,
            marca: '3M',
            normaCertificacion: 'IRAM 3620'
        },
        {
            nombre: 'Calzado de Seguridad Dieléctrico',
            codigo: 'EPP-CALZ-01',
            categoria: 'Calzado',
            esGlobal: true,
            diasValidez: 180,
            stockActual: 20,
            stockMinimo: 4,
            talle: '42',
            marca: 'Voromax',
            normaCertificacion: 'IRAM 3610'
        },
        {
            nombre: 'Protector Ocular / Antiparras',
            codigo: 'EPP-OCU-01',
            categoria: 'Protección Ocular',
            esGlobal: true,
            diasValidez: 90,
            stockActual: 30,
            stockMinimo: 8,
            normaCertificacion: 'ANSI Z87.1'
        },
        {
            nombre: 'Guantes de Nitrilo Reforzados',
            codigo: 'EPP-GUAN-01',
            categoria: 'Manos',
            esGlobal: true,
            diasValidez: 60,
            stockActual: 50,
            stockMinimo: 10,
            normaCertificacion: 'IRAM 3607'
        },
        {
            nombre: 'Arnés de Seguridad Trabajo en Altura',
            codigo: 'EPP-ALT-01',
            categoria: 'Altura',
            esGlobal: false, // ESPECÍFICO
            diasValidez: 730,
            stockActual: 5,
            stockMinimo: 2,
            normaCertificacion: 'IRAM 3622'
        }
    ];

    for (const item of testItems) {
        const existing = await prisma.eppItem.findFirst({
            where: { codigo: item.codigo }
        });

        if (!existing) {
            const created = await prisma.eppItem.create({ data: item });
            console.log(`Creado elemento EPP: ${created.nombre} (${created.esGlobal ? 'GLOBAL' : 'ESPECÍFICO'}) - Stock: ${created.stockActual}`);
        } else {
            console.log(`Elemento ya existente: ${existing.nombre} - Stock: ${existing.stockActual}`);
        }
    }

    // 3. Probar getEppCatalog
    const catalogRes = await getEppCatalog();
    console.log(`Catálogo cargado: ${catalogRes.data?.length} elementos`);

    // 4. Probar getEppMatrix
    const matrixRes = await getEppMatrix();
    console.log('Estadísticas de la matriz:', matrixRes.data?.stats);

    // 5. Simular despacho de entrega al primer operador
    const targetOperator = operators[0];
    const casco = await prisma.eppItem.findFirst({ where: { codigo: 'EPP-CASCO-01' } });
    const guantes = await prisma.eppItem.findFirst({ where: { codigo: 'EPP-GUAN-01' } });

    if (casco && guantes) {
        const stockCascoAntes = casco.stockActual;
        const stockGuantesAntes = guantes.stockActual;

        console.log(`Despachando entrega a ${targetOperator.nombreCompleto}...`);
        const deliveryRes = await createEppDelivery({
            operatorId: targetOperator.id,
            items: [
                { eppItemId: casco.id, cantidad: 1 },
                { eppItemId: guantes.id, cantidad: 2 }
            ],
            entregadoPor: 'Supervisor de Seguridad (Test)',
            observaciones: 'Dotación periódica de seguridad'
        });

        if (deliveryRes.success) {
            console.log(`Acta de entrega creada con éxito: ${deliveryRes.data.codigoActa} (Estado: ${deliveryRes.data.estado})`);

            // Verificar descuento de stock
            const cascoDespues = await prisma.eppItem.findUnique({ where: { id: casco.id } });
            const guantesDespues = await prisma.eppItem.findUnique({ where: { id: guantes.id } });

            console.log(`Stock Casco: ${stockCascoAntes} -> ${cascoDespues?.stockActual} (Descontó 1: ${stockCascoAntes - 1 === cascoDespues?.stockActual ? 'CORRECTO' : 'FALLO'})`);
            console.log(`Stock Guantes: ${stockGuantesAntes} -> ${guantesDespues?.stockActual} (Descontó 2: ${stockGuantesAntes - 2 === guantesDespues?.stockActual ? 'CORRECTO' : 'FALLO'})`);

            // Verificar que aparezca en getMyEppData para el operador
            const myEppRes = await getMyEppData(targetOperator.id);
            console.log(`Mis EPP del operador ${targetOperator.nombreCompleto}:`, {
                pendientesDeFirma: myEppRes.data?.pendingDeliveries.length,
                asignadosActivos: myEppRes.data?.assignedItems.length
            });
        } else {
            console.error('Error al despachar entrega:', deliveryRes.error);
        }
    }

    console.log('--- TEST COMPLETADO CON ÉXITO ---');
}

testEppWorkflow().catch(console.error).finally(() => prisma.$disconnect());
