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

Migración `prisma/sql/20261121_proveedores_unicos` (mueve datos y borra la tabla `Proveedor`; probada ida/vuelta/ida con los proveedores de producción). **Aplicada en producción el 21/11/2026 (14:19 UTC).**

| Dónde | Antes | Ahora |
|---|---|---|
| Maestro | `Proveedor` (Gastos) y `ProveedorVentas` (productos), el mismo proveedor cargado dos veces | Uno solo, `ProveedorVentas`, con CUIT único y siempre `30-12345678-9` (`lib/proveedores.ts`) |
| Duplicados de producción | STRUMIA ×2, CORREDORES VIALES ×4 (dos con el CUIT mal escaneado) | Fusionados: 28 + 2 → 26 proveedores, las 63 facturas conservadas |
| Gastos: alta, búsqueda, importación y escaneo | CUIT comparado tal cual (con y sin guiones = dos proveedores) | CUIT normalizado; si ya existe se usa ese; CUIT de menos de 11 dígitos se rechaza |
| Ventas → Proveedores | Solo los de productos | Pestañas "Comerciales" y "De gastos" (los que solo tienen facturas de gastos: peajes, combustible, viajes); no se borra uno con facturas (se da de baja) |
| Selectores de proveedor (producto, filtros, importaciones) | — | Solo comerciales: los de gastos no se mezclan |

### P27 · Tipo de proyecto y estados calculados

Migración `prisma/sql/20261121_tipo_proyecto` (agrega `Project.tipo`; pasa `en_riesgo`/`atrasado` guardados a `activo`; probada ida/vuelta/ida). **Aplicada en producción el 21/11/2026 (14:46 UTC).**

| Dónde | Antes | Ahora |
|---|---|---|
| Tipo de proyecto | Implícito en los interruptores (OS, provisión, fichaje, fijo, métricas) | Obra, Servicio puntual, Contrato de mantenimiento o Interno (`lib/proyectos/tipos.ts`). Al elegirlo propone los interruptores; se pueden ajustar. Existentes: fijo → contrato, con OS → servicio, resto → obra |
| "Atrasado" | Lo escribía un proceso al leer proyectos y no volvía atrás aunque se corriera la fecha | Calculado: fecha de fin vencida |
| "En riesgo" | Manual | Calculado: ≥ 90% de las horas estimadas; o vence en ≤ 7 días con el checklist < 80%; o "Bloqueante" en la bitácora en los últimos 7 días (`lib/proyectos/salud.ts`) |
| Formulario, planilla y asistente | Se podía elegir "En riesgo" y "Atrasado" | Solo Por hacer, Planificado, Activo y Finalizado; el motivo de la alerta se muestra en la ficha, el formulario y al pasar sobre el estado |
| Paneles (Panel de análisis, Proyectos → Dashboard, Mis proyectos) | Estado guardado | Estado calculado |

### E9 · Un solo estado del proyecto

El estado tiene un valor más, **Archivado**, que reemplaza al interruptor "Activo" (quitado del formulario). "Eliminar" un proyecto con historial lo archiva. "Todos" no muestra los archivados (tienen su filtro) y tampoco aparecen en Mis proyectos ni en los selectores. La columna `activo` queda en la base, sincronizada desde el estado, para las pantallas que la leen. Migración de datos `prisma/sql/20261121_estado_archivado` (en producción no cambia filas: todos los proyectos están activos).

### Demoras del cliente fuera del menú

`/delays` queda oculta (`lib/viewAccess.ts`): las demoras se cargan y se ven en la bitácora de la ficha del proyecto. La página sigue funcionando por enlace directo y las demoras siguen contando en el Panel de análisis.

### Pendiente en esta fase

Nada: la fase 3 está completa.

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

### P38 · Limpieza de datos sin uso

Migración `prisma/sql/20261123_limpieza_p38` (destructiva: primero el código). **Aplicada en producción el 24/11/2026.**

