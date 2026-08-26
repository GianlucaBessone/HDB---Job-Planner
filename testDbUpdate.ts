import { PrismaClient } from '@prisma/client';
import { recalcularAvanceOkr } from './lib/okrKpiEngine';

const prisma = new PrismaClient();

async function main() {
    await recalcularAvanceOkr('f9247707-d7bd-4c9b-b624-c5e4cc08c5e1');
    const okr = await prisma.okr.findUnique({ where: { id: 'f9247707-d7bd-4c9b-b624-c5e4cc08c5e1' }});
    console.log('Updated OKR:', okr);
}

main().catch(console.error).finally(() => prisma.$disconnect());
