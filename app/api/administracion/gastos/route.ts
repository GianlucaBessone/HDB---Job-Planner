import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const facturaSchema = z.object({
  fechaEmision: z.string(),
  fechaVencimiento: z.string().optional().nullable(),
  proveedorId: z.string(),
  codigoGastoId: z.string().optional().nullable(),
  descripcion: z.string().optional().nullable(),
  tipoComprobante: z.string().optional().nullable(),
  letraComprobante: z.string().optional().nullable(),
  puntoVenta: z.string().optional().nullable(),
  numeroComprobante: z.string().optional().nullable(),
  netoGeneral: z.number().default(0),
  neto21: z.number().default(0),
  neto10_5: z.number().default(0),
  neto27: z.number().default(0),
  iva21: z.number().default(0),
  iva10_5: z.number().default(0),
  iva27: z.number().default(0),
  noGravados: z.number().default(0),
  percepcionesIva: z.number().default(0),
  percepcionesIibb: z.number().default(0),
  impuestosInternos: z.number().default(0),
  otrosImpuestos: z.number().default(0),
  total: z.number().default(0),
  moneda: z.string().default('ARS'),
  cae: z.string().optional().nullable(),
  fechaVencimientoCae: z.string().optional().nullable(),
  esFactura: z.boolean().default(true),
  statusIaConfianza: z.number().optional().nullable(),
  iaRawData: z.any().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const month = url.searchParams.get('month');
    const year = url.searchParams.get('year');

    // Build the query
    let whereClause = {};
    if (month && year) {
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
      whereClause = {
        fechaEmision: {
          gte: startDate,
          lte: endDate,
        },
      };
    }

    const facturas = await prisma.facturaConsumo.findMany({
      where: whereClause,
      include: {
        proveedor: true,
        codigoGasto: true,
      },
      orderBy: {
        fechaEmision: 'desc',
      },
    });

    return NextResponse.json(facturas);
  } catch (error) {
    console.error('Error fetching facturas:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = facturaSchema.parse(body);

    const factura = await prisma.facturaConsumo.create({
      data: {
        ...data,
        fechaEmision: new Date(data.fechaEmision),
        fechaVencimiento: data.fechaVencimiento ? new Date(data.fechaVencimiento) : null,
        fechaVencimientoCae: data.fechaVencimientoCae ? new Date(data.fechaVencimientoCae) : null,
      },
      include: {
        proveedor: true,
        codigoGasto: true,
      }
    });

    return NextResponse.json(factura, { status: 201 });
  } catch (error: any) {
    console.error('Error creating factura:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
