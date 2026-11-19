import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  obtenerCotizacionPorId,
  guardarCotizacion,
  cambiarEstadoCotizacion,
} from '@/lib/ventas/cotizacionService';
import { exigirAcceso } from '@/lib/permisosServer';

const itemSchema = z.object({
  productoId: z.string().optional().nullable(),
  sku: z.string().default('999999'),
  descripcion: z.string().min(1, 'La descripción del ítem es obligatoria'),
  marca: z.string().optional().nullable(),
  unidad: z.string().optional().nullable(),
  cantidad: z.coerce.number().positive('La cantidad debe ser mayor a 0'),
  precioOriginal: z.coerce.number().nonnegative().default(0),
  precioUnitario: z.coerce.number().nonnegative('El precio unitario no puede ser negativo'),
  descuentoPorcentaje: z.coerce.number().min(0).max(100).default(0),
  descuentoMonto: z.coerce.number().nonnegative().default(0),
  ivaPorcentaje: z.coerce.number().min(0).default(21),
  precioModificado: z.boolean().default(false),
  motivoModificacion: z.string().optional().nullable(),
  esManual: z.boolean().default(false),
});

const guardarCotizacionSchema = z.object({
  cotizacionId: z.string().optional().nullable(),
  clienteId: z.string().optional().nullable(),
  clienteNombre: z.string().optional().nullable(),
  clienteIdentificacion: z.string().optional().nullable(),
  clienteDireccion: z.string().optional().nullable(),
  clienteTelefono: z.string().optional().nullable(),
  clienteEmail: z.string().optional().nullable(),
  listaPrecioId: z.string().optional().nullable(),
  ivaDiscriminado: z.boolean().optional(),
  vendedorId: z.string().optional().nullable(),
  vendedorNombre: z.string().optional().nullable(),
  validezDias: z.coerce.number().min(1).max(365).default(15),
  condicionPago: z.string().optional().nullable(),
  plazoEntrega: z.string().optional().nullable(),
  referenciaObra: z.string().optional().nullable(),
  descuentoPorcentaje: z.coerce.number().min(0).max(100).default(0),
  recargoPorcentaje: z.coerce.number().min(0).default(0),
  observaciones: z.string().optional().nullable(),
  notasInternas: z.string().optional().nullable(),
  items: z.array(itemSchema).min(1, 'La cotización debe incluir al menos un artículo'),
});

const patchEstadoSchema = z.object({
  estado: z.enum(['VIGENTE', 'APROBADA', 'RECHAZADA', 'ANULADA', 'CONVERTIDA']),
  motivo: z.string().optional().nullable(),
  ventaId: z.string().optional().nullable(),
  ventaNumero: z.string().optional().nullable(),
});

export async function GET(
  req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const acceso = await exigirAcceso(req, ['ventas.cotizaciones_ver', 'ventas.cotizaciones_gestionar'], 'No tenés permiso para ver cotizaciones');
    if (acceso instanceof NextResponse) return acceso;

    const cotizacion = await obtenerCotizacionPorId(params.id);
    return NextResponse.json(cotizacion);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Cotización no encontrada' },
      { status: 404 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const acceso = await exigirAcceso(req, ['ventas.cotizaciones_gestionar'], 'No tenés permiso para crear o editar cotizaciones');
    if (acceso instanceof NextResponse) return acceso;

    const body = await req.json();
    const parsed = guardarCotizacionSchema.parse(body);
    const userIdHeader = acceso.userId;
    const userNameHeader = acceso.nombre;

    const cotizacion = await guardarCotizacion(
      {
        ...parsed,
        cotizacionId: params.id,
        vendedorId: parsed.vendedorId || userIdHeader,
        vendedorNombre: parsed.vendedorNombre || userNameHeader,
      },
      userIdHeader
    );

    return NextResponse.json({
      success: true,
      cotizacion,
      message: `Cotización ${cotizacion.numero} actualizada correctamente`,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error.message || 'Error al actualizar la cotización',
        details: error.errors || null,
      },
      { status: 400 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const acceso = await exigirAcceso(req, ['ventas.cotizaciones_gestionar'], 'No tenés permiso para crear o editar cotizaciones');
    if (acceso instanceof NextResponse) return acceso;

    const body = await req.json();
    const parsed = patchEstadoSchema.parse(body);

    const userId = acceso.userId;
    const userName = acceso.nombre;

    const cotizacion = await cambiarEstadoCotizacion(params.id, parsed.estado, {
      motivo: parsed.motivo,
      ventaId: parsed.ventaId,
      ventaNumero: parsed.ventaNumero,
      usuarioId: userId,
      usuarioNombre: userName,
    });

    return NextResponse.json({
      success: true,
      cotizacion,
      message: `Estado de cotización ${cotizacion.numero} cambiado a ${parsed.estado}`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error al cambiar estado de la cotización' },
      { status: 400 }
    );
  }
}
