/**
 * Quién gestiona una orden de servicio: quien tiene "os.gestionar" o el responsable
 * del proyecto (las genera desde "Mis proyectos").
 */
import { prisma } from '@/lib/prisma';
import type { AccesoSesion } from '@/lib/permisosServer';

export async function puedeGestionarOSDelProyecto(acceso: AccesoSesion, projectId: string | null | undefined): Promise<boolean> {
    if (acceso.puede('os.gestionar')) return true;
    if (!projectId) return false;
    const proyecto = await prisma.project.findUnique({ where: { id: projectId }, select: { responsableId: true } });
    return !!proyecto?.responsableId && proyecto.responsableId === acceso.userId;
}

export const SIN_PERMISO_OS = 'No tenés permiso para gestionar órdenes de servicio de este proyecto';
