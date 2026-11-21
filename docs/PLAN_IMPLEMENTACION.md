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

### Hecho: órdenes firmadas a la cuenta corriente (P15)

Migración `prisma/sql/20261121_cc_cargo_por_orden` (aditiva: `origenTipo` y `origenId` en `CuentaCorrienteMovimiento`, probada ida/vuelta/ida en PostgreSQL 16 local). **Aplicada en producción el 20/11/2026.**

| Cambio | Detalle |
|---|---|
| Órdenes por cargar | Panel en Cuentas corrientes y en la ficha del cliente: OS con el cobro generado (estado "cobrada") y cada ciclo de OT firmado en el portal que todavía no están en la cuenta |
| Cargo por servicio | Movimiento nuevo `CARGO_SERVICIO` (serie ND), con el origen de la orden. Cuenta para el saldo, el vencimiento (plazo del cliente) y la imputación de cobranzas y notas de crédito como cualquier débito |
| Una vez por orden | No se carga dos veces la misma orden (control en una transacción con bloqueo por orden). Si el cargo se anula, la orden vuelve a la lista. El monto y el cliente se leen de la orden, nunca del navegador |
| Permisos | Ver la lista: `ventas.cc_ver`; cargar: `ventas.cc_ajustar` (la función de los débitos manuales). Sin funciones nuevas |
| OS | Una OS ya cargada no cambia su cobro (409: hay que anular el cargo). "Marcar pagada" avisa que el cobro se registra en Cuentas corrientes |
| Por qué con un clic y no automático | Hoy se factura en otro sistema y AFIP llega el próximo sprint (Anexo A). Pasarlo a automático al firmar es cambiar dónde se llama `cargarOrdenesACuenta` |

### Hecho: consumos reales mueven el stock (P9)

Sin cambios de base de datos: usa el kardex existente (`ProductoStockMovimiento` con `referenciaTipo` y `referenciaId`) y la marca `Venta.stockDescontado`. Lógica en `lib/inventario/consumos.ts`.

| Origen | Cuándo mueve el stock |
|---|---|
| Material de OT | Al cargarlo en el ciclo sale del depósito; quitarlo lo devuelve (ver P8) |
| Venta del PDV | Al confirmarla sale lo vendido (del almacén de la venta o el predeterminado). Cancelar pendientes devuelve lo cancelado; anularla devuelve todo |
| Entrega a obra | Sale lo entregado menos lo devuelto y cerrado por el depósito. Alta, edición, importación de provisión, materiales que agrega una OS y devoluciones; borrar el material devuelve lo que quedaba afuera |
| Stock negativo | Permitido: una venta nunca se frena por stock (Anexo A). El movimiento queda marcado `stockNegativo` para corregirlo con un conteo o ajuste |

- **Conciliación**: cada origen tiene una salida neta objetivo; se registra solo la diferencia con lo que ya está en el kardex para ese origen. Repetirla no duplica nada (bloqueo por origen dentro de la transacción).
- **Lo anterior no se toca**: ventas confirmadas antes del cambio (`stockDescontado = false`) y materiales de obra creados antes de `STOCK_OBRA_DESDE` (20/11/2026 21:00 UTC; se puede mover con esa variable de entorno) no mueven stock, para no restar dos veces lo que ya se ajustó a mano.
- **Vínculo con el catálogo**: el material de obra se busca por código = SKU (también sin ceros a la izquierda o por código de barras), igual que su precio. Un material sin producto en el catálogo no mueve stock.

### Hecho: una sola fuente de precios de materiales (P8)

Sin cambios de base de datos. Lógica en `lib/ventas/precioMaterial.ts`: producto por código (SKU, con o sin ceros a la izquierda, o código de barras) y precio de venta vigente con la lista del proyecto, si no la del cliente, si no la predeterminada (`resolverPrecioProducto`, la misma regla que usa el PDV).

| Antes leía `MaterialMaestro` | Ahora |
|---|---|
| Materiales de las OT (precio base del snapshot) | Precio del catálogo + el % de materiales del cliente, como antes. Un código fuera del catálogo se rechaza; el 999999 sigue para materiales manuales |
| Buscador de materiales de la OT | `GET /api/materiales/catalogo?q=` con la lista del proyecto o cliente |
| Precarga de precios al cobrar una OS | `GET /api/materiales/catalogo?codigos=` con la lista del proyecto |
| Costo del proyecto → "Sincronizar precios" | Precio del catálogo con la lista del proyecto |
| Alta y edición de materiales de obra, importación de provisión, edición de precio en el costo | Ya no escriben en `MaterialMaestro`; el buscador de materiales de obra ya no cae a esa tabla |

