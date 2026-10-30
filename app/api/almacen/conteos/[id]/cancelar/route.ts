import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { StockService } from '@/lib/inventario/stockService';
import { verificarPermisoInventario } from '@/lib/inventario/permisos';

const cancelarConteoSchema = z.object({
  motivo: z.string().min(1, 'El motivo de cancelación es obligatorio'),
});

export async function POST(
  req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const auth = verificarPermisoInventario(req, 'conteos_crear');
    if (auth.error) return auth.error;

    const body = await req.json();
    const data = cancelarConteoSchema.parse(body);

    const result = await StockService.cancelarConteo(
      params.id,
      data.motivo,
      auth.usuario?.id
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error cancelando conteo:', error);
    return NextResponse.json(
      { error: error.message || 'Error al cancelar conteo' },
      { status: 500 }
    );
  }
}
