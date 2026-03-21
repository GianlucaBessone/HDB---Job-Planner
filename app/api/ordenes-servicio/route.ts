import { NextResponse } from 'next/server';
import { prisma } from '@/lib/dataLayer';

// GET /api/ordenes-servicio  — listado para admin/supervisor
// GET /api/ordenes-servicio?projectId=xxx  — OS de un proyecto
export async function GET(req: Request) {
    const url = new URL(req.url);
    const projectId = url.searchParams.get('projectId');

    try {
        const ordenes = await prisma.ordenServicio.findMany({
            where: projectId ? { projectId } : undefined,
            include: {
                project: { select: { id: true, nombre: true, client: { select: { nombre: true } }, cliente: true } },
                materiales: true,
                operadores: { include: { operador: { select: { id: true, nombreCompleto: true } } } },
                firma: true,
            },
            orderBy: { fechaCreacion: 'desc' },
        });
        return NextResponse.json(ordenes);
    } catch (e) {
        console.error('GET ordenes-servicio error:', e);
        return NextResponse.json({ error: 'Error al obtener órdenes de servicio', details: String(e) }, { status: 500 });
    }
}

// POST /api/ordenes-servicio — crear nueva OS
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { projectId, reporte, materiales, operadores } = body;

        if (!projectId || !reporte) {
            return NextResponse.json({ error: 'projectId y reporte son obligatorios' }, { status: 400 });
        }
        if (!operadores || operadores.length === 0) {
            return NextResponse.json({ error: 'Debe haber al menos un operador con horas' }, { status: 400 });
        }
        for (const op of operadores) {
            if (!op.operadorId || !op.horas || op.horas <= 0) {
                return NextResponse.json({ error: 'Todos los operadores deben tener horas > 0' }, { status: 400 });
            }
        }
        if (materiales && materiales.length > 0) {
            for (const m of materiales) {
                if (!m.material || !m.cantidad || !m.unidadMedida) {
                    return NextResponse.json({ error: 'Todos los campos de materiales son obligatorios' }, { status: 400 });
                }
            }
        }

        const os = await prisma.ordenServicio.create({
            data: {
                projectId,
                reporte,
                estado: 'pendiente',
                materiales: {
                    create: (materiales || []).map((m: any) => ({
                        material: m.material,
                        cantidad: Number(m.cantidad),
                        unidadMedida: m.unidadMedida,
                    })),
                },
                operadores: {
                    create: operadores.map((op: any) => ({
                        operadorId: op.operadorId,
                        horas: Number(op.horas),
                    })),
                },
            },
            include: {
                project: { select: { nombre: true, client: { select: { nombre: true } }, cliente: true } },
                materiales: true,
                operadores: { include: { operador: { select: { id: true, nombreCompleto: true } } } },
                firma: true,
            },
        });

        return NextResponse.json(os);
    } catch (e) {
        console.error('POST ordenes-servicio error:', e);
        return NextResponse.json({ error: 'Error al crear la orden de servicio', details: String(e) }, { status: 500 });
    }
}
