/**
 * Catálogo de categorías de mano de obra (Oficial, Medio oficial, Ayudante…).
 * El valor hora es neto (sin IVA). Se edita en Ventas y Comercial › Presupuestos de servicios › Mano de obra.
 */
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { ErrorNegocio, type UsuarioSesion } from './sesion';

const ENTIDAD = 'MANO_OBRA_CATEGORIA';

export interface CategoriaManoObraInput {
    nombre: string;
    valorHora: number;
    ivaPorcentaje: number;
    orden: number;
    activo: boolean;
}

export async function listarCategorias(soloActivas = false) {
    return prisma.manoObraCategoria.findMany({
        where: soloActivas ? { activo: true } : undefined,
        orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    });
}

export async function crearCategoria(input: CategoriaManoObraInput, usuario: UsuarioSesion) {
    const existe = await prisma.manoObraCategoria.findFirst({ where: { nombre: { equals: input.nombre, mode: 'insensitive' } } });
    if (existe) throw new ErrorNegocio(`Ya existe la categoría "${existe.nombre}"`, 409);
    const c = await prisma.manoObraCategoria.create({ data: input });
    await logAudit({ userId: usuario.id, userName: usuario.nombre, action: 'CREATE', entity: ENTIDAD, entityId: c.id, newValue: input });
    return c;
}

export async function actualizarCategoria(id: string, input: CategoriaManoObraInput, usuario: UsuarioSesion) {
    const antes = await prisma.manoObraCategoria.findUnique({ where: { id } });
    if (!antes) throw new ErrorNegocio('Categoría no encontrada', 404);
    const duplicada = await prisma.manoObraCategoria.findFirst({
        where: { id: { not: id }, nombre: { equals: input.nombre, mode: 'insensitive' } },
    });
    if (duplicada) throw new ErrorNegocio(`Ya existe la categoría "${duplicada.nombre}"`, 409);
    const c = await prisma.manoObraCategoria.update({ where: { id }, data: input });
    await logAudit({
        userId: usuario.id,
        userName: usuario.nombre,
        action: 'UPDATE',
        entity: ENTIDAD,
        entityId: id,
        oldValue: { nombre: antes.nombre, valorHora: antes.valorHora, ivaPorcentaje: antes.ivaPorcentaje, orden: antes.orden, activo: antes.activo },
        newValue: input,
    });
    return c;
}
