import { prisma } from '../lib/prisma';
import { DEFAULT_ACCESS_STRUCTURE } from '../lib/constants/documentAccessStructure';

async function seed() {
    console.log('Seeding / Checking Document Access Structure...');
    const count = await prisma.documentAccessModule.count();
    
    if (count === 0) {
        for (const modData of DEFAULT_ACCESS_STRUCTURE) {
            const { subAccesses, ...moduleInfo } = modData;
            const createdModule = await prisma.documentAccessModule.create({
                data: moduleInfo
            });
            console.log(`Created Module ${createdModule.codigo}: ${createdModule.nombre}`);

            for (const sub of subAccesses) {
                const createdSub = await prisma.documentSubAccess.create({
                    data: {
                        moduleId: createdModule.id,
                        codigo: sub.codigo,
                        nombre: sub.nombre,
                        descripcion: sub.descripcion,
                        icon: sub.icon,
                        orden: sub.orden,
                        esPersonalizado: false,
                    }
                });
                console.log(`  -> SubAccess ${createdSub.codigo}: ${createdSub.nombre}`);
            }
        }
    } else {
        console.log(`Found ${count} modules already.`);
    }

    // Map existing documents if they are unassigned
    const sub11 = await prisma.documentSubAccess.findFirst({ where: { codigo: '1.1' } });
    const sub31 = await prisma.documentSubAccess.findFirst({ where: { codigo: '3.1' } });

    if (sub11) {
        await prisma.controlledDocument.updateMany({
            where: {
                subAccessId: null,
                OR: [
                    { codigoDocumental: { contains: 'MQ' } },
                    { titulo: { contains: 'Política de Calidad', mode: 'insensitive' } },
                    { titulo: { contains: 'Manual de Calidad', mode: 'insensitive' } }
                ]
            },
            data: { subAccessId: sub11.id }
        });
    }

    if (sub31) {
        await prisma.controlledDocument.updateMany({
            where: {
                subAccessId: null,
                OR: [
                    { titulo: { contains: 'Permisos de Trabajo', mode: 'insensitive' } },
                    { titulo: { contains: 'Trabajo en Altura', mode: 'insensitive' } },
                    { titulo: { contains: 'SST', mode: 'insensitive' } },
                    { titulo: { contains: 'EPP', mode: 'insensitive' } }
                ]
            },
            data: { subAccessId: sub31.id }
        });
    }

    const allModules = await prisma.documentAccessModule.findMany({
        include: {
            subAccesses: {
                include: {
                    _count: { select: { documentos: true } }
                }
            }
        }
    });

    console.log('Structure status:');
    for (const m of allModules) {
        console.log(`[${m.codigo}] ${m.nombre}`);
        for (const s of m.subAccesses) {
            console.log(`   - [${s.codigo}] ${s.nombre} (${s._count.documentos} docs)`);
        }
    }
}

seed()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
