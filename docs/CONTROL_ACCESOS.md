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
- El middleware borra los `x-user-id` / `x-user-role` que manda el navegador, también en
  las rutas públicas: solo los pone él, después de validar la cookie.

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

- **API**: `exigirAcceso` exige usuario activo y, si se pasan funciones, al menos una:

  ```ts
  const acceso = await exigirAcceso(req, ['calidad.ver', 'calidad.gestionar']);
  if (acceso instanceof NextResponse) return acceso; // 401 o 403
  // acceso.userId, acceso.nombre, acceso.role, acceso.puede('calidad.gestionar')
  ```

  Sin funciones (`exigirAcceso(req)`) solo pide sesión de un usuario activo. Un tercer
  parámetro opcional cambia el mensaje del 403. Para decidir sin cortar el pedido:
  `const acceso = await getAcceso(req); acceso.puede(...)` (con un usuario inactivo, `puede()`
  siempre da `false`). `verificarAcceso` devuelve el motivo en vez de la respuesta, para
  módulos con su propio formato de error (EPP, presupuestos). Usá `acceso.userId` /
  `acceso.nombre` para la auditoría.
- **Pantalla**: `const { puede, puedeVer } = useAcceso()` (`lib/store/useAccessStore.ts`).
- **Función nueva**: agregala a `FUNCIONES` en `lib/permisos.ts` con sus roles por defecto.
  Aparece sola en el editor.
- **Vista nueva**: se declara en `lib/viewAccess.ts`, como siempre.
- No compares roles a mano (`role === 'admin'`) ni leas `x-user-role`: un permiso
  especial no lo vería y el rol del token puede estar desactualizado.

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
- Calidad (SGI), OKR y KPI, datasets, diccionario de datos, tickets, sugerencias, viajes,
  pliegos, informes técnicos, PDV y generación de documentos con IA: ver
  "Funciones por API".
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
`GET /api/config/tags` es solo lectura: no crea ni borra etiquetas. Las etiquetas base se
siembran con `scripts/seed-etiquetas-base.ts`, que solo crea las que faltan.

| Función | Roles por defecto | APIs |
|---|---|---|
| `config.administrar` | admin, supervisor, qa | `PUT /api/config/system`; `POST/PUT/DELETE` de `/api/config/tags`, `/api/config/options`, `/api/config/checklists`, `/api/checklist-templates` |
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
| `gastos.ver` | admin, supervisor, qa | `GET` de `/api/administracion/gastos`, `/proveedores` y `/codigos-gasto` |
| `gastos.gestionar` | admin, supervisor, qa | Escrituras de `/api/administracion/**` (facturas, importación, proveedores, códigos de gasto) y `POST /api/ia/ocr-factura` |
| `herramientas.gestionar` | admin, supervisor | Altas, ediciones y bajas de `/api/herramientas/**` y `/api/carros/**`, armado de carros (`asignar`, `replicar`) y `GET /api/carros/movements/history` |
| `planificacion.gestionar` | admin, supervisor, qa | `POST /api/planning`, `POST /api/planning/notify` (el `GET` sigue con solo sesión: lo usa Fichado) |
| `formacion.gestionar` | admin, supervisor, qa | Ver la formación de otros en `/api/qms/capacitaciones`, `/certificados`, `/competencias` y `/compliance`; validar o borrar certificados ajenos; `POST /api/qms/competencias`; `/api/dashboard/operator-scoreboard/competencies` |
| `ventas.cotizaciones_ver` | admin, supervisor, qa, vendedor | `GET /api/ventas/cotizaciones`, `/[id]` y `/[id]/pdf` |
| `ventas.cotizaciones_gestionar` | admin, supervisor, vendedor | `POST/PUT/PATCH` de cotizaciones (crear, editar, aprobar, anular, convertir en venta) |
| `ventas.cc_ver` | admin, supervisor, qa, vendedor | `GET` de `/api/ventas/cuentas-corrientes`, `/[clienteId]` y la vista previa de actualización de precios |
| `ventas.cc_cobrar` | admin, supervisor, vendedor | `POST /api/ventas/cuentas-corrientes/cobranzas` |
| `ventas.cc_ajustar` | admin, supervisor, vendedor | `POST /api/ventas/cuentas-corrientes/movimientos` (saldo inicial, cargo manual, nota de crédito) |
| `ventas.cc_configurar` | admin, supervisor | `PUT /api/ventas/cuentas-corrientes/[clienteId]` (crédito) y `POST .../actualizacion-precios` |

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
- **Herramientas**: retirar un carro y verificar una herramienta quedan a nombre del usuario de
  la sesión. Devolver un carro lo hace quien lo retiró (o quien tiene `herramientas.gestionar`).
  `GET /api/carros/movements/active` devuelve los movimientos propios.
- **Formación**: cada uno ve su formación, rinde solo sus capacitaciones y carga sus
  certificados. Puede editar o borrar un certificado propio mientras no esté aprobado, y no
  puede cambiarle el estado (aprobar o rechazar).
- **Ventas**: el operador de una cobranza, un ajuste o una actualización de deuda, y quien
  cambia el estado de una cotización, es el usuario de la sesión. Una cotización sin
  vendedor elegido queda a nombre de la sesión.

El rol que usan las pantallas (`useAcceso`) también sale de la base: `/api/accesos/yo` lo
devuelve con los permisos especiales.

