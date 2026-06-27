import { NextRequest, NextResponse } from 'next/server';
import { requireSGIRole } from '@/lib/sgiAuth';
import { testearSQL, construirSQLDesdeVisual, DefinicionVisual } from '@/lib/datasetEngine';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const auth = requireSGIRole(req, ['supervisor', 'admin', 'qa']);
    if (auth.error) return auth.error;

    try {
        const body = await req.json();
        const { sql, modoConsulta, definicionVisual } = body;

        let queryToExecute = sql;

        if (modoConsulta === 'Visual' && definicionVisual) {
            queryToExecute = construirSQLDesdeVisual(definicionVisual as unknown as DefinicionVisual);
        }

        if (!queryToExecute) {
            return NextResponse.json({ error: 'Falta la consulta SQL o definición visual válida' }, { status: 400 });
        }

        const resultado = await testearSQL(queryToExecute, { limite: 10 });
        
        return NextResponse.json(resultado);
    } catch (error: any) {
        console.error('Error test dataset:', error);
        return NextResponse.json({
            error: error.message || 'Error al ejecutar la consulta de prueba',
        }, { status: 500 });
    }
}
