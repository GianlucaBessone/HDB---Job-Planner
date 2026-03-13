const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const plannings = await prisma.planning.findMany();
    console.log(`--- Checking ${plannings.length} Planning Days ---`);
    
    const unassignedProjectIds = [
        'cmmfazvf600049lpw2jzl6hsd', // Taller
        'cmmp1i7kx0004e7ka7zjmyb80', // Quebracho
        'cmmo3tw3j00013pcmuf6ijoo1', // La Casa del Agro
        'cmmfaq4gc0007olhsj01o5mc5', // Papel
        'cmmp2mjoi0000oywlp2kzmws8', // Hostal
        'cmmic4btv0000d9zkvunlxydz'  // Igarzábal
    ];

    const assignments = {};

    plannings.forEach(p => {
        const blocks = p.blocks || [];
        blocks.forEach(b => {
            if (unassignedProjectIds.includes(b.projectId)) {
                if (!assignments[b.projectId]) assignments[b.projectId] = new Set();
                if (b.operatorNames) {
                    b.operatorNames.forEach(name => assignments[b.projectId].add(name));
                }
            }
        });
    });

    console.log('--- Operators found in planning for unassigned projects ---');
    for (const projectId in assignments) {
        console.log(`Project ID ${projectId}: ${Array.from(assignments[projectId]).join(', ')}`);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
