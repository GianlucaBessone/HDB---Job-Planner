import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { StockService } from '@/lib/inventario/stockService';
import { verificarPermisoInventario } from '@/lib/inventario/permisos';

const confirmarConteoSchema = z.object({
  observacionesFinales: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const auth = verificarPermisoInventario(req, 'conteos_confirmar');
    if (auth.error) return auth.error;

    let observacionesFinales: string | undefined;
    try {
      const body = await req.json();
      const parsed = confirmarConteoSchema.parse(body);
      observacionesFinales = parsed.observacionesFinales;
    } catch {
      // Body opcional
    }

    const result = await StockService.confirmarConteo({
      conteoId: params.id,
      observacionesFinales,
      usuarioId: auth.usuario?.id,
      usuarioNombre: auth.usuario?.nombreCompleto,
      userRole: auth.usuario?.role,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error confirmando conteo:', error);
    return NextResponse.json(
      { error: error.message || 'Error al confirmar conteo de inventario' },
      { status: 500 }
    );
  }
}
