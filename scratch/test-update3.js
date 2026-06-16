const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const tarea = await prisma.tarea.findFirst();
        console.log("Updating tarea", tarea.id);
        const data = {
            titulo: tarea.titulo,
            fechaInicio: '',
        };
        if (data.fechaInicio) data.fechaInicio = new Date(data.fechaInicio);
        else if (data.fechaInicio === '') data.fechaInicio = null;
        
        console.log("data", data);
        const res = await prisma.tarea.update({
            where: { id: tarea.id },
            data
        });
        console.log("Success", res.id);
    } catch(e) {
        console.error("Prisma error:", e.message);
    }
}
main();
