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

## Fase 2 · Pantallas unificadas — próxima

Sin cambios de base de datos.

- P11 · Inicio "Mi día": pendientes del usuario (fichadas a aprobar, pedidos, tareas vencidas, EPP por firmar, viajes por rendir, capacitaciones).
- P13 · Asistencia y horas: una pantalla con Hoy (fichadas en curso), Excepciones (aprobaciones) y Período (control horario).
- P14 · El equipo asignado a un proyecto cuenta como asignación para el fichado.
- P19 · Configuración repartida: cada catálogo junto al módulo que lo usa.
- P7 · Archivar en lugar de borrar personas, clientes y proyectos con historia.
- P23 · PIN temporal y cambio obligatorio al primer ingreso.
- P28 · Demoras del cliente como tipo de entrada de la bitácora del proyecto.
- P33 · Aprobación masiva de fichadas.


## Fase 3 · Datos maestros e integración

Requiere cambios de esquema; las migraciones se aplican solo con autorización.

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
