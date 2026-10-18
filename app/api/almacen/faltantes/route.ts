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
    const familiaId = searchParams.get('familiaId') || undefined;
    const proveedorId = searchParams.get('proveedorId') || undefined;
    const filtroCondicion = searchParams.get('condicion') || 'necesitan_reposicion'; // 'necesitan_reposicion' | 'sin_stock' | 'bajo_minimo' | 'sobre_maximo' | 'sin_limites' | 'todos'
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const sortBy = searchParams.get('sortBy') || 'sku';
    const sortOrder = (searchParams.get('sortOrder') || 'asc') as 'asc' | 'desc';

    // Mapear condición a EstadoStock
    let estadoStock: EstadoStock | '' | 'necesitan_reposicion' = '';
    if (filtroCondicion === 'necesitan_reposicion') estadoStock = 'necesitan_reposicion';
    else if (filtroCondicion === 'sin_stock') estadoStock = 'sin_stock';
    else if (filtroCondicion === 'bajo_minimo') estadoStock = 'bajo_minimo';
    else if (filtroCondicion === 'sobre_maximo') estadoStock = 'sobre_maximo';
    else if (filtroCondicion === 'sin_limites') estadoStock = 'no_configurado';

    const result = await StockService.consultarStock({
      q,
      almacenId,
      familiaId,
      proveedorId,
      estadoStock: estadoStock || undefined,
      page,
      limit,
      sortBy,
      sortOrder,
    });

    return NextResponse.json({
      items: result.items,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
      condicion: filtroCondicion,
      aviso: 'La cantidad sugerida es una recomendación operativa basada en límites configurados, no constituye una orden de compra automática.',
    });
  } catch (error: any) {
    console.error('Error al consultar faltantes de stock:', error);
    return NextResponse.json(
      { error: error.message || 'Error al consultar reporte de reposición' },
      { status: 500 }
    );
  }
}
