const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const okrs = await prisma.okr.findMany({ include: { kpis: true } });
    console.log(JSON.stringify(okrs, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
