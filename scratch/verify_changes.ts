import { prisma } from '../lib/prisma';

async function main() {
  console.log('=== INICIANDO PRUEBAS DE VERIFICACIÓN ===');

  // 1. Verificar clientes habilitados para OT
  const enabledClients = await prisma.hdbClient.findMany({
    where: { configuracion: { habilitadoOT: true } },
    include: { configuracion: true },
  });
  console.log(`✓ Clientes habilitados para OT encontrados: ${enabledClients.length}`);
  for (const c of enabledClients) {
    console.log(`  - [${c.id}] ${c.nombre} (Ajuste Materiales: ${c.configuracion?.porcentajeMateriales}%)`);
  }

  // 2. Verificar campo 'activo' en ClientOperatorRate
  const testClient = enabledClients[0];
  if (testClient) {
    const rates = await prisma.clientOperatorRate.findMany({
      where: { clientId: testClient.id },
    });
    console.log(`✓ Tarifas para cliente '${testClient.nombre}': ${rates.length}`);
    for (const r of rates) {
      console.log(`  - Operador: ${r.operatorId} | Tarifa: $${r.valorHora} | Activo: ${r.activo}`);
    }
  }

  // 3. Verificar Sectores dinámicos
  const sectors = await prisma.clientSector.findMany({
    take: 5,
  });
  console.log(`✓ Sectores dinámicos registrados: ${sectors.length}`);
  for (const s of sectors) {
    console.log(`  - Sector: '${s.nombre}' (Cliente: ${s.clientId})`);
  }

  // 4. Verificar integridad de OTs existentes
  const totalOts = await prisma.ordenTrabajo.count();
  console.log(`✓ Total de Órdenes de Trabajo en base de datos: ${totalOts}`);

  console.log('=== VERIFICACIÓN EXITOSA ===');
}

main()
  .catch((e) => {
    console.error('Error en verificación:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