### Funciones por API: calidad, tickets, viajes y otros módulos

Todas estas APIs exigen además un usuario activo (401 si no lo hay). "A ∨ B" significa
que alcanza con una de las dos.

| API | Métodos | Función |
|---|---|---|
| `/api/sgi/{nc,capa,riesgos,oportunidades,objetivos}` y sus `[id]` | GET | `calidad.ver` ∨ `calidad.gestionar` |
| Las mismas, `nc/[id]/causa`, `verificacion-eficacia` | POST, PATCH, DELETE | `calidad.gestionar` |
| `/api/sgi/capa/stats` | GET | `calidad.indicadores_capa` ∨ `calidad.ver` ∨ `calidad.gestionar` |
| `/api/okr-kpi/{okr,kpi,graficos,planes-accion}` y sus `[id]`, `kpi/[id]/medicion`, `dashboard` | GET | `okr.ver` ∨ `okr.gestionar` |
| Las mismas, `kpi/[id]/sincronizar` | POST, PUT | `okr.gestionar` |
| `/api/datasets`, `[id]`, `[id]/historial`, `[id]/preview`, `[id]/ejecutar`, `test` | GET; POST de preview, ejecutar y test | `datasets.usar` ∨ `datasets.gestionar` |
| `/api/datasets`, `[id]` | POST, PUT, DELETE | `datasets.gestionar` |
| `/api/diccionario-datos`, `[tablaId]` | GET | `diccionario.ver` ∨ `diccionario.editar` |
| `/api/diccionario-datos`, `[tablaId]` | POST, PUT | `diccionario.editar` |
| `/api/tickets`, `metrics`, `[id]`, `[id]/analizar`, `adjuntos/[id]` | todos | `tickets.gestionar` ve y modifica todo; sin ella, solo los tickets propios (comentar, cerrar o reabrir un resuelto, un análisis con IA) |
| `/api/tickets` | POST | usuario activo; reportar en nombre de otro pide `tickets.gestionar` |
| `/api/tickets/[id]/agente-token` | POST, DELETE | `tickets.delegar_agente` |
| `/api/tickets/upload` | POST | usuario activo |
| `/api/sugerencias/[id]` | PATCH | `sugerencias.gestionar` (GET: usuario activo) |
| `/api/sugerencias/analizar` | POST | `sugerencias.gestionar` |
| `/api/viajes/**` | según la acción | `viajes.gestionar` para crear, editar, eliminar, rendir, ver todos y valores de referencia; responsable y participantes, sobre su viaje |
| `/api/viajes/comprobantes/[id]` | GET | `viajes.gestionar`, quien lo subió, el responsable o un participante |
| `/api/almacen/**`, `/api/ventas/stock/ajuste-rapido` | según la acción | `inventario.*` (`lib/inventario/permisos.ts`) |
| `/api/pliegos`, `[id]`, `[id]/archivo` | GET | `pliegos.ver` ∨ `pliegos.gestionar` |
| `/api/pliegos/tareas/[id]` | PATCH | `pliegos.ver` ∨ `pliegos.gestionar` |
| `/api/pliegos`, `[id]`, `[id]/analizar`, `[id]/archivo`, `[id]/archivo/confirmar`, `opciones` | POST, DELETE, GET de opciones | `pliegos.gestionar` |
| `/api/informes-tecnicos/[id]` | DELETE de un informe finalizado | `informes.eliminar_finalizados`, más DNI y firma (el resto: usuario activo) |
| `/api/ordenes-trabajo/[id]/comentarios` | GET, POST | usuario activo; el autor sale de la sesión |
| `/api/ventas/pdv/confirmar` | POST | `ventas.modificar_precios` si hay precios modificados (o autorización / cotización); `ventas.exceder_limite_credito` para superar el límite de cuenta corriente; el vendedor es el usuario de la sesión |
| `/api/ai/generate-doc` | POST | `ia.generar_documentos` |

Todavía dependen solo del rol, o de datos que manda el navegador, y hay que migrarlos:

- `POST /api/activities` toma el emisor de la sesión, pero cualquier usuario con sesión puede
  enviar un aviso a cualquier otro (`operatorId`) o a todos los supervisores (`forSupervisors`).
- Chequeos de rol sueltos dentro de las pantallas (botones y acciones que se muestran
  según `role`; por ejemplo, Viajes usa `esGestorViajes`).
- El PIN de supervisor (`/api/auth/verificar-supervisor` y las anulaciones de ventas y
  cuenta corriente) compara el rol de quien lo ingresa a mano.
- El PDV manda siempre `autorizadoPorSupervisor: true`: el servidor no comprueba esa
  autorización.
- `x-user-name` lo manda el navegador y varias APIs lo usan como nombre en la auditoría.
- Las APIs de IA `semantic-search`, `training`, `ocr` y `generate-checklist` toman usuario,
  nombre y rol del cuerpo, solo para registrar el uso.
- `/api/cron/reminders?manual=true` usa el rol del token.
- En `/api/time-entries` cada usuario puede marcar como confirmado un día propio.
- `/api/sgi/reunion/[id]`, `nc/[id]/chat`, `nc/[id]/reunion`, `nc/[id]/similares` y
  `nc/[id]/ia-docs` solo piden sesión.
- Una vista que el rol no tiene, sin denegación puntual, solo se oculta del menú: no se
  bloquea la URL directa (igual que antes de este módulo).
