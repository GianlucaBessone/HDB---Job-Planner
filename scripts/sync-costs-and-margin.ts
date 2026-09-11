import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Sincronizando Costos desde MaterialMaestro y aplicando Rentabilidad 41.5% ---');

  // 1. Obtener el proveedor principal predeterminado
  let prov = await prisma.proveedorVentas.findFirst({
    where: { activo: true },
    orderBy: { createdAt: 'asc' },
  });

  if (!prov) {
    prov = await prisma.proveedorVentas.create({
      data: {
        codigo: 'PV-001',
        razonSocial: 'Distribuidora Eléctrica Central S.A.',
        nombreFantasia: 'ElectroCentral',
        activo: true,
      },
    });
    console.log('Creado proveedor principal por defecto:', prov.id);
  } else {
    console.log('Proveedor principal existente:', prov.razonSocial, `(${prov.id})`);
  }

  // 2. Obtener todos los materiales con costo de MaterialMaestro
  const materiales = await prisma.materialMaestro.findMany({
    where: { costo: { not: null, gt: 0 } },
    select: { codigo: true, costo: true, precioVenta: true },
  });
  console.log(`Materiales con costo encontrados: ${materiales.length}`);

  const matMap = new Map<string, { costo: number; precioVenta: number | null }>();
  for (const m of materiales) {
    if (m.codigo && m.costo) {
      const code = m.codigo.trim();
      matMap.set(code, { costo: m.costo, precioVenta: m.precioVenta });
      matMap.set(code.toUpperCase(), { costo: m.costo, precioVenta: m.precioVenta });
      const unpadded = code.replace(/^0+/, '');
      if (unpadded) {
        matMap.set(unpadded, { costo: m.costo, precioVenta: m.precioVenta });
      }
      const padded = /^\d+$/.test(code) && code.length <= 5 ? code.padStart(5, '0') : code;
      matMap.set(padded, { costo: m.costo, precioVenta: m.precioVenta });
    }
  }

  // 3. Obtener todos los productos
  const productos = await prisma.producto.findMany({
    select: {
      id: true,
      sku: true,
      precioBase: true,
      rentabilidad: true,
      proveedores: { select: { id: true, costo: true } },
    },
  });
  console.log(`Total productos a procesar: ${productos.length}`);

  let actualizadosCosto = 0;
  let actualizadosRentabilidad = 0;
  let actualizadosPrecio = 0;

  const RENTABILIDAD_OBJETIVO = 41.5;
  const FACTOR_MARGEN = 1 + RENTABILIDAD_OBJETIVO / 100; // 1.415

  const BATCH_SIZE = 100;
  for (let i = 0; i < productos.length; i += BATCH_SIZE) {
    const batch = productos.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (p) => {
        const skuTrim = p.sku.trim();
        const mat =
          matMap.get(skuTrim) ||
          matMap.get(skuTrim.toUpperCase()) ||
          matMap.get(skuTrim.replace(/^0+/, '')) ||
          matMap.get(/^\d+$/.test(skuTrim) && skuTrim.length <= 5 ? skuTrim.padStart(5, '0') : skuTrim);

        const costo = mat?.costo ?? p.proveedores[0]?.costo ?? 0;
        const costoRedondeado = Math.round(costo * 100) / 100;

        // Calcular nuevo precio base si hay costo
        let nuevoPrecioBase = p.precioBase;
        if (costoRedondeado > 0) {
          nuevoPrecioBase = Math.round(costoRedondeado * FACTOR_MARGEN * 100) / 100;
        }

        // 1. Actualizar o crear ProductoProveedorVentas
        if (p.proveedores.length > 0) {
          if (costoRedondeado > 0 && p.proveedores[0].costo !== costoRedondeado) {
            await prisma.productoProveedorVentas.update({
              where: { id: p.proveedores[0].id },
              data: { costo: costoRedondeado },
            });
            actualizadosCosto++;
          }
        } else if (costoRedondeado > 0) {
          await prisma.productoProveedorVentas.create({
            data: {
              productoId: p.id,
              proveedorId: prov!.id,
              costo: costoRedondeado,
              esPrincipal: true,
              orden: 1,
            },
          });
          actualizadosCosto++;
        }

        // 2. Actualizar Producto con rentabilidad 41.5% y precio base si corresponde
        await prisma.producto.update({
          where: { id: p.id },
          data: {
            rentabilidad: RENTABILIDAD_OBJETIVO,
            ...(costoRedondeado > 0 ? { precioBase: nuevoPrecioBase } : {}),
          },
        });

        actualizadosRentabilidad++;
        if (costoRedondeado > 0) actualizadosPrecio++;
      })
    );
  }

  console.log(`\nResumen de actualización:`);
  console.log(`- Costos asignados/actualizados: ${actualizadosCosto} productos`);
  console.log(`- Rentabilidad fijada en 41.5%: ${actualizadosRentabilidad} productos`);
  console.log(`- Precios base recalculados (Costo * 1.415): ${actualizadosPrecio} productos`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
