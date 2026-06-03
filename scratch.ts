import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const sugerencias = await prisma.sugerencia.findMany({
            include: {
                usuario: {
                    select: {
                        id: true,
                        nombreCompleto: true,
                        role: true,
                        posicion: true
                    }
                },
                responsable: {
                    select: {
                        id: true,
                        nombreCompleto: true,
                        role: true,
                        posicion: true
                    }
                },
                comentarios: {
                    orderBy: { fecha: 'asc' }
                },
                historial: {
                    orderBy: { fecha: 'asc' }
                }
            },
            orderBy: { fecha_creacion: 'desc' }
        });
        console.log("Success:", sugerencias.length);
    } catch (e) {
        console.error("Prisma error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
