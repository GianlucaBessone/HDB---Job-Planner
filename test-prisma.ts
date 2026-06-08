import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
  try {
    const nc = await prisma.noConformidad.create({
      data: {
        codigoNC: 'NC-TEST-001',
        fechaDeteccion: new Date(),
        origen: 'Hallazgo operativo',
        tipoNC: 'Menor',
        categoria: 'Seguridad',
        descripcion: 'Ejemplo test',
        procesoAfectado: 'Fabricación',
        areaAfectada: 'Operaciones',
        criticidad: 'Media',
        impacto: 'Test',
        estado: 'Abierta',
      }
    });
    console.log("Success:", nc);
  } catch (e) {
    console.error("Prisma error:", e);
  } finally {
    await prisma.$disconnect();
  }
}
test();
