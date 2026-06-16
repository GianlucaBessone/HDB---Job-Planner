const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const timeEntries = await prisma.timeEntry.findMany({ 
    where: { deviceId: { not: null } }
  });
  console.log('Total Legacy Fichadas EVER:', timeEntries.length);
}
main().catch(console.error).finally(() => prisma.$disconnect());
