const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Connecting to Prisma ---');
    await prisma.$connect();
    console.log('Connected!');

    console.log('--- Checking Operators ---');
    const operators = await prisma.operator.findMany({
        where: {
            nombreCompleto: {
                contains: 'Gianluca',
                mode: 'insensitive'
            }
        }
    });
    console.log('Operators found:', operators.length);
    console.log(JSON.stringify(operators, null, 2));

    for (const operator of operators) {
        console.log(`\n--- Checking Projects for ${operator.nombreCompleto} (ID: ${operator.id}) ---`);
        const projects = await prisma.project.findMany({
            where: {
                responsableId: operator.id
            },
            include: {
                client: true
            }
        });
        console.log(`Found ${projects.length} projects:`);
        projects.forEach(p => {
            console.log(`- ID: ${p.id}, Name: ${p.nombre}, Status: ${p.estado}, Active: ${p.activo}`);
        });
    }

    console.log('\n--- Project Status Summary ---');
    const allProjects = await prisma.project.findMany({
        include: {
            responsableUser: true
        }
    });
    
    const summary = {};
    allProjects.forEach(p => {
        const respName = p.responsableUser?.nombreCompleto || 'Unassigned';
        if (!summary[respName]) summary[respName] = { total: 0, active: 0, finalized: 0 };
        summary[respName].total++;
        if (p.estado === 'finalizado') summary[respName].finalized++;
        else summary[respName].active++;
    });

    console.log(JSON.stringify(summary, null, 2));
}

main()
    .catch(e => {
        console.error('ERROR during main:');
        console.error(e);
    })
    .finally(async () => {
        console.log('Disconnecting...');
        await prisma.$disconnect();
        console.log('Done!');
    });
