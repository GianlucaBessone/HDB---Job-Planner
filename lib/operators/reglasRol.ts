/**
 * Reglas para dar de alta, editar y eliminar usuarios sin escalar privilegios.
 * Funciones puras: la API (app/api/operators) les pasa el acceso de la sesión
 * y el usuario tal como está en la base.
 *
 *  - Asignar un rol distinto de "operador" o cambiar el rol de alguien pide
 *    la función "usuarios.asignar_rol".
 *  - Nadie asigna un rol de rango mayor al propio (lib/permisos.ts → rangoRol).
 *  - Nadie cambia su propio rol.
 *  - Nadie edita ni elimina a un usuario de rango mayor al propio.
 */
import { esRolValido, normalizarRol, rangoRol } from '@/lib/permisos';

export interface ActorUsuarios {
    userId: string;
    role: string;
    puedeAsignarRol: boolean;
}

export interface UsuarioObjetivo {
    id: string;
    role: string | null;
}

export interface ErrorRegla {
    status: 400 | 403;
    error: string;
}

const ROL_POR_DEFECTO = 'operador';

function validarRolAsignado(actor: ActorUsuarios, rol: string): ErrorRegla | null {
    if (!esRolValido(rol)) return { status: 400, error: `El rol "${rol}" no existe` };
    if (!actor.puedeAsignarRol) return { status: 403, error: 'No tenés permiso para asignar roles' };
    if (rangoRol(rol) > rangoRol(actor.role)) {
        return { status: 403, error: 'No podés asignar un rol superior al tuyo' };
    }
    return null;
}

/** Alta de un usuario. Sin rol, queda como operador. */
export function reglaAltaUsuario(actor: ActorUsuarios, rolNuevo: string | undefined): ErrorRegla | null {
    const rol = normalizarRol(rolNuevo || ROL_POR_DEFECTO);
    if (rol === ROL_POR_DEFECTO) return null;
    return validarRolAsignado(actor, rol);
}

/** Edición de un usuario existente. `rolNuevo` undefined = no se toca el rol. */
export function reglaEdicionUsuario(
    actor: ActorUsuarios,
    objetivo: UsuarioObjetivo,
    rolNuevo: string | undefined
): ErrorRegla | null {
    if (rangoRol(objetivo.role) > rangoRol(actor.role)) {
        return { status: 403, error: 'No podés modificar a un usuario de rango superior al tuyo' };
    }
    if (rolNuevo === undefined || normalizarRol(rolNuevo) === normalizarRol(objetivo.role)) return null;
    if (objetivo.id === actor.userId) return { status: 403, error: 'No podés cambiar tu propio rol' };
    return validarRolAsignado(actor, normalizarRol(rolNuevo));
}

/** Baja definitiva de un usuario. */
export function reglaEliminarUsuario(actor: ActorUsuarios, objetivo: UsuarioObjetivo): ErrorRegla | null {
    if (rangoRol(objetivo.role) > rangoRol(actor.role)) {
        return { status: 403, error: 'No podés eliminar a un usuario de rango superior al tuyo' };
    }
    return null;
}