| Qué | Resultado |
|---|---|
| "Impacta métricas" en etiquetas | Quitada de la API y de la base (no tenía efecto) |
| Hora del recordatorio diario | No tenía efecto (Vercel llamaba a hora fija). Ahora se elige en Configuración, sin valor preseteado, y el envío lo dispara **cron-job.org** cada pocos minutos: sale al llegar a la hora configurada, una vez por día. Se quitó el cron de `vercel.json` |
| `TagChecklistItem` | Se queda: sí se usa para armar el checklist de los proyectos nuevos por etiqueta (la auditoría se equivocó) |
| Vista `/inventario` | Ya se había quitado en P8 |

### P32 · Búsqueda global de registros

La paleta (Ctrl+K o "Buscar" del encabezado) busca, desde 2 letras, además de vistas y acciones: **proyectos** (código, nombre, cliente), **clientes** (nombre, razón social, CUIT con o sin guiones), **órdenes de trabajo** y **de servicio** (número o proyecto), **presupuestos de servicio** (número, título, cliente), **productos** (SKU, código de barras, descripción) y **tickets** (código o título). Enter abre la ficha del registro.

- `GET /api/buscar?q=` (`lib/buscador.ts`): cada tipo se busca solo si la persona puede abrir su vista (roles configurados y permisos especiales, igual que el menú); en tickets, sin `tickets.gestionar` solo los propios. Hasta 5 por tipo.
- Sin cambios de base de datos.

### P31 · "Mis tareas" unificado (etapa 1)

Inicio suma el panel **Mis tareas**: las tareas (creadas o donde la persona está involucrada), las acciones de mejora (CAPA) y los planes de acción de KPI de los que es responsable, juntos, con su origen (tarea, no conformidad, sugerencia, riesgo, oportunidad, auditoría, KPI…), un estado común (pendiente / en curso) y el vencimiento; las vencidas primero. Cada una se abre en su módulo (`/tareas`, `/calidad?tab=capa`, `/okr-kpi?tab=planes`), y solo se muestran los orígenes cuyas vistas la persona puede abrir.

- `GET /api/mis-tareas` (`lib/misTareas.ts`, tipos en `lib/misTareasTipos.ts`). Sin cambios de base de datos.
- **Etapa 2 (pendiente)**: unificar las tablas en una sola entidad de acción con origen (FU9). Es una migración de datos grande; conviene después de usar la vista unificada un tiempo.

### P29 · Calidad en cuatro entradas

"Calidad y documentos" (una pantalla con 12 pestañas) se divide en cuatro entradas del menú, con las mismas pestañas y los mismos roles (`app/calidad/SeccionCalidad.tsx`):

| Entrada | Ruta | Pestañas |
|---|---|---|
| Documentos | `/calidad` | Tablero del SGI, Biblioteca, Vencimientos, Plantillas de checklist, Historial |
| Mejora | `/calidad/mejora` | No conformidades, Acciones (CAPA), Oportunidades, Sugerencias (abre `/gestion-sugerencias`, que sale del menú) |
| Riesgos | `/calidad/riesgos` | Matriz de riesgos |
| Formación y competencias | `/calidad/formacion` | Capacitación, Matriz de competencias |

- Los **objetivos de calidad** pasan a OKR y KPI (pestaña "Objetivos de calidad"), paso previo a P30.
- Los enlaces viejos `/calidad?tab=…` redirigen a la entrada nueva (`/calidad?tab=library&docId=` de los avisos sigue igual).
- Menú: con vistas anidadas se marca solo la más específica; la miga muestra "Calidad › Mejora".
- Sin cambios de base de datos ni de permisos.

### P30 · Objetivos e indicadores unificados

Un **objetivo de calidad** del SGI pasa a ser un **KPI marcado "Objetivo de calidad (SGI)"** (`Kpi.esSgi`): tiene meta numérica, mediciones (manuales o por dataset), historial y planes de acción, en lugar de indicador y meta como texto libre.

