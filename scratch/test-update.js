const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const tarea = await prisma.tarea.findFirst();
        console.log("Updating tarea", tarea.id);
        const res = await prisma.tarea.update({
            where: { id: tarea.id },
            data: {
                titulo: tarea.titulo,
                descripcion: tarea.descripcion || '',
                estado: tarea.estado,
                prioridad: tarea.prioridad,
                categoria: tarea.categoria || '',
                fechaInicio: tarea.fechaInicio ? new Date(tarea.fechaInicio) : null,
                fechaVencimiento: tarea.fechaVencimiento ? new Date(tarea.fechaVencimiento) : null,
                projectId: tarea.projectId || null,
                notas: tarea.notas || '',
            }
        });
        console.log("Success", res.id);
    } catch(e) {
        console.error(e);
    }
}
main();
