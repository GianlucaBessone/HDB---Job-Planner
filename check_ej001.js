const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const doc = await prisma.controlledDocument.findUnique({
    where: { codigoDocumental: 'EJ-001' }
  });
  console.log(JSON.stringify(doc, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
