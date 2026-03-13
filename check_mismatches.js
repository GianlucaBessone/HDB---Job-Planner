const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Checking for name/ID mismatches ---');
    const projects = await prisma.project.findMany({
        where: {
            OR: [
                { responsable: { contains: 'Gianluca', mode: 'insensitive' } },
                { responsable: { contains: 'Bessone', mode: 'insensitive' } }
            ]
        },
        include: {
            responsableUser: true
        }
    });

    console.log(`Found ${projects.length} projects mentioning Gianluca in name field:`);
    projects.forEach(p => {
        console.log(`- Project: ${p.nombre}`);
        console.log(`  - Legacy responsable field: ${p.responsable}`);
        console.log(`  - responsableId field: ${p.responsableId}`);
        console.log(`  - Linked Operator: ${p.responsableUser?.nombreCompleto || 'NONE'}`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
