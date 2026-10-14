import { NextRequest, NextResponse } from 'next/server';
import { searchMaterialsForOS } from '@/lib/services/materialSearchService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const listaPrecioId = searchParams.get('listaPrecioId') || undefined;
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 25;

    // Validación mínima: si es menor a 2 caracteres y no es un dígito numérico, devolver vacío
    const trimmed = query.trim();
    if (!trimmed) {
      return NextResponse.json({ materiales: [], totalCandidates: 0, hasMore: false });
    }

    if (trimmed.length < 2 && !/^\d+$/.test(trimmed)) {
      return NextResponse.json({
        materiales: [],
        totalCandidates: 0,
        hasMore: false,
        message: 'Mínimo 2 caracteres requeridos para búsqueda de texto',
      });
    }

    const results = await searchMaterialsForOS({
      query: trimmed,
      listaPrecioId: listaPrecioId || null,
      limit,
    });

    return NextResponse.json(results);
  } catch (error: any) {
    console.error('Error in GET /api/ordenes-servicio/materiales-search:', error);
    return NextResponse.json(
      { error: 'Error al buscar materiales en Gestión Comercial', details: error.message },
      { status: 500 }
    );
  }
}
