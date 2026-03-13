const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const projects = await prisma.project.findMany({
        where: { estado: { notIn: ['finalizado'] } },
        include: { responsableUser: true }
    });

    console.log(`--- Checking ${projects.length} Active/In-Progress Projects ---`);
    const issues = [];

    projects.forEach(p => {
        if (!p.responsableId) {
            issues.push(`Project "${p.nombre}" (ID: ${p.id}) has NO responsableId. (Legacy field: "${p.responsable}")`);
        } else if (!p.responsableUser) {
            issues.push(`Project "${p.nombre}" (ID: ${p.id}) has an INVALID responsableId: ${p.responsableId}. (Legacy field: "${p.responsable}")`);
        }
    });

    if (issues.length === 0) {
        console.log('No issues found with project assignments for active projects.');
    } else {
        console.log('Found the following issues:');
        issues.forEach(issue => console.log(`- ${issue}`));
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
