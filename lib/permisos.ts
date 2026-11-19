/**
 * Control de accesos: catálogo de funciones y resolución de permisos.
 *
 * El rol define los accesos por defecto. Sobre eso, cada usuario puede tener
 * permisos especiales que amplían ("permitir") o recortan ("denegar") lo que
 * le da el rol. Un permiso especial siempre gana sobre el rol.
 *
 * Hay dos tipos de acceso:
 *  - Vistas:    pantallas del menú. Sus roles por defecto están en lib/viewAccess.ts
 *               y se ajustan desde Configuración. Clave: "vista:/ventas/pdv".
 *  - Funciones: acciones dentro de una vista. Se declaran acá.
 *               Clave: "funcion:ventas.anular_venta".
 *
 * Este archivo no depende de la base ni de React: lo usan el cliente y el servidor.
 * Para leer los permisos de la sesión en una API, ver lib/permisosServer.ts.
 */

// ── Tipos ──────────────────────────────────────────────────────────

export type EfectoPermiso = 'permitir' | 'denegar';

export interface PermisoEspecial {
    clave: string;
    efecto: EfectoPermiso;
}

export interface FuncionConfig {
    id: string;
    label: string;
    description: string;
    grupo: string;
    /** Roles que tienen la función por defecto. */
    roles: string[];
}

// ── Catálogo de funciones ──────────────────────────────────────────

