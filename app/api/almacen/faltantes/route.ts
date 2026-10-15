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
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Mapear condición a EstadoStock
    let estadoStock: EstadoStock | '' = '';
    if (filtroCondicion === 'sin_stock') estadoStock = 'sin_stock';
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
      limit: filtroCondicion === 'necesitan_reposicion' ? 200 : limit,
      sortBy: 'sku',
    });

    let items = result.items;
    if (filtroCondicion === 'necesitan_reposicion') {
      // Artículos sin stock o bajo mínimo que tengan cantidad sugerida o stock <= 0
      items = items.filter(
        (it) => it.estadoStock === 'sin_stock' || it.estadoStock === 'bajo_minimo'
      );
    }

    return NextResponse.json({
      items,
      total: items.length,
      page,
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
