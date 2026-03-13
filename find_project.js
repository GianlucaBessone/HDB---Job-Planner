const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const projects = await prisma.project.findMany();
    console.log(`Total projects: ${projects.length}`);
    const match = projects.find(p => p.nombre.includes('Central Termoeléctrica'));
    console.log(JSON.stringify(match, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
