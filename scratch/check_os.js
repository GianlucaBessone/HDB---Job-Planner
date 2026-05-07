
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const os = await prisma.ordenServicio.findUnique({
    where: { codigoOS: 'OS-2026-0007' },
    include: {
      firma: true,
      project: true
    }
  });

  console.log('OS Data:', JSON.stringify(os, null, 2));

  const signatures = await prisma.ordenServicioFirma.findMany({
    where: {
      OR: [
        { ordenServicioId: os?.id },
        { dni: '0' }, // Just to see if there are others
        { nombre: { contains: 'Firma' } }
      ]
    }
  });
  console.log('Signatures found:', JSON.stringify(signatures, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
