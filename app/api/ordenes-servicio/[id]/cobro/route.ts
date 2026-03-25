import { NextResponse } from 'next/server';
import { prisma } from '@/lib/dataLayer';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
    try {
        const { id } = params;
        const body = await req.json();

        const {
            valorManoObra,
            descuentoPorcentaje,
            aplicarIva,
            totalFinal,
            observaciones,
            condicionPago,
            materiales // Array de { id: string, precioUnitario: number }
        } = body;

        // 1. Update OS with cobro fields
        const osUpdated = await prisma.ordenServicio.update({
            where: { id },
            data: {
                cobroGenerado: true,
                cobroValorManoObra: valorManoObra,
                cobroDescuentoPorcentaje: descuentoPorcentaje,
                cobroAplicarIva: aplicarIva,
                cobroTotalFinal: totalFinal,
                cobroObservaciones: observaciones,
                cobroCondicionPago: condicionPago,
                cobroFechaGeneracion: new Date(),
                estado: 'cobrada'
            }
        });

        // 2. Update material prices if provided
        if (materiales && materiales.length > 0) {
            for (const mat of materiales) {
                await prisma.ordenServicioMaterial.update({
                    where: { id: mat.id },
                    data: { precioUnitario: mat.precioUnitario }
                });
            }
        }

        // Return updated OS with nested includes (same as the GET)
        const updatedOSFull = await prisma.ordenServicio.findUnique({
            where: { id },
            include: {
                project: { select: { id: true, nombre: true, codigoProyecto: true, client: { select: { nombre: true } }, cliente: true, responsableUser: { select: { nombreCompleto: true } } } },
                materiales: true,
                operadores: { include: { operador: { select: { id: true, nombreCompleto: true } } } },
                firma: true,
            }
        });

        return NextResponse.json(updatedOSFull);

    } catch (e) {
        console.error('PUT cobro error:', e);
        return NextResponse.json({ error: 'Error al guardar el cobro', details: String(e) }, { status: 500 });
    }
}
