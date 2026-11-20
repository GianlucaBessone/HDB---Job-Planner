import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withIdempotency } from '@/lib/idempotency';
import { confirmarVentaPDV } from '@/lib/ventas/pdvService';
import { exigirAcceso } from '@/lib/permisosServer';

const itemSchema = z.object({
  productoId: z.string().optional().nullable(),
  esManual: z.boolean().optional().default(false),
  sku: z.string().min(1, 'El SKU es obligatorio'),
  descripcion: z.string().min(1, 'La descripción es obligatoria'),
  unidad: z.string().optional().nullable(),
  cantidad: z.coerce.number().positive('La cantidad debe ser mayor a 0'),
  precioOriginal: z.coerce.number().nonnegative(),
  precioUnitario: z.coerce.number().nonnegative('El precio unitario no puede ser negativo'),
  descuentoPorcentaje: z.coerce.number().min(0).max(100).default(0),
  descuentoMonto: z.coerce.number().nonnegative().default(0),
  ivaPorcentaje: z.coerce.number().default(21),
  precioModificado: z.boolean().default(false),
  motivoModificacion: z.string().optional().nullable(),
});

const pagoSchema = z.object({
  metodo: z.enum([
    'EFECTIVO',
    'TRANSFERENCIA',
    'TARJETA_DEBITO',
    'TARJETA_CREDITO',
    'CUENTA_CORRIENTE',
    'CHEQUE',
  ]),
  monto: z.coerce.number().positive('El monto del pago debe ser mayor a 0'),
  montoRecibido: z.coerce.number().optional().nullable(),
  vuelto: z.coerce.number().optional().nullable(),
  referencia: z.string().optional().nullable(),
  observaciones: z.string().optional().nullable(),
});

const confirmarVentaSchema = z.object({
  clienteId: z.string().optional().nullable(),
  clienteNombre: z.string().optional().nullable(),
  clienteIdentificacion: z.string().optional().nullable(),
  clienteDireccion: z.string().optional().nullable(),
  clienteTelefono: z.string().optional().nullable(),
  clienteEmail: z.string().optional().nullable(),
  listaPrecioId: z.string().optional().nullable(),
  almacenId: z.string().optional().nullable(),
  vendedorId: z.string().optional().nullable(),
  vendedorNombre: z.string().optional().nullable(),
  descuentoPorcentaje: z.coerce.number().min(0).max(100).default(0),
  recargoPorcentaje: z.coerce.number().min(0).default(0),
  observaciones: z.string().optional().nullable(),
  cotizacionId: z.string().optional().nullable(),
  items: z.array(itemSchema).min(1, 'Debe incluir al menos un producto'),
  pagos: z.array(pagoSchema).min(1, 'Debe registrar al menos un medio de pago'),
});

export async function POST(req: NextRequest) {
  return withIdempotency(req, async () => {
    try {
      // Usuario, rol y funciones salen de la sesión (base de datos), no del navegador.
      const acceso = await exigirAcceso(req, ['ventas.pdv_operar'], 'No tenés permiso para operar el Punto de Venta');
      if (acceso instanceof NextResponse) return acceso;

      const body = await req.json();
      const parsed = confirmarVentaSchema.parse(body);

      // Validar si algún item tuvo precio modificado manualmente y si el usuario puede hacerlo
      const hayPreciosModificados = parsed.items.some((i) => i.precioModificado);
      if (hayPreciosModificados) {
        // Sin la función "Modificar precios" (por rol o permiso especial), la venta tiene que
        // venir autorizada o provenir de una cotización formal
        if (
          !acceso.puede('ventas.modificar_precios') &&
          !body.autorizadoPorSupervisor &&
          !parsed.cotizacionId
        ) {
          return NextResponse.json(
            {
              error:
                'Se requiere autorización de un Supervisor o Administrador para modificar precios unitarios.',
              requiereAutorizacion: true,
            },
            { status: 403 }
          );
        }
      }

      // El vendedor es siempre el usuario de la sesión.
      const venta = await confirmarVentaPDV(
        {
          ...parsed,
          vendedorId: acceso.userId,
          vendedorNombre: acceso.nombre,
          puedeExcederLimiteCredito: acceso.puede('ventas.exceder_limite_credito'),
        },
        acceso.userId
      );

      return NextResponse.json(
        {
          success: true,
          venta,
          message: `Venta ${venta.numero} confirmada exitosamente`,
        },
        { status: 201 }
      );
    } catch (error: any) {
      console.error('Error al confirmar venta en PDV:', error);
      return NextResponse.json(
        {
          error: error.message || 'Error al procesar la venta',
          details: error.errors || null,
        },
        { status: 400 }
      );
    }
  });
}
