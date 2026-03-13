const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const project = await prisma.project.findFirst({
        where: { nombre: { contains: 'Central Termoeléctrica', mode: 'insensitive' } },
        include: { responsableUser: true }
    });

    if (project) {
        console.log(`Project: ${project.nombre}`);
        console.log(`Legacy Resp: ${project.responsable}`);
        console.log(`ID Resp: ${project.responsableId}`);
        console.log(`Linked Op: ${project.responsableUser?.nombreCompleto || 'NONE'}`);
        console.log(`Status: ${project.estado}`);
    } else {
        console.log('Project not found');
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
