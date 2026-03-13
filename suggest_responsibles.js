const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const unassignedProjects = await prisma.project.findMany({
        where: { responsableId: null, estado: { notIn: ['finalizado'] } }
    });

    console.log(`Found ${unassignedProjects.length} unassigned active projects.`);

    const operators = await prisma.operator.findMany();
    const plannings = await prisma.planning.findMany({
        orderBy: { fecha: 'desc' },
        take: 30
    });

    for (const project of unassignedProjects) {
        console.log(`\nChecking project: ${project.nombre} (ID: ${project.id})`);
        
        // Find who worked on it in the last 30 days
        const contributors = new Map();
        plannings.forEach(p => {
            const blocks = p.blocks || [];
            blocks.forEach(b => {
                if (b.projectId === project.id && b.operatorIds) {
                    b.operatorIds.forEach(id => {
                        contributors.set(id, (contributors.get(id) || 0) + 1);
                    });
                }
            });
        });

        if (contributors.size > 0) {
            const sorted = [...contributors.entries()].sort((a, b) => b[1] - a[1]);
            const mainContributorId = sorted[0][0];
            const mainContributor = operators.find(o => o.id === mainContributorId);
            console.log(`Potential responsible: ${mainContributor?.nombreCompleto} (worked ${sorted[0][1]} times)`);
        } else {
            console.log('No planning history found for this project.');
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
