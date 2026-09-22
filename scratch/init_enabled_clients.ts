import { prisma } from '../lib/prisma';

async function init() {
    const clientsWithOts = await prisma.hdbClient.findMany({
        where: {
            OR: [
                { ordenesTrabajo: { some: {} } },
                { configuracion: { isNot: null } }
            ]
        },
        select: { id: true, nombre: true }
    });

    for (const c of clientsWithOts) {
        await prisma.hdbClientConfig.upsert({
            where: { clientId: c.id },
            create: { clientId: c.id, habilitadoOT: true },
            update: { habilitadoOT: true }
        });
        console.log(`Enabled client for OT: ${c.nombre} (${c.id})`);
    }
    console.log(`Total enabled clients initialized: ${clientsWithOts.length}`);
}

init()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
