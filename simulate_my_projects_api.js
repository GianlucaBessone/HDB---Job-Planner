const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const userId = 'cmmf9qzvl003tw039xg6cdpzi'; // Gianluca's ID
    
    const projects = await prisma.project.findMany({
        where: {
            responsableId: userId,
            estado: { notIn: ['finalizado'] }
        },
        include: {
            responsableUser: true,
            checklistItems: true,
            _count: {
                select: { clientDelays: true }
            }
        },
        orderBy: { nombre: 'asc' }
    });

    console.log(`Found ${projects.length} projects for Gianluca:`);
    projects.forEach(p => {
        console.log(`- ${p.nombre} (ID: ${p.id}, Estado: ${p.estado})`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
