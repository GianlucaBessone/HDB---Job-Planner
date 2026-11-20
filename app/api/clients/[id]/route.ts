import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAcceso } from '@/lib/permisosServer';

export const dynamic = 'force-dynamic';

/**
 * Ficha del cliente: datos, lista de precios, cantidades de lo que tiene
 * registrado y sus proyectos. La configuración de OT, el portal y la cuenta
 * corriente se piden aparte, cada uno con su permiso.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const acceso = await getAcceso(req);
    if (!acceso.userId) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    const { id } = await params;

    const cliente = await prisma.hdbClient.findUnique({
        where: { id },
        include: {
            listaPrecio: { select: { id: true, nombre: true, codigo: true } },
            configuracion: { select: { porcentajeMateriales: true, habilitadoOT: true } },
            _count: {
                select: {
                    projects: true, ordenesTrabajo: true, ventas: true, cotizaciones: true,
                    presupuestosServicio: true, responsables: true, sectores: true,
                },
            },
            projects: {
                select: { id: true, nombre: true, codigoProyecto: true, estado: true, activo: true, fechaInicio: true },
                orderBy: { createdAt: 'desc' },
                take: 50,
            },
        },
    });
    if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });

    return NextResponse.json(cliente, { headers: { 'Cache-Control': 'private, no-store' } });
}
