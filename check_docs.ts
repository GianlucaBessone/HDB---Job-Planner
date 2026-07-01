import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const docs = await prisma.controlledDocument.findMany({
    where: { requiereConfirmacionLectura: true, estado: 'vigente' },
    select: { codigoDocumental: true, nivelCriticidad: true, tags: true, titulo: true }
  });
  console.log(docs);
}
main().catch(console.error).finally(() => prisma.$disconnect());
