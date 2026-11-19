import { NextRequest, NextResponse } from 'next/server';
import { listarResumenCuentasCorrientes } from '@/lib/ventas/cuentaCorrienteService';
import { exigirAcceso } from '@/lib/permisosServer';

export async function GET(req: NextRequest) {
  try {
    const acceso = await exigirAcceso(req, ['ventas.cc_ver'], 'No tenés permiso para ver cuentas corrientes');
    if (acceso instanceof NextResponse) return acceso;

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim() || '';
    const estadoDeuda = (searchParams.get('estadoDeuda') || 'TODOS') as any;
    const soloConActividad = searchParams.get('soloConActividad') === 'true';

    const data = await listarResumenCuentasCorrientes({
      q,
      estadoDeuda,
      soloConActividad,
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error en GET /api/ventas/cuentas-corrientes:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener cuentas corrientes' },
      { status: 500 }
    );
  }
}
