const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const timeEntries = await prisma.timeEntry.findMany({ 
    where: { fecha: '2026-06-01' }
  });
  console.log('Sample TimeEntries for 01/06:');
  for (const t of timeEntries) {
    console.log(`ID: ${t.id}, In: ${t.horaIngreso}, Out: ${t.horaEgreso}, deviceId: ${t.deviceId}, qrValidated: ${t.qrValidated}, flags: ${t.validationFlags}`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