- OKR y KPI → **Objetivos de calidad**: los KPI marcados; "Nuevo objetivo de calidad" crea un KPI ya marcado. En el formulario de cualquier KPI se puede marcar o desmarcar.
- Se quitan `ObjetivoCalidad`, `AccionMejora.objetivoId`, `/api/sgi/objetivos` y la pestaña vieja (en producción había 0 objetivos).
- Dos migraciones: `20261124_kpi_objetivo_sgi` (aditiva, antes del merge) y `20261124_quitar_objetivo_calidad` (destructiva, después del merge). **Las dos aplicadas en producción el 25/11/2026.**

### P31 · Acción con origen (etapa 2)

`Tarea` es la única entidad de acción. Las **acciones de mejora (CAPA)** son tareas con tipo de acción (`codigo` CAPA-AAAA-0001, avance, eficacia, evidencia) y los **planes de acción de KPI**, tareas con KPI (causa, acción correctiva). Cada tarea tiene **origen** (`origenTipo`: libre, proyecto, NC, sugerencia, riesgo, oportunidad, KPI, calidad) y su vínculo.

- Las APIs de CAPA, NC, riesgos, oportunidades, sugerencias, verificación de eficacia y planes de acción leen y escriben tareas con el mismo formato de siempre (`lib/acciones.ts`), así que las pantallas de Calidad y de OKR no cambian.
- El responsable es el involucrado con rol "responsable": las acciones de calidad aparecen en **Tareas** (las cerradas con las completadas, las anuladas con las canceladas) y en **Mis tareas** de su responsable.
- Migraciones: `20261125_tarea_accion_con_origen` (aditiva, antes del merge; **aplicada el 25/11/2026**) y `20261125_quitar_accionmejora_plankpi` (borra las dos tablas, vacías en producción; después del merge). **Las dos aplicadas en producción el 25/11/2026.**

### P35 · Presupuestos en una entrada (dos tipos)

Comercial → **Presupuestos** reemplaza a "Cotizaciones" y "Presupuestos de servicio" en el menú (`/presupuestos` abre el tipo que la persona puede ver: servicio para gestión, productos para vendedores). Las dos pantallas suman arriba **De productos | De servicio** (`components/presupuestos/TiposPresupuesto.tsx`), con los tipos que la persona puede abrir; el menú marca "Presupuestos" en las dos.

- Cada tipo conserva su editor, sus estados, sus permisos y su tabla (`Cotizacion` y `PresupuestoServicio`). Sin cambios de base de datos.
- Pendiente si hiciera falta: fusión de tablas con numeración y estados comunes (la auditoría la dejó a confirmar; en producción hay 10 cotizaciones y 0 presupuestos de servicio).
### Calendario único de vencimientos

Mi trabajo → **Vencimientos** (`/vencimientos`): EPP entregado y vigente, competencias del personal, documentos a revisar, presupuestos de servicio enviados y presupuestos de productos vigentes, en una sola lista por fecha, con pestañas **Vencidos / Próximos 30 días / Próximos 90 días** y filtro por tipo. Cada ítem abre su módulo.

- `GET /api/vencimientos?desde=&hasta=` (`lib/vencimientos.ts`, Zod): cada tipo solo si la persona puede abrir su vista. Del EPP cuenta el elemento vigente (el reemplazado deja de estar `VIGENTE`) y no las actas rechazadas. Sin cambios de base de datos.
- Pendiente: herramientas (no tienen fecha de verificación en el modelo), crédito de clientes y certificados externos.
- También muestra las entregas de compras pendientes (fecha esperada de las órdenes enviadas o recibidas en parte).

### Compras y recepción

Logística → **Compras** (`/compras`): órdenes de compra a proveedores comerciales, con pestañas **Abiertas / Recibidas / Canceladas / Todas**.

