import { NextRequest, NextResponse } from 'next/server';

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

const MATRIZ_PERMISOS: Record<string, AccionInventario[]> = {
  admin: [
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
  ],
  supervisor: [
    'consultar_stock',
    'consultar_movimientos',
    'ajustar_stock',
    'transferir_stock',
    'conteos_crear',
    'conteos_contar',
    'conteos_confirmar',
    'almacenes_admin',
    'exportar_inventario',
  ],
  qa: [
    'consultar_stock',
    'consultar_movimientos',
    'conteos_crear',
    'conteos_contar',
    'exportar_inventario',
  ],
  vendedor: [
    'consultar_stock',
    'consultar_movimientos',
    'exportar_inventario',
  ],
  operador: [
    'consultar_stock',
    'conteos_contar',
  ],
};

export interface UsuarioSesionInventario {
  id: string;
  role: string;
  nombreCompleto?: string;
  permisos: AccionInventario[];
}

export function getPermisosRol(role: string): AccionInventario[] {
  const normalizado = (role || '').trim().toLowerCase();
  return MATRIZ_PERMISOS[normalizado] || ['consultar_stock'];
}

export function tienePermiso(role: string, accion: AccionInventario): boolean {
  const permisos = getPermisosRol(role);
  return permisos.includes(accion);
}

export function verificarPermisoInventario(
  req: NextRequest,
  accion: AccionInventario
): { error?: NextResponse; usuario?: UsuarioSesionInventario } {
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

  const permisos = getPermisosRol(userRole);
  if (!permisos.includes(accion)) {
    return {
      error: NextResponse.json(
        {
          error: `Acceso denegado. Su rol "${userRole}" no posee permiso para realizar "${accion}".`,
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
