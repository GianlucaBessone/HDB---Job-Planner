const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const op = await prisma.operator.findFirst({ where: { nombreCompleto: { contains: 'Darío Pérez' } } });
  const fichadas = await prisma.fichada.findMany({ 
    where: { operatorId: op.id }
  });
  console.log('Total Fichadas for Darío:', fichadas.length);
  for (const f of fichadas) {
    console.log(`Fecha raw: ${f.fecha}`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
