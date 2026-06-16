const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const timeEntries = await prisma.timeEntry.findMany({ 
    where: { 
      fecha: { startsWith: '2026-06' },
      deviceId: { not: null }
    },
    include: { operator: true }
  });
  console.log('Total Legacy Fichadas June:', timeEntries.length);
  for (const t of timeEntries) {
    console.log(`Fecha: ${t.fecha}, In: ${t.horaIngreso}, Out: ${t.horaEgreso}, Op: ${t.operator.nombreCompleto}`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