- **Orden** (`OrdenCompra`, número `OC-AAAA-000001`): proveedor, almacén donde entra la mercadería, fecha esperada y productos con su costo sin IVA (por defecto, el que ese proveedor tiene cargado en el producto). Se guarda como borrador (editable, se puede borrar) y se envía; enviada ya no cambia proveedor ni productos.
- **Recepción** (`RecepcionCompra`, `REC-AAAA-000001`): cantidades por ítem (por defecto, lo que falta), remito y fecha. Entra el stock al almacén con su movimiento de kardex (`ENTRADA`, `referenciaTipo = 'COMPRA'`, idempotente como las ventas y entregas a obra). Puede haber varias; se puede recibir de más (queda a la vista). La orden pasa sola a "Recibida en parte" o "Recibida".
- **Anular una recepción** saca del stock lo que había entrado (`SALIDA` con el mismo origen) y la orden vuelve a esperar lo que falta. **Cancelar** (o "Cerrar sin el resto" si llegó una parte) deja de esperar lo pendiente; lo recibido queda.
- Opción al recibir, solo para quien gestiona compras: **actualizar el costo** del proveedor en cada producto (cambia los precios de venta que se calculan desde el costo). Sin tildar, los costos no cambian.
- **Factura**: se vincula una factura del mismo proveedor cargada en Gastos y facturas (`OrdenCompra.facturaId`); una factura puede cubrir varias órdenes.
- Permisos nuevos en `lib/permisos.ts` (grupo Compras): `compras.ver` (admin, supervisor, qa, vendedor), `compras.gestionar` y `compras.recibir` (admin y supervisor; se pueden dar como permiso especial, por ejemplo al encargado del depósito).
- Un proveedor con órdenes de compra cuenta como comercial (`lib/proveedores.ts`).
- Migración `20261126_compras_recepcion` (aditiva: cuatro tablas nuevas). **Aplicada en producción el 25/11/2026.**

### Legajo del personal

Personas → **Legajo del personal** (`/rrhh/legajo`, también desde Recursos humanos): cada persona con su número de legajo, ingreso y antigüedad, contacto de emergencia y documentos, con filtros **Con vencimientos** y **Datos incompletos**. La ficha (`/rrhh/legajo/[id]`) edita los datos y los documentos.

- **Datos** (`LegajoPersonal`, 1 a 1 con `Operator`): legajo, ingreso, egreso, CUIL, nacimiento, teléfono, email, domicilio, obra social, grupo sanguíneo, contacto de emergencia y observaciones. El DNI sigue en `Operator.dni`. El número de legajo no se repite.
- **Documentos** (`DocumentoPersonal`): apto médico, licencia de conducir, ART, habilitación, seguro u otro, con número, emisión, vencimiento y archivo adjunto opcional (PDF o imagen, hasta 8 MB, se valida la firma del archivo) en el almacenamiento de archivos; se abre con URL prefirmada. Vencido / por vencer (30 días) / vigente.
- Los documentos del personal activo aparecen en **Vencimientos**.
- Permisos nuevos: `rrhh.legajo_ver` (admin, supervisor, qa) y `rrhh.legajo_gestionar` (admin, supervisor). Las respuestas no se guardan en caché y la auditoría registra qué campos cambiaron, sin los valores.
- Pendiente si hace falta: que cada persona vea su propio legajo ("Mi legajo").
- Migración `20261126_legajo_personal` (aditiva: dos tablas nuevas). **Aplicada en producción el 26/11/2026.**

### Portal del cliente completo

El portal (`/portal-clientes`) suma tres secciones a las OT:

- **Órdenes de servicio** de los proyectos autorizados del responsable: "Para firmar" y "Firmadas". Se firman con el mismo link público que envía HDB (`/os/[token]`), así la firma es una sola.
- **Presupuestos** de servicio enviados al cliente (no se ven borradores ni revisiones en curso): el mismo PDF que se envió, y quien está habilitado los **acepta** (con su referencia, p. ej. nº de orden de compra) o los **rechaza** con motivo. La aceptación usa el mismo servicio que la registración interna: queda la copia sellada con hash y la auditoría con el nombre del responsable "(cliente, portal del cliente)". Un presupuesto vencido no se puede aceptar desde el portal.
- **Estado de cuenta** (solo habilitados): saldo, vencido, a vencer, crédito disponible, comprobantes pendientes y movimientos, sin datos internos (observaciones, operadores, medios de pago, imputaciones). Los anulados no se muestran.
- **Permisos por responsable** (`ClientResponsable.verCuentaCorriente` y `aprobarPresupuestos`, apagados por defecto): se tildan en la ficha del cliente → Portal y OT → Tarifas, responsables y sectores → Responsables. Cada pedido vuelve a leer al responsable de la base: un permiso quitado o un acceso bloqueado rige al instante, aunque la sesión siga abierta. Con la clave temporal las secciones nuevas responden 403 hasta cambiarla.
- El PDF del presupuesto se generó en `lib/presupuestosServicio/pdf.ts` para usarlo desde la pantalla interna y desde el portal.
- Migración `20261126_portal_permisos` (aditiva: dos columnas booleanas). **Aplicada en producción el 26/11/2026.**
- Seguridad (de paso): `GET /api/clients/[id]/responsables` y la configuración del cliente devolvían el hash de la clave del portal a cualquier sesión. Ahora nunca lo devuelven (`CAMPOS_RESPONSABLE` en `lib/portalAuth.ts`) y la lista exige `clientes.gestionar`.

