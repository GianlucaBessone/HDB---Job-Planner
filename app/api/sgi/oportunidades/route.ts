import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exigirAcceso } from '@/lib/permisosServer';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const auth = await exigirAcceso(req, ['calidad.ver', 'calidad.gestionar']);
    if (auth instanceof NextResponse) return auth;

    try {
        const { searchParams } = new URL(req.url);
        const estado = searchParams.get('estado');

        const where: any = {};
        if (estado) where.estado = estado;

        const opts = await prisma.oportunidad.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(opts);
    } catch (error) {
        console.error('Error fetching Oportunidades:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const auth = await exigirAcceso(req, ['calidad.gestionar']);
    if (auth instanceof NextResponse) return auth;

    try {
        const body = await req.json();

        if (!body.titulo || !body.descripcion || !body.tipoOportunidad) {
            return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
        }

        let codigo = body.codigo;
        if (!codigo) {
            const year = new Date().getFullYear();
            const pattern = `OPT-${year}-`;
            const last = await prisma.oportunidad.findFirst({
                where: { codigo: { startsWith: pattern } },
                orderBy: { codigo: 'desc' },
                select: { codigo: true },
            });
            let lastNumber = 0;
            if (last?.codigo) {
                const parts = last.codigo.split('-');
                lastNumber = parseInt(parts[parts.length - 1], 10) || 0;
            }
            codigo = `OPT-${year}-${String(lastNumber + 1).padStart(4, '0')}`;
        }

        const opt = await prisma.oportunidad.create({
            data: {
                codigo,
                titulo: body.titulo,
                descripcion: body.descripcion,
                tipoOportunidad: body.tipoOportunidad,
                beneficioEsperado: body.beneficioEsperado,
                estado: 'Identificada',
                responsableId: body.responsableId
            }
        });

        await logAudit({
            userId: auth.userId,
            action: 'CREATE',
            entity: 'OPORTUNIDAD',
            entityId: opt.id,
            newValue: opt
        });

        return NextResponse.json(opt, { status: 201 });
    } catch (error) {
        console.error('Error creating Oportunidad:', error);
        return NextResponse.json({ error: 'Error del servidor al crear Oportunidad' }, { status: 500 });
    }
}
