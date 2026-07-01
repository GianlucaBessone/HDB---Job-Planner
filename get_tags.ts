import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const ops = await prisma.operator.findMany({ where: { activo: true }, select: { etiquetas: true } });
  const allTags = new Set<string>();
  ops.forEach(op => {
      try {
          const tags = Array.isArray(op.etiquetas) ? op.etiquetas : JSON.parse(op.etiquetas as string || '[]');
          tags.forEach(t => allTags.add(t));
      } catch (e) {}
  });
  console.log(Array.from(allTags));
}
main().catch(console.error).finally(() => prisma.$disconnect());