### P16 · Ficha única de la persona

Antes los datos de una persona estaban repartidos entre Usuarios (rol, PIN, accesos), RRHH (EPP), Legajo, Calidad (competencias y capacitaciones), Asistencia (horas) y Viajes. Ahora hay una ficha (`/personas/[id]`) con pestañas **Resumen · Legajo · Accesos · EPP · Formación · Horas · Viajes**.

- Se abre desde **Usuarios y accesos** (el nombre), desde **Legajo del personal** y desde **Vencimientos**. `/rrhh/legajo/[id]` redirige a la pestaña Legajo.
- Cada pestaña aparece solo si quien mira puede abrir el módulo de origen (`lib/fichaPersona.ts`, `GET /api/personas/[id]`): Legajo con `rrhh.legajo_ver`/`gestionar`; Accesos con Usuarios y accesos y `usuarios.gestionar` o `usuarios.accesos`; EPP con Recursos humanos; Formación con Formación y competencias; Horas con Asistencia y horas; Viajes con Viajes. La ficha de otra persona la abre quien ve Usuarios y accesos o el Legajo.
- **Resumen**: documentos vencidos o por vencer, EPP, competencias por vencer, horas de los últimos 30 días y datos básicos (legajo, ingreso y antigüedad, rol, categoría de mano de obra).
- **Accesos**: rol, estado y permisos especiales; "Editar usuario, rol y PIN" abre la edición en Usuarios (`/operators?editar=<id>`) y "Accesos y permisos especiales" abre el mismo diálogo de siempre.
- **Mi ficha** (`/personas/yo`, en el menú del usuario): cada persona ve su legajo (sin las observaciones internas de RRHH), sus documentos y adjuntos, su EPP, su formación, sus horas y sus viajes, en solo lectura. No ve sus accesos ni la ficha de otros.
- El formulario del legajo pasó a `components/personas/LegajoFicha.tsx`. Sin cambios de base de datos.

### P36 · Del pliego al presupuesto

Antes el análisis del pliego se copiaba a mano en el presupuesto. Ahora, en un pliego analizado, el panel **Presupuesto** arma un presupuesto de servicio en borrador (`POST /api/pliegos/[id]/presupuesto`, `lib/presupuestoDesdePliego.ts`) y lo abre en el editor:

- Cliente y título del pliego (si el pliego no tiene cliente, se elige en el diálogo). Alcance: el resumen del análisis con la referencia al pliego.
- **Tareas**: las marcadas "dentro del pliego" (con su modificación, si la tienen) y, si se tilda, las sin marcar. Las "fuera del pliego" no se cargan. Cada tarea lleva una línea de mano de obra con la primera categoría activa y 0 horas, para completar.
- **Materiales**: los del pliego y, si se tilda, los sugeridos por la IA, con la cantidad interpretada ("1.500 m" → 1500; sin número → 1 y la cantidad original en la descripción) y sin precio: se eligen del catálogo en el editor.
- El presupuesto queda vinculado (`PresupuestoServicio.pliegoId`): el pliego lista sus presupuestos y el presupuesto muestra "Pliego PLG-…".
- Permisos: armar exige `presupuestos.gestionar` y ver pliegos.
- Migración `20261127_presupuesto_desde_pliego` (aditiva: una columna opcional). **Aplicada en producción el 27/11/2026.**

