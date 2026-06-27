import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSGIRole } from '@/lib/sgiAuth';
import { getTablesToSync, syncTable, cleanupSync } from '@/lib/diccionarioDatos';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const auth = requireSGIRole(req, ['supervisor', 'admin', 'qa']);
    if (auth.error) return auth.error;

    try {
        const { searchParams } = new URL(req.url);
        const incluirOcultas = searchParams.get('incluirOcultas') === 'true';
        const incluirCampos = searchParams.get('incluirCampos') === 'true';

        const where: any = {};
        if (!incluirOcultas) where.oculta = false;

        const tablas = await prisma.diccionarioTabla.findMany({
            where,
            include: {
                campos: incluirCampos ? {
                    orderBy: { nombreCampo: 'asc' }
                } : false,
                _count: { select: { campos: true } },
            },
            orderBy: { nombreTabla: 'asc' },
        });

        return NextResponse.json(tablas);
    } catch (error) {
        console.error('Error fetching diccionario:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const auth = requireSGIRole(req, ['supervisor', 'admin']);
    if (auth.error) return auth.error;

    try {
        const body = await req.json();

        if (body.action === 'sync-start') {
            const tables = await getTablesToSync();
            return NextResponse.json({ tables });
        }

        if (body.action === 'sync-table') {
            const { tabla } = body;
            if (!tabla) return NextResponse.json({ error: 'Tabla no especificada' }, { status: 400 });
            
            const result = await syncTable(tabla);
            return NextResponse.json({ success: true, ...result });
        }

        if (body.action === 'sync-finish') {
            const { validTables } = body;
            if (!Array.isArray(validTables)) return NextResponse.json({ error: 'Faltan tablas válidas' }, { status: 400 });
            
            const result = await cleanupSync(validTables);
            return NextResponse.json({ success: true, ...result });
        }

        return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    } catch (error) {
        console.error('Error en diccionario:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}
