import { NextRequest, NextResponse } from 'next/server';
import { StockService } from '@/lib/inventario/stockService';
import { verificarPermisoInventario } from '@/lib/inventario/permisos';
import { EstadoStock } from '@/lib/inventario/types';

export async function GET(req: NextRequest) {
  try {
    const auth = verificarPermisoInventario(req, 'consultar_stock');
    if (auth.error) return auth.error;

    const { searchParams } = new URL(req.url);

    const q = searchParams.get('q') || undefined;
    const almacenId = searchParams.get('almacenId') || undefined;
    const ubicacionId = searchParams.get('ubicacionId') || undefined;
    const categoriaId = searchParams.get('categoriaId') || undefined;
    const marcaId = searchParams.get('marcaId') || undefined;
    const familiaId = searchParams.get('familiaId') || undefined;
    const subFamiliaId = searchParams.get('subFamiliaId') || undefined;
    const estadoStock = (searchParams.get('estadoStock') || '') as EstadoStock | '';
    const proveedorId = searchParams.get('proveedorId') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const sortBy = searchParams.get('sortBy') || 'sku';
    const sortOrder = (searchParams.get('sortOrder') || 'asc') as 'asc' | 'desc';

    const result = await StockService.consultarStock({
      q,
      almacenId,
      ubicacionId,
      categoriaId,
      marcaId,
      familiaId,
      subFamiliaId,
      estadoStock,
      proveedorId,
      page,
      limit,
      sortBy,
      sortOrder,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error al consultar stock:', error);
    return NextResponse.json(
      { error: error.message || 'Error al consultar existencias' },
      { status: 500 }
    );
  }
}
