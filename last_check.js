const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const p = await prisma.project.findFirst({
        where: { nombre: { contains: 'Central', mode: 'insensitive' } },
        include: { responsableUser: true }
    });
    console.log(JSON.stringify(p, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
