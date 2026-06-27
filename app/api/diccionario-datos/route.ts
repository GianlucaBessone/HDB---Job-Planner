import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSGIRole } from '@/lib/sgiAuth';
import { sincronizarDiccionario } from '@/lib/diccionarioDatos';

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

        if (body.action === 'sincronizar') {
            const resultado = await sincronizarDiccionario();
            return NextResponse.json({
                success: true,
                message: `Sincronización completada: ${resultado.tablasCreadas} tablas creadas, ${resultado.tablasActualizadas} actualizadas, ${resultado.camposActualizados} campos procesados.`,
                ...resultado,
            });
        }

        return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    } catch (error) {
        console.error('Error en diccionario:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}
