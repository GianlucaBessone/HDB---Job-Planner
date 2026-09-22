import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateOtNumber } from '@/lib/ot/counter';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clienteId = searchParams.get('clienteId') || undefined;
    const proyectoId = searchParams.get('proyectoId') || undefined;
    const estado = searchParams.get('estado') || undefined;
    const sector = searchParams.get('sector') || undefined;
    const responsableId = searchParams.get('responsableId') || undefined;
    const search = searchParams.get('search')?.trim() || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '30', 10)));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (clienteId) where.clienteId = clienteId;
    if (proyectoId) where.proyectoId = proyectoId;
    if (estado && estado !== 'TODAS') where.estado = estado;
    if (sector) where.sector = sector;
    if (responsableId) where.responsableId = responsableId;

    if (search) {
      where.OR = [
        { numeroOT: { contains: search, mode: 'insensitive' } },
        { refCliente: { contains: search, mode: 'insensitive' } },
        { reporteTrabajo: { contains: search, mode: 'insensitive' } },
        { sector: { contains: search, mode: 'insensitive' } },
        { proyecto: { nombre: { contains: search, mode: 'insensitive' } } },
        { cliente: { nombre: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [total, ots] = await Promise.all([
      prisma.ordenTrabajo.count({ where }),
      prisma.ordenTrabajo.findMany({
        where,
        include: {
          cliente: { select: { id: true, nombre: true } },
          proyecto: { select: { id: true, nombre: true, codigoProyecto: true } },
          responsable: { select: { id: true, nombreCompleto: true, role: true } },
          creador: { select: { id: true, nombreCompleto: true } },
          ciclos: {
            orderBy: { numeroCiclo: 'desc' },
            select: {
              id: true,
              numeroCiclo: true,
              periodo: true,
              estado: true,
              totalHoras: true,
              totalManoObra: true,
              totalMateriales: true,
              totalGeneral: true,
              hashIntegridad: true,
              fechaFirma: true,
            },
          },
          _count: {
            select: { comentarios: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      data: ots,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Error in GET /api/ordenes-trabajo:', error);
    return NextResponse.json({ error: error.message || 'Error al obtener órdenes de trabajo' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clienteId, proyectoId, responsableId, sector, reporteTrabajo, refCliente, creadorId } = body;

    if (!clienteId || !proyectoId || !responsableId || !reporteTrabajo?.trim()) {
      return NextResponse.json(
        { error: 'Cliente, proyecto, responsable y reporte de trabajo son obligatorios' },
        { status: 400 }
      );
    }

    const effectiveCreadorId = creadorId || req.headers.get('x-user-id') || responsableId;

    // Verificar existencia de entidades
    const [client, project, responsable, creador] = await Promise.all([
      prisma.hdbClient.findUnique({ where: { id: clienteId } }),
      prisma.project.findUnique({ where: { id: proyectoId } }),
      prisma.operator.findUnique({ where: { id: responsableId } }),
      prisma.operator.findUnique({ where: { id: effectiveCreadorId } }),
    ]);

    if (!client) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    if (!project) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    if (!responsable) return NextResponse.json({ error: 'Responsable no encontrado' }, { status: 404 });
    if (!creador) return NextResponse.json({ error: 'Creador no encontrado' }, { status: 404 });

    // Generar número atómico seguro
    const { numeroOT, numeroSecuencial, anio } = await generateOtNumber();

    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const nuevaOT = await prisma.$transaction(async (tx) => {
      const ot = await tx.ordenTrabajo.create({
        data: {
          numeroOT,
          numeroSecuencial,
          anio,
          refCliente: refCliente?.trim() || null,
          clienteId,
          proyectoId,
          sector: sector?.trim() || null,
          reporteTrabajo: reporteTrabajo.trim(),
          creadorId: effectiveCreadorId,
          responsableId,
          estado: 'ABIERTA',
        },
      });

      // Auto-guardar nueva ubicación en ClientSector si no existe
      if (sector?.trim()) {
        const trimmedSector = sector.trim();
        const existingSector = await tx.clientSector.findFirst({
          where: {
            clientId: clienteId,
            nombre: { equals: trimmedSector, mode: 'insensitive' },
          },
        });
        if (!existingSector) {
          await tx.clientSector.create({
            data: {
              clientId: clienteId,
              nombre: trimmedSector,
              projectId: proyectoId,
            },
          });
        }
      }

      // Crear Ciclo inicial 1 (ABIERTO)
      await tx.otCiclo.create({
        data: {
          ordenTrabajoId: ot.id,
          numeroCiclo: 1,
          periodo: currentPeriod,
          estado: 'ABIERTO',
        },
      });

      // Registrar historial inicial de estado
      await tx.otHistorialEstado.create({
        data: {
          ordenTrabajoId: ot.id,
          estadoAnterior: 'NUEVA',
          estadoNuevo: 'ABIERTA',
          usuarioId: effectiveCreadorId,
          usuarioNombre: creador.nombreCompleto,
          motivo: 'Creación de orden de trabajo',
        },
      });

      return ot;
    });

    await logAudit({
      userId: effectiveCreadorId,
      userName: creador.nombreCompleto,
      action: 'CREATE',
      entity: 'ORDEN_TRABAJO',
      entityId: nuevaOT.id,
      newValue: { numeroOT, refCliente, clienteId, proyectoId, sector },
    });

    return NextResponse.json(nuevaOT, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/ordenes-trabajo:', error);
    return NextResponse.json({ error: error.message || 'Error al crear orden de trabajo' }, { status: 500 });
  }
}
