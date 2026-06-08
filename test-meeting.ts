import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
  try {
    const params = { id: 'test-nc-id' };
    const body = {
      motivo: "Reunión de Análisis",
      fecha: new Date(),
      participantes: ["cm4bch57200028y0nly1oig4m"], // Assume this is a valid operator ID or just generic string
      estado: "Programada"
    };
    
    const operatorIds = body.participantes;
    const operators = await prisma.operator.findMany({
        where: { id: { in: operatorIds } },
        select: { nombreCompleto: true }
    });
    console.log("Operators found:", operators);
    
  } catch (e) {
    console.error("Prisma error:", e);
  } finally {
    await prisma.$disconnect();
  }
}
test();
