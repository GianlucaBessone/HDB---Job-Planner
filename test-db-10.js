const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const op = await prisma.operator.findFirst({ where: { nombreCompleto: { contains: 'Darío Pérez' } } });
  const timeEntries = await prisma.timeEntry.findMany({ 
    where: { operatorId: op.id, fecha: '2026-06-01' }
  });
  console.log('TimeEntries for Darío on 2026-06-01:', timeEntries.length);
  for (const t of timeEntries) {
    console.log(`Fecha: ${t.fecha}, In: ${t.horaIngreso}, Out: ${t.horaEgreso}, deviceId: ${t.deviceId}`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
