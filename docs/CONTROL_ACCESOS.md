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

## Datos

Tabla `OperatorPermiso` (`prisma/schema.prisma`): una fila por usuario y acceso, con el
efecto y quién lo otorgó. Mientras la tabla no exista en la base rigen solo los roles
y el editor avisa que no puede guardar.

## Sesión del lado del servidor

El middleware valida la cookie y deja `x-user-id`. Todo lo demás se lee de la base en
cada pedido (`lib/permisosServer.ts`): el rol, si el usuario está activo, su nombre y sus
permisos especiales. Por eso:

- Un cambio de rol rige en el próximo pedido, no cuando se renueva el token.
- Un usuario dado de baja recibe 401 aunque su cookie siga vigente.
- `x-user-role` (el rol guardado en el token) ya no decide permisos. El middleware lo
  sigue dejando como dato, y borra los `x-user-id` / `x-user-role` que mande el navegador,
  también en las rutas públicas.
- El usuario, el nombre y el rol que manda el navegador (cuerpo, query o headers) no se
  usan para decidir permisos ni para firmar lo que se registra.

## Para desarrollar

- **API**: `exigirAcceso` exige usuario activo y, si se pasan funciones, al menos una:

  ```ts
  const acceso = await exigirAcceso(req, ['calidad.ver', 'calidad.gestionar']);
  if (acceso instanceof NextResponse) return acceso; // 401 o 403
  // acceso.userId, acceso.nombre, acceso.role, acceso.puede('calidad.gestionar')
  ```

  Sin funciones (`exigirAcceso(req)`) solo pide sesión de un usuario activo.
  `verificarAcceso` devuelve el motivo en vez de la respuesta, para módulos con su propio
  formato de error (EPP, presupuestos). `getAcceso` / `puede` siguen disponibles; con un
  usuario inactivo, `puede()` siempre da `false`.
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
  pliegos, informes técnicos, PDV, tareas, registro de tiempos y prompts de IA: ver
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
  El alta clásica de proyectos (`POST /api/projects`) no cambió: sigue con sus reglas de antes.

## Funciones por API

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
| `/api/tareas` | GET | `tareas.ver_todas` ve todas; sin ella, las propias o en las que se participa |
| `/api/time-entries` | POST, PUT, DELETE | `timesheets.cargar_otros` para registros de otros; `timesheets.editar_confirmados` para días confirmados |
| `/api/ai/prompts` | POST | `ia.prompts_editar` |
| `/api/ai/generate-doc` | POST | `ia.generar_documentos` |

Todavía dependen solo del rol, o de datos que manda el navegador, y hay que migrarlos:

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
- `/api/time-entries` no controla quién marca un día como confirmado.
- `/api/sgi/reunion/[id]`, `nc/[id]/chat`, `nc/[id]/reunion`, `nc/[id]/similares` y
  `nc/[id]/ia-docs` solo piden sesión.
- Una vista que el rol no tiene, sin denegación puntual, solo se oculta del menú: no se
  bloquea la URL directa (igual que antes de este módulo).
