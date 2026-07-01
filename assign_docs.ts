import { PrismaClient } from '@prisma/client';
import { triggerAutomaticTraining } from './app/api/qms/compliance-engine';

const prisma = new PrismaClient();

async function main() {
  const doc = await prisma.controlledDocument.findFirst({
    where: { codigoDocumental: 'PG-GLB-001', estado: 'vigente' }
  });

  if (!doc) {
    console.error("Document not found");
    return;
  }

  // Update tags
  await prisma.controlledDocument.update({
    where: { id: doc.id },
    data: { tags: JSON.stringify(['Supervisor']) }
  });

  console.log(`Document updated with tags ['Supervisor']. Triggering assignment...`);

  const result = await triggerAutomaticTraining(doc.id);
  console.log(result);
}

main().catch(console.error).finally(() => prisma.$disconnect());