export const FUNCIONES = [
    // ─ Usuarios ─
    { id: 'usuarios.gestionar', label: 'Gestionar usuarios', description: 'Crear, editar y eliminar usuarios', grupo: 'Usuarios', roles: ['admin', 'supervisor', 'qa'] },
    { id: 'usuarios.asignar_rol', label: 'Asignar roles', description: 'Cambiar el rol de otros usuarios, hasta el rango propio', grupo: 'Usuarios', roles: ['admin', 'supervisor', 'qa'] },
    { id: 'usuarios.accesos', label: 'Administrar accesos', description: 'Otorgar y quitar permisos especiales a otros usuarios', grupo: 'Usuarios', roles: ['admin'] },

    // ─ Configuración ─
    { id: 'config.administrar', label: 'Administrar configuración', description: 'Ajustes del sistema, fichaje, etiquetas, opciones y plantillas de checklist', grupo: 'Configuración', roles: ['admin', 'supervisor', 'qa'] },
    { id: 'config.vistas', label: 'Configurar vistas por rol', description: 'Definir qué roles ven cada pantalla del menú', grupo: 'Configuración', roles: ['admin'] },
    { id: 'config.prompts_ia', label: 'Editar prompts de IA', description: 'Modificar las plantillas de prompts que usa la IA', grupo: 'Configuración', roles: ['admin'] },

    // ─ Auditoría ─
    { id: 'auditoria.ver', label: 'Ver auditoría', description: 'Consultar el registro de auditoría de todo el sistema', grupo: 'Auditoría', roles: ['admin', 'supervisor', 'qa'] },

    // ─ Registro de tiempos ─
    { id: 'timesheets.control_horario', label: 'Control horario', description: 'Cruce entre registro de tiempos y fichadas, con ajustes', grupo: 'Registro de tiempos', roles: ['admin', 'supervisor'] },
    { id: 'timesheets.gestionar_horas', label: 'Gestionar horas de otros', description: 'Cargar, editar y borrar horas de otros usuarios y de días ya confirmados', grupo: 'Registro de tiempos', roles: ['admin', 'supervisor', 'qa'] },
    { id: 'fichadas.aprobar', label: 'Aprobar fichadas', description: 'Ver, aprobar y rechazar fichadas pendientes de aprobación', grupo: 'Registro de tiempos', roles: ['admin', 'supervisor', 'qa'] },

    // ─ Planificación ─
    { id: 'planificacion.gestionar', label: 'Gestionar planificación', description: 'Armar la agenda diaria y avisar al equipo asignado', grupo: 'Planificación', roles: ['admin', 'supervisor', 'qa'] },

    // ─ Herramientas ─
    { id: 'herramientas.gestionar', label: 'Gestionar herramientas y carros', description: 'Crear, editar y eliminar herramientas y carros, armar carros y ver el historial de movimientos', grupo: 'Herramientas', roles: ['admin', 'supervisor'] },

    // ─ Gastos ─
    { id: 'gastos.ver', label: 'Ver gastos y facturas', description: 'Consultar facturas de gastos, proveedores y códigos de gasto', grupo: 'Gastos', roles: ['admin', 'supervisor', 'qa'] },
    { id: 'gastos.gestionar', label: 'Gestionar gastos y facturas', description: 'Cargar, escanear, importar y eliminar facturas; administrar proveedores y códigos de gasto', grupo: 'Gastos', roles: ['admin', 'supervisor', 'qa'] },

    // ─ Formación ─
    { id: 'formacion.gestionar', label: 'Gestionar formación', description: 'Ver la formación de todo el personal, validar certificados y administrar competencias', grupo: 'Formación', roles: ['admin', 'supervisor', 'qa'] },

    // ─ Tareas ─
    { id: 'tareas.ver_todas', label: 'Ver y gestionar todas las tareas', description: 'Ver, editar y eliminar tareas aunque no sea creador ni involucrado', grupo: 'Tareas', roles: ['admin'] },

    // ─ Clientes ─
    { id: 'clientes.gestionar', label: 'Gestionar clientes', description: 'Crear y editar clientes, sectores, tarifas y responsables del portal', grupo: 'Clientes', roles: ['admin', 'supervisor', 'qa', 'vendedor'] },
    { id: 'clientes.eliminar', label: 'Eliminar clientes', description: 'Eliminar clientes', grupo: 'Clientes', roles: ['admin', 'supervisor'] },

    // ─ Calidad y documentación ─
    { id: 'documentos.gestionar', label: 'Gestionar documentos', description: 'Crear y editar documentos controlados, versiones, archivos, reglas, cuestionarios y subaccesos', grupo: 'Calidad y documentación', roles: ['admin', 'supervisor', 'qa'] },
    { id: 'documentos.eliminar', label: 'Eliminar documentos', description: 'Eliminar un documento controlado con todas sus versiones', grupo: 'Calidad y documentación', roles: ['admin', 'qa'] },

    // ─ Ventas ─
    { id: 'ventas.anular_venta', label: 'Anular ventas', description: 'Anular ventas del Punto de Venta sin PIN de supervisor', grupo: 'Ventas', roles: ['admin', 'supervisor'] },
    { id: 'ventas.modificar_precios', label: 'Modificar precios', description: 'Cambiar el precio unitario en una venta sin PIN de supervisor', grupo: 'Ventas', roles: ['admin', 'supervisor'] },
    { id: 'ventas.anular_comprobante_cc', label: 'Anular comprobantes de cuenta corriente', description: 'Anular recibos y movimientos sin PIN de supervisor', grupo: 'Ventas', roles: ['admin', 'supervisor'] },
    { id: 'ventas.mano_obra_gestionar', label: 'Gestionar mano de obra', description: 'Editar categorías de mano de obra y su valor hora', grupo: 'Ventas', roles: ['admin', 'supervisor'] },
    { id: 'ventas.cotizaciones_ver', label: 'Ver cotizaciones', description: 'Consultar cotizaciones y descargar su PDF', grupo: 'Ventas', roles: ['admin', 'supervisor', 'qa', 'vendedor'] },
    { id: 'ventas.cotizaciones_gestionar', label: 'Crear y editar cotizaciones', description: 'Crear cotizaciones, editarlas y cambiar su estado', grupo: 'Ventas', roles: ['admin', 'supervisor', 'vendedor'] },
    { id: 'ventas.cc_ver', label: 'Ver cuentas corrientes', description: 'Consultar saldos, movimientos y estados de cuenta de los clientes', grupo: 'Ventas', roles: ['admin', 'supervisor', 'qa', 'vendedor'] },
    { id: 'ventas.cc_cobrar', label: 'Registrar cobranzas', description: 'Registrar cobranzas en la cuenta corriente de un cliente', grupo: 'Ventas', roles: ['admin', 'supervisor', 'vendedor'] },
    { id: 'ventas.cc_ajustar', label: 'Ajustes de cuenta corriente', description: 'Registrar ajustes manuales (débitos y créditos) en la cuenta corriente', grupo: 'Ventas', roles: ['admin', 'supervisor', 'vendedor'] },
    { id: 'ventas.cc_configurar', label: 'Configurar crédito y actualizar deuda', description: 'Cambiar el límite y las condiciones de crédito y actualizar la deuda a precios vigentes', grupo: 'Ventas', roles: ['admin', 'supervisor'] },

    // ─ Proyectos ─
    { id: 'proyectos.crear', label: 'Crear y planificar proyectos', description: 'Crear y editar proyectos, asignar el equipo y marcar tareas', grupo: 'Proyectos', roles: ['admin', 'supervisor', 'qa'] },
    { id: 'provision.gestionar', label: 'Gestionar provisión de materiales', description: 'Cargar y editar materiales de proyecto, importar, avisar faltantes y corregir estados', grupo: 'Proyectos', roles: ['admin', 'supervisor', 'qa', 'vendedor'] },
    { id: 'proyectos.eliminar', label: 'Eliminar proyectos', description: 'Eliminar un proyecto con sus órdenes de servicio, horas y fichadas', grupo: 'Proyectos', roles: ['admin', 'supervisor'] },

    // ─ Presupuestos de servicio ─
    { id: 'presupuestos.ver', label: 'Ver presupuestos de servicio', description: 'Consultar presupuestos, sus revisiones y el reporte presupuestado vs. real', grupo: 'Presupuestos de servicio', roles: ['admin', 'supervisor', 'qa'] },
    { id: 'presupuestos.gestionar', label: 'Crear y editar presupuestos', description: 'Crear presupuestos, editarlos, abrir revisiones y enviarlos', grupo: 'Presupuestos de servicio', roles: ['admin', 'supervisor'] },
    { id: 'presupuestos.aprobar', label: 'Registrar aceptación o rechazo', description: 'Registrar la aceptación o el rechazo del cliente', grupo: 'Presupuestos de servicio', roles: ['admin', 'supervisor'] },
    { id: 'presupuestos.convertir', label: 'Convertir en proyecto', description: 'Crear el proyecto desde un presupuesto aceptado', grupo: 'Presupuestos de servicio', roles: ['admin', 'supervisor'] },

    // ─ Recursos Humanos ─
    { id: 'rrhh.reclutamiento_ver', label: 'Ver reclutamiento', description: 'Consultar vacantes, postulantes, CV y análisis de IA', grupo: 'Recursos Humanos', roles: ['admin', 'supervisor', 'qa'] },
    { id: 'rrhh.reclutamiento_gestionar', label: 'Gestionar reclutamiento', description: 'Crear y editar vacantes y postulantes, mover etapas y analizar CV con IA', grupo: 'Recursos Humanos', roles: ['admin', 'supervisor', 'qa'] },
    { id: 'rrhh.reclutamiento_eliminar', label: 'Eliminar en reclutamiento', description: 'Eliminar vacantes y postulantes con su CV', grupo: 'Recursos Humanos', roles: ['admin', 'supervisor'] },

    // ─ Almacén y stock ─
    { id: 'inventario.consultar_stock', label: 'Consultar stock', description: 'Ver existencias por almacén', grupo: 'Almacén y stock', roles: ['admin', 'supervisor', 'qa', 'vendedor', 'operador'] },
    { id: 'inventario.consultar_movimientos', label: 'Consultar movimientos', description: 'Ver el historial de movimientos de stock', grupo: 'Almacén y stock', roles: ['admin', 'supervisor', 'qa', 'vendedor'] },
    { id: 'inventario.ajustar_stock', label: 'Ajustar stock', description: 'Registrar ajustes manuales de existencias', grupo: 'Almacén y stock', roles: ['admin', 'supervisor'] },
    { id: 'inventario.transferir_stock', label: 'Transferir stock', description: 'Mover existencias entre almacenes', grupo: 'Almacén y stock', roles: ['admin', 'supervisor'] },
    { id: 'inventario.conteos_crear', label: 'Crear conteos', description: 'Abrir conteos físicos de inventario', grupo: 'Almacén y stock', roles: ['admin', 'supervisor', 'qa'] },
    { id: 'inventario.conteos_contar', label: 'Cargar conteos', description: 'Cargar cantidades contadas', grupo: 'Almacén y stock', roles: ['admin', 'supervisor', 'qa', 'operador'] },
    { id: 'inventario.conteos_confirmar', label: 'Confirmar conteos', description: 'Cerrar un conteo y aplicar sus diferencias', grupo: 'Almacén y stock', roles: ['admin', 'supervisor'] },
    { id: 'inventario.almacenes_admin', label: 'Administrar almacenes', description: 'Crear y editar almacenes y ubicaciones', grupo: 'Almacén y stock', roles: ['admin', 'supervisor'] },
    { id: 'inventario.exportar_inventario', label: 'Exportar inventario', description: 'Descargar existencias y movimientos', grupo: 'Almacén y stock', roles: ['admin', 'supervisor', 'qa', 'vendedor'] },
    { id: 'inventario.permitir_stock_negativo', label: 'Permitir stock negativo', description: 'Confirmar operaciones que dejan el stock en negativo', grupo: 'Almacén y stock', roles: ['admin'] },

    // ─ Recursos Humanos: EPP ─
    { id: 'rrhh.epp_ver', label: 'Ver EPP del personal', description: 'Consultar matriz, catálogo, kardex, solicitudes y legajo de EPP', grupo: 'Recursos Humanos', roles: ['admin', 'supervisor', 'qa'] },
    { id: 'rrhh.epp_gestionar', label: 'Gestionar EPP', description: 'Editar catálogo y stock, resolver solicitudes y administrar enlaces públicos de la matriz', grupo: 'Recursos Humanos', roles: ['admin', 'supervisor', 'qa'] },
    { id: 'rrhh.epp_entregar', label: 'Entregar EPP', description: 'Registrar actas de entrega de EPP y descontar stock', grupo: 'Recursos Humanos', roles: ['admin', 'supervisor', 'qa'] },

    // ─ Ventas: cuenta corriente ─
    { id: 'ventas.exceder_limite_credito', label: 'Superar el límite de crédito', description: 'Confirmar ventas a cuenta corriente que superan el límite de crédito del cliente', grupo: 'Ventas', roles: ['admin', 'supervisor'] },

    // ─ Calidad (SGI) ─
    { id: 'calidad.ver', label: 'Ver SGI de calidad', description: 'Consultar no conformidades, CAPA, riesgos, oportunidades y objetivos de calidad', grupo: 'Calidad', roles: ['admin', 'supervisor', 'qa'] },
    { id: 'calidad.gestionar', label: 'Gestionar SGI de calidad', description: 'Crear, editar y eliminar NC, CAPA, riesgos, oportunidades y objetivos; análisis de causa y verificación de eficacia', grupo: 'Calidad', roles: ['admin', 'supervisor', 'qa'] },
    { id: 'calidad.indicadores_capa', label: 'Ver indicadores de CAPA', description: 'Resumen de acciones correctivas en el tablero', grupo: 'Calidad', roles: ['admin', 'supervisor', 'qa', 'operador'] },

    // ─ Sugerencias ─
    { id: 'sugerencias.gestionar', label: 'Gestionar sugerencias', description: 'Cambiar estado, asignar responsable, comentar, cargar acciones de mejora y analizar con IA', grupo: 'Calidad', roles: ['admin', 'supervisor', 'qa'] },

    // ─ Tickets de soporte ─
    { id: 'tickets.gestionar', label: 'Gestionar tickets', description: 'Ver todos los tickets, clasificar, asignar, cambiar estados, notas internas y volver a analizar con IA', grupo: 'Tickets de soporte', roles: ['admin', 'supervisor', 'qa'] },
    { id: 'tickets.delegar_agente', label: 'Delegar tickets a un agente', description: 'Generar y revocar el acceso de un agente externo a un ticket', grupo: 'Tickets de soporte', roles: ['admin', 'supervisor', 'qa'] },

    // ─ OKR y KPI ─
    { id: 'okr.ver', label: 'Ver OKR y KPI', description: 'Consultar OKR, KPI, mediciones, gráficos, planes de acción y tablero', grupo: 'OKR y KPI', roles: ['admin', 'supervisor', 'qa'] },
    { id: 'okr.gestionar', label: 'Gestionar OKR y KPI', description: 'Crear y editar OKR, KPI, gráficos y planes de acción; cargar y sincronizar mediciones', grupo: 'OKR y KPI', roles: ['admin', 'supervisor', 'qa'] },

    // ─ Datos ─
    { id: 'datasets.usar', label: 'Usar datasets', description: 'Consultar, previsualizar, probar y ejecutar datasets', grupo: 'Datos', roles: ['admin', 'supervisor', 'qa'] },
    { id: 'datasets.gestionar', label: 'Gestionar datasets', description: 'Crear, editar y eliminar datasets', grupo: 'Datos', roles: ['admin', 'supervisor'] },
    { id: 'diccionario.ver', label: 'Ver diccionario de datos', description: 'Consultar tablas y campos del diccionario de datos', grupo: 'Datos', roles: ['admin', 'supervisor', 'qa'] },
    { id: 'diccionario.editar', label: 'Editar diccionario de datos', description: 'Cargar y editar tablas y campos del diccionario de datos', grupo: 'Datos', roles: ['admin', 'supervisor'] },

    // ─ Viajes y viáticos ─
    { id: 'viajes.gestionar', label: 'Gestionar viajes', description: 'Crear, editar, eliminar y rendir viajes; ver todos los viajes y comprobantes; valores de referencia', grupo: 'Viajes y viáticos', roles: ['admin', 'supervisor', 'qa'] },

    // ─ Análisis de pliegos ─
    { id: 'pliegos.ver', label: 'Ver pliegos', description: 'Consultar análisis de pliegos y marcar tareas dentro o fuera del pliego', grupo: 'Análisis de pliegos', roles: ['admin', 'supervisor', 'qa', 'operador'] },
    { id: 'pliegos.gestionar', label: 'Gestionar pliegos', description: 'Subir, analizar y borrar pliegos', grupo: 'Análisis de pliegos', roles: ['admin', 'supervisor'] },

    // ─ Informes técnicos ─
    { id: 'informes.eliminar_finalizados', label: 'Eliminar informes finalizados', description: 'Eliminar informes técnicos finalizados, con DNI, firma y justificación', grupo: 'Informes técnicos', roles: ['admin', 'supervisor'] },

    // ─ Inteligencia artificial ─
    { id: 'ia.generar_documentos', label: 'Generar documentos con IA', description: 'Generar documentación controlada con IA', grupo: 'Inteligencia artificial', roles: ['admin', 'supervisor', 'qa'] },
] as const satisfies readonly FuncionConfig[];

