const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const op = await prisma.operator.findFirst({ where: { nombreCompleto: { contains: 'Darío Pérez' } } });
  const timeEntries = await prisma.timeEntry.findMany({ 
    where: { 
      operatorId: op.id,
      deviceId: { not: null }
    }
  });
  console.log('Legacy Fichadas for Darío Pérez:', timeEntries.length);
  for (const t of timeEntries) {
    console.log(`Fecha: ${t.fecha}, In: ${t.horaIngreso}, Out: ${t.horaEgreso}`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
