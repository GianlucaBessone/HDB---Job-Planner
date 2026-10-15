import { NextRequest, NextResponse } from 'next/server';
import { StockService } from '@/lib/inventario/stockService';
import { verificarPermisoInventario } from '@/lib/inventario/permisos';

export async function GET(req: NextRequest) {
  try {
    const auth = verificarPermisoInventario(req, 'consultar_movimientos');
    if (auth.error) return auth.error;

    const { searchParams } = new URL(req.url);

    const fechaDesde = searchParams.get('fechaDesde') || undefined;
    const fechaHasta = searchParams.get('fechaHasta') || undefined;
    const productoId = searchParams.get('productoId') || undefined;
    const sku = searchParams.get('sku') || undefined;
    const tipo = searchParams.get('tipo') || undefined;
    const almacenId = searchParams.get('almacenId') || undefined;
    const usuarioId = searchParams.get('usuarioId') || undefined;
    const motivo = searchParams.get('motivo') || undefined;
    const referencia = searchParams.get('referencia') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const result = await StockService.consultarMovimientos({
      fechaDesde,
      fechaHasta,
      productoId,
      sku,
      tipo,
      almacenId,
      usuarioId,
      motivo,
      referencia,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error al consultar movimientos:', error);
    return NextResponse.json(
      { error: error.message || 'Error al listar movimientos de inventario' },
      { status: 500 }
    );
  }
}