- **Materiales de las OT al stock** (salen del depósito): cargar un material de catálogo en un ciclo lo descuenta; quitarlo lo devuelve (`conciliarStockCicloOT`, referencia `OT` por ciclo). Los de código 999999 son manuales y no mueven stock; los cargados antes de `STOCK_OBRA_DESDE` no se cuentan.
- Se borran la vista desactivada `/inventario` y su API (`/api/inventario/**`).
- Migración `prisma/sql/20261121_quitar_material_maestro`: **aplicada en producción el 21/11/2026**, después de desplegar P8 y de dar de alta en el catálogo los códigos que no tenían producto (101; 74 activos). Detalle en su README.

### Hecho: tarifas de mano de obra con una sola regla (P20, FU8)

Migración `prisma/sql/20261121_tarifas_mano_obra` (aditiva: `Operator.manoObraCategoriaId` y tabla `ClienteTarifaCategoria`; probada ida/vuelta/ida). **Aplicada en producción el 21/11/2026.**

Regla única (`lib/manoObra/tarifa.ts`), para una persona y un cliente: excepción del cliente para la persona (`ClientOperatorRate`) → valor del cliente para la categoría de la persona → valor de la categoría (`ManoObraCategoria`) → valor por defecto (Proyectos → Ajustes → Mano de obra).

| Dónde | Antes | Ahora |
|---|---|---|
| Horas de una OT | Solo la tarifa por cliente y persona; sin cargar, la hora valía $0 | La regla completa |
| Costo del proyecto | Un único valor global para todas las personas | La regla para cada persona con el cliente del proyecto; el desglose muestra valor hora y de dónde sale |
| Usuarios | — | Campo "Categoría de mano de obra" |
| Ficha del cliente → Comercial | — | "Valor hora por categoría" (vacío = el de la categoría) |
| Presupuestos de servicio | Categorías | Sin cambios: siguen siendo la base |
| Cobro de OS | Valor global | Sin cambios: el valor global es el inicial del cobro (se edita en cada cobro) |

### P24 · Proveedores únicos

Migración `prisma/sql/20261121_proveedores_unicos` (mueve datos y borra la tabla `Proveedor`; probada ida/vuelta/ida con los proveedores de producción). Se aplica junto con el merge (ver su README).

| Dónde | Antes | Ahora |
|---|---|---|
| Maestro | `Proveedor` (Gastos) y `ProveedorVentas` (productos), el mismo proveedor cargado dos veces | Uno solo, `ProveedorVentas`, con CUIT único y siempre `30-12345678-9` (`lib/proveedores.ts`) |
| Duplicados de producción | STRUMIA ×2, CORREDORES VIALES ×4 (dos con el CUIT mal escaneado) | Fusionados: 28 + 2 → 26 proveedores, las 63 facturas conservadas |
| Gastos: alta, búsqueda, importación y escaneo | CUIT comparado tal cual (con y sin guiones = dos proveedores) | CUIT normalizado; si ya existe se usa ese; CUIT de menos de 11 dígitos se rechaza |
| Ventas → Proveedores | Solo los de productos | Todos; no se borra uno con facturas de gastos (se da de baja) |

### Pendiente en esta fase

- Demoras del cliente (`/delays`) sigue como listado de todos los proyectos; se puede ocultar del menú cuando la bitácora reemplace su uso.
- P27 · Tipo de proyecto con valores por defecto y estados calculados.

## Respuestas del Anexo A (21/11/2026)

| Pregunta | Respuesta | Qué cambia |
|---|---|---|
| OS y OT | Se usan las dos: OS para clientes o tareas ocasionales; OT para dividir tareas en proyectos fijos, con horas y materiales por tarea, y se factura todo a fin de mes | **P26 (fusión OS + OT) queda descartada.** El cargo por ciclo de OT firmado (P15) coincide con la facturación mensual: cada ciclo es un período |
| Stock | Se usa para comprar y cobrar. Una venta no se bloquea por stock en 0: puede quedar negativo (se asume error de conteo) | **P9 pasa a crítico**: los consumos reales (PDV, entregas a obra, órdenes) tienen que mover el stock, permitiendo negativos |
| Facturación AFIP | Hoy en otro sistema; se implementa en el próximo sprint | El cargo por servicio queda con un clic (no automático). Con AFIP, el cargo puede pasar a ser la factura |
| Organigrama | Gerencia (Hernán); Operaciones (Gianluca), Administración (Katy), RRHH/SST (Florencia), Ventas (Facu), QA (Victor); los operadores dependen de Operaciones | Insumo para P16 y P18 (accesos por puesto) |
| App de escritorio | No se usa | Electron se quitó del repositorio (carpeta, scripts y dependencias) |

## Fase 4 · Fusiones mayores

P26 (OS + OT) descartada por las respuestas del Anexo A.

- P35 · Presupuestos unificados.
- P29–P31 · Calidad reorganizada, objetivos unificados, acciones con origen.
- P32 · Búsqueda global de registros.
- Legajo, calendario de vencimientos, compras, portal del cliente completo.
