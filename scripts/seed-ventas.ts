import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedVentas() {
  console.log('Seeding Ventas base data...');

  // 1. Listas de Precios
  const listas = [
    { codigo: 'LISTA_1', nombre: 'Lista de Precio 1', descripcion: 'Precio Minorista / Mostrador', orden: 1 },
    { codigo: 'LISTA_2', nombre: 'Lista de Precio 2', descripcion: 'Precio Gremio / Instalador', orden: 2 },
    { codigo: 'LISTA_3', nombre: 'Lista de Precio 3', descripcion: 'Precio Mayorista / Distribuidor', orden: 3 },
  ];

  for (const l of listas) {
    await prisma.listaPrecio.upsert({
      where: { codigo: l.codigo },
      update: { nombre: l.nombre, descripcion: l.descripcion, orden: l.orden },
      create: l,
    });
  }
  console.log('✔ Listas de precios listas');

  // 2. Alícuotas de IVA
  const alicuotas = [
    { porcentaje: 21.0, nombre: '21%', predeterminado: true },
    { porcentaje: 10.5, nombre: '10.5%', predeterminado: false },
    { porcentaje: 27.0, nombre: '27%', predeterminado: false },
    { porcentaje: 0.0, nombre: '0% (Exento)', predeterminado: false },
    { porcentaje: 2.5, nombre: '2.5%', predeterminado: false },
    { porcentaje: 5.0, nombre: '5%', predeterminado: false },
  ];

  for (const a of alicuotas) {
    await prisma.ivaAlicuota.upsert({
      where: { porcentaje: a.porcentaje },
      update: { nombre: a.nombre, predeterminado: a.predeterminado },
      create: a,
    });
  }
  console.log('✔ Alícuotas de IVA listas');

  // 3. Almacén Central predeterminado
  const almacen = await prisma.almacen.upsert({
    where: { codigo: 'ALM-CENTRAL' },
    update: { esPredeterminado: true, activo: true },
    create: {
      codigo: 'ALM-CENTRAL',
      nombre: 'Almacén Central',
      descripcion: 'Depósito principal de mercadería',
      esPredeterminado: true,
      activo: true,
    },
  });

  await prisma.almacenUbicacion.upsert({
    where: {
      almacenId_codigo: {
        almacenId: almacen.id,
        codigo: 'GENERAL',
      },
    },
    update: { nombre: 'Ubicación General' },
    create: {
      almacenId: almacen.id,
      codigo: 'GENERAL',
      nombre: 'Ubicación General',
      activo: true,
    },
  });
  console.log('✔ Almacén y ubicación predeterminados listos');

  console.log('Seeding Ventas completado con éxito.');
}

seedVentas()
  .catch((e) => {
    console.error('Error seeding ventas:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
