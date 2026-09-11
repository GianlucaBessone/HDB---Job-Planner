// Force recompile after schema updates
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const [proveedores, marcas, familias, almacenes, alicuotasIva, listasPrecios, categorias, unidades] = await Promise.all([
      // Proveedores de Ventas
      prisma.proveedorVentas.findMany({
        where: { activo: true },
        select: {
          id: true,
          razonSocial: true,
          nombreFantasia: true,
          cuit: true,
          condicionIva: true,
        },
        orderBy: { razonSocial: 'asc' },
      }),
      // Marcas
      prisma.marca.findMany({
        where: { activo: true },
        select: { id: true, nombre: true },
        orderBy: { nombre: 'asc' },
      }),
      // Familias con subfamilias
      prisma.familia.findMany({
        where: { activo: true },
        select: {
          id: true,
          nombre: true,
          subfamilias: {
            where: { activo: true },
            select: { id: true, nombre: true },
            orderBy: { nombre: 'asc' },
          },
        },
        orderBy: { nombre: 'asc' },
      }),
      // Almacenes con ubicaciones
      prisma.almacen.findMany({
        where: { activo: true },
        select: {
          id: true,
          codigo: true,
          nombre: true,
          esPredeterminado: true,
          ubicaciones: {
            where: { activo: true },
            select: { id: true, codigo: true, nombre: true },
            orderBy: { codigo: 'asc' },
          },
        },
        orderBy: { nombre: 'asc' },
      }),
      // Alícuotas de IVA
      prisma.ivaAlicuota.findMany({
        where: { activo: true },
        select: { id: true, porcentaje: true, nombre: true, predeterminado: true },
        orderBy: { porcentaje: 'asc' },
      }),
      // Listas de Precios
      prisma.listaPrecio.findMany({
        where: { activo: true },
        select: {
          id: true,
          codigo: true,
          nombre: true,
          orden: true,
          tipoAjuste: true,
          valorAjuste: true,
          listaBaseId: true,
          aplicaA: true,
          familiaId: true,
          marcaId: true,
          activo: true,
        },
        orderBy: { orden: 'asc' },
      }),
      // Categorías
      prisma.categoria.findMany({
        where: { activo: true },
        select: { id: true, nombre: true },
        orderBy: { nombre: 'asc' },
      }),
      // Unidades de Medida
      prisma.unidadMedida.findMany({
        where: { activo: true },
        select: { id: true, codigo: true, nombre: true },
        orderBy: { codigo: 'asc' },
      }),
    ]);

    return NextResponse.json({
      proveedores,
      marcas,
      familias,
      almacenes,
      alicuotasIva,
      listasPrecios,
      categorias,
      unidades,
    });
  } catch (error: any) {
    console.error('Error fetching ventas meta:', error);
    return NextResponse.json({ error: 'Error al obtener metadatos de ventas', details: error.message }, { status: 500 });
  }
}
