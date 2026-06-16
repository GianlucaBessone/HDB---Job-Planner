const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const fichadas = await prisma.fichada.findMany({ 
    where: { fecha: { startsWith: '2026-06' } },
    include: { operator: true }
  });
  console.log('Total Fichadas June:', fichadas.length);
  for (const f of fichadas) {
    console.log(`Fecha: ${f.fecha}, In: ${f.horaIngreso}, Out: ${f.horaEgreso}, Op: ${f.operator.nombreCompleto}`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
