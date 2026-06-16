const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const op = await prisma.operator.findFirst({ where: { nombreCompleto: { contains: 'Pérez' } } });
  if (!op) {
    console.log('No operator');
    return;
  }
  console.log('Operator ID:', op.id);
  
  const fichadas = await prisma.fichada.findMany({ where: { operatorId: op.id }});
  console.log('Fichadas:', fichadas.length);
  for (const f of fichadas) console.log(f.fecha, f.horaIngreso, f.horaEgreso);

  const timeEntries = await prisma.timeEntry.findMany({ where: { operatorId: op.id, deviceId: { not: null } }});
  console.log('TimeEntries (legacy fichadas):', timeEntries.length);
  for (const t of timeEntries) console.log(t.fecha, t.horaIngreso, t.horaEgreso);
}

main().catch(console.error).finally(() => prisma.$disconnect());
