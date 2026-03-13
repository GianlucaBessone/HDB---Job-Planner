const fetch = require('node-fetch');

async function testApi() {
    const userId = 'cmmf9qzvl003tw039xg6cdpzi'; // Gianluca Bessone
    const url = `http://localhost:3000/api/projects/my-projects?responsableId=${userId}`;
    console.log(`Testing API: ${url}`);
    
    // Since I can't easily run the server and fetch from it here, 
    // I'll simulate the GET function from the route.ts directly if possible,
    // or just assume the Prisma query is the source of truth.
}

// Actually, I'll just check the Prisma logic again.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const responsableId = 'cmmf9qzvl003tw039xg6cdpzi';
    let where = {
        estado: { notIn: ['finalizado'] },
        responsableId: responsableId
    };

    const projects = await prisma.project.findMany({
        where,
        include: {
            client: true,
            responsableUser: {
                select: { nombreCompleto: true }
            },
            _count: {
                select: { checklistItems: true }
            },
            checklistItems: {
                select: { completed: true }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    console.log(`Found ${projects.length} projects for Gianluca:`);
    projects.forEach(p => console.log(`- ${p.nombre} (${p.estado})`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
