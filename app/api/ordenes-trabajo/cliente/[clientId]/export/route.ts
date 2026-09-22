import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as xlsx from 'xlsx';

export async function GET(
  req: NextRequest,
  { params }: { params: { clientId: string } }
) {
  try {
    const { clientId } = params;
    const { searchParams } = new URL(req.url);

    const format = (searchParams.get('format') || 'xlsx').toLowerCase();
    const estado = searchParams.get('estado') || 'TODAS';
    const proyectoId = searchParams.get('proyectoId') || 'TODOS';
    const fechaDesde = searchParams.get('fechaDesde') || '';
    const fechaHasta = searchParams.get('fechaHasta') || '';

    // 1. Verify client
    const client = await prisma.hdbClient.findUnique({
      where: { id: clientId },
      select: { id: true, nombre: true },
    });

    if (!client) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    // 2. Build where filter
    const where: any = {
      clienteId: clientId,
    };

    if (estado && estado !== 'TODAS') {
      where.estado = estado;
    }

    if (proyectoId && proyectoId !== 'TODOS') {
      where.proyectoId = proyectoId;
    }

    if (fechaDesde || fechaHasta) {
      where.createdAt = {};
      if (fechaDesde) {
        where.createdAt.gte = new Date(`${fechaDesde}T00:00:00.000Z`);
      }
      if (fechaHasta) {
        where.createdAt.lte = new Date(`${fechaHasta}T23:59:59.999Z`);
      }
    }

    // 3. Fetch OTs
    const ots = await prisma.ordenTrabajo.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        proyecto: {
          select: { id: true, nombre: true, codigoProyecto: true },
        },
        responsable: {
          select: { id: true, nombreCompleto: true },
        },
        creador: {
          select: { id: true, nombreCompleto: true },
        },
        ciclos: {
          orderBy: { numeroCiclo: 'asc' },
          include: {
            operadores: {
              include: {
                operador: { select: { id: true, nombreCompleto: true } },
              },
            },
            materiales: true,
            responsableCliente: true,
          },
        },
      },
    });

    // 4. Transform data for Sheet 1: Resumen de OTs
    const rowsResumen = ots.map((ot) => {
      const totalHoras = ot.ciclos.reduce((sum, c) => sum + (c.totalHoras || 0), 0);
      const totalManoObra = ot.ciclos.reduce((sum, c) => sum + (c.totalManoObra || 0), 0);
      const totalMateriales = ot.ciclos.reduce((sum, c) => sum + (c.totalMateriales || 0), 0);
      const totalGeneral = ot.ciclos.reduce((sum, c) => sum + (c.totalGeneral || 0), 0);

      // Ultimo firmante if any
      const signedCycle = [...ot.ciclos].reverse().find((c) => c.fechaFirma);
      const firmante = signedCycle
        ? signedCycle.firmanteNombre || signedCycle.responsableCliente?.nombre || 'Registrado'
        : '-';
      const fechaFirma = signedCycle?.fechaFirma
        ? new Date(signedCycle.fechaFirma).toLocaleString('es-AR')
        : '-';

      return {
        'N° OT': ot.numeroOT,
        'Proyecto': ot.proyecto?.nombre || 'Sin Proyecto',
        'Código Proyecto': ot.proyecto?.codigoProyecto || '-',
        'Ref. Cliente': ot.refCliente || '-',
        'Sector / Ubicación': ot.sector || '-',
        'Estado': ot.estado,
        'Responsable Técnico': ot.responsable?.nombreCompleto || '-',
        'Creado Por': ot.creador?.nombreCompleto || '-',
        'Fecha Creación': new Date(ot.createdAt).toLocaleString('es-AR'),
        'Fecha Cierre': ot.fechaCierre ? new Date(ot.fechaCierre).toLocaleString('es-AR') : '-',
        'Tipo Cierre': ot.tipoCierre || '-',
        'Cant. Ciclos': ot.ciclos.length,
        'Total Horas MO': Number(totalHoras.toFixed(2)),
        'Costo Mano de Obra ($)': Number(totalManoObra.toFixed(2)),
        'Total Materiales ($)': Number(totalMateriales.toFixed(2)),
        'Total General ($)': Number(totalGeneral.toFixed(2)),
        'Firmado Por': firmante,
        'Fecha Firma': fechaFirma,
        'Reporte de Trabajo': ot.reporteTrabajo || '',
      };
    });

    // 5. Transform data for Sheet 2: Detalle Materiales
    const rowsMateriales: any[] = [];
    ots.forEach((ot) => {
      ot.ciclos.forEach((ciclo) => {
        ciclo.materiales.forEach((m) => {
          rowsMateriales.push({
            'N° OT': ot.numeroOT,
            'Proyecto': ot.proyecto?.nombre || '-',
            'Ciclo': ciclo.numeroCiclo,
            'Periodo': ciclo.periodo,
            'Origen': m.materialSource,
            'Código / SKU': m.materialCodigo,
            'Descripción': m.descripcion,
            'Cantidad': m.cantidad,
            'Precio Unitario Base ($)': Number((m.precioBaseSnapshot || 0).toFixed(2)),
            'Ajuste Cliente (%)': Number((m.porcentajeClienteSnapshot || 0).toFixed(2)),
            'Precio Final ($)': Number((m.precioFinalSnapshot || 0).toFixed(2)),
            'Importe Total ($)': Number((m.importeTotal || 0).toFixed(2)),
            'Fecha Registro': new Date(m.createdAt).toLocaleString('es-AR'),
          });
        });
      });
    });

    // 6. Transform data for Sheet 3: Detalle Mano de Obra
    const rowsManoObra: any[] = [];
    ots.forEach((ot) => {
      ot.ciclos.forEach((ciclo) => {
        ciclo.operadores.forEach((op) => {
          rowsManoObra.push({
            'N° OT': ot.numeroOT,
            'Proyecto': ot.proyecto?.nombre || '-',
            'Ciclo': ciclo.numeroCiclo,
            'Periodo': ciclo.periodo,
            'Operador / Técnico': op.operador?.nombreCompleto || 'Sin nombre',
            'Horas': op.horas,
            'Valor Hora ($)': Number((op.valorHoraSnapshot || 0).toFixed(2)),
            'Costo MO ($)': Number((op.costoManoObra || 0).toFixed(2)),
            'Fecha Registro': new Date(op.createdAt).toLocaleString('es-AR'),
          });
        });
      });
    });

    const clientSlug = client.nombre.replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    // 7. Format Output: CSV or XLSX
    if (format === 'csv') {
      const worksheet = xlsx.utils.json_to_sheet(
        rowsResumen.length > 0 ? rowsResumen : [{ Mensaje: 'No hay datos para los filtros seleccionados' }]
      );
      const csvContent = xlsx.utils.sheet_to_csv(worksheet);
      // Include UTF-8 BOM for Excel compatibility
      const bom = '\uFEFF';
      const filename = `OTs_${clientSlug}_${dateStamp}.csv`;

      return new NextResponse(bom + csvContent, {
        status: 200,
        headers: {
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Type': 'text/csv; charset=utf-8',
        },
      });
    }

    // Default: Excel .xlsx with 3 tabs
    const workbook = xlsx.utils.book_new();

    const wsResumen = xlsx.utils.json_to_sheet(
      rowsResumen.length > 0 ? rowsResumen : [{ Mensaje: 'No hay datos para los filtros seleccionados' }]
    );
    // Adjust column widths
    wsResumen['!cols'] = [
      { wch: 15 }, // OT
      { wch: 25 }, // Proyecto
      { wch: 15 }, // Codigo Proyecto
      { wch: 15 }, // Ref Cliente
      { wch: 20 }, // Sector
      { wch: 15 }, // Estado
      { wch: 25 }, // Responsable
      { wch: 20 }, // Creador
      { wch: 18 }, // Fecha Creacion
      { wch: 18 }, // Fecha Cierre
      { wch: 12 }, // Tipo Cierre
      { wch: 12 }, // Cant Ciclos
      { wch: 14 }, // Total Horas
      { wch: 18 }, // Costo MO
      { wch: 18 }, // Total Materiales
      { wch: 18 }, // Total General
      { wch: 20 }, // Firmante
      { wch: 18 }, // Fecha Firma
      { wch: 40 }, // Reporte
    ];
    xlsx.utils.book_append_sheet(workbook, wsResumen, 'Resumen OTs');

    const wsMateriales = xlsx.utils.json_to_sheet(
      rowsMateriales.length > 0 ? rowsMateriales : [{ Mensaje: 'No hay materiales registrados' }]
    );
    wsMateriales['!cols'] = [
      { wch: 15 }, // OT
      { wch: 25 }, // Proyecto
      { wch: 8 },  // Ciclo
      { wch: 15 }, // Periodo
      { wch: 12 }, // Origen
      { wch: 15 }, // SKU
      { wch: 35 }, // Descripcion
      { wch: 10 }, // Cantidad
      { wch: 18 }, // Precio Unitario
      { wch: 15 }, // Ajuste %
      { wch: 16 }, // Precio Final
      { wch: 18 }, // Importe Total
      { wch: 18 }, // Fecha Registro
    ];
    xlsx.utils.book_append_sheet(workbook, wsMateriales, 'Detalle Materiales');

    const wsManoObra = xlsx.utils.json_to_sheet(
      rowsManoObra.length > 0 ? rowsManoObra : [{ Mensaje: 'No hay mano de obra registrada' }]
    );
    wsManoObra['!cols'] = [
      { wch: 15 }, // OT
      { wch: 25 }, // Proyecto
      { wch: 8 },  // Ciclo
      { wch: 15 }, // Periodo
      { wch: 25 }, // Operador
      { wch: 10 }, // Horas
      { wch: 15 }, // Valor Hora
      { wch: 18 }, // Costo MO
      { wch: 18 }, // Fecha Registro
    ];
    xlsx.utils.book_append_sheet(workbook, wsManoObra, 'Detalle Mano de Obra');

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const filename = `OTs_${clientSlug}_${dateStamp}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });
  } catch (error: any) {
    console.error('Error al exportar datos del cliente:', error);
    return NextResponse.json(
      { error: error.message || 'Error al exportar datos del cliente' },
      { status: 500 }
    );
  }
}