### P17 · Permisos del catálogo en las pantallas

Las pantallas que todavía comparaban el rol a mano ahora usan las funciones de `lib/permisos.ts` (`useAcceso().puede` o `puedeFuncion`), las mismas que exige su API. Así un permiso especial (dar o quitar una función a una persona) también cambia lo que ve la pantalla, no solo lo que acepta el servidor.

| Pantalla | Antes | Ahora |
|---|---|---|
| Usuarios y accesos | Editar, activar y borrar si el rol no era operador ni vendedor | `usuarios.gestionar`; el rol, con `usuarios.asignar_rol` |
| Registro de horas | El operador veía y cargaba solo lo suyo | Sin `timesheets.gestionar_horas`, solo lo propio |
| Avisos (aprobar correcciones de horas) | Supervisor, admin y QA | `timesheets.gestionar_horas` |
| Órdenes de servicio | Cobro y cancelar para admin y QA (la API pedía `os.cobrar`: admin y supervisor) | Cobro con `os.cobrar`, cancelar con `os.gestionar`: QA ya no ve botones que fallaban y supervisión ve los que puede usar |
| Demoras | Editar y borrar para admin, supervisor y QA | `demoras.gestionar` |
| Tickets | Gestionar para admin, supervisor y QA | `tickets.gestionar` |
| Datasets y Diccionario | Redirigían si el rol no era de gestión | Decide el acceso a la vista (roles por vista y permisos especiales) |
| Pestañas de Calidad, OKR y KPI, Herramientas | Lista de roles por pestaña | `calidad.ver`, `okr.ver`, `herramientas.gestionar`; las pestañas para todos quedan para quien abre la vista |

Quedan comparaciones de rol que no son permisos: filtrar qué personas listar (por ejemplo, operadores en la agenda) y el color de la etiqueta del rol. Sin cambios de base de datos.

### Horas reales por tarea (faltante 10, fase 2 de presupuestos de servicio)

Antes el presupuestado vs. real quedaba a nivel proyecto: los registros de horas no indicaban la tarea.

- **Registro de horas**: al elegir un proyecto con tareas aparece **Tarea (opcional)** con las tareas del proyecto. La lista muestra "Tarea: …" debajo del proyecto.
- **API** (`/api/time-entries`): `proyectoTareaId` opcional; la tarea tiene que ser del proyecto del registro (si no, 400). Al editar se conserva; si cambia el proyecto o pasa a causa, se borra.
- **Presupuestado vs. real**: la tabla "Horas por tarea" suma la columna **Reales** (horas trabajadas de los registros con esa tarea, sin devoluciones ni el doble de las extra) y una fila "Sin tarea indicada" con el resto. Si las reales superan las presupuestadas, se marcan en rojo.
- **Tareas del proyecto** (panel del presupuesto en la ficha): cada tarea muestra sus horas reales.
- `Project.horasConsumidas` no cambia (sigue contando extras doble, como el dashboard).
- Migración `20261127_horas_por_tarea` (aditiva: una columna opcional). Los registros existentes quedan "sin tarea". **Aplicada en producción el 27/11/2026.**

### Solicitudes y aprobaciones (faltante 3, F8)

Antes un pedido de autorización era un aviso con botones: sin estado, el solicitante no sabía qué pasó y el cambio lo aplicaba el navegador de quien aprobaba. Ahora es una **solicitud** (`Solicitud`, `lib/solicitudes.ts`):

1. Se crea con tipo, objeto, motivo y el cambio propuesto (`POST /api/solicitudes`). Llega a quienes tienen la función para aprobarla (rol + permisos especiales), con aviso.
2. Mi trabajo → **Solicitudes** (`/solicitudes`): **Para aprobar**, **Mis solicitudes** y **Resueltas**. Inicio muestra las que esperan tu aprobación y tus solicitudes resueltas en la semana.
3. Se aprueba o se rechaza (con motivo obligatorio). Al aprobar una corrección o eliminación de horas, el **servidor** aplica el cambio con la misma lógica que la edición directa (`lib/registroHoras.ts`, compartida con `/api/time-entries`): horas consumidas del proyecto y auditoría incluidas. Si no se puede aplicar, vuelve a pendiente.
4. Una finalización de proyecto se aprueba **finalizando el proyecto** (tiene su propio checklist): al finalizar, sus solicitudes pendientes quedan aprobadas. El solicitante recibe un aviso y ve el estado.

