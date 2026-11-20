# Plan de implementación de la auditoría funcional

Implementa las propuestas de [`AUDITORIA_FUNCIONAL.md`](./AUDITORIA_FUNCIONAL.md) por fases. Las referencias (P1, X7, FU3…) son las del informe.

## Resueltas en otras ramas

| Propuesta | Estado |
|---|---|
| P5 · pedidos a `/api/notifications` | En `main` (PR #45): las solicitudes van por `/api/activities` |
| P6 · doble conteo de horas consumidas | En `main` (PR #46) |
| P1–P4 · permisos en el servidor y sesión | En `main` (PR #48): funciones por API, rol leído de la base, cierre de sesión real, sin escalada de rol |

## Fase 1 · Navegación por dominios y arreglos rápidos — hecha

Sin cambios de base de datos.

| Propuesta | Cambio |
|---|---|
| P10 | Menú por dominios en `lib/viewAccess.ts`: Mi trabajo, Proyectos, Personas, Comercial, Logística, Finanzas, Calidad, Indicadores, Ajustes. Mismas vistas y mismos roles por defecto |
| E5 | `getViewConfig` toma de lo guardado solo los roles; sección, nombre, ícono, color y ubicación salen del código. Configuración → "Roles por vista" edita solo roles y la ve quien tiene `config.vistas` |
| E16, E17, P40 | Notificaciones, Tickets y Centro de ayuda salen del menú (`access: 'oculta'`): se abren desde la campana y el nuevo menú "Ayuda y soporte" del encabezado |
| P37 | Nombres y títulos claros y alineados entre menú, migas de pan y pantallas ("Consumo de IA", "Mi formación", "Agenda del equipo", pestaña "Bloqueos" en Proyectos, etc.) |
| E6, P39 | Color de acento en el menú del usuario; sale de Configuración |
| E3, E4 | Se quitan de la pantalla "Impacta métricas" (no tenía efecto) y el campo de hora fija de la alerta |
| P21 | Favoritos y recientes por `id` de usuario (antes por `legajo`, que no existe); migra lo guardado bajo "default" |
| P22, E20 | Órdenes de trabajo: lista global con búsqueda por número, cliente o proyecto, filtro por estado y paginación |
| — | `useViewState` ya no actualiza el store global durante el render (aviso de React al cambiar de pestaña) |

## Fase 2 · Pantallas unificadas — hecha

Sin cambios de base de datos.

| Propuesta | Cambio |
|---|---|
| P11, FU12 | Inicio "Mi día" (`components/inicio/MiDia.tsx`, `GET /api/inicio/pendientes`): jornada en curso, agenda de hoy (Planificación y equipo asignado) y pendientes de la persona: fichadas a aprobar, tareas vencidas y para hoy, actas de EPP por firmar, viajes por rendir, capacitaciones, solicitudes de EPP y avisos sin leer. Cada pendiente depende de la sesión y de sus permisos |
| P13, FU2 | Asistencia y horas: navegación común (`components/asistencia/AsistenciaNav.tsx`) entre Fichadas en curso, Fichadas a aprobar y Control horario. Una sola entrada de menú ("Asistencia y horas") |
| P33 | Fichadas a aprobar: selección múltiple y "Aprobar N". El rechazo sigue de a una porque borra la fichada |
| P14, X10 | El fichado acepta como asignado al operario que está en el equipo del proyecto (`ProyectoAsignacion`) para esa fecha, aunque no figure en la agenda |
| P7, X14 | Personas, clientes y proyectos con historial se desactivan en lugar de borrarse en cascada; la pantalla lo informa y queda en Auditoría (antes borrar un cliente no dejaba registro) |
| P7 (resto) | Documentos controlados, OS firmadas, registros del SGI e informes técnicos finalizados se anulan en lugar de borrarse; el documento ya no purga su auditoría. Detalle en `docs/CONTROL_ACCESOS.md` (Bajas). Sin cambios de base de datos |
| P23 | Ingresar con un PIN débil (1234, repetidos, escaleras) obliga a elegir uno nuevo antes de entrar. El servidor lo exige con una marca en la sesión, no solo la pantalla |

### Pasan a la Fase 3

- P19 · Configuración repartida en los módulos: conviene hacerla junto con las fichas (cliente, persona, proyecto) para no mover los catálogos dos veces.
- P28 · Demoras del cliente dentro de la bitácora: se hace con la ficha única del proyecto (FU11).

## Fase 3 · Fichas y datos maestros — en curso

Requiere cambios de esquema; las migraciones se aplican solo con autorización.

### Hecho: ficha de cliente (P12, FU6)

Migración `prisma/sql/20261120_clientes_datos_fiscales` (aditiva, probada ida/vuelta/ida en PostgreSQL 16 local). **Aplicarla en producción antes de desplegar este código.**

| Cambio | Detalle |
|---|---|
| Datos fiscales | `HdbClient.razonSocial`, `cuit` (normalizado `30-12345678-9`) y `condicionIva` |
| Ficha `/clients/[id]` | Pestañas Datos, Comercial (lista de precios, % sobre materiales, crédito), Portal y OT (tarifas, responsables, sectores), Proyectos y Cuenta corriente (saldo, vencido, disponible; enlace a sus movimientos) |
| API de clientes | Alta y edición validadas con Zod (`lib/clientes.ts`); antes el cuerpo pasaba directo a la base. `GET /api/clients/[id]` para la ficha |
| Ventas | El PDV busca por CUIT o razón social y usa el CUIT como identificación (antes ponía el teléfono o el email, que salían impresos como "CUIT/DNI"). Cotizaciones precarga el CUIT del cliente |
| Cuentas corrientes | Acepta `?cliente=<id>` para abrir la cuenta de un cliente |

### Hecho: ficha del proyecto (FU11, FU10, P28)

Sin cambios de base de datos.

| Cambio | Detalle |
|---|---|
| Ficha `/projects/ficha/[id]` | Pestañas Resumen (horas, checklist, bloqueantes, demoras, datos, horas por persona, presupuesto, tareas y equipo, enlace público), Checklist, Bitácora, Materiales y Órdenes (OS y OT del proyecto). Acciones según permiso: Editar y Costos para quien gestiona; Finalizar con `proyectos.finalizar`, si no "Pedir finalización" |
| Una sola ficha | Reemplaza el detalle en ventana de Proyectos y la vista del responsable de Mis proyectos (≈1.400 líneas repetidas con reglas distintas). La abren quien gestiona proyectos, el responsable y el equipo asignado; vista oculta `/projects/ficha` en `lib/viewAccess.ts` |
| Mis proyectos | Es la lista filtrada: donde la persona es responsable o está en el equipo asignado (`ProyectoAsignacion` vigente o futura), con el rol marcado. Quien gestiona puede ver todos. Mantiene las delegaciones de material por aceptar |
| Bitácora (`lib/bitacora.ts`) | Nota, reporte, consulta, bloqueante y **demora del cliente** en una sola línea de tiempo, con filtros. La demora pide área, horas y motivo y queda en Demoras del cliente. El bloqueante avisa a los supervisores |
| API | `POST/PATCH /api/delays` y `POST /api/projects/[id]/logs` validan con Zod (antes el cuerpo pasaba directo a la base). Quien carga la demora sale de la sesión; solo quien gestiona demoras la registra a nombre de otro |
| Checklist | Una regla: quien gestiona marca y excluye; el responsable marca y, si un supervisor ya confirmó el ítem, pide el cambio con justificación |
| Materiales | Un solo cálculo del saldo en poder, igual al de la API (antes la pantalla permitía informar uso por encima de lo devuelto y contaba las delegaciones rechazadas) |
| Enlaces | `/projects?proyecto=<id>` lleva a la ficha; Bloqueos, la ficha del cliente, presupuestos y el alta de proyecto abren la ficha. `GET /api/projects/[id]` ya no se cachea en la CDN (`private, no-store`) |

### Hecho: configuración repartida (P19, SE1)

Sin cambios de base de datos ni de APIs: mismos endpoints y mismo permiso (`config.administrar`; roles por vista con `config.vistas`).

| Antes, en Configuración | Ahora |
|---|---|
| Etiquetas, checklists por etiqueta, categorías y tipos de actividad | Proyectos → Ajustes (`/projects/ajustes`) |
| Áreas y motivos de demora | Proyectos → Ajustes → Demoras del cliente (lo que usa la bitácora) |
| Valor de mano de obra ("Órdenes de servicio") | Proyectos → Ajustes → Mano de obra: lo usan el costo del proyecto y el cobro de la OS |
| Alerta diaria de carga de horas y fichaje en la base | Asistencia y horas → Ajustes (`/monitoreo-fichadas/ajustes`) |
| Causas de registro de tiempo | Asistencia y horas → Ajustes |
| Roles por vista | Sigue en Configuración, que además muestra dónde se configura cada módulo |

Las secciones viven en `components/configuracion/secciones.tsx` y cada módulo monta las suyas; la pestaña Ajustes aparece solo con `config.administrar`.

### Pendiente en esta fase

- Demoras del cliente (`/delays`) sigue como listado de todos los proyectos; se puede ocultar del menú cuando la bitácora reemplace su uso.
- P8 · Una sola fuente de precios de materiales (`Producto`); se retira `MaterialMaestro`.
- P9 · Stock integrado con ventas, entregas a obra y órdenes.
- P15 · Las órdenes firmadas generan el cargo en cuenta corriente.
- P20 · Tarifas de mano de obra con una sola regla.
- P24 · Proveedores únicos.
- P27 · Tipo de proyecto con valores por defecto y estados calculados.

## Fase 4 · Fusiones mayores

Dependen de las respuestas del Anexo A del informe.

- P26 · Órdenes de servicio + órdenes de trabajo.
- P35 · Presupuestos unificados.
- P29–P31 · Calidad reorganizada, objetivos unificados, acciones con origen.
- P32 · Búsqueda global de registros.
- Legajo, calendario de vencimientos, compras, portal del cliente completo.
