const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const plannings = await prisma.planning.findMany({
        orderBy: { fecha: 'desc' },
        take: 10
    });
    console.log(`--- Checking last 10 Planning Days ---`);
    
    plannings.forEach(p => {
        console.log(`Fecha: ${p.fecha}`);
        const blocks = p.blocks || [];
        blocks.forEach(b => {
            if (b.projectName) {
                console.log(`  - Project: ${b.projectName}, Operators: ${b.operatorNames?.join(', ') || 'NONE'}`);
            }
        });
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
