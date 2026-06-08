import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
  try {
    const params = { id: 'test' };
    const body = {
      motivo: "Reunion Test",
      fecha: new Date().toISOString(),
      participantes: ["cm4bch57200028y0nly1oig4m"], // Assume this is a valid operator ID or just generic string
      estado: "Programada"
    };
    
    const operatorIds = Array.isArray(body.participantes) ? body.participantes : [];
    const operators = await prisma.operator.findMany({
        where: { id: { in: operatorIds } },
        select: { nombreCompleto: true }
    });
    const participantesNombres = operators.map(op => op.nombreCompleto);

    const nc = await prisma.noConformidad.findFirst();
    if(!nc) return console.log("NO NC");

    const reunion = await prisma.reunionNC.create({
        data: {
            ncId: nc.id,
            fecha: new Date(body.fecha),
            motivo: body.motivo,
            estado: body.estado || 'Programada',
            participantes: participantesNombres,
            minuta: body.minuta || null
        }
    });
    console.log("REUNION CREATED", reunion.id);
    
  } catch (e) {
    console.error("Prisma error:", e);
  } finally {
    await prisma.$disconnect();
  }
}
test();
