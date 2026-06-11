const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando migración de PINs...');
  
  const operators = await prisma.operator.findMany();
  console.log(`Se encontraron ${operators.length} operadores.`);

  let actualizados = 0;
  let yaHasheados = 0;

  for (const op of operators) {
    if (!op.pin) continue;
    
    // Verificar si el PIN ya parece estar hasheado (los hashes de bcrypt empiezan con $2a$, $2b$ o $2y$ y tienen 60 caracteres)
    if (op.pin.startsWith('$2') && op.pin.length === 60) {
      yaHasheados++;
      continue;
    }

    // Hashear el PIN en texto plano
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(op.pin, salt);

    // Actualizar el operador en la base de datos
    await prisma.operator.update({
      where: { id: op.id },
      data: { pin: hash }
    });

    actualizados++;
    console.log(`- Operador ${op.nombreCompleto} (${op.id}) migrado.`);
  }

  console.log('--- Migración completada ---');
  console.log(`Total actualizados: ${actualizados}`);
  console.log(`Ya hasheados previamiente: ${yaHasheados}`);
}

main()
  .catch((e) => {
    console.error('Error durante la migración:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
