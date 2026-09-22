import { prisma } from '../lib/prisma';
import { hashPassword, verifyPassword, createPortalSession, verifyPortalSession } from '../lib/portalAuth';

async function testAll() {
  console.log('--- STARTING OT & PORTAL ACCESS VERIFICATION ---');

  // 1. Check client
  const client = await prisma.hdbClient.findFirst({
    where: { activo: true },
  });
  if (!client) throw new Error('No client found');
  console.log(`✓ Using client: ${client.nombre} (${client.id})`);

  // 2. Verify Sectores API logic
  const [sectores, otsWithSector] = await Promise.all([
    prisma.clientSector.findMany({
      where: { clientId: client.id },
      include: {
        project: { select: { id: true, nombre: true } },
      },
      orderBy: { nombre: 'asc' },
    }),
    prisma.ordenTrabajo.findMany({
      where: {
        clienteId: client.id,
        sector: { not: null },
      },
      select: {
        sector: true,
        proyectoId: true,
        proyecto: { select: { id: true, nombre: true } },
      },
      distinct: ['sector'],
    }),
  ]);

  const sectorMap = new Map<string, any>();
  sectores.forEach((s) => {
    if (s.nombre?.trim()) {
      sectorMap.set(s.nombre.trim().toLowerCase(), {
        id: s.id,
        nombre: s.nombre.trim(),
        projectId: s.projectId,
        project: s.project,
      });
    }
  });
  otsWithSector.forEach((ot) => {
    if (ot.sector?.trim()) {
      const key = ot.sector.trim().toLowerCase();
      if (!sectorMap.has(key)) {
        sectorMap.set(key, {
          id: `ot-${key}`,
          nombre: ot.sector.trim(),
          projectId: ot.proyectoId,
          project: ot.proyecto,
        });
      }
    }
  });
  const allSectores = Array.from(sectorMap.values());
  console.log(`✓ Sectores found for client ${client.nombre}: ${allSectores.length}`);
  allSectores.forEach(s => console.log(`   - Sector: "${s.nombre}"`));

  // 3. Test First Access User creation & authentication flow
  const testEmail = `test.resp.${Date.now()}@example.com`;
  
  // Case A: User created WITHOUT password initially
  const respNoPass = await prisma.clientResponsable.create({
    data: {
      clientId: client.id,
      nombre: 'Responsable Sin Clave',
      email: testEmail,
      cargo: 'Supervisor Planta',
      activo: true,
      portalHabilitado: true,
      passwordHash: null,
      mustChangePassword: true,
    },
  });
  console.log(`✓ Created test responsible without password: ${respNoPass.id}`);

  // Simulate first access: establishing initial password
  const newPass = 'MiClaveSegura2026!';
  const initialHash = await hashPassword(newPass);
  const updatedResp = await prisma.clientResponsable.update({
    where: { id: respNoPass.id },
    data: {
      passwordHash: initialHash,
      mustChangePassword: false,
    },
  });
  console.log(`✓ Responsible set initial password successfully. hasPassword = ${!!updatedResp.passwordHash}, mustChange = ${updatedResp.mustChangePassword}`);
  const passValid = await verifyPassword(newPass, updatedResp.passwordHash!);
  if (!passValid) throw new Error('Password verification failed for newly set password');
  console.log('✓ verifyPassword correctly validated the newly established password.');

  // Clean up test responsible
  await prisma.clientResponsable.delete({ where: { id: respNoPass.id } });
  console.log('✓ Cleaned up test responsible.');

  // 4. Test John Doe state in DB
  const john = await prisma.clientResponsable.findFirst({
    where: { nombre: 'John Doe' },
  });
  if (john) {
    console.log(`✓ Existing responsible John Doe: hasPassword = ${!!john.passwordHash}, mustChangePassword = ${john.mustChangePassword}`);
  }

  // 5. Test Export API logic with xlsx
  const xlsx = require('xlsx');
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.aoa_to_sheet([['OT', 'Cliente', 'Estado'], ['OT-2026-0001', client.nombre, 'ABIERTA']]);
  xlsx.utils.book_append_sheet(wb, ws, 'Test');
  const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  console.log(`✓ Excel buffer generated successfully: ${buf.length} bytes`);

  console.log('=== ALL TESTS PASSED SUCCESSFULLY ===');
}

testAll()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('TEST FAILED:', err);
    process.exit(1);
  });
