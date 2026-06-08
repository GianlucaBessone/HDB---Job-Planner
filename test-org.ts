import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const currentDate = new Date();
        const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        console.log("Current Month:", currentMonth);
        
        const timeEntriesThisMonth = await prisma.timeEntry.groupBy({
            by: ['operatorId'],
            _sum: { horasTrabajadas: true },
            where: { fecha: { startsWith: currentMonth } }
        });
        console.log("TimeEntries:", timeEntriesThisMonth.length);
        
        const activeOperators = await prisma.operator.findMany({
            where: { activo: true },
            select: { 
                id: true, 
                nombreCompleto: true, 
                role: true,
                responsibleProjects: {
                    where: { estado: 'Activo' },
                    select: { nombre: true }
                }
            }
        });
        console.log("ActiveOperators:", activeOperators.length);
        
        const operatorMetrics = activeOperators.map(op => {
            const stats = timeEntriesThisMonth.find(t => t.operatorId === op.id);
            return {
                nombre: op.nombreCompleto,
                rol: op.role,
                horasEsteMes: stats?._sum?.horasTrabajadas || 0,
                proyectosResponsable: op.responsibleProjects.map((p: any) => p.nombre)
            };
        });

        const activeProjects = await prisma.project.findMany({
            where: { estado: 'Activo' },
            select: { 
                nombre: true, 
                estado: true, 
                client: { select: { nombre: true } },
                horasEstimadas: true,
                horasConsumidas: true,
                responsableUser: { select: { nombreCompleto: true } }
            }
        });
        console.log("ActiveProjects:", activeProjects.length);

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentSurveys = await prisma.encuestaServicio.findMany({
            where: { fecha: { gte: thirtyDaysAgo } },
            select: {
                nps: true, atencion: true, calidad: true, tiempo: true, comentario: true,
                project: { select: { nombre: true } },
                ordenServicio: { select: { codigoOS: true } }
            }
        });
        console.log("Surveys:", recentSurveys.length);

        const systemSnapshot = {
            mesActual: currentMonth,
            operadores: operatorMetrics,
            proyectosActivos: activeProjects.map(p => ({
                nombre: p.nombre,
                cliente: p.client?.nombre || 'Sin cliente',
                progreso: p.horasEstimadas ? Math.round((p.horasConsumidas / p.horasEstimadas) * 100) : 0,
                responsable: p.responsableUser?.nombreCompleto || 'Sin responsable'
            })),
            encuestasRecientes: recentSurveys.map(e => ({
                proyecto: e.project?.nombre || 'Desconocido',
                orden: e.ordenServicio?.codigoOS || 'Desconocido',
                NPS: e.nps,
                puntajePromedio: ((e.atencion + e.calidad + e.tiempo) / 3).toFixed(1),
                comentario: e.comentario || ''
            }))
        };

        console.log("Success! snapshot length:", JSON.stringify(systemSnapshot).length);
    } catch (e) {
        console.error("ERROR:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
