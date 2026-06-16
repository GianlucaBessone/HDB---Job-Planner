const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const op = await prisma.operator.findFirst({ where: { nombreCompleto: { contains: 'Pérez' } } });
  const timeEntries = await prisma.timeEntry.findMany({ where: { operatorId: op.id }});
  console.log('Total TimeEntries:', timeEntries.length);
  for (const t of timeEntries) {
    console.log(`Fecha: ${t.fecha}, In: ${t.horaIngreso}, Out: ${t.horaEgreso}, deviceId: ${t.deviceId}, isDevolucion: ${t.isDevolucion}`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
