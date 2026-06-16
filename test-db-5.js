const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const ops = await prisma.operator.findMany({ where: { nombreCompleto: { contains: 'Pérez' } } });
  console.log('Operators named Pérez:');
  for (const o of ops) {
    console.log(`ID: ${o.id}, Name: ${o.nombreCompleto}`);
    const fichadas = await prisma.fichada.count({ where: { operatorId: o.id } });
    console.log(`  Fichadas count: ${fichadas}`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
