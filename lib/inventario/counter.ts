import { Prisma } from '@prisma/client';

export type SerieInventario = 'MOV' | 'OPI' | 'CNT';

/**
 * Genera el siguiente número correlativo atómico para documentos de inventario.
 * Debe llamarse SIEMPRE dentro de una transacción `tx` de Prisma para garantizar atomicidad y secuencialidad.
 * Formato: SERIE-YYYY-XXXXXX (ej: MOV-2026-000001, OPI-2026-000001, CNT-2026-000001)
 */
export async function getNextInventarioNumero(
  tx: Prisma.TransactionClient,
  serie: SerieInventario,
  date: Date = new Date()
): Promise<string> {
  const year = date.getFullYear();

  // Upsert con incremento atómico
  const counter = await tx.inventarioCounter.upsert({
    where: {
      serie_year: {
        serie,
        year,
      },
    },
    update: {
      currentNumber: {
        increment: 1,
      },
    },
    create: {
      serie,
      year,
      currentNumber: 1,
    },
  });

  const paddedNumber = String(counter.currentNumber).padStart(6, '0');
  return `${serie}-${year}-${paddedNumber}`;
}
