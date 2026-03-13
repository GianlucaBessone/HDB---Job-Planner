const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const projects = await prisma.project.findMany({
        where: { estado: { notIn: ['finalizado'] } },
    });

    console.log(`--- Checking ALL ${projects.length} Active Projects ---`);
    projects.forEach(p => {
        console.log(`[${p.id}] ${p.nombre}`);
        console.log(`   Legacy Resp: "${p.responsable || ''}"`);
        console.log(`   ID Resp: "${p.responsableId || ''}"`);
        console.log('---');
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
