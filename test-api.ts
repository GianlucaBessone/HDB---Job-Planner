import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
  const nc = await prisma.noConformidad.findFirst();
  if (!nc) {
    console.log("No NC found");
    return;
  }
  
  const op = await prisma.operator.findFirst();

  const reqBody = {
      motivo: "Reunion Test",
      fecha: new Date().toISOString(),
      participantes: [op?.id],
      estado: "Programada"
  };

  try {
    const response = await fetch(`http://localhost:3000/api/sgi/nc/${nc.id}/reunion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqBody)
    });
    
    const data = await response.json();
    console.log("Status:", response.status);
    console.log("Response:", data);
  } catch (e) {
    console.error("Fetch error:", e);
  }
  await prisma.$disconnect();
}
test();
