import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { StockService } from '@/lib/inventario/stockService';
import { verificarPermisoInventario } from '@/lib/inventario/permisos';

const revertirSchema = z.object({
  motivo: z.string().min(1, 'El motivo de reversión es obligatorio'),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = verificarPermisoInventario(req, 'ajustar_stock');
    if (auth.error) return auth.error;

    const body = await req.json();
    const data = revertirSchema.parse(body);

    const result = await StockService.revertirMovimiento({
      movimientoId: params.id,
      motivo: data.motivo,
      usuarioId: auth.usuario?.id,
      userRole: auth.usuario?.role,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error al revertir movimiento:', error);
    return NextResponse.json(
      { error: error.message || 'Error al revertir movimiento' },
      { status: 500 }
    );
  }
}