export type FuncionId = (typeof FUNCIONES)[number]['id'];

const FUNCIONES_POR_ID = new Map<string, FuncionConfig>(FUNCIONES.map(f => [f.id, f]));

export function getFuncion(id: string): FuncionConfig | undefined {
    return FUNCIONES_POR_ID.get(id);
}

/** Funciones agrupadas, en el orden del catálogo. */
export function agruparFunciones(): { grupo: string; funciones: FuncionConfig[] }[] {
    const grupos: { grupo: string; funciones: FuncionConfig[] }[] = [];
    for (const f of FUNCIONES) {
        let g = grupos.find(x => x.grupo === f.grupo);
        if (!g) {
            g = { grupo: f.grupo, funciones: [] };
            grupos.push(g);
        }
        g.funciones.push(f);
    }
    return grupos;
}

// ── Claves ─────────────────────────────────────────────────────────

const PREFIJO_VISTA = 'vista:';
const PREFIJO_FUNCION = 'funcion:';

export function claveVista(viewKey: string): string {
    return PREFIJO_VISTA + viewKey;
}

export function claveFuncion(id: string): string {
    return PREFIJO_FUNCION + id;
}

export function parseClave(clave: string): { tipo: 'vista' | 'funcion'; id: string } | null {
    if (clave.startsWith(PREFIJO_VISTA)) return { tipo: 'vista', id: clave.slice(PREFIJO_VISTA.length) };
    if (clave.startsWith(PREFIJO_FUNCION)) return { tipo: 'funcion', id: clave.slice(PREFIJO_FUNCION.length) };
    return null;
}

