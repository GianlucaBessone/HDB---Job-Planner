import { prisma } from '../lib/prisma';

async function main() {
  const prods = await prisma.producto.findMany({
    take: 5,
    include: {
      proveedores: { orderBy: [{ esPrincipal: 'desc' }, { orden: 'asc' }], take: 1 }
    }
  });

  for (const p of prods) {
    const costo = p.proveedores[0]?.costo ?? 0;
    const precioBase = p.precioBase;
    const rent = p.rentabilidad;
    const factor = rent > 0 ? (1 + rent / 100) : 1;
    const esperado = Math.round(costo * factor * 100) / 100;
    console.log({
      sku: p.sku,
      costo,
      rentabilidad: rent,
      precioBase,
      esperado,
      coincide: precioBase === esperado
    });
  }

  const totalProds = await prisma.producto.count();
  const conCosto = await prisma.productoProveedorVentas.count();
  const conRentabilidadConfigurada = await prisma.producto.count({ where: { rentabilidad: { gt: 0 } } });

  console.log({
    totalProds,
    conCosto,
    conRentabilidadConfigurada
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
