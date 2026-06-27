import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSGIRole } from '@/lib/sgiAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { tablaId: string } }) {
    const auth = requireSGIRole(req, ['supervisor', 'admin', 'qa']);
    if (auth.error) return auth.error;

    try {
        const tabla = await prisma.diccionarioTabla.findUnique({
            where: { id: params.tablaId },
            include: {
                campos: {
                    orderBy: [
                        { esClavePrimaria: 'desc' },
                        { esClaveForanea: 'desc' },
                        { nombreCampo: 'asc' },
                    ],
                },
            },
        });

        if (!tabla) {
            return NextResponse.json({ error: 'Tabla no encontrada' }, { status: 404 });
        }

        return NextResponse.json(tabla);
    } catch (error) {
        console.error('Error fetching tabla:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}

export async function PUT(req: NextRequest, { params }: { params: { tablaId: string } }) {
    const auth = requireSGIRole(req, ['supervisor', 'admin']);
    if (auth.error) return auth.error;

    try {
        const body = await req.json();

        // Actualizar descripción de tabla
        if (body.descripcion !== undefined) {
            await prisma.diccionarioTabla.update({
                where: { id: params.tablaId },
                data: { descripcion: body.descripcion },
            });
        }

        // Actualizar oculta
        if (body.oculta !== undefined) {
            await prisma.diccionarioTabla.update({
                where: { id: params.tablaId },
                data: { oculta: body.oculta },
            });
        }

        // Actualizar descripción de campos
        if (body.campos && Array.isArray(body.campos)) {
            for (const campo of body.campos) {
                if (campo.id && campo.descripcion !== undefined) {
                    await prisma.diccionarioCampo.update({
                        where: { id: campo.id },
                        data: { descripcion: campo.descripcion },
                    });
                }
            }
        }

        const tablaActualizada = await prisma.diccionarioTabla.findUnique({
            where: { id: params.tablaId },
            include: { campos: { orderBy: { nombreCampo: 'asc' } } },
        });

        return NextResponse.json(tablaActualizada);
    } catch (error) {
        console.error('Error updating tabla:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}
