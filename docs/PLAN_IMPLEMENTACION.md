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
| P23 | Ingresar con un PIN débil (1234, repetidos, escaleras) obliga a elegir uno nuevo antes de entrar. El servidor lo exige con una marca en la sesión, no solo la pantalla |

### Pasan a la Fase 3

- P19 · Configuración repartida en los módulos: conviene hacerla junto con las fichas (cliente, persona, proyecto) para no mover los catálogos dos veces.
- P28 · Demoras del cliente dentro de la bitácora: se hace con la ficha única del proyecto (FU11).

## Fase 3 · Fichas y datos maestros — próxima

Requiere cambios de esquema; las migraciones se aplican solo con autorización.

- P19 · Configuración repartida: cada catálogo junto a la ficha o el módulo que lo usa.
- FU11, P28 · Ficha única del proyecto (Mis proyectos como filtro) con la bitácora que incluye las demoras del cliente.

- P12 · Ficha de cliente con razón social, CUIT y condición de IVA, y su configuración en un solo lugar.
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
