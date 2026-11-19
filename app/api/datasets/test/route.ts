import { NextRequest, NextResponse } from 'next/server';
import { exigirAcceso } from '@/lib/permisosServer';
import { testearSQL, construirSQLDesdeVisual, DefinicionVisual } from '@/lib/datasetEngine';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const auth = await exigirAcceso(req, ['datasets.usar', 'datasets.gestionar']);
    if (auth instanceof NextResponse) return auth;

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
