const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const list = await prisma.project.findMany({
        where: { nombre: { contains: 'Central', mode: 'insensitive' } }
    });
    console.log(JSON.stringify(list.map(p => ({id: p.id, nombre: p.nombre, resp: p.responsable})), null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
