import { NextRequest, NextResponse } from 'next/server';
import { requireSGIRole } from '@/lib/sgiAuth';
import { testearSQL } from '@/lib/datasetEngine';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const auth = requireSGIRole(req, ['supervisor', 'admin', 'qa']);
    if (auth.error) return auth.error;

    try {
        const body = await req.json();
        const { sql } = body;

        if (!sql) {
            return NextResponse.json({ error: 'Falta la consulta SQL' }, { status: 400 });
        }

        const resultado = await testearSQL(sql, { limite: 10 });
        
        return NextResponse.json(resultado);
    } catch (error: any) {
        console.error('Error test dataset:', error);
        return NextResponse.json({
            error: error.message || 'Error al ejecutar la consulta de prueba',
        }, { status: 500 });
    }
}
