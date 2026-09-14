import { prisma } from '@/lib/prisma';

/**
 * Función auxiliar para validar productos aplicables según la regla de la lista
 */
export async function recalcularPreciosParaLista(listaId: string, userId?: string): Promise<number> {
  const lista = await prisma.listaPrecio.findUnique({
    where: { id: listaId },
  });
  if (!lista || lista.tipoAjuste === 'MANUAL') return 0;

  // Build filter for applicable products
  const where: any = { activo: true };
  if (lista.aplicaA === 'FAMILIA' && lista.familiaId) {
    where.familiaId = lista.familiaId;
  } else if (lista.aplicaA === 'MARCA' && lista.marcaId) {
    where.marcaId = lista.marcaId;
  }

  const count = await prisma.producto.count({ where });
  return count;
}
