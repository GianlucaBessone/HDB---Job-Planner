import { NextRequest, NextResponse } from 'next/server';
import { FuncionId, PermisoEspecial, claveFuncion, efectoEspecial, normalizarRol, rolTieneFuncion } from '@/lib/permisos';
import { getPermisosEspeciales } from '@/lib/permisosServer';

export type AccionInventario =
  | 'consultar_stock'
  | 'consultar_movimientos'
  | 'ajustar_stock'
  | 'transferir_stock'
  | 'conteos_crear'
  | 'conteos_contar'
  | 'conteos_confirmar'
  | 'almacenes_admin'
  | 'exportar_inventario'
  | 'permitir_stock_negativo';

const ACCIONES: AccionInventario[] = [
  'consultar_stock',
  'consultar_movimientos',
  'ajustar_stock',
  'transferir_stock',
  'conteos_crear',
  'conteos_contar',
  'conteos_confirmar',
  'almacenes_admin',
  'exportar_inventario',
  'permitir_stock_negativo',
];

const ROLES_CONOCIDOS = ['admin', 'supervisor', 'qa', 'vendedor', 'operador'];

// Qué acciones tiene cada rol por defecto se declara en lib/permisos.ts
// (funciones "inventario.*"). Los permisos especiales del usuario ganan sobre el rol.
const funcionDe = (accion: AccionInventario) => `inventario.${accion}` as FuncionId;

export interface UsuarioSesionInventario {
  id: string;
  role: string;
  nombreCompleto?: string;
  permisos: AccionInventario[];
}

/** Acciones de inventario de un rol, con los permisos especiales del usuario si se pasan. */
export function getPermisosRol(role: string, especiales?: PermisoEspecial[] | null): AccionInventario[] {
  const normalizado = normalizarRol(role);
  // Un rol desconocido solo consulta stock
  const rolBase = ROLES_CONOCIDOS.includes(normalizado) ? normalizado : null;
  return ACCIONES.filter((accion) => {
    const especial = efectoEspecial(claveFuncion(funcionDe(accion)), especiales);
    if (especial) return especial === 'permitir';
    return rolBase ? rolTieneFuncion(funcionDe(accion), rolBase) : accion === 'consultar_stock';
  });
}

export function tienePermiso(role: string, accion: AccionInventario, especiales?: PermisoEspecial[] | null): boolean {
  return getPermisosRol(role, especiales).includes(accion);
}

export async function verificarPermisoInventario(
  req: NextRequest,
  accion: AccionInventario
): Promise<{ error?: NextResponse; usuario?: UsuarioSesionInventario }> {
  const userId = req.headers.get('x-user-id');
  const userRole = req.headers.get('x-user-role') || 'operador';

  if (!userId) {
    return {
      error: NextResponse.json(
        { error: 'No autorizado. Se requiere sesión activa en el sistema.' },
        { status: 401 }
      ),
    };
  }

  const permisos = getPermisosRol(userRole, await getPermisosEspeciales(userId));
  if (!permisos.includes(accion)) {
    return {
      error: NextResponse.json(
        {
          error: `Acceso denegado. No tenés permiso para realizar "${accion}".`,
          accionRequerida: accion,
          rolActual: userRole,
        },
        { status: 403 }
      ),
    };
  }

  return {
    usuario: {
      id: userId,
      role: userRole,
      permisos,
    },
  };
}
