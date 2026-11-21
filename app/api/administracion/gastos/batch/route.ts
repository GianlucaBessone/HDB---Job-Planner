import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { exigirAcceso } from '@/lib/permisosServer';
import { normalizarCuit, proveedorPorCuitOCrear } from '@/lib/proveedores';

const excelRowSchema = z.object({
  fechaEmision: z.string().or(z.date()),
  proveedorCuit: z.string().min(1),
  proveedorRazonSocial: z.string().min(1),
  codigoGasto: z.string().optional().nullable(),
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
});

const batchPayloadSchema = z.array(excelRowSchema);

export async function POST(req: NextRequest) {
  try {
    const acceso = await exigirAcceso(req, ['gastos.gestionar'], 'No tenés permiso para gestionar gastos');
    if (acceso instanceof NextResponse) return acceso;

    const body = await req.json();
    const rows = batchPayloadSchema.parse(body);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No hay registros para importar' }, { status: 400 });
    }

    // 1. Proveedores: maestro único (P24). El CUIT se compara normalizado (con o sin guiones es el mismo).
    const invalidos = Array.from(new Set(rows.map(r => r.proveedorCuit.trim()).filter(c => !normalizarCuit(c))));
    if (invalidos.length > 0) {
      return NextResponse.json({ error: `CUIT inválido (debe tener 11 dígitos): ${invalidos.join(', ')}` }, { status: 400 });
    }
    const provDict: Record<string, string> = {};
    for (const row of rows) {
      const cuit = normalizarCuit(row.proveedorCuit)!;
      if (provDict[cuit]) continue;
      const proveedor = await proveedorPorCuitOCrear(prisma, { cuit, razonSocial: row.proveedorRazonSocial || 'Proveedor importado' });
      provDict[cuit] = proveedor.id;
    }

    // 2. Resolve CodigoGasto
    const uniqueCodigos = Array.from(new Set(rows.map(r => r.codigoGasto?.trim()).filter(Boolean) as string[]));
    const existingCodigos = await prisma.codigoGasto.findMany({
      where: { codigo: { in: uniqueCodigos } }
    });
    const codigosDict: Record<string, string> = {};
    existingCodigos.forEach(c => codigosDict[c.codigo] = c.id);

    // 3. Prepare data for insert
    const insertData = rows.map(row => {
      const cuit = normalizarCuit(row.proveedorCuit)!;
      const cod = row.codigoGasto?.trim();

      return {
        fechaEmision: new Date(row.fechaEmision),
        proveedorId: provDict[cuit],
        codigoGastoId: cod ? codigosDict[cod] || null : null,
        tipoComprobante: row.tipoComprobante || 'Factura',
        letraComprobante: row.letraComprobante || '',
        puntoVenta: row.puntoVenta || '0000',
        numeroComprobante: row.numeroComprobante || '00000000',
        netoGeneral: Number(row.netoGeneral) || 0,
        neto21: Number(row.neto21) || 0,
        neto10_5: Number(row.neto10_5) || 0,
        neto27: Number(row.neto27) || 0,
        iva21: Number(row.iva21) || 0,
        iva10_5: Number(row.iva10_5) || 0,
        iva27: Number(row.iva27) || 0,
        noGravados: Number(row.noGravados) || 0,
        percepcionesIva: Number(row.percepcionesIva) || 0,
        percepcionesIibb: Number(row.percepcionesIibb) || 0,
        impuestosInternos: Number(row.impuestosInternos) || 0,
        otrosImpuestos: Number(row.otrosImpuestos) || 0,
        total: Number(row.total) || 0,
        moneda: row.moneda || 'ARS',
        esFactura: true,
      };
    });

    // 4. Batch Insert
    const createResult = await prisma.facturaConsumo.createMany({
      data: insertData,
      skipDuplicates: false, // Or true if we have unique constraints on comprobante, but we don't strictly right now.
    });

    return NextResponse.json({ 
      success: true, 
      message: `Se importaron ${createResult.count} registros exitosamente.`,
      count: createResult.count
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error en importación batch:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Error de validación en la planilla', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error interno del servidor durante la importación' }, { status: 500 });
  }
}
