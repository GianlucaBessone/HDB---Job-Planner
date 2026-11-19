# Control de accesos

Cada usuario tiene un **rol** que define sus accesos por defecto. Sobre eso se le pueden
dar **permisos especiales**: accesos puntuales que amplían o recortan lo que le da el rol,
sin cambiarle el rol ni tocar la configuración del resto.

## Cómo se resuelve un acceso

1. Si el usuario tiene un permiso especial para ese acceso, gana el permiso especial:
   `permitir` lo habilita y `denegar` lo bloquea.
2. Si no tiene, rige el rol.

Hay dos tipos de acceso:

| Tipo | Qué controla | Accesos por defecto del rol | Clave |
|---|---|---|---|
| Vista | Una pantalla del menú | `lib/viewAccess.ts`, editable en Configuración | `vista:/ventas/pdv` |
| Función | Una acción dentro de una vista | `FUNCIONES` en `lib/permisos.ts` | `funcion:ventas.anular_venta` |

## Dónde se administra

**Gestión de Usuarios → botón de la llave** en cada usuario. Lo ve quien tiene la función
"Administrar accesos" (`usuarios.accesos`, por defecto solo `admin`). Cada acceso tiene tres
estados: *Según rol*, *Permitir* o *Denegar*. Los cambios quedan en Auditoría
(`OPERATOR_PERMISOS`) y aplican cuando el usuario vuelve a la pestaña o recarga.

Nadie puede cambiar su propio permiso de administrar accesos.

## Sesión

- El middleware valida la cookie `sgi_session` y deja `x-user-id` (y `x-user-role`, el rol
  guardado en el token).
- `getAcceso` (`lib/permisosServer.ts`) **no usa el rol del token**: en cada pedido lee de la
  base el rol, si el usuario sigue activo y su nombre. Un cambio de rol o una baja aplican en
  el pedido siguiente, aunque la cookie siga vigente. Un usuario inactivo o borrado queda
  sin sesión para todas las APIs que pasan por `getAcceso`.
- Cerrar sesión llama a `POST /api/auth/logout`, que borra la cookie (es httpOnly: el
  navegador no puede borrarla solo). La ruta es pública en el middleware para que la
  renovación de sesión no vuelva a escribir la cookie.
- Ninguna API decide permisos con el rol o el usuario que manda el navegador (cuerpo,
  query o headers propios como `requestUserRole`, `role`, `userRole`, `approvedById`).
  Quien actúa, y quien queda en Auditoría, es siempre el usuario de la sesión.

## Roles y rango (Gestión de Usuarios)

Rango: `admin` (3) > `supervisor` = `qa` (2) > `vendedor` = `operador` (1). Las reglas
están en `lib/operators/reglasRol.ts` y las aplica `app/api/operators`:

- Dar de alta un usuario con un rol distinto de `operador`, o cambiarle el rol a alguien,
  pide la función `usuarios.asignar_rol`. El rol tiene que existir.
- Nadie asigna un rol de rango mayor al propio.
- Nadie cambia su propio rol.
- Nadie edita (datos, PIN, estado, dispositivo) ni elimina a un usuario de rango mayor al propio.
- La API solo acepta los campos del formulario de usuarios (Zod). Los permisos especiales
  se administran solo desde el editor de accesos (`/api/accesos`).

## Datos

Tabla `OperatorPermiso` (`prisma/schema.prisma`): una fila por usuario y acceso, con el
efecto y quién lo otorgó. Mientras la tabla no exista en la base rigen solo los roles
y el editor avisa que no puede guardar.

## Para desarrollar

- **API**: `const acceso = await exigirAcceso(req, ['ventas.anular_venta']); if (acceso instanceof NextResponse) return acceso;`
  responde 401 sin sesión válida y 403 sin la función (alcanza con una de las de la lista).
  Para decidir sin cortar el pedido: `const acceso = await getAcceso(req); acceso.puede(...)`.
  Atajo: `await puede(req, funcion)`. Usá `acceso.userId` / `acceso.nombre` para la auditoría.
- **Pantalla**: `const { puede, puedeVer } = useAcceso()` (`lib/store/useAccessStore.ts`).
- **Función nueva**: agregala a `FUNCIONES` en `lib/permisos.ts` con sus roles por defecto.
  Aparece sola en el editor.
- **Vista nueva**: se declara en `lib/viewAccess.ts`, como siempre.
- No compares roles a mano (`role === 'admin'`): un permiso especial no lo vería.

## Alcance actual

Pasan por el control de accesos:

- Menú lateral, inicio y buscador global (vistas).
- Bloqueo de una vista denegada puntualmente, también si se entra por enlace directo.
- Acceso a Punto de Venta y Auditoría de IA.
- Funciones: gestionar usuarios, administrar accesos, control horario, anular ventas,
  modificar precios, anular comprobantes de cuenta corriente, las diez acciones de
  Almacén y stock, Reclutamiento de RRHH (ver, gestionar y eliminar; ver
  `docs/rrhh/RECLUTAMIENTO.md`) y las tres de EPP de Recursos Humanos
  (`rrhh.epp_ver`, `rrhh.epp_gestionar`, `rrhh.epp_entregar`).
