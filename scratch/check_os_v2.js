
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const os = await prisma.ordenServicio.findUnique({
    where: { codigoOS: 'OS-2026-0007' },
    include: { firma: true }
  });

  if (!os) {
    console.log('OS-2026-0007 not found');
    return;
  }

  console.log('OS-2026-0007 ID:', os.id);
  console.log('OS-2026-0007 Status:', os.estado);
  console.log('OS-2026-0007 Firma:', os.firma ? 'Connected' : 'Disconnected');

  // Search for signatures that might belong to this OS but are not connected
  // Or signatures for this OS ID that aren't showing up for some reason
  const allSignatures = await prisma.ordenServicioFirma.findMany();
  console.log('Total signatures in DB:', allSignatures.length);
  
  const possibleSignatures = allSignatures.filter(s => s.ordenServicioId === os.id);
  console.log('Signatures with OS ID', os.id, ':', possibleSignatures.length);
  if (possibleSignatures.length > 0) {
      console.log('Signature details:', JSON.stringify(possibleSignatures[0], null, 2));
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
