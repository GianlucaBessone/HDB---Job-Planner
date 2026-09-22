import { prisma } from '@/lib/prisma';

/**
 * Generates an atomic, concurrency-safe annual OT number in the format OT-YYYY-NNNN.
 * Uses a transactional upsert with atomic increment on OtCounter.
 * When a new year starts, the counter automatically begins at 0001.
 */
export async function generateOtNumber(targetYear?: number): Promise<{ numeroOT: string; numeroSecuencial: number; anio: number }> {
  const anio = targetYear || new Date().getFullYear();

  const counter = await prisma.$transaction(async (tx) => {
    return tx.otCounter.upsert({
      where: { year: anio },
      create: { year: anio, currentNumber: 1 },
      update: { currentNumber: { increment: 1 } },
    });
  });

  const numeroSecuencial = counter.currentNumber;
  const numeroOT = `OT-${anio}-${String(numeroSecuencial).padStart(4, '0')}`;

  return { numeroOT, numeroSecuencial, anio };
}

export const getNextOtNumber = generateOtNumber;
