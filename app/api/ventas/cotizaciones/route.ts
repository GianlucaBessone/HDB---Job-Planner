import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withIdempotency } from '@/lib/idempotency';
import {
  listarCotizaciones,
  guardarCotizacion,
} from '@/lib/ventas/cotizacionService';

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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim() || '';
    const estado = searchParams.get('estado') || undefined;
    const clienteId = searchParams.get('clienteId') || undefined;
    const vendedorId = searchParams.get('vendedorId') || undefined;
    const fechaDesde = searchParams.get('fechaDesde') || undefined;
    const fechaHasta = searchParams.get('fechaHasta') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const data = await listarCotizaciones({
      q,
      estado,
      clienteId,
      vendedorId,
      fechaDesde,
      fechaHasta,
      page,
      limit,
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error listando cotizaciones:', error);
    return NextResponse.json(
      { error: error.message || 'Error al listar cotizaciones' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return withIdempotency(req, async () => {
    try {
      const body = await req.json();
      const parsed = guardarCotizacionSchema.parse(body);

      const userIdHeader = req.headers.get('x-user-id') || undefined;
      const userNameHeader = req.headers.get('x-user-name') || undefined;

      const cotizacion = await guardarCotizacion(
        {
          ...parsed,
          vendedorId: parsed.vendedorId || userIdHeader,
          vendedorNombre: parsed.vendedorNombre || userNameHeader,
        },
        userIdHeader
      );

      return NextResponse.json(
        {
          success: true,
          cotizacion,
          message: parsed.cotizacionId
            ? `Cotización ${cotizacion.numero} actualizada con éxito`
            : `Cotización ${cotizacion.numero} registrada con éxito`,
        },
        { status: parsed.cotizacionId ? 200 : 201 }
      );
    } catch (error: any) {
      console.error('Error al guardar cotización:', error);
      return NextResponse.json(
        {
          error: error.message || 'Error al procesar la cotización',
          details: error.errors || null,
        },
        { status: 400 }
      );
    }
  });
}
