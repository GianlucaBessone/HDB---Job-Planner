import { prisma } from '@/lib/prisma';
import type { ProveedorVentasInput } from '@/lib/ventas/proveedorVentas';

/**
 * Devuelve un mensaje si el código o el CUIT ya pertenecen a otro proveedor
 * de ventas (activo o no), o null si no hay conflicto.
 */
export async function buscarConflictoProveedor(
  data: Pick<ProveedorVentasInput, 'codigo' | 'cuit'>,
  excluirId?: string
): Promise<string | null> {
  const notSelf = excluirId ? { id: { not: excluirId } } : {};

  if (data.codigo) {
    const porCodigo = await prisma.proveedorVentas.findFirst({
      where: { ...notSelf, codigo: { equals: data.codigo, mode: 'insensitive' } },
      select: { razonSocial: true, activo: true },
    });
    if (porCodigo) {
      return `El código ${data.codigo} ya está asignado a ${porCodigo.razonSocial}${porCodigo.activo ? '' : ' (inactivo)'}`;
    }
  }

  if (data.cuit) {
    const digitos = data.cuit.replace(/\D/g, '');
    const porCuit = await prisma.proveedorVentas.findFirst({
      where: { ...notSelf, cuit: { in: [data.cuit, digitos] } },
      select: { razonSocial: true, activo: true },
    });
    if (porCuit) {
      return `El CUIT ${data.cuit} ya está cargado en ${porCuit.razonSocial}${porCuit.activo ? '' : ' (inactivo: reactivalo desde el listado)'}`;
    }
  }

  return null;
}