| Tipo | Lo pide | Lo aprueba |
|---|---|---|
| Corregir registro de horas | El dueño de un registro ya confirmado (Registro de horas) | `timesheets.gestionar_horas` |
| Eliminar registro de horas | Ídem | `timesheets.gestionar_horas` |
| Finalizar proyecto | Quien no tiene `proyectos.finalizar` (ficha del proyecto) | `proyectos.finalizar` |

- Nadie resuelve su propia solicitud; no se repite una pendiente sobre lo mismo; el solicitante puede cancelarla mientras está pendiente.
- Los avisos viejos `TIME_MODIFICATION_REQUEST` y `PROJECT_FINALIZE_REQUEST` pendientes se siguen pudiendo resolver desde la campana.
- Pendiente para más adelante: precio fuera de lista (hoy PIN de supervisor en el punto de venta) y gastos fuera de política.
- Migración `20261127_solicitudes` (aditiva: tabla nueva). **Aplicada en producción el 27/11/2026.**

## Mejoras chicas

### P43 · ModuleHeader en todas las pantallas

Antes 31 pantallas armaban su título a mano (h1/h2 sueltos, varios tamaños, algunas sin título visible). Ahora todas usan `ModuleHeader` como único h1, con ícono, descripción y acciones a la derecha.

- Convertidas: Aprobaciones, Consumo de IA, Auditoría de cambios, Clientes, Datasets, Demoras del cliente, Diccionario de datos, Sugerencias y mejoras, Herramientas y carros, Informes técnicos (lista y nuevo), Fichadas en curso, Notificaciones, Usuarios y accesos, Órdenes de servicio (con pestañas Activas/Historial) y Generar orden de servicio, Nueva orden de trabajo, Agenda del equipo, Provisión de materiales, Registro de horas, Verificación de firmas.
- **Ventas**: `VentasNavTabs` dibuja el encabezado de la sección (Gestión comercial, Presupuestos de productos, Almacén y stock, Cuentas corrientes) con `titulo`/`descripcion` para las subpantallas (Proveedores, Importación masiva, Nuevo/Editar producto). Los títulos chicos que repetían el nombre dentro de las tarjetas se quitaron.
- Quedan con diseño propio, a propósito: Inicio ("Mi día"), Fichado, Punto de venta (`sinEncabezado`) y el formulario público de ideas y reclamos.
- `ModuleHeader` marca el encabezado con `data-module-header` (sirve para controlar en pruebas que cada pantalla tenga uno).

### P33 · Acciones masivas en tareas, personas y órdenes

Además de Fichadas a aprobar (fase 2), ahora se puede elegir varios elementos y aplicar una acción de una vez. Una barra común (`BarraSeleccion` + `useSeleccion` en `components/ui`) muestra cuántos hay elegidos y las acciones; `lib/lote.ts` (`enLote`, `avisarLote`) las aplica **con la misma API que la acción individual**, de a una, así valen los mismos permisos, validaciones y auditoría. Si alguna falla, sigue con las demás y avisa cuántas no se cambiaron y por qué.

| Pantalla | Se eligen | Acciones |
|---|---|---|
| Tareas (vista Lista) | Las que podés cambiar de estado | Completar, cambiar estado, cambiar prioridad, cambiar vencimiento |
| Usuarios y accesos | Con `usuarios.gestionar`; uno mismo no (desactivarse en lote cortaría la sesión) | Activar, desactivar, marcar de vacaciones, volvieron de vacaciones |
| Órdenes de trabajo (lista) | Abiertas o pausadas de la página | Pausar, reanudar (queda en el historial de estados con el motivo "cambio en lote"), reasignar el responsable |

Sin cambios de base de datos.
