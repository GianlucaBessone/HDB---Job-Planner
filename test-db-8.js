const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const fichadas = await prisma.fichada.findMany({ 
    where: { fecha: { in: ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04'] } },
    include: { operator: true }
  });
  console.log('Total Fichadas 1-4 June:', fichadas.length);
  for (const f of fichadas) {
    console.log(`Fecha: ${f.fecha}, Op: ${f.operator.nombreCompleto}`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