- EPP (`app/api/rrhh/epp/**`, lógica en `lib/rrhh/eppServer.ts`): ya no usa server
  actions. Cada API exige sesión de un usuario activo (`lib/rrhh/eppSesion.ts`) y la
  función que corresponde; actas, kardex, solicitudes y auditoría quedan a nombre del
  usuario de la sesión. "Mis EPP" (`/api/rrhh/epp/mis-epp/**`) solo pide sesión y
  trabaja siempre sobre el operador de la sesión. La matriz pública por enlace
  (`/api/public/epp-matriz/[token]`) no pide sesión: solo valida el token.
- Presupuestos de servicio y asistente de proyectos (ver `docs/presupuestos-servicio/README.md`):
  `presupuestos.ver` (admin, supervisor, qa), `presupuestos.gestionar`, `presupuestos.aprobar`,
  `presupuestos.convertir` y `ventas.mano_obra_gestionar` (admin y supervisor), y
  `proyectos.crear` (admin, supervisor, qa) para el asistente, el equipo asignado y las tareas.

### Funciones por API

Los GET de configuración, proyectos, clientes y documentos siguen pidiendo solo sesión:
los usan pantallas de todos los roles (Fichado, Registro de tiempos, Capacitación…).

| Función | Roles por defecto | APIs |
|---|---|---|
| `config.administrar` | admin, supervisor, qa | `PUT /api/config/system`; `POST/PUT/DELETE` de `/api/config/tags`, `/api/config/options`, `/api/config/checklists`, `/api/checklist-templates`; `GET /api/config/tags?seed=true` |
| `config.vistas` | admin | `PUT /api/config/views` (queda en Auditoría como `VIEW_ACCESS`); opciones de la categoría `VIEW_ACCESS` en `/api/config/options` |
| `config.prompts_ia` | admin | `POST /api/ai/prompts` |
| `usuarios.gestionar` | admin, supervisor, qa | `POST/PATCH/DELETE /api/operators`, `POST /api/operators/reset-devices` |
| `usuarios.asignar_rol` | admin, supervisor, qa | Alta con rol distinto de operador o cambio de rol en `/api/operators` (con las reglas de rango) |
| `auditoria.ver` | admin, supervisor, qa | `GET /api/audit` |
| `proyectos.crear` | admin, supervisor, qa | `POST/PATCH /api/projects` |
| `proyectos.eliminar` | admin, supervisor | `DELETE /api/projects` (borra en cascada OS, horas y fichadas) |
| `clientes.gestionar` | admin, supervisor, qa, vendedor | `POST/PATCH /api/clients`; escrituras de `/api/clients/[id]/` sectores, config, tarifas, responsables y regenerar clave del portal |
| `clientes.eliminar` | admin, supervisor | `DELETE /api/clients` |
| `documentos.gestionar` | admin, supervisor, qa | Escrituras de `/api/documentos/**`: alta, edición, archivos, quick-upload, versiones, reglas, cuestionario y subaccesos |
| `documentos.eliminar` | admin, qa | `DELETE /api/documentos/[id]` |
| `timesheets.gestionar_horas` | admin, supervisor, qa | `/api/time-entries`: cargar horas de otro usuario, editar o borrar horas ajenas o de un día ya confirmado. Sin la función, cada uno carga, edita y confirma solo sus horas |
| `fichadas.aprobar` | admin, supervisor, qa | `GET/PATCH /api/time-entries/approve` |
| `tareas.ver_todas` | admin | `/api/tareas`: ver todas las tareas y editar o borrar cualquiera |

Reglas por usuario, sin función:

- **Tareas**: sin `tareas.ver_todas`, el GET devuelve las tareas creadas por el usuario o en las
  que está involucrado. Editar y borrar: el creador o un involucrado responsable; un
  colaborador solo cambia el estado; un observador, nada. El creador de una tarea nueva es
  el usuario de la sesión.
- **Avisos** (`/api/activities`, `/api/activities/[id]`): cada uno lee, marca y archiva solo
  sus propios avisos. `?todos=1` cierra el aviso para todos sus destinatarios, y solo puede
  hacerlo uno de ellos.
- **Documentos**: firmar (`/api/documentos/[id]/firmar`) solo puede el firmante asignado al
  paso (creador, revisor o aprobador del documento). Confirmar lectura e imprimir una copia
  controlada quedan a nombre del usuario de la sesión.

Todavía dependen solo del rol, y hay que migrarlos por etapas:

- Las APIs que leen `x-user-role` directo (tickets, sugerencias, viajes, inventario,
  pliegos, comentarios de OT, `requireSGIRole`) usan el rol guardado en el token: un cambio
  de rol o una baja recién aplican ahí cuando la sesión vence o el usuario vuelve a entrar.
  Migrarlas a `getAcceso` lo corrige. Lo mismo para las APIs que solo piden sesión.
- `POST /api/activities` toma el emisor de la sesión, pero cualquier usuario con sesión puede
  enviar un aviso a cualquier otro (`operatorId`) o a todos los supervisores (`forSupervisors`).

- Las APIs que usan `requireSGIRole` (`lib/sgiAuth.ts`): calidad (`/api/sgi`), OKR/KPI,
  datasets y diccionario de datos. Otorgar esas vistas a un rol que no las tiene muestra
  la pantalla, pero la API responde 403.
- Chequeos de rol sueltos dentro de las pantallas (botones y acciones que se muestran
  según `role`).
- Una vista que el rol no tiene, sin denegación puntual, solo se oculta del menú: no se
  bloquea la URL directa (igual que antes de este módulo).
