import { prisma } from '../lib/prisma';

async function main() {
    console.log('--- Verificando Integración de Accesos Documentales ---');

    // 1. Módulos y sub-accesos
    const modules = await prisma.documentAccessModule.findMany({
        orderBy: { orden: 'asc' },
        include: {
            subAccesses: {
                orderBy: { orden: 'asc' },
                include: {
                    _count: { select: { documentos: true } }
                }
            }
        }
    });

    console.log(`Total módulos encontrados: ${modules.length}`);
    for (const m of modules) {
        console.log(`\n📁 Módulo ${m.codigo}: ${m.nombre}`);
        console.log(`   Color: ${m.color}, Icon: ${m.icon}`);
        for (const s of m.subAccesses) {
            console.log(`   └─ [${s.codigo}] ${s.nombre} (${s._count.documentos} docs)`);
        }
    }

    // 2. Test creación de sub-acceso personalizado
    const mod1 = modules.find(m => m.codigo === '1');
    if (mod1) {
        const testSub = await prisma.documentSubAccess.create({
            data: {
                moduleId: mod1.id,
                codigo: '1.4',
                nombre: 'Gestión de Innovación y Mejora Continua',
                descripcion: 'Proyectos de innovación, lecciones aprendidas y benchmarking.',
                icon: 'Sparkles',
                esPersonalizado: true,
                orden: 4
            }
        });
        console.log(`\n✅ Sub-acceso creado de prueba: [${testSub.codigo}] ${testSub.nombre}`);

        // Update
        const updated = await prisma.documentSubAccess.update({
            where: { id: testSub.id },
            data: { nombre: 'Gestión de Innovación, I+D y Mejora Continua' }
        });
        console.log(`✅ Sub-acceso actualizado: [${updated.codigo}] ${updated.nombre}`);

        // Delete test sub-access
        await prisma.documentSubAccess.delete({ where: { id: testSub.id } });
        console.log(`✅ Sub-acceso de prueba eliminado exitosamente.`);
    }

    console.log('\n--- Verificación completada con éxito ---');
}

main().catch(console.error).finally(() => prisma.$disconnect());
