import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateCodigoOS } from '@/lib/codeGenerator';

// GET /api/ordenes-servicio  — listado para admin/supervisor
// GET /api/ordenes-servicio?projectId=xxx  — OS de un proyecto
export async function GET(req: Request) {
    const url = new URL(req.url);
    const projectId = url.searchParams.get('projectId');

    try {
        const ordenes = await prisma.ordenServicio.findMany({
            where: projectId ? { projectId } : undefined,
            include: {
                project: { select: { id: true, nombre: true, codigoProyecto: true, client: { select: { nombre: true } }, cliente: true } },
                materiales: true,
                operadores: { include: { operador: { select: { id: true, nombreCompleto: true } } } },
                firma: {
                    select: {
                        id: true,
                        nombre: true,
                        dni: true,
                        fechaFirma: true
                        // EXCLUDING firmaImagen intentionally to save payload size (~100KB per OS) and drop TTFB.
                    }
                },
            },
            orderBy: { fechaCreacion: 'desc' },
        });
        
        // Use stale-while-revalidate to cache the heavy DB query and drop API TTFB to 0ms for subsequent requests
        return NextResponse.json(ordenes, {
            headers: {
                'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=30',
            },
        });
    } catch (e) {
        console.error('GET ordenes-servicio error:', e);
        return NextResponse.json({ error: 'Error al obtener órdenes de servicio', details: String(e) }, { status: 500 });
    }
}

// POST /api/ordenes-servicio — crear nueva OS
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { projectId, reporte, materiales, operadores, comentario } = body;

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

        // 1) Create OS and update project hours via service
        const { createOrdenServicio } = await import('@/lib/services/osService');
        const os = await createOrdenServicio({ projectId, reporte, materiales, operadores, comentario });

        // 2) Synchronize materials with the dynamic provisioning system
        const { syncInventoryForOS } = await import('@/lib/services/inventorySyncService');
        await syncInventoryForOS(os, materiales, operadores);

        // 3) INTEGRACIÓN QMS: Auto-asignación de Documentos y Checklists
        const { autoAssignQMSForOS } = await import('@/lib/services/qmsAssignationService');
        await autoAssignQMSForOS(os);

        return NextResponse.json(os);
    } catch (e) {
        console.error('POST ordenes-servicio error:', e);
        return NextResponse.json({ error: 'Error al crear la orden de servicio', details: String(e) }, { status: 500 });
    }
}
