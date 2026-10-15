import { NextRequest, NextResponse } from 'next/server';
import { StockService } from '@/lib/inventario/stockService';
import { verificarPermisoInventario } from '@/lib/inventario/permisos';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = verificarPermisoInventario(req, 'conteos_contar');
    if (auth.error) return auth.error;

    const result = await StockService.finalizarCapturaConteo(
      params.id,
      auth.usuario?.id,
      auth.usuario?.nombreCompleto
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error finalizando captura de conteo:', error);
    return NextResponse.json(
      { error: error.message || 'Error al finalizar captura' },
      { status: 500 }
    );
  }
}
