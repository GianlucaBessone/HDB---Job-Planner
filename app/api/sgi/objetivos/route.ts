import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSGIRole } from '@/lib/sgiAuth';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const auth = requireSGIRole(req, ['supervisor', 'admin', 'qa']);
    if (auth.error) return auth.error;

    try {
        const { searchParams } = new URL(req.url);
        const estado = searchParams.get('estado');

        const where: any = {};
        if (estado) where.estado = estado;

        const objetivos = await prisma.objetivoCalidad.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(objetivos);
    } catch (error) {
        console.error('Error fetching Objetivos:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const auth = requireSGIRole(req, ['supervisor', 'admin', 'qa']);
    if (auth.error) return auth.error;

    try {
        const body = await req.json();

        if (!body.titulo || !body.descripcion || !body.indicador || !body.meta) {
            return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
        }

        let codigo = body.codigo;
        if (!codigo) {
            const year = new Date().getFullYear();
            const pattern = `OBJ-${year}-`;
            const last = await prisma.objetivoCalidad.findFirst({
                where: { codigo: { startsWith: pattern } },
                orderBy: { codigo: 'desc' },
                select: { codigo: true },
            });
            let lastNumber = 0;
            if (last?.codigo) {
                const parts = last.codigo.split('-');
                lastNumber = parseInt(parts[parts.length - 1], 10) || 0;
            }
            codigo = `OBJ-${year}-${String(lastNumber + 1).padStart(4, '0')}`;
        }

        const objetivo = await prisma.objetivoCalidad.create({
            data: {
                codigo,
                titulo: body.titulo,
                descripcion: body.descripcion,
                indicador: body.indicador,
                meta: body.meta,
                unidad: body.unidad,
                frecuenciaMedicion: body.frecuenciaMedicion,
                estado: 'Activo',
                periodo: body.periodo,
                responsableId: body.responsableId
            }
        });

        await logAudit({
            userId: auth.user.id,
            action: 'CREATE',
            entity: 'OBJETIVO',
            entityId: objetivo.id,
            newValue: objetivo
        });

        return NextResponse.json(objetivo, { status: 201 });
    } catch (error) {
        console.error('Error creating Objetivo:', error);
        return NextResponse.json({ error: 'Error del servidor al crear Objetivo' }, { status: 500 });
    }
}