// ── Resolución ─────────────────────────────────────────────────────

/** En datos viejos el rol de administrador aparece como "administrador". */
export function normalizarRol(role: string | null | undefined): string {
    const r = (role || '').trim().toLowerCase();
    return r === 'administrador' ? 'admin' : r;
}

// ── Roles y rango ──────────────────────────────────────────────────

/** Roles válidos de un usuario. */
export const ROLES = ['admin', 'supervisor', 'qa', 'vendedor', 'operador'] as const;
export type Rol = (typeof ROLES)[number];

/**
 * Rango de cada rol. Nadie asigna un rol de rango mayor al propio ni edita
 * a un usuario de rango mayor (ver lib/operators/reglasRol.ts).
 */
const RANGO_ROL: Record<Rol, number> = { admin: 3, supervisor: 2, qa: 2, vendedor: 1, operador: 1 };

export function esRolValido(role: string | null | undefined): role is Rol {
    return (ROLES as readonly string[]).includes(normalizarRol(role));
}

/** Rango del rol; 0 si el rol no existe. */
export function rangoRol(role: string | null | undefined): number {
    const r = normalizarRol(role);
    return esRolValido(r) ? RANGO_ROL[r] : 0;
}

/** Permiso especial del usuario para una clave, o null si rige el rol. */
export function efectoEspecial(clave: string, permisos: PermisoEspecial[] | null | undefined): EfectoPermiso | null {
    if (!permisos || permisos.length === 0) return null;
    const p = permisos.find(x => x.clave === clave);
    return p ? p.efecto : null;
}

/** Lo que da el rol por defecto para una función, sin mirar permisos especiales. */
export function rolTieneFuncion(id: FuncionId, role: string | null | undefined): boolean {
    const f = FUNCIONES_POR_ID.get(id);
    return !!f && f.roles.includes(normalizarRol(role));
}

/** Acceso efectivo a una función: permiso especial si lo hay; si no, el rol. */
export function puedeFuncion(
    id: FuncionId,
    role: string | null | undefined,
    permisos?: PermisoEspecial[] | null
): boolean {
    const especial = efectoEspecial(claveFuncion(id), permisos);
    if (especial) return especial === 'permitir';
    return rolTieneFuncion(id, role);
}
