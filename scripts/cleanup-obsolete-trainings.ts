import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting QMS obsolete trainings cleanup...');

    // 1. Delete all trainings that are marked 'obsoleto' and were not approved/completed
    const deletedObsolete = await prisma.technicianTraining.deleteMany({
        where: {
            estado: 'obsoleto',
            OR: [
                { puntaje: null },
                {
                    AND: [
                        { puntaje: { not: null } },
                        {
                            puntaje: {
                                lt: 70.0 // Assuming 70.0 is default, or we can check dynamically but lt is safe for non-approved
                            }
                        }
                    ]
                }
            ]
        }
    });
    console.log(`Deleted ${deletedObsolete.count} unapproved trainings marked as 'obsoleto'.`);

    // 2. Find and delete all trainings for documents that are obsolete, where the training is not approved
    const obsoleteDocs = await prisma.controlledDocument.findMany({
        where: {
            estado: 'obsoleto'
        },
        select: {
            id: true
        }
    });

    const obsoleteDocIds = obsoleteDocs.map(d => d.id);

    if (obsoleteDocIds.length > 0) {
        const deletedDocsTrainings = await prisma.technicianTraining.deleteMany({
            where: {
                documentId: { in: obsoleteDocIds },
                estado: { not: 'aprobado' }
            }
        });
        console.log(`Deleted ${deletedDocsTrainings.count} unapproved trainings associated with obsolete documents.`);
    } else {
        console.log('No obsolete documents found in database.');
    }

    console.log('Cleanup finished successfully.');
}

main()
    .catch((e) => {
        console.error('Error running cleanup:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
