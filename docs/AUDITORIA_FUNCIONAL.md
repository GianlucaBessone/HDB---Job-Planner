# Auditoría funcional y de arquitectura — HDB SGI

**Fecha:** 18/11/2026 · **Rama analizada:** `claude/practical-hawking-4qsjlx` (al día con `main`, commit `e66bfc0`)
**Foco:** Gestión, Administración, Configuración y todo lo que los afecta.

## Cómo leer este informe

- Todo lo que se describe como "actual" sale del código: rutas, pantallas, APIs, `prisma/schema.prisma`, `lib/viewAccess.ts`, `lib/permisos.ts` y la documentación de `docs/`. Cada afirmación importante cita el archivo.
- **PROPUESTA** marca lo que no existe hoy y propongo agregar o cambiar.
- **FALTA INFORMACIÓN** marca decisiones que dependen de datos que no están en el repositorio (organigrama, uso real, volumen). No los asumí.
- Los conteos de clics son estimaciones hechas recorriendo el código de cada pantalla, no mediciones con usuarios.
- No hay datos de uso por pantalla en el repo (Vercel Analytics está instalado, pero no tengo acceso a sus datos). La frecuencia de cada flujo la inferí del rol que lo usa y de su lugar en la operación diaria.

---

## Resumen ejecutivo

**La pregunta central:** ¿cuál debería ser la estructura del sistema para dar toda la funcionalidad con la menor complejidad?

**Respuesta corta:** organizar el sistema por **dominios de trabajo** (los objetos con los que la gente trabaja: proyectos, personas, clientes, stock, calidad), no por cláusulas ISO ni por tipo de actividad ("gestión", "administración", "configuración"). Cada dominio tiene una lista, una **ficha** del objeto con todas sus acciones y sus ajustes, y una vista "Mis…" para el que ejecuta. Lo único global es lo que de verdad cruza dominios (organización, accesos, catálogos compartidos).

Con eso el menú pasa de **43 vistas en 7 secciones** (un supervisor ve 42) a **9 módulos con 3 a 6 entradas cada uno**, y un operario ve 3.

**Diagnóstico en cinco puntos:**

1. **El sistema creció por agregación.** Cada funcionalidad nueva sumó una entrada al menú, su propia configuración y, muchas veces, su propio mecanismo de permisos. El resultado es muy completo en capacidades, pero fragmentado: la misma realidad (un cliente, una hora trabajada, un proveedor, una tarifa) vive en dos, tres o cuatro lugares.
2. **"Gestión", "Administración" y "Configuración" son una división artificial.** "Gestión y Seguimiento" mezcla ejecución (planificación, proyectos, órdenes) con estrategia (OKR, tablero). "Administración" es un cajón con finanzas, RRHH, viajes, datos maestros, herramientas técnicas, configuración y notificaciones. "Configuración" mezcla catálogos de proyectos, parámetros de fichaje, un precio, seguridad y una preferencia personal de color.
3. **El modelo de permisos es conceptualmente correcto, pero no se cumple.** Usuario → Rol → Permisos + excepción por usuario es simple y alcanza. El problema es que hay siete mecanismos de control distintos y la mayoría de las APIs no verifican el rol en el servidor; algunas confían en el rol que manda el navegador. Esto es lo más urgente del informe.
4. **Hay flujos rotos y datos que se cuentan dos veces.** Tres pantallas llaman a una API que no existe (`/api/notifications`), las horas consumidas de un proyecto se suman dos veces cuando se genera una OS, ni las ventas ni los materiales entregados descuentan stock, y las OT y el costo de proyecto toman precios de una tabla que pertenece a un módulo desactivado.
5. **La misma hora de trabajo se carga hasta cuatro veces** (planificación, fichada, registro de tiempos, OS/OT) y después hay tres pantallas para conciliarlas. Buena parte de la complejidad de "Aprobaciones", "Monitoreo de fichadas" y "Control horario" es consecuencia de esa doble carga, no una necesidad del negocio.

**Lo que está bien y conviene conservar:** el módulo de Presupuestos de servicio (estados claros, versiones, copia congelada, conversión a proyecto en una transacción), Almacén (movimientos con número, reversas en lugar de borrados, conteos), PDV y Cuentas corrientes (anulación con motivo, PIN de supervisor), el catálogo de funciones de `lib/permisos.ts` y el patrón "Mis…" para el autoservicio del operario.

---

## 1. Inventario completo

### 1.1 Cifras

| Elemento | Cantidad | Fuente |
|---|---|---|
| Vistas declaradas en el menú | 43 (1 desactivada) | `lib/viewAccess.ts` |
| Secciones del menú | 7 | `DEFAULT_SECTIONS` |
| Páginas (`page.tsx`) | ≈ 120 | `app/**/page.tsx` |
| Rutas de API | 331 | `app/api/**/route.ts` |
| Modelos de datos | 194 (incluye enums) | `prisma/schema.prisma` |
| Funciones con permiso propio | 28 | `FUNCIONES` en `lib/permisos.ts` |
| Roles | 5 fijos: `operador`, `supervisor`, `admin`, `qa`, `vendedor` | `Operator.role` (texto) |
| Vistas que ve cada rol | supervisor 42 · admin 41 · qa 40 · operador 15 · vendedor 12 | cálculo sobre `DEFAULT_VIEWS` |

Dato llamativo: el **supervisor ve más vistas que el administrador**, porque `/fichado` está habilitado para `operador` y `supervisor` pero no para `admin` (`lib/viewAccess.ts:54`).

### 1.2 Criterio actual de organización del menú

Las secciones siguen cláusulas de ISO 9001 (comentario en `lib/viewAccess.ts`):

| Sección | Cláusula ISO declarada | Vistas |
|---|---|---|
| Operaciones | 8 – Operación | 8 |
| Gestión y Seguimiento | 5 y 6 – Liderazgo y planificación | 8 |
| Ventas y Comercial | — | 6 |
| Logística y Materiales | 7 – Apoyo | 3 (1 desactivada) |
| Calidad y Mejora Continua | 9 y 10 | 5 |
| Administración | 4 y 7.1 – Contexto y recursos | 9 |
| Auditoría y Trazabilidad | — | 4 |

Este criterio es útil para un auditor de calidad, pero obliga al usuario a pensar en la norma para encontrar una pantalla. Nadie que va a cargar un gasto piensa "esto es cláusula 7.1".

### 1.3 Inventario detallado: Gestión, Administración y Configuración

Roles = roles por defecto en `lib/viewAccess.ts` (editables en Configuración → Vistas). "Control en API" indica si el servidor verifica el permiso o solo exige sesión.

#### Sección "Gestión y Seguimiento"

| Vista (ruta) | Objetivo y acciones | Entidades que modifica | Quién más usa esos datos | Roles | Control en API | Duplicación |
|---|---|---|---|---|---|---|
| **Panel de Análisis** (`/dashboard`) | Métricas globales en 4 pestañas: Proyectos (eficiencia de tiempo, horas ahorradas, demoras), Órdenes de Trabajo, Servicios (NPS de encuestas) y Operadores (ranking y competencias). Filtros por cliente y fechas. | Ninguna, salvo competencias del ranking (`/api/dashboard/operator-scoreboard/competencies` POST/PUT) | — | supervisor, admin, qa | No | Parcial con Proyectos → Dashboard, OKR → Tablero, Calidad → Dashboard QMS, métricas de Tickets, tablero de RRHH y de Gastos: **6 tableros distintos** |
| **Planificación** (`/planning`) | Agenda diaria por bloques (proyecto, horario, operadores), notas, bloques favoritos, copiar día, mensaje de WhatsApp | `Planning` (un JSON por fecha), `FavoriteBlock` | Fichado valida contra este JSON si el operario está asignado (`app/api/time-entries/punch/route.ts:208`); el asistente de proyectos lo usa para disponibilidad | supervisor, admin, qa | No | Parcial con el **equipo asignado del proyecto** (`ProyectoAsignacion`), que no escribe en Planificación |
| **Gestión de Proyectos** (`/projects` + 6 pestañas: Dashboard, Proyectos, Cronograma, Recursos, Riesgos, Documentación, Reportes) | Alta (asistente de 6 pasos y "alta clásica"), edición, detalle con bitácora, checklist, costos, presupuestado vs. real, finalización | `Project`, `ProjectLog`, `ChecklistItem`, `ProyectoTarea`, `ProyectoAsignacion`, `ProyectoBorrador` | Prácticamente todo: OS, OT, fichado, horas, materiales, tareas, viajes, pliegos, informes, presupuestos, encuestas | supervisor, admin, qa | Solo el asistente (`proyectos.crear`); `POST/PATCH/DELETE /api/projects` no verifica rol | **Mis Proyectos** repite el detalle; la pestaña "Riesgos" son entradas de bitácora, no la matriz de riesgos; "Documentación" son los informes técnicos |
| **Órdenes de Servicio** (`/ordenes-servicio`, `/generar`, `/qr/[id]`) | Generar OS por proyecto (reporte, operadores y horas precargadas desde el registro de tiempos, materiales), firma del cliente por link público, cobro con valor de mano de obra global, encuesta, PDF y QR | `OrdenServicio*`, `EncuestaServicio`, `MaterialProyecto` (sincroniza), y en `Project`: suma horas y lo pasa a `finalizado` (`lib/services/osService.ts:134-149`) | Panel (servicios), costo del proyecto, provisión de materiales | supervisor, admin, qa | No | **Órdenes de Trabajo** resuelven el mismo problema con otro modelo |
| **Órdenes de Trabajo** (`/ordenes-trabajo` → cliente → proyecto → OT) | Habilitar clientes para OT, OT por cliente y proyecto con ciclos mensuales, operadores con valor hora por cliente, materiales con % del cliente, firma del responsable del cliente en el portal con hash SHA-256 | `OrdenTrabajo`, `OtCiclo*`, `OtComentario`, `OtHistorialEstado`, y configuración del cliente: `HdbClientConfig`, `ClientOperatorRate`, `ClientResponsable`, `ClientSector` | Portal de clientes, Panel (pestaña OT) | operador, supervisor, admin, qa, vendedor | No (las rutas internas de OT solo exigen sesión) | **OS**; la configuración del cliente vive acá y no en Clientes |
| **Aprobaciones** (`/aprobaciones`) | Aprobar o rechazar fichadas marcadas con alertas (fuera de geocerca, dispositivo distinto, sin GPS, etc.) | `Fichada.status` (la API se llama `/api/time-entries/approve` aunque opera sobre `Fichada`) | Monitoreo de fichadas | supervisor, admin, qa | No: el aprobador sale del cuerpo del pedido (`approvedById`, `app/api/time-entries/approve/route.ts:32`) | Con **Monitoreo de Fichadas** y **Control horario** |
| **Tareas** (`/tareas`) | Tareas con involucrados, prioridad, vencimiento, recordatorios, comentarios y proyecto opcional | `Tarea*` | Recordatorios por cron | operador, supervisor, admin, qa | No: `?role=admin` en la consulta devuelve todas las tareas (`app/api/tareas/route.ts:15-32`) | Con `ProyectoTarea`, `AccionMejora` (CAPA), `PlanAccionKpi`, `ChecklistItem`, `PliegoTarea`: **6 conceptos de "tarea"** |
| **OKR y KPI** (`/okr-kpi`, 6 pestañas) | OKR, KPI con medición manual o sincronizada desde datasets, gráficos, planes de acción, histórico | `Okr`, `Kpi`, `KpiHistorico`, `GraficoConfig`, `PlanAccionKpi` | Panel de Análisis (gráficos) | admin, qa, supervisor | Sí (`requireSGIRole`) | Con **Objetivos de Calidad** (pestaña de Calidad, modelo `ObjetivoCalidad`) |

`/monitoreo-fichadas` figura en el bloque de Gestión del código, pero su sección es "Auditoría y Trazabilidad".

#### Sección "Administración"

| Vista (ruta) | Objetivo y acciones | Entidades | Quién más usa esos datos | Roles | Control en API | Duplicación |
|---|---|---|---|---|---|---|
| **Motor de Datasets** (`/datasets`) | Definir consultas, probarlas, ejecutarlas, programarlas y ver historial; alimentan KPI | `Dataset`, `DatasetEjecucion` | OKR y KPI | admin, qa, supervisor | Sí (`requireSGIRole`) | — Es una herramienta técnica, no de negocio |
| **Diccionario de Datos** (`/diccionario-datos`) | Metadatos de tablas y campos de la base | `DiccionarioTabla`, `DiccionarioCampo` | Motor de datasets | admin, qa, supervisor | Sí | — Herramienta técnica |
| **Gastos y Facturas** (`/administracion/gastos`, `/crear`, `/escanear`, `/importar`) | Tablero, planilla, ajustes (proveedores y códigos de gasto), alta manual, escaneo con IA, importación desde Excel | `FacturaConsumo`, `Proveedor`, `CodigoGasto` | — | admin, supervisor, qa | **No** (ninguna de las 7 rutas) | **Proveedores** duplicados con `ProveedorVentas`; gastos de viajes en otro modelo (`ViajeGasto`); dos endpoints de OCR (`/api/ia/ocr-factura` y `/api/ai/ocr`) |
| **Viajes y Viáticos** (`/viajes`, `/viajes/[id]`) | Planificar viajes (participantes, costos estimados), extensiones, gastos y comprobantes, verificación, tarifas de reintegro | `Viaje*` | Disponibilidad del asistente de proyectos; **Mis Viajes** | admin, supervisor, qa | Sí, con lista de roles propia (`VIAJE_GESTORES`, `lib/viajes.ts:6`) | Gastos con Gastos y Facturas |
| **Gestión de Usuarios** (`/operators`) | Alta, edición (nombre, rol, DNI, cargo, PIN, vacaciones, especialidades), activar/desactivar, eliminar, resetear un dispositivo o **todos**, permisos especiales (llave) | `Operator`, `OperatorPermiso` | Todo el sistema | supervisor, admin, qa | Sí para alta/edición/baja (`usuarios.gestionar`); **no** para resetear dispositivos | El título de la pantalla dice "Gestión de Operadores"; las tarifas por persona están en OT; las competencias en Calidad; el EPP en RRHH |
| **Gestión de Clientes** (`/clients`) | Alta, edición (nombre, email, teléfono, dirección, lista de precios), activar, eliminar | `HdbClient` | Proyectos, OT, OS, ventas, cuentas corrientes, cotizaciones, presupuestos, pliegos, EPP, informes | supervisor, admin, qa, vendedor | **No** | La configuración del cliente está repartida en **tres módulos** (ver 1.6) |
| **Recursos Humanos** (`/rrhh`, reclutamiento y `/rrhh/personal/epp`) | Tablero; reclutamiento (vacantes, postulantes, CV analizado con IA, embudo); EPP (matriz, stock, kardex, solicitudes, actas, enlaces públicos) | `RecruitmentVacancy`, `Candidate*`, `Interview*`, `Epp*` | Mis EPP | admin, supervisor, qa | Sí (funciones `rrhh.*`) | "Personal" (`/rrhh/personal`) solo redirige a EPP: **no hay legajo**. El stock de EPP es un inventario aparte del Almacén |
| **Configuración** (`/configuracion`) | Ver 1.4 | Varias | Varios | admin, qa, supervisor (verificado en la pantalla con el rol de `localStorage`, `app/configuracion/page.tsx:57-70`) | **No** en ninguna de sus APIs | Ver 1.4 y 1.5 |
| **Notificaciones** (`/notifications`) | Bandeja de avisos: leer, archivar, aprobar pedidos | `ActivityRecipient` | — | todos | **No**: lee los avisos del `operatorId` que manda el navegador | Con la campana del encabezado (`ActivityCenterDropdown`), que hace lo mismo |

#### Pantalla "Configuración" (`/configuracion`): 7 pestañas

| Pestaña | Qué guarda | Dónde tiene efecto | Observación |
|---|---|---|---|
| Etiquetas | `ProjectTag` (nombre, activo, "impacta métricas") | Etiquetas de proyectos, especialidades de operadores, checklists por etiqueta | "Impacta métricas" **no lo usa ninguna métrica** (solo se guarda y se devuelve en `app/api/config/tags/route.ts`) |
| Checklists | Vínculo plantilla ↔ etiqueta (`TagChecklistTemplate`) | Los proyectos con esa etiqueta heredan las plantillas | Las plantillas se crean en **Calidad → Plantillas de Checklist**: crear y vincular están en módulos distintos. El modelo viejo `TagChecklistItem` no se usa en ningún lado |
| Desplegables | `ConfigOption` en 5 categorías: áreas de demora, motivos de demora, categorías de proyecto, tipos de actividad, causas de registro de tiempo | Demoras, Proyectos, Registro de tiempos (y tipo de actividad en Documentos) | Cada lista sirve a una sola pantalla, pero se edita lejos de ella |
| Sistema | Alerta diaria de carga de horas y umbral de días; fichaje en la base (activar, geocerca, radio, token QR, imprimir QR); disparar alertas a mano | Cron de recordatorios, Fichado | La hora del aviso se muestra como un campo deshabilitado fijo en 18:00 (`vercel.json` corre a las 21 UTC); `dailyReminderTime` existe en la base pero no tiene efecto |
| Órdenes de Servicio | `valorManoObra` (un único valor hora global) | Cobro de OS y costo del proyecto (`app/api/projects/[id]/cost/route.ts:25`) | Es **una tarifa**, no una configuración del sistema; convive con otras dos fuentes de tarifa (ver 1.6) |
| Vistas | Por vista: roles, si aparece en menú/inicio/ambos, sección | Menú, inicio, buscador | Mezcla **seguridad** (roles) con **diseño de la navegación** (ubicación, sección). Lo puede editar un supervisor o QA: pueden darse acceso a sí mismos |
| Tema de color | Color de acento | Solo el dispositivo actual (`localStorage`) | Es una **preferencia personal** dentro de una pantalla de configuración global |

### 1.4 Resto del sistema (resumen)

| Sección actual | Vista | Qué resuelve | Duplicación o solapamiento detectado |
|---|---|---|---|
| Operaciones | Fichado (GPS/QR) | Iniciar y cerrar jornada con validación de geocerca, QR y dispositivo | Cuarta captura de la misma hora (ver flujo F4) |
| Operaciones | Registro de Tiempos (+ Control horario) | Carga de horas por proyecto o causa; el control horario cruza horas con fichadas | Con Aprobaciones y Monitoreo |
| Operaciones | Mis Proyectos (Resp.) | Vista del responsable: checklist, materiales (uso, devolución, delegación), bitácora, OS, pedir finalización | Repite el detalle de Gestión de Proyectos en 1.839 líneas propias |
| Operaciones | Demoras del Cliente | Registrar demoras con área, motivo y duración | Es un tipo de entrada de bitácora del proyecto |
| Operaciones | Informes Técnicos | Relevamientos y diagnósticos con plantillas, evidencias, PDF | Aparecen también como "Documentación" en Proyectos |
| Operaciones | Mis EPP · Mis Viajes | Autoservicio del empleado | — (patrón correcto) |
| Operaciones | Análisis de Pliegos | Subir el pliego del cliente, análisis con IA, marcar tareas dentro/fuera | Es preventa: alimenta un presupuesto, pero no está conectado a Presupuestos |
| Ventas y Comercial | Gestión Comercial | Maestro de productos, precios, listas, importación, ajustes masivos | — |
| Ventas y Comercial | Punto de Venta | Venta de mostrador, remitos, anulación con PIN | No descuenta stock (`lib/ventas/pdvService.ts:436`) |
| Ventas y Comercial | Cotizaciones | Presupuestos de productos | Con **Presupuestos de servicios** |
| Ventas y Comercial | Presupuestos de servicios | Mano de obra + materiales, versiones, aceptación, conversión a proyecto | Con Cotizaciones |
| Ventas y Comercial | Almacén y Stock | Stock por almacén, kardex, ajustes, conteos, transferencias, faltantes | Es logística, no ventas; ningún flujo de consumo lo mueve |
| Ventas y Comercial | Cuentas Corrientes | Saldos, cobranzas, cargos manuales, crédito por cliente | No recibe lo facturado por OS u OT |
| Logística | Inventario de Materiales | **Desactivada** ("usar Gestión Comercial") | Su tabla (`MaterialMaestro`) **sigue en uso** por OT, costo de proyectos y provisión |
| Logística | Provisión de Materiales | Pedido, disponibilidad, entrega, uso y devolución de materiales por proyecto | No mueve stock del Almacén |
| Logística | Herramientas y Carros | Retiro, devolución, verificación periódica, carros | — |
| Calidad | Calidad y Documentación (12 pestañas) | Documentos, NC, CAPA, riesgos, objetivos, oportunidades, LMS, competencias, plantillas, vencimientos, historial | Título interno distinto ("Gestión Operativa y Calidad"); objetivos con OKR; LMS con Formación Integral |
| Calidad | Formación Integral | Mis capacitaciones y certificados | Autoservicio (correcto), pero con nombre que no lo dice |
| Calidad | Gestión de Sugerencias | Ideas, reclamos y mejoras de la empresa (ISO) | Con "Oportunidades" (Calidad) y con el tipo "sugerencia" de Tickets |
| Calidad | Tickets de Soporte | Fallas y pedidos sobre el software, con agentes | No es calidad del negocio: es soporte del sistema |
| Calidad | Centro de Ayuda | Base de conocimiento | Soporte del sistema |
| Trazabilidad | Monitoreo de Fichadas | Fichadas en tiempo real y cruce con registro de tiempos | Con Aprobaciones y Control horario |
| Trazabilidad | Auditoría de IA | Consumo, éxito y costo de llamadas a IA | El menú la describe como "Validación inteligente": no lo es |
| Trazabilidad | Auditoría | Bitácora de cambios (`AuditLog`) | API sin control de rol |
| Trazabilidad | Verificación de Firmas | Verificar integridad de firmas | — |

### 1.5 Configuraciones dispersas dentro de los módulos

Además de `/configuracion`, hay **al menos 13 lugares** donde se configura algo (dos de ellos sin pantalla):

| Configuración | Dónde está hoy |
|---|---|
| Listas de precios, IVA, predeterminada | Gestión Comercial → modal "Configurar listas" |
| Almacenes y ubicaciones | Almacén → pestaña "Almacenes y Ubicaciones" |
| Categorías de mano de obra (valor hora) | Presupuestos de servicios → Mano de obra |
| Tarifas de viáticos | Viajes → botón de tarifas |
| Proveedores y códigos de gasto | Gastos → pestaña "Ajustes" |
| Configuración del cliente para OT (% materiales, valor hora por operador, responsables del portal, sectores) | Órdenes de Trabajo → modal del cliente |
| Crédito del cliente (límite, plazo, estado) | Cuentas Corrientes |
| Estructura documental ("accesos" 1.1, 1.2…) | Calidad → Biblioteca → gestionar subaccesos |
| Plantillas de checklist | Calidad → Plantillas |
| Catálogo de EPP (vigencia, global/específico, stock mínimo) | RRHH → EPP |
| Enlaces públicos de matriz de EPP por cliente | RRHH → EPP |
| Prompts de IA | **Ninguna pantalla**: solo la API `/api/ai/prompts`, que acepta cambios si el pedido no declara un rol (X2) |
| Stock negativo permitido (`inventarioPermiteNegativo`) | **Ninguna pantalla**: solo se cambia en la base |

Configurar dentro del módulo es el patrón correcto (la configuración cerca de lo que configura). El problema es que **no hay una regla**: algunas cosas del mismo tipo están en `/configuracion` y otras en el módulo, y el usuario no puede predecir dónde buscar.

### 1.6 Datos maestros fragmentados

| Concepto | Dónde vive hoy | Consecuencia |
|---|---|---|
| **Cliente** | `HdbClient` (Clientes) + `HdbClientConfig`, `ClientOperatorRate`, `ClientResponsable`, `ClientSector` (OT) + `CuentaCorrienteConfig` (Cuentas corrientes) | Para dejar un cliente listo hay que pasar por tres módulos. El cliente **no tiene CUIT, razón social ni condición de IVA** (`prisma/schema.prisma:241`): se vuelven a escribir en cada venta y cotización (`Venta.clienteIdentificacion`, `Cotizacion.clienteIdentificacion`) |
| **Proveedor** | `Proveedor` (Gastos, CUIT obligatorio y único) y `ProveedorVentas` (productos, CUIT opcional) | El mismo proveedor se carga dos veces con reglas distintas |
| **Persona** | `Operator` = cuenta de acceso + empleado + técnico. Datos de la persona en Usuarios; tarifas en OT; competencias y capacitaciones en Calidad; EPP en RRHH; viajes en Viajes | No hay una ficha de la persona. No existe un legajo (fecha de ingreso, contacto, vencimientos) |
| **Valor de la hora** | `SystemSetting.valorManoObra` (OS y costo del proyecto), `ManoObraCategoria` (presupuestos), `ClientOperatorRate` (OT) | Tres precios para la misma hora; el presupuestado vs. real compara contra una fuente y el cobro usa otra |
| **Material / producto** | `Producto` (Gestión Comercial), `MaterialMaestro` (inventario desactivado), `MaterialProyecto` (provisión), `EppItem` (EPP), `Tool` (herramientas) | Dos fuentes de precio para materiales; tres stocks independientes |
| **Hora trabajada** | `Planning` (planificada), `Fichada` (presencia), `TimeEntry` (por proyecto), `OrdenServicioOperador` / `OtCicloOperador` (facturable), `ControlHorarioAjuste` (validada) | Cuatro capturas y una conciliación (ver flujo F4) |
| **Objetivo / indicador** | `ObjetivoCalidad` (texto libre) y `Okr` + `Kpi` (medidos) | Dos sistemas de objetivos |
| **Acción / tarea** | `Tarea`, `ProyectoTarea`, `AccionMejora`, `PlanAccionKpi`, `ChecklistItem`, `PliegoTarea` | El usuario no tiene una lista única de "lo que tengo que hacer" |
| **Riesgo** | `Riesgo` (matriz ISO, Calidad) y la pestaña "Riesgos" de Proyectos (que muestra entradas de bitácora `Bloqueante`/`Reporte`, `app/api/riesgos/route.ts`) | Mismo nombre, conceptos distintos |
| **"Accesos"** | Permisos de usuario (`OperatorPermiso`) y "accesos" de documentos (`DocumentAccessModule`, que en realidad es la estructura de carpetas del sistema documental) | Mismo nombre, conceptos distintos |

### 1.7 Contradicciones entre frontend, backend, base y permisos

Estas son las más importantes. Todas están verificadas en el código.

| # | Contradicción | Evidencia | Efecto |
|---|---|---|---|
| X1 | La documentación dice que los accesos se controlan por rol y permiso especial, pero **más de 100 de las 331 rutas de API solo exigen sesión**, sin verificar rol ni función (algunas son públicas a propósito; la mayoría no). Entre ellas: toda la configuración (`/api/config/system`, `/api/config/views`, etiquetas, desplegables, checklists), clientes, proyectos (incluido `DELETE`), documentos controlados (incluido borrar documentos y versiones), gastos, auditoría, herramientas, planificación, capacitaciones y competencias, cotizaciones, cuentas corrientes (consulta), resetear dispositivos | `app/api/config/system/route.ts:23`, `app/api/config/views/route.ts:32`, `app/api/projects/route.ts:29`, `app/api/operators/reset-devices/route.ts` | Ocultar una vista del menú no protege nada: cualquier usuario con sesión puede llamar a la API. Un operario puede cambiar la geocerca de la empresa, darse acceso a vistas o borrar un proyecto |
| X2 | Algunas APIs **confían en el rol que manda el navegador** | `requestUserRole` en `app/api/time-entries/route.ts:55,75,151,263`; `?role=admin` en `app/api/tareas/route.ts:15-32`; `userRole` del cuerpo en `app/api/ai/prompts/route.ts:42-49` (y si no se manda, pasa); aprobador desde el cuerpo en `app/api/time-entries/approve/route.ts:32` | Un operario puede editar o confirmar horas de otro, ver todas las tareas o aprobar fichadas a nombre de otro |
| X3 | El rol de la sesión se fija al ingresar y **nunca se actualiza**: el token dura 30 días y cada pedido lo renueva copiando el rol viejo. Desactivar a un usuario tampoco corta su sesión | `middleware.ts:76-82`; `app/api/auth/login/route.ts` | Un cambio de rol o una baja no aplica hasta que la persona deje de usar el sistema 30 días |
| X4 | "Cerrar sesión" solo borra `localStorage`; la cookie de sesión queda viva. No existe `/api/auth/logout` para el sistema interno | `app/layout.tsx:174-177` | En dispositivos compartidos (tablets de obra, base) la sesión anterior sigue habilitada para la API |
| X5 | Quien tiene `usuarios.gestionar` (supervisor y QA por defecto) puede asignar **cualquier rol, incluido admin**, también a sí mismo. Pero "Administrar accesos" es solo de admin | `lib/permisos.ts:40-41`; `lib/dataLayer.ts:406` no restringe el campo `role` | El permiso fino de accesos queda anulado por el grueso de usuarios |
| X6 | Tres pantallas llaman a **`/api/notifications`, que no existe** | `app/my-projects/page.tsx:712,739`; `app/timesheets/page.tsx:448`; `components/ProjectFinalizeAuthModal.tsx:100-139` | No funcionan: pedir la finalización de un proyecto, pedir modificar o borrar un registro de horas, avisar a supervisores de un bloqueante. El usuario ve "Error al enviar solicitud" o el aviso no sale |
| X7 | Las **horas consumidas** del proyecto se suman dos veces: al cargar horas (`app/api/time-entries/route.ts:108-113`) y al generar la OS, que precarga esas mismas horas y las vuelve a sumar (`lib/services/osService.ts:134-149`). Además el campo se puede editar a mano en el formulario (`app/projects/page.tsx:1356`) | — | El Panel de Análisis (eficiencia, horas ahorradas, variación) y el presupuestado vs. real usan un número que puede estar inflado o pisado a mano |
| X8 | El inventario de materiales está desactivado ("usar Gestión Comercial"), pero su tabla `MaterialMaestro` **sigue siendo la fuente de precios** de los materiales de OT, del costo de proyectos y de la importación de provisión | `app/api/ordenes-trabajo/[id]/materiales/route.ts:88`; `app/api/projects/[id]/cost/materials/route.ts:47`; `app/api/provision-materiales/importar/route.ts` | OS y presupuestos toman precios de `Producto`; OT y costo de proyecto de una tabla que ya no se mantiene |
| X9 | Almacén lleva un kardex completo, pero **ningún consumo lo mueve**: las ventas del PDV se guardan con `stockDescontado: false`, y la provisión a obra, las OS y las OT no generan movimientos | `lib/ventas/pdvService.ts:436`; ninguna llamada a `stockService` fuera de `app/api/almacen`, el ajuste rápido de stock y el alta e importación de productos | El stock solo es correcto si alguien lo ajusta a mano |
| X10 | La asignación del equipo en el asistente de proyecto **no escribe en Planificación**, pero el fichado valida contra Planificación | `docs/presupuestos-servicio/README.md`; `app/api/time-entries/punch/route.ts:208-236` | Un operario asignado al proyecto por el asistente recibe "No estás asignado a este proyecto hoy" y su fichada cae en Aprobaciones |
| X11 | Favoritos y recientes se guardan con `user.legajo`, un campo que **no existe** en `Operator` | `app/layout.tsx:59-60`; `components/shell/AppSidebar.tsx:72`; `app/page.tsx:95` | "Recientes" nunca se registra; los favoritos de todos los usuarios de un mismo dispositivo se mezclan bajo la clave `default` |
| X12 | Calidad muestra pestañas para `operador` (biblioteca, LMS, competencias), pero la vista `/calidad` no está habilitada para `operador` | `app/calidad/page.tsx:67-79` vs. `lib/viewAccess.ts` | Permisos declarados en dos lugares que no coinciden |
| X13 | Varias pantallas se protegen leyendo el rol de `localStorage` y comparándolo a mano (hay 86 comparaciones de rol escritas a mano en 22 archivos de pantallas; unas pocas son solo para colores, la mayoría decide qué se muestra), lo que contradice la regla de `AGENTS.md` ("no compares roles a mano") | p. ej. `app/configuracion/page.tsx:57-70`, `app/datasets/page.tsx`, `app/operators/page.tsx` | Un permiso especial otorgado desde la llave no se refleja en esas pantallas |
| X14 | Borrar un operador o un proyecto es un **borrado físico en cascada** en un sistema que se presenta como ISO 9001 | `lib/dataLayer.ts:364,432`; relaciones `onDelete: Cascade` de `TimeEntry`, `Fichada`, `OrdenServicioOperador` (operador) y de `OrdenServicio`, `TimeEntry`, `MaterialProyecto`, `Fichada` (proyecto) | Borrar un proyecto borra sus OS firmadas, horas, fichadas y materiales. Borrar un cliente no deja ni registro en Auditoría (`lib/dataLayer.ts:528`) |
| X15 | Generar una OS **finaliza el proyecto** automáticamente | `lib/services/osService.ts:141` | Regla implícita pensada para servicios de una sola OS; en un proyecto largo con varias OS lo cierra sin aviso |
| X16 | El stock negativo depende de un permiso (`inventario.permitir_stock_negativo`) **y** de un interruptor global que no tiene pantalla | `SystemSetting.inventarioPermiteNegativo`; `lib/inventario/stockService.ts` | Un admin con el permiso no puede usarlo sin tocar la base |

---

## 2. Mapeo de flujos actuales

Elegí los recorridos que más tocan Gestión, Administración y Configuración, ordenados por impacto. Notación: `→` paso, `⟂` salto a otra sección del menú, `✗` punto roto.

### F1. Dar de alta a una persona lista para trabajar

```
Menú ⟂ Administración → Gestión de Usuarios → "Nuevo Operador"
   └ modal: nombre, rol, DNI, cargo, PIN (1234 por defecto), vacaciones, especialidades → Guardar
→ (si necesita algo distinto a su rol) ícono de llave → buscar acceso → Según rol / Permitir / Denegar → Guardar
⟂ Gestión → Órdenes de Trabajo → cliente → Configurar → "Valores hora" → elegir persona → valor → Agregar
   └ se repite por cada cliente con OT
⟂ Administración → Recursos Humanos → EPP → Matriz → entregar acta
(capacitaciones obligatorias: se asignan solas — bien)
```

| Punto | Análisis |
|---|---|
| Interacciones | ≈ 12 para el alta y los accesos, más ≈ 6 por cada cliente con OT, más la entrega de EPP |
| Decisiones | Rol (5 opciones sin explicación de qué habilita), especialidades, accesos especiales, valor hora por cliente |
| Información previa necesaria | Qué ve cada rol; que las especialidades son las mismas etiquetas de proyectos; en qué clientes trabajará y qué tarifa tiene en cada uno |
| Pasos innecesarios | La tarifa por cliente para cada persona (podría heredarse de una categoría); el PIN por defecto conocido por todos |
| Pérdida de contexto | Sí: tres secciones del menú y ningún lugar que muestre "todo lo de esta persona" |
| Riesgo | Un supervisor puede crear un admin (X5) |

### F2. Dar de alta un cliente listo para operar

```
Menú ⟂ Administración → Gestión de Clientes → "Nuevo"
   └ nombre, email, teléfono, dirección, lista de precios → Guardar
⟂ Gestión → Órdenes de Trabajo → "Habilitar cliente" (elegir de la lista de disponibles)
   → Configurar → Comercial (% materiales) → Valores hora (por persona) → Responsables (alta y clave del portal) → Sectores
⟂ Ventas → Cuentas Corrientes → cliente → crédito (límite, plazo, estado)
CUIT / razón social / condición IVA: no existen; se tipean en cada venta y cotización
```

| Punto | Análisis |
|---|---|
| Interacciones | ≈ 20 a 30, en tres secciones |
| Información previa | Saber que la "configuración del cliente" está dentro de Órdenes de Trabajo y el crédito dentro de Cuentas Corrientes |
| Pasos innecesarios | "Habilitar cliente para OT": es una configuración que se podría deducir (un cliente está habilitado cuando tiene su primera OT o un responsable de portal) |
| Caminos alternativos confusos | Se puede vender o cotizar a un cliente "eventual" sin darlo de alta, y además existe el maestro de clientes, sin datos fiscales en ninguno de los dos casos |

### F3. Del presupuesto al cobro (el ciclo principal del negocio)

```
1  ⟂ Operaciones → Análisis de Pliegos → subir PDF → analizar        (no se conecta con el presupuesto: se copia a mano)
2  ⟂ Ventas → Presupuestos de servicios → Nuevo → tareas, mano de obra, materiales → Enviar → Aceptar
3  → Convertir → Asistente de proyecto (6 pasos, incluye equipo)
4  ⟂ Gestión → Planificación → armar los bloques con los mismos operarios   (la asignación del paso 3 no llega, X10)
5  Operario ⟂ Fichado → si no está en el bloque: alerta → ⟂ Registro de Tiempos → carga horas
6  Supervisor ⟂ Aprobaciones · ⟂ Trazabilidad → Monitoreo · ⟂ Registro de Tiempos → Control horario
7a ⟂ Gestión → Órdenes de Servicio → Generar (precarga horas) → firma por link → Cobro con valor hora GLOBAL
      → el proyecto pasa a "finalizado" y las horas se suman otra vez (X7, X15)
7b o ⟂ Gestión → Órdenes de Trabajo → cliente → proyecto → OT → ciclo → horas tipeadas de nuevo con tarifa POR CLIENTE
      → firma en el portal
8  ⟂ Ventas → Cuentas Corrientes → cargo MANUAL con el importe        (OS y OT no generan deuda)
```

| Punto | Análisis |
|---|---|
| Pantallas | 10 módulos en 5 secciones |
| Decisiones | ¿OS u OT para este cliente? ¿Qué valor hora? ¿Quién pasa el importe a la cuenta corriente? |
| Información previa | Que la asignación del asistente no sirve para el fichado; que la OS cierra el proyecto; que hay que cargar la deuda a mano |
| Pasos innecesarios | Paso 4 (reasignar), la tercera carga de horas en 7b, el paso 8 |
| Pérdida de contexto | Total: el presupuesto, el proyecto, las órdenes y la deuda no se ven juntos en ningún lado |
| Datos | Tres valores hora distintos en el mismo ciclo: el del presupuesto (categorías), el de la OS (global) y el de la OT (por cliente y persona) |

### F4. La jornada del operario y el control de horas

```
Operario:   Inicio ⟂ Fichado → iniciar jornada … finalizar ⟂ Registro de Tiempos → cargar (proyecto, horas, extra, causa)
            → si se equivocó: pedir modificación ✗ (X6)
Supervisor: ⟂ Gestión → Aprobaciones            (fichadas con alertas)
            ⟂ Trazabilidad → Monitoreo de Fichadas (tiempo real y cruce)
            ⟂ Operaciones → Registro de Tiempos → Control horario (ajuste del día)
            ⟂ Campana / Notificaciones          (pedidos de corrección, que hoy no llegan)
```

La misma hora queda registrada como **planificada** (`Planning`), **presente** (`Fichada`), **imputada** (`TimeEntry`), **facturada** (`OrdenServicioOperador`/`OtCicloOperador`) y **validada** (`ControlHorarioAjuste`). Las tres pantallas del supervisor existen para conciliar esas capturas.

| Punto | Análisis |
|---|---|
| Frecuencia | Diaria, para todos los operarios y supervisores: es el flujo más usado del sistema |
| Interacciones del operario | ≈ 8 a 10 por día (dos fichadas, una o más cargas de horas) |
| Pantallas del supervisor | 4, en 3 secciones distintas |
| Complejidad necesaria | La validación por GPS, QR y dispositivo (control de fraude) es legítima |
| Complejidad accidental | Capturar dos veces lo mismo (fichada y registro) y conciliarlo en tres pantallas |
| FALTA INFORMACIÓN | Si en la práctica un operario reparte el día entre varios proyectos con frecuencia. Si es la excepción, la fichada puede generar la imputación sola; si es la regla, hace falta un paso de reparto |

### F5. Materiales para una obra y stock

```
⟂ Logística → Provisión de Materiales → proyecto → cargar materiales (búsqueda en Gestión Comercial)
   → solicitada / disponible / entregada
Operario ⟂ Mis Proyectos → registrar uso o devolución, o delegar
Supervisor → confirmar devolución
Stock: no cambia ✗ (X9) → alguien ⟂ Ventas → Almacén → Ajuste rápido
OS: vuelve a cargar materiales (sincroniza con la provisión) · OT: los carga de nuevo con precio de MaterialMaestro (X8)
```

| Punto | Análisis |
|---|---|
| Pasos innecesarios | El ajuste manual de stock y la recarga de materiales en la OT |
| Información previa | Que el almacén está bajo "Ventas"; que la OT usa otra lista de precios |
| Caminos confusos | Tres lugares para materiales de una obra (provisión, OS, OT) |

### F6. Configurar un proyecto

El formulario del proyecto pide decidir, sin guía, seis interruptores: `generarOS`, `aprovisionamiento`, `fichajeHabilitado` (con geocerca y QR), `proyectoFijo`, `noEnMetricas` y "activo", además de **estado** (que convive con "activo"), categoría, tipo de actividad, etiquetas, lista de precios, horas estimadas y **horas consumidas editables**. Existen además dos caminos de alta: el asistente y el "alta clásica" (`/projects?alta=clasica`).

| Punto | Análisis |
|---|---|
| Decisiones | 6 interruptores + 3 clasificaciones (categoría, tipo de actividad, etiquetas) cuya diferencia no está explicada |
| Información previa | Qué implica cada interruptor en otros módulos (OS, provisión, fichado, métricas) |
| Automatizable | "En riesgo" y "atrasado" se pueden calcular con fechas y horas; las horas consumidas, con los registros; los interruptores, con un **tipo de proyecto** |

### F7. Dar un acceso o cambiar lo que ve un rol

```
Por persona: ⟂ Administración → Gestión de Usuarios → llave (solo admin) → buscar → Permitir / Denegar → Guardar
Por rol:     ⟂ Administración → Configuración → Vistas → tildar roles en cada vista → Guardar   (también supervisor y QA)
Funciones por rol: solo cambiando el código (lib/permisos.ts)
```

Dos pantallas y el código para el mismo concepto. Y como la mayoría de las APIs no verifica (X1), dar o quitar un acceso a veces no tiene efecto real: se oculta un botón pero la API sigue respondiendo, o se muestra la pantalla y la API devuelve 403 (calidad, OKR, datasets, documentado en `docs/CONTROL_ACCESOS.md`).

### F8. Pedir autorización (finalizar proyecto, corregir horas)

Hoy está roto (X6). Aun funcionando, el pedido viaja como notificación y la aprobación vive dentro del menú desplegable de la campana: no hay una lista de "pendientes de aprobar" ni un estado del pedido para quien lo hizo.

### F9. Registrar una demora del cliente o un bloqueante

```
Demora:     ⟂ Operaciones → Demoras del Cliente → nueva (proyecto, fecha, hora, área, motivo, duración)
Bloqueante: ⟂ Operaciones → Mis Proyectos → proyecto → bitácora → categoría "Bloqueante" (el aviso no sale, X6)
Se ven en:  Proyectos → pestaña "Riesgos" (bloqueantes) · Panel de Análisis (demoras)
```

Son dos formas de anotar algo que pasó en una obra. Deberían ser la misma bitácora con distintos tipos de entrada.

### F10. Cambiar un parámetro

Para cambiar "el valor de la hora", el usuario tiene que saber que hay tres: Configuración → Órdenes de Servicio (global), Presupuestos → Mano de obra (por categoría) y Órdenes de Trabajo → cliente → Valores hora (por cliente y persona). Para cambiar los motivos de demora, que están en Configuración → Desplegables → "Motivos de Demora", lejos de la pantalla de Demoras.

---

## 3. Responsabilidades de cada módulo

### 3.1 Gestión vs. Administración vs. Configuración

**Veredicto: no deberían existir como módulos.** Son verbos, no dominios.

| Palabra | Lo que contiene hoy | Por qué no funciona como módulo |
|---|---|---|
| Gestión y Seguimiento | Planificación, Proyectos, OS, OT, Aprobaciones y Tareas (ejecución) + Panel de Análisis y OKR (estrategia) | Mezcla trabajo operativo diario con dirección estratégica. Además "gestión" aparece en otros lugares: "Gestión Comercial", "Gestión de Usuarios", "Gestión de Clientes", "Gestión de Sugerencias", "Gestión Operativa y Calidad" |
| Administración | Gastos (finanzas), Viajes (personal), Usuarios y Clientes (datos maestros), RRHH, Datasets y Diccionario (técnico), Configuración y Notificaciones | Es un cajón de sastre: 5 dominios distintos y 2 herramientas técnicas. Un usuario no puede deducir qué hay adentro |
| Configuración | Catálogos de proyectos, parámetros de fichaje, una tarifa, roles por vista, una preferencia personal | Mezcla 5 tipos de decisión con dueños distintos (supervisor de obra, administración, admin del sistema, cada usuario) |

En cualquier dominio aparecen las tres actividades: **operar** (la lista y el trabajo diario), **administrar** (la ficha del objeto y sus acciones) y **configurar** (los ajustes del dominio). Separarlas en módulos obliga al usuario a clasificar su tarea antes de encontrarla. Separarlas **dentro** de cada dominio (lista → ficha → ajustes) no.

### 3.2 Evaluación módulo por módulo

| Módulo | Responsabilidad que debería tener | Hace de más | Hace de menos | ¿El nombre representa lo que contiene? | Veredicto |
|---|---|---|---|---|---|
| Panel de Análisis | Indicadores de dirección | Ranking de operadores con edición de competencias | No se conecta con OKR | Sí | Mantener, mover a "Indicadores" |
| Planificación | Agenda del equipo | — | No recibe el equipo asignado del proyecto | Sí | Mantener dentro de Proyectos, alimentado por asignaciones |
| Gestión de Proyectos | El proyecto de punta a punta | 7 pestañas globales (dashboard, riesgos, documentación, reportes) que no son de "un" proyecto | La ficha no muestra horas, órdenes y cuenta del cliente juntas; el responsable usa otra pantalla | "Gestión de" sobra | Mantener y absorber Mis Proyectos, Demoras, OS/OT del proyecto |
| Órdenes de Servicio | Certificar trabajo hecho y cobrarlo | Finaliza el proyecto; suma horas | No genera deuda | Sí | Fusionar con OT |
| Órdenes de Trabajo | Ídem, con ciclos y portal | Contiene la configuración del cliente | Sin lista global de OT (hay que entrar por cliente y proyecto) | Sí | Fusionar con OS |
| Aprobaciones | Excepciones de fichada | — | Solo fichadas: no aprueba correcciones de horas ni finalizaciones | "Aprobaciones" sugiere algo general | Fusionar en "Asistencia y horas" y en la bandeja de Inicio |
| Tareas | Lo que cada uno tiene que hacer | — | No muestra acciones CAPA, planes de KPI ni tareas de proyecto | Sí | Mantener como vista personal unificada |
| OKR y KPI | Objetivos e indicadores | — | No incluye Objetivos de Calidad | Siglas que el operario no entiende, pero el público es dirección | Fusionar con Objetivos de Calidad |
| Motor de Datasets · Diccionario de Datos | Plomería técnica de los KPI | Están en el menú de negocio para supervisores | — | Técnicos | Mover a Ajustes → Datos (solo admin) |
| Gastos y Facturas | Facturas de proveedores | Tiene su propio maestro de proveedores | No se vincula con compras de stock ni con gastos de viajes | Sí | Mantener en Finanzas con proveedores únicos |
| Viajes y Viáticos | Viajes y rendiciones | — | — | Sí | Mantener en Personas |
| Gestión de Usuarios | Personas y su acceso | Resetear **todos** los dispositivos desde el encabezado | No hay legajo; la persona está repartida en 5 módulos | Menú dice "Usuarios", pantalla dice "Operadores" | Fusionar con RRHH en "Personas" |
| Gestión de Clientes | El cliente completo | — | No tiene datos fiscales, ni su configuración, ni su cuenta | "Gestión de" sobra | Convertir en ficha 360 dentro de Comercial |
| Recursos Humanos | Personal | — | "Personal" redirige a EPP: no hay legajo | Promete más de lo que tiene | Fusionar en "Personas" |
| Configuración | Lo transversal | Tiene una tarifa, catálogos de un solo módulo y una preferencia personal | No tiene el interruptor de stock negativo | Genérico | Dividir (ver sección 5) |
| Notificaciones | Avisos | — | No funciona como bandeja de tareas | Sí | Sacar del menú (ya está la campana) |
| Calidad y Documentación | Sistema de gestión de calidad | 12 pestañas: documentos, mejora, riesgos, objetivos, capacitación, plantillas | — | El título interno es otro ("Gestión Operativa y Calidad") | Dividir en 4 entradas |
| Tickets · Centro de Ayuda | Soporte del software | Están en "Calidad y Mejora Continua" | — | Sí | Mover al encabezado ("Ayuda y soporte") |
| Auditoría de IA | Consumo de IA | — | — | Se describe como "Validación inteligente" | Renombrar "Consumo de IA" y mover a Ajustes |
| Almacén y Stock | Existencias | — | No lo mueve ningún consumo | Sí | Mover a Logística e integrar |
| Provisión de Materiales | Materiales de cada obra | 2.408 líneas, lógica propia de entregas | No mueve stock | Sí | Mover a la ficha del proyecto + vista global en Logística |
| Análisis de Pliegos | Leer el pliego del cliente | — | No crea el presupuesto | Sí | Mover a Comercial y conectar con Presupuestos |

---

## 4. Fusiones propuestas

Cada fusión parte de una responsabilidad compartida y de un flujo real, no de nombres parecidos.

### FU1. Gestión de Usuarios + Recursos Humanos (personal) + datos de la persona dispersos → **Personas**

- **Por qué están relacionados:** `Operator` es a la vez cuenta de acceso, empleado y técnico. Hoy sus datos están en Usuarios, sus tarifas en OT, sus competencias y capacitaciones en Calidad, su EPP en RRHH y sus viajes en Viajes.
- **Problema de mantenerlos separados:** no existe una ficha de la persona; dar de alta a alguien recorre tres secciones (F1); RRHH promete "Personal" y solo tiene EPP.
- **Resultado:** "Personas" con una lista y una **ficha por persona** con pestañas: Datos y legajo · Acceso (rol, PIN, dispositivo, permisos especiales) · Especialidades y competencias · Tarifas (si difiere de su categoría) · Asistencia y horas · EPP · Formación · Viajes.
- **Se elimina o traslada:** "Resetear todos los dispositivos" pasa a una acción con confirmación en Ajustes; la edición de tarifas por persona dentro de OT desaparece.
- **Navegación:** Administración → Gestión de Usuarios y Administración → Recursos Humanos pasan a ser **Personas → Personas**.

### FU2. Aprobaciones + Monitoreo de Fichadas + Control horario + supervisión del Registro de Tiempos → **Asistencia y horas**

- **Por qué:** las cuatro sirven para lo mismo: confirmar cuánto y dónde trabajó cada persona.
- **Problema:** cuatro pantallas en tres secciones (F4); el supervisor concilia a mano lo que el sistema capturó dos veces.
- **Resultado:** una pantalla con tres vistas: **Hoy** (quién está fichado y dónde, el monitoreo actual), **Excepciones** (fichadas con alertas, diferencias entre fichada y horas, pedidos de corrección; se aprueba o ajusta en el lugar) y **Período** (el control horario por persona y día, exportable).
- **Navegación:** Gestión → Aprobaciones, Trazabilidad → Monitoreo y el botón "Control horario" pasan a **Personas → Asistencia y horas**. Las excepciones pendientes también aparecen en la bandeja de Inicio.

### FU3. Órdenes de Servicio + Órdenes de Trabajo → **Órdenes** (PROPUESTA, sujeta a confirmar)

- **Por qué:** ambas certifican trabajo hecho para un cliente en un proyecto, con personas y horas, materiales, firma del cliente, PDF y total a cobrar.
- **Diferencias reales:** la OT agrupa por ciclos (mensuales), usa tarifa por cliente y persona, firma en el portal con hash; la OS es de una vez, firma por link público y usa tarifa global.
- **Problema:** el usuario tiene que saber qué módulo usa cada cliente; hay dos firmas, dos tarifas, dos formas de cargar materiales, y la OT no tiene lista global.
- **Resultado:** una entidad "Orden" con **modalidad** (única o por períodos), que se crea desde el proyecto, precarga horas aprobadas y materiales usados, toma la tarifa de una sola regla (ver FU8) y se firma por link o desde el portal, con el mismo sellado de integridad.
- **FALTA INFORMACIÓN:** si la OS se usa todavía o quedó como modelo anterior a la OT; qué clientes usan cada una; si hay requisitos contractuales distintos. Si las dos siguen vigentes por razones de cliente, la fusión puede ser solo de pantalla (una lista y un alta con dos modalidades) sin fusionar tablas.

### FU4. Cotizaciones + Presupuestos de servicios → **Presupuestos** (PROPUESTA)

- **Por qué:** ambos son una oferta al cliente con número, validez, lista de precios, IVA, ítems, PDF y aceptación.
- **Problema:** dos lugares para "hacerle un presupuesto a un cliente"; el vendedor no sabe cuál usar cuando el trabajo mezcla productos y servicio.
- **Resultado:** "Presupuestos" con **tipo**: de productos (lo que hoy es Cotización, se convierte en venta) o de servicio (lo que hoy es Presupuesto de servicio, se convierte en proyecto). Comparten numeración, estados (borrador, enviado, aceptado, rechazado, vencido), documento y el patrón de copia congelada al aceptar, que hoy solo tiene el de servicio.
- **Se mantiene:** el editor de servicio (tareas, mano de obra, revisiones) y la velocidad de la cotización rápida de mostrador.

### FU5. Proveedores (Gastos) + Proveedores de Ventas → **Proveedores**

- **Problema:** el mismo proveedor se carga dos veces con reglas distintas (CUIT obligatorio en uno, opcional en el otro).
- **Resultado:** un maestro único con CUIT, condición de IVA y contacto, usado por facturas de gastos, productos y (a futuro) compras. Vive en Finanzas, y se puede crear al vuelo desde un producto o una factura.

### FU6. Clientes + configuración del cliente en OT + crédito en Cuentas Corrientes → **Ficha de cliente**

- **Problema:** F2 recorre tres módulos y el cliente no tiene datos fiscales.
- **Resultado:** ficha con pestañas: Datos (razón social, CUIT, condición de IVA, contacto) · Comercial (lista de precios, % sobre materiales, crédito y plazo) · Sitios y sectores (con geocerca, para reutilizar en proyectos) · Portal (responsables y claves) · Proyectos · Órdenes · Presupuestos · Cuenta corriente.
- **Se elimina:** "Habilitar cliente para OT" (se deduce) y el modal de configuración dentro de OT.

### FU7. Objetivos de Calidad + OKR y KPI → **Objetivos e indicadores**

- **Problema:** dos sistemas de objetivos; uno con indicador y meta como texto libre (`ObjetivoCalidad`) y otro medido y sincronizado (`Okr`, `Kpi`).
- **Resultado:** un solo sistema. Un objetivo de calidad es un objetivo con un KPI marcado como "SGI". Los planes de acción pasan a ser acciones (FU9).

### FU8. Tres valores hora → **Tarifas de mano de obra**

- **Hoy:** `SystemSetting.valorManoObra` (OS y costo), `ManoObraCategoria` (presupuestos), `ClientOperatorRate` (OT).
- **Resultado:** categorías de mano de obra con valor hora (oficial, medio oficial, ayudante…) como **regla por defecto**; cada persona tiene una categoría; un cliente puede tener valores propios por categoría y, excepcionalmente, por persona. Presupuesto, orden y costo del proyecto usan la misma regla. El campo de Configuración → Órdenes de Servicio desaparece.

### FU9. Acciones de mejora + planes de acción de KPI + tareas → **Acciones** con origen

- **Problema:** `AccionMejora`, `PlanAccionKpi`, `Tarea` (y en menor medida `ProyectoTarea`) son "algo que alguien tiene que hacer para una fecha"; cada uno con estados escritos distinto.
- **Resultado:** una entidad de acción con **origen** (NC, sugerencia, oportunidad, desvío de KPI, proyecto, libre), responsable, vencimiento y estado común. Todas aparecen en "Mis tareas" de Inicio. `ProyectoTarea` puede quedar separada porque representa el alcance del proyecto, pero debería mostrarse en la misma vista personal.

### FU10. Demoras del Cliente + bitácora del proyecto + pestaña "Riesgos" de Proyectos → **Bitácora del proyecto**

- **Resultado:** una bitácora con tipos de entrada: nota, consulta, bloqueante, **demora del cliente** (pide área, motivo y duración). Los bloqueantes avisan al supervisor. La pestaña "Riesgos" se renombra "Bloqueos abiertos" o desaparece, para no confundirse con la matriz de riesgos de Calidad.

### FU11. Mis Proyectos + detalle de Gestión de Proyectos → **Ficha del proyecto**

- **Problema:** el responsable ve el proyecto en una pantalla de 1.839 líneas y el supervisor en otra; las acciones están duplicadas o repartidas.
- **Resultado:** una ficha única; las acciones se habilitan según el permiso. "Mis proyectos" es un **filtro** de la lista ("donde soy responsable o estoy asignado"), no otro módulo.

### FU12. Inicio + Notificaciones + bandejas de aprobación → **Inicio ("Mi día")**

- **Problema:** Inicio hoy repite el menú en tarjetas; los pendientes están dispersos (campana, Aprobaciones, Calidad, EPP, Viajes).
- **Resultado:** ver sección 13.

### FU13. Auditoría + Verificación de Firmas → **Auditoría y trazabilidad** (en Calidad)

La auditoría de IA sale de acá (es consumo técnico, va a Ajustes).

### FU14. Centro de Ayuda + Tickets de Soporte → **Ayuda y soporte** (en el encabezado)

Ya existe el botón de ayuda y el atajo de ticket en el encabezado. Salen del menú de "Calidad".

### FU15. Alta clásica + asistente de proyecto → **un solo alta**

El asistente con un modo "rápido" (solo datos generales) reemplaza al alta clásica. Dos formas de crear lo mismo producen proyectos con datos distintos (los del alta clásica no tienen tareas ni equipo asignado).

### FU16. Stock de EPP + Almacén (PROPUESTA, mediano plazo)

El EPP tiene su propio stock y kardex (`EppItem.stockActual`, `EppStockMovement`), paralelo al Almacén. Los elementos de EPP pueden ser productos del almacén; el módulo de EPP conserva lo propio (matriz, vigencia, actas firmadas, solicitudes) y descuenta stock con el mismo servicio. Las herramientas (`Tool`) son activos, no consumibles: conviene que sigan aparte.

---

## 5. Separaciones propuestas

### SE1. Dividir **Configuración**

| Contenido actual | Criterio | Destino |
|---|---|---|
| Etiquetas, checklists por etiqueta, categorías y tipos de actividad | Configura proyectos | Proyectos → Ajustes ("Tipos de proyecto y especialidades") |
| Áreas y motivos de demora | Configura la bitácora | Proyectos → Ajustes, o editable desde el mismo formulario ("Agregar motivo") |
| Causas de registro de tiempo | Configura asistencia | Personas → Ajustes |
| Fichaje en la base (geocerca, QR) | Dato de la organización | Ajustes → Organización y sedes |
| Valor de mano de obra | Es una tarifa | Comercial → Ajustes → Tarifas de mano de obra (FU8) |
| Alerta diaria y umbral | Automatización | Ajustes → Avisos automáticos |
| Vistas (roles) | Seguridad | Ajustes → Accesos |
| Vistas (menú/inicio/sección, etiqueta) | Diseño de producto | Eliminar como configuración (ver sección 6) |
| Tema de color | Preferencia personal | Menú del usuario → Preferencias |

**Criterio general:** la configuración vive en el dominio que la usa. Solo queda global lo que cruza dominios.

### SE2. Dividir **Calidad y Documentación** (12 pestañas)

| Nueva entrada | Pestañas actuales | Usuario típico |
|---|---|---|
| Documentos | Biblioteca, Vencimientos, Historial, Plantillas de checklist | Todos (consulta), QA (gestión) |
| Mejora | NC, CAPA, Oportunidades + Gestión de Sugerencias | QA, supervisores |
| Riesgos | Matriz de riesgos | QA, dirección |
| Formación y competencias | Capacitación LMS, Matriz de competencias + Formación Integral (vista personal) | QA, RRHH, todos (lo propio) |

El tablero QMS pasa a ser la portada de Calidad. Los objetivos van a Indicadores (FU7).

### SE3. Disolver la sección **Administración**

Cada vista va a su dominio: Usuarios y RRHH → Personas; Clientes → Comercial; Gastos → Finanzas; Viajes → Personas; Configuración → Ajustes y cada módulo; Datasets y Diccionario → Ajustes → Datos; Notificaciones → encabezado.

### SE4. Separar **Almacén** de **Ventas**

El stock es de toda la empresa (obras, mostrador, EPP). Pasa a Logística. La sub-navegación propia de Ventas (`components/ventas/VentasNavTabs.tsx`) desaparece: hoy se navega en dos niveles a la vez (menú lateral y pestañas) hacia las mismas cinco pantallas.

### SE5. Separar en el **proyecto** lo que hoy decide una bolsa de interruptores

`Project` hoy representa obras, servicios de una OS, contenedores de OT y la propia base de la empresa (`proyectoFijo`). PROPUESTA: un campo **tipo de proyecto** (obra, servicio puntual, contrato de mantenimiento, interno) con valores por defecto para fichaje, OS, provisión y métricas. No hace falta separar entidades: hace falta que la intención sea explícita.

### SE6. Separar **cuenta de acceso** y **legajo** dentro de la ficha de la persona

No como módulos, sino como secciones de la misma ficha: quién puede entrar y con qué permisos, por un lado; los datos laborales, por el otro. Hoy se mezclan en el mismo formulario, y el legajo no existe.

---

## 6. Qué eliminar, mantener, simplificar o automatizar

| # | Elemento | Decisión | Justificación |
|---|---|---|---|
| E1 | Vista `/inventario` y tabla `MaterialMaestro` | **Eliminar** (después de migrar sus usos) | La vista está desactivada, pero OT, costo de proyecto y la importación de provisión siguen leyendo precios de esa tabla (X8). Migrar a `Producto` y borrar |
| E2 | Modelo `TagChecklistItem` | **Eliminar** | No lo usa ningún archivo de `app/` ni `lib/` |
| E3 | "Impacta métricas" en etiquetas | **Eliminar** | No tiene efecto. La exclusión de métricas ya existe por proyecto (`noEnMetricas`), y con el tipo de proyecto (SE5) se resuelve sola |
| E4 | `dailyReminderTime` y el campo de hora deshabilitado | **Eliminar** | La hora la fija `vercel.json`; mostrar un campo que no se puede cambiar confunde |
| E5 | Configuración → Vistas: ubicación (menú/inicio/ambos), sección, etiqueta | **Eliminar** | Es diseño de producto, no una decisión del usuario. Permite dejar el menú distinto de la documentación y de la ayuda. Los roles de cada vista pasan a Accesos |
| E6 | Tema de color en Configuración | **Mover** | Es personal y se guarda en el dispositivo |
| E7 | "Horas consumidas" editable en el proyecto | **Automatizar** | Se calcula desde las horas imputadas (y se corrige X7) |
| E8 | Estados "en riesgo" y "atrasado" manuales | **Automatizar** | Se deducen de fechas, horas estimadas y bloqueos abiertos |
| E9 | "Activo" del proyecto junto con "estado" | **Simplificar** | Un solo estado (con "archivado" o "cancelado") |
| E10 | "Habilitar cliente para OT" | **Automatizar** | Se deduce de tener órdenes o responsables de portal |
| E11 | Tarifa por cliente y persona como paso obligatorio | **Simplificar** | Regla por categoría, con excepción opcional (FU8) |
| E12 | PIN por defecto `1234` | **Automatizar** | PIN temporal generado y cambio obligatorio al primer ingreso (como ya hace el portal de clientes con `mustChangePassword`) |
| E13 | Botón "Resetear dispositivos" (todos) en el encabezado de Usuarios | **Simplificar** | Acción masiva y riesgosa a un clic. Queda el reseteo por persona; el global va a Ajustes con confirmación |
| E14 | Borrado físico de personas, clientes y proyectos | **Eliminar** (reemplazar por archivar) | Rompe la trazabilidad ISO y borra en cascada (X14) |
| E15 | Interruptor global `inventarioPermiteNegativo` | **Simplificar** | Que alcance con el permiso `inventario.permitir_stock_negativo`; hoy hacen falta los dos y el interruptor no tiene pantalla (X16) |
| E16 | Notificaciones como entrada del menú | **Eliminar del menú** | La campana del encabezado ya es la bandeja |
| E17 | Centro de Ayuda y Tickets en el menú | **Mover** al encabezado | Es soporte del software |
| E18 | Datasets y Diccionario en el menú de supervisores | **Mover** a Ajustes → Datos | Herramientas técnicas |
| E19 | Pestañas globales de Proyectos (Dashboard, Recursos, Riesgos, Documentación, Reportes) | **Simplificar** | El tablero va a Indicadores; Recursos se integra a Planificación (carga del equipo); Riesgos y Documentación pasan a la ficha; Reportes queda como "Exportar" en la lista |
| E20 | Navegación de OT por cliente → proyecto → OT | **Simplificar** | Lista global de órdenes con filtros (cliente, proyecto, estado). Cliente y proyecto se abren desde su ficha |
| E21 | Doble navegación de Ventas (menú lateral + pestañas propias) | **Simplificar** | Un solo nivel |
| E22 | Doble endpoint de OCR de facturas (`/api/ia/ocr-factura`, `/api/ai/ocr`) | **Simplificar** | Uno solo dentro de la capa `lib/ai` |
| E23 | Alta clásica de proyectos | **Eliminar** | FU15 |
| E24 | Captura doble fichada + registro de horas | **Automatizar** | La fichada propone la imputación (F4) |
| E25 | Cargo manual en cuenta corriente por servicios | **Automatizar** | La orden firmada genera el cargo (sección 17) |
| E26 | Ajuste manual de stock por consumos | **Automatizar** | Ventas, entregas a obra y órdenes generan movimientos (X9) |
| E27 | Reasignar operarios en Planificación después del asistente | **Automatizar** | La asignación del proyecto publica los bloques o, al menos, cuenta como asignación para el fichado (X10) |
| — | Presupuestos de servicio, Almacén (kardex, reversas, conteos), PDV, Cuentas corrientes, Fichado con validaciones, Pliegos, Informes técnicos, Viajes, EPP (actas y matriz), Reclutamiento, Documentos controlados, catálogo de funciones de permisos | **Mantener** | Bien diseñados o con complejidad necesaria; lo que cambia es dónde están y cómo se integran |

---

## 7. Configuraciones

**Principio aplicado:** una configuración existe solo si el usuario realmente tiene que decidir algo. Si una regla, un valor por defecto o un cálculo lo resuelve, no se pregunta.

| Configuración actual | ¿Necesaria? | Nivel correcto | Dónde debería estar | Cambio propuesto |
|---|---|---|---|---|
| Etiquetas (especialidades) | Sí | Organización | Proyectos → Ajustes (compartida con Personas) | Renombrar "Especialidades" |
| Checklist por etiqueta | Sí | Proceso (tipo de trabajo) | Junto a la plantilla (Documentos) o al tipo de proyecto | Crear y vincular en el mismo lugar |
| Categoría de proyecto + Tipo de actividad | Parcial | Organización | Proyectos → Ajustes | Reducir a **tipo de proyecto** + especialidades. FALTA INFORMACIÓN: qué reportes usan categoría y tipo de actividad por separado |
| Áreas y motivos de demora | Sí | Organización | Bitácora del proyecto | Editables desde el formulario |
| Causas de registro de tiempo | Sí | Organización | Personas → Ajustes | — |
| Alerta diaria + umbral de días | Sí | Organización | Ajustes → Avisos automáticos | Mantener el umbral, quitar la hora |
| Hora de la alerta | No | — | — | Eliminar (E4) |
| Geocerca y QR de la base | Sí | Organización (sede) | Ajustes → Organización y sedes | Soportar varias sedes; el QR se genera solo |
| Fichaje habilitado (base) | Sí | Sede | Ídem | — |
| Valor de mano de obra (OS) | Sí, pero no así | Organización con excepciones por cliente | Comercial → Tarifas | Una regla (FU8) |
| Vistas por rol | Sí | Organización | Ajustes → Accesos | Matriz única con funciones |
| Ubicación y sección de cada vista | No | — | — | Eliminar (E5) |
| Tema de color | Opcional | **Usuario** | Menú del usuario | — |
| Stock negativo (interruptor) | No | — | — | Solo permiso (E15) |
| Listas de precios | Sí | Organización | Comercial → Ajustes | — |
| Lista de precios por cliente | Sí | Cliente | Ficha de cliente | — |
| Lista de precios por proyecto | Parcial | Proyecto | Proyecto | Por defecto la del cliente (ya es así); que solo se vea si difiere |
| % sobre materiales por cliente | Sí | Cliente | Ficha de cliente | — |
| Crédito y plazo del cliente | Sí | Cliente | Ficha de cliente | Plazo por defecto de la organización |
| Responsables del portal y sectores | Sí | Cliente | Ficha de cliente | Sectores como "sitios" con geocerca reutilizable |
| Almacenes y ubicaciones | Sí | Organización | Logística → Ajustes | — |
| Categorías de mano de obra | Sí | Organización | Comercial → Tarifas | Base de FU8 |
| Tarifas de viáticos | Sí | Organización | Personas → Ajustes | — |
| Códigos de gasto | Sí | Organización | Finanzas → Ajustes | — |
| Estructura documental ("accesos") | Sí | Organización | Calidad → Ajustes | Renombrar "Estructura documental" o "Mapa de procesos" |
| Plantillas de checklist | Sí | Proceso | Calidad → Documentos | — |
| Catálogo de EPP (vigencia, global/específico) | Sí | Organización | Personas → EPP → Ajustes | — |
| Prompts de IA | Rara vez | Organización | Ajustes → IA (solo admin) | Que la API verifique el rol de la sesión (X2) |
| Interruptores del proyecto (OS, provisión, fichaje, fijo, métricas) | Parcial | Proyecto | Proyecto → Ajustes | Valores por tipo de proyecto; geocerca tomada del sitio del cliente |
| Horas consumidas | No | — | — | Calcular (E7) |
| Favoritos, recientes, menú fijo, columnas, filtros | Sí | **Usuario** | Donde están | Guardar por `id` de usuario y no por `legajo` (X11). Hoy viven en el dispositivo; PROPUESTA: guardarlos en el servidor para que acompañen a la persona |
| Notificaciones push | Sí | Usuario | Menú del usuario | PROPUESTA: elegir qué avisos recibir |

**Resumen por nivel:**

- **Organización (global):** sedes y fichaje, accesos por rol, catálogos compartidos, avisos automáticos, IA, datos.
- **Por dominio:** listas de precios y tarifas (Comercial), almacenes (Logística), tarifas de viáticos y causas de ausencia (Personas), códigos de gasto (Finanzas), estructura documental (Calidad), tipos de proyecto (Proyectos).
- **Por objeto:** cliente (lista, %, crédito, portal, sitios), proyecto (tipo, sitio, excepciones), persona (rol, categoría, excepciones de acceso).
- **Por usuario:** tema, favoritos, menú, columnas, avisos.
- **Eliminadas o automáticas:** hora de la alerta, ubicación de vistas, impacta métricas, stock negativo global, horas consumidas, estados de riesgo, habilitar cliente para OT, PIN por defecto.

---

## 8. Navegación y UX

### 8.1 Evaluación de la arquitectura actual

| Aspecto | Estado actual | Problema |
|---|---|---|
| Menú principal | 43 vistas en 7 secciones plegables; favoritos arriba | Un supervisor ve 42 entradas. El criterio (cláusulas ISO) no coincide con las tareas |
| Submenús | Pestañas internas muy desparejas: Calidad 12, Configuración 7 (+5 dentro de Desplegables), Proyectos 7 (como rutas), OKR 6, Almacén 6, Panel 4, Gastos 3; Ventas tiene además su propia barra con 5 pantallas que ya están en el menú | Dos niveles de navegación para lo mismo en Ventas; Calidad es un sistema entero dentro de una pestaña |
| Jerarquía | Casi todo a 1 o 2 niveles, salvo OT: Órdenes de Trabajo → cliente → proyecto → orden (4 niveles) | Para encontrar una OT por número hay que saber de qué cliente y proyecto es |
| Nombres | "Gestión de…" en 5 entradas; "Aprobaciones" (solo fichadas); "Auditoría de IA – Validación inteligente" (es consumo); "Formación Integral" (es "Mis capacitaciones"); "Mis Proyectos (Resp.)"; "Riesgos" (dos conceptos); "Accesos" de documentos (es una estructura de carpetas); menú "Gestión de Usuarios" vs. título "Gestión de Operadores"; menú "Calidad y Documentación" vs. título "Gestión Operativa y Calidad" | El usuario tiene que aprender el vocabulario interno |
| Inicio | Grilla de tarjetas que repite el menú, con favoritos y recientes | No muestra trabajo pendiente. "Recientes" no funciona (X11) |
| Encabezado | Buscador (vistas y acciones), sincronización, campana, ayuda, ticket rápido, tema, migas de pan | Bien resuelto; es el lugar natural para avisos y soporte |
| Búsqueda | La paleta busca vistas, comandos y registros recientes de la sesión | No busca registros: no se puede escribir "OT-2026-0012", un cliente o un producto y llegar |
| Acciones principales | `ModuleHeader` con acciones en parte de las pantallas; botones y títulos propios en otras (Configuración, Usuarios, Clientes, OS, OT, Planificación, Ventas, Fichado, Registro de Tiempos, entre muchas) | El botón principal cambia de lugar y estilo entre módulos |
| Formularios | Modales para entidades chicas; páginas para las complejas (asistente, OS, OT, informes) | El formulario de proyecto es largo y con interruptores sin explicación; el modal de cliente en OT tiene 4 pestañas |
| Confirmaciones | Tres componentes distintos: `components/ConfirmDialog.tsx` (20 usos), `components/ConfirmModal.tsx` y `components/ui/ConfirmModal.tsx` | Confirmar se ve y se comporta distinto según la pantalla |
| Filtros | Persisten por vista (`useViewState`) | Bien |
| Acciones masivas | Solo en Ventas (precios por lote, importación), devoluciones de materiales y gastos | No hay en Aprobaciones (se aprueba de a una), personas, proyectos, órdenes ni tareas |
| Atajos | Comandos contextuales por pantalla (`Ctrl+N` para "nuevo") | Bien; conviene unificar los nombres |

### 8.2 Problemas de navegación más costosos

1. **Funcionalidades escondidas:** la configuración del cliente dentro de OT; el control horario como botón dentro de Registro de Tiempos; las plantillas de checklist en la pestaña 10 de Calidad; las tarifas de viaje en un ícono sin texto.
2. **Volver constantemente a otras pantallas:** el ciclo presupuesto → proyecto → planificación → órdenes → cuenta corriente (F3) salta entre 5 secciones.
3. **Conceptos duplicados en el menú:** OS y OT; Cotizaciones y Presupuestos; Gestión de Sugerencias y Oportunidades; Aprobaciones, Monitoreo y Control horario; Mis Proyectos y Gestión de Proyectos.
4. **Menú demasiado grande para roles de gestión** y demasiado genérico para el operario, que tiene 15 entradas cuando su día se resume en fichar, cargar horas y ver su proyecto.

La arquitectura alternativa está en la sección 13.

---

## 9. Roles y permisos

### 9.1 Modelo actual

```
Usuario (Operator)
  └─ rol: texto libre en la base (operador | supervisor | admin | qa | vendedor)
        ├─ Vistas: roles por vista en lib/viewAccess.ts, editables en Configuración → Vistas (se guardan en ConfigOption)
        └─ Funciones: 28 en lib/permisos.ts, con roles por defecto SOLO en el código
  └─ Permisos especiales (OperatorPermiso): permitir / denegar por vista o función, ganan sobre el rol
```

**El modelo conceptual es correcto y suficientemente simple.** `Usuario → Rol → Permisos + excepción por persona` cubre los casos reales sin niveles adicionales (grupos, jerarquías de roles, permisos por registro). No recomiendo agregar niveles.

### 9.2 Dónde está la complejidad real

No en el modelo, sino en **cómo se aplica**. Hoy conviven **siete mecanismos**:

| # | Mecanismo | Dónde | Respeta permisos especiales |
|---|---|---|---|
| 1 | Roles por vista | `lib/viewAccess.ts` + Configuración → Vistas | Sí |
| 2 | Funciones del catálogo | `lib/permisos.ts` + `getAcceso`/`puede` | Sí |
| 3 | `requireSGIRole` con listas fijas | Calidad (`/api/sgi`), OKR, datasets, diccionario | No |
| 4 | Listas de roles propias de un módulo | `VIAJE_GESTORES`, `PLIEGO_ROLES_*`, `lib/inventario/permisos.ts`, `getActorRRHH`, `eppSesion` | Parcial |
| 5 | Comparaciones de rol en pantallas | 86 escritas a mano en 22 archivos, con el rol de `localStorage` | No |
| 6 | Roles por pestaña dentro de una pantalla | Calidad, OKR, Herramientas | No |
| 7 | PIN de supervisor | Ventas (anular, cambiar precio) | Complementa |

Y más de 100 rutas sin ninguno (X1), más las que confían en el rol enviado por el navegador (X2).

### 9.3 Problemas concretos

| Problema | Efecto | Tipo |
|---|---|---|
| El servidor no verifica la mayoría de las operaciones | Ocultar una vista no protege los datos | Arquitectura / seguridad |
| Rol congelado en la sesión durante 30 días renovables (X3) | Cambiar un rol o dar de baja a alguien no tiene efecto inmediato | Arquitectura |
| Supervisor y QA pueden crear administradores (X5) | El permiso fino "Administrar accesos" se puede saltear | Seguridad |
| Dos lugares para editar accesos (Configuración → Vistas por rol; llave de Usuarios por persona) y un tercero (el código) para funciones por rol | El administrador no tiene una vista única de "quién puede qué" | UX |
| Granularidad despareja | Almacén tiene 10 funciones y presupuestos 4; proyectos 1; clientes, órdenes, configuración, gastos y documentos 0 | Arquitectura |
| `supervisor` y `qa` ven casi lo mismo (42 y 40 vistas); en funciones, supervisor tiene 13 más (ventas, presupuestos, stock, control horario) | No queda claro para qué existe cada rol: QA ve casi todo el sistema, incluidos usuarios y configuración, pero no puede operar lo comercial | Funcional |
| El administrador no ve Fichado; el supervisor ve más que el administrador | Inconsistencia de roles por defecto | Funcional |

### 9.4 Propuesta

1. **Mantener** `Usuario → Rol → Permisos + excepción`.
2. **Un solo mecanismo de aplicación:** toda API pasa por `getAcceso(req)` con el rol leído de la base (o un token de vida corta), nunca del cuerpo ni de la URL. Reemplazar `requireSGIRole`, `VIAJE_GESTORES`, `PLIEGO_ROLES_*` y las comparaciones en pantallas por funciones del catálogo.
3. **Granularidad uniforme por dominio (PROPUESTA):** tres niveles por módulo — **ver**, **operar** (crear y editar lo propio o lo asignado), **administrar** (todo, incluidos los ajustes del módulo) — más un puñado de funciones sensibles explícitas: anular, aprobar, cambiar precios, asignar roles, exportar datos personales. Con 9 módulos son ≈ 27 permisos + ≈ 10 sensibles: menos que hoy si se cuenta lo implícito, y todos visibles.
4. **Una sola pantalla de accesos** (Ajustes → Accesos, solo admin): matriz rol × permiso, editable, con los valores del código como punto de partida; pestaña de excepciones por persona. La llave de la ficha de la persona lleva a la misma pantalla filtrada.
5. **Roles por puesto (PROPUESTA, FALTA INFORMACIÓN):** los cinco roles actuales mezclan puesto (vendedor, operador) con área (qa). Una propuesta a validar con el organigrama: Operario · Supervisor de obra · Comercial · Calidad · Administración (finanzas y personal) · Administrador del sistema. Hace falta saber cuántas personas hay en cada puesto y si la misma persona cubre varios (por ejemplo, si quien hace calidad también supervisa obras).
6. **Asignar roles solo con un permiso específico** (`usuarios.asignar_rol`), y nadie puede asignar un rol con más permisos que el propio.

---

## 10. Modelo mental del usuario

"Si yo fuera el usuario, ¿dónde buscaría esto?" frente a dónde está hoy.

| Tarea | Dónde lo buscaría | Dónde está hoy | ¿Exige conocer la arquitectura? |
|---|---|---|---|
| Fichar al llegar a la obra | Al abrir la app | Operaciones → Fichado (o tarjeta en Inicio) | Poco |
| Corregir una carga de horas | En mis horas | Registro de Tiempos → pedir modificación (no funciona) | Sí |
| Ver qué tengo pendiente hoy | En Inicio | Repartido: campana, Tareas, Mis EPP, Mis Viajes, Formación | Sí |
| Darle a un técnico el valor hora para un cliente | En la persona o en el cliente | Gestión → Órdenes de Trabajo → cliente → Configurar → Valores hora | **Mucho** |
| Cargar el CUIT de un cliente | En el cliente | No existe; se escribe en cada venta | — |
| Saber cuánto me debe un cliente | En el cliente | Ventas → Cuentas Corrientes | Algo |
| Cobrar un servicio terminado | En el proyecto o en el cliente | OS → Cobro, y después cargo manual en Cuentas Corrientes | **Mucho** |
| Encontrar la OT 0012 | En un buscador o en "Órdenes" | Órdenes de Trabajo → cliente → proyecto → OT | Sí |
| Saber si hay stock de un material | En Stock o en el producto | Ventas → Almacén (bajo "Ventas") | Algo |
| Pedir materiales para mi obra | En mi proyecto | Logística → Provisión de Materiales | Algo |
| Agregar un motivo de demora nuevo | En el formulario de demoras | Administración → Configuración → Desplegables → Motivos de Demora | **Mucho** |
| Cambiar lo que puede ver un usuario | En el usuario | Llave (solo admin) o Configuración → Vistas | Sí |
| Dejar una sugerencia de mejora para la empresa | "Sugerencias" | Hay tres: Gestión de Sugerencias, pizarra pública, Tickets tipo "sugerencia" | Sí |
| Reportar una falla del sistema | En "Ayuda" | Tickets de Soporte (en Calidad) o el botón del encabezado | Algo |
| Ver los riesgos de una obra | En el proyecto | Pestaña "Riesgos" de Proyectos (que son bloqueos), distinta de la matriz de Calidad | Sí |
| Cargar una factura de proveedor | En "Gastos" o "Compras" | Administración → Gastos y Facturas | Algo |
| Ver cuánto se gastó en un viaje | En el viaje | Viajes → viaje → gastos (separado de Gastos y Facturas) | Algo |

**Conclusión:** en las tareas de gestión y administración, el usuario necesita saber qué módulo "es dueño" de cada dato. La propuesta invierte esto: **el objeto es dueño de su información** (cliente, persona, proyecto) y los módulos son vistas sobre esos objetos.

---

## 11. Complejidad necesaria vs. accidental

| Área | Necesaria (la exige el negocio o la norma) | Accidental (la generó la construcción) |
|---|---|---|
| Fichado | Validación GPS/QR, dispositivo, alertas de fraude, trabajo sin conexión | Validar contra un JSON de planificación desconectado del equipo asignado |
| Horas | Distinguir presencia de imputación cuando hay varios proyectos por día | Cuatro capturas, tres pantallas de conciliación, horas sumadas dos veces, campo editable a mano |
| Órdenes | Firma del cliente, integridad, ciclos para contratos | Dos modelos, dos firmas, dos tarifas, navegación de 4 niveles |
| Presupuestos | Versiones, aceptación con copia congelada, conversión a proyecto | Dos módulos de presupuesto |
| Clientes | Lista de precios, crédito, portal, sectores | Configuración repartida en 3 módulos; sin datos fiscales |
| Personas | Rol, accesos, EPP, capacitación | Sin ficha única; RRHH sin legajo |
| Materiales y stock | Kardex, conteos, reversas, devoluciones | Tres stocks, dos fuentes de precio, ningún consumo integrado |
| Calidad | NC, CAPA, riesgos, documentos controlados, competencias (ISO 9001) | Objetivos duplicados con OKR; sugerencias vs. oportunidades; 12 pestañas en una pantalla |
| Permisos | Rol + excepción por persona, PIN de supervisor | Siete mecanismos de aplicación; la mayoría sin verificación en el servidor |
| Configuración | Catálogos, tarifas, sedes, accesos | Mezcla de niveles en una pantalla; configuraciones sin efecto (impacta métricas, hora de alerta) o sin pantalla (stock negativo) |
| Estados | Estados propios de cada proceso | Mismo concepto escrito distinto en cada módulo (sección 12) |
| Tareas | — | Seis entidades de "algo por hacer" sin vista unificada |

**Entidades que deberían combinarse:** `Proveedor` + `ProveedorVentas`; `ObjetivoCalidad` + `Okr/Kpi`; `AccionMejora` + `PlanAccionKpi` (+ `Tarea` con origen); tarifas (`SystemSetting.valorManoObra` + `ManoObraCategoria` + `ClientOperatorRate`); `ClientDelay` como tipo de `ProjectLog`; `OrdenServicio` + `OrdenTrabajo` (a confirmar); `Cotizacion` + `PresupuestoServicio` (a confirmar).

**Entidades que deberían separarse o crearse:** legajo de la persona (hoy no existe); sitio o sede del cliente con geocerca (hoy `ClientSector` sin ubicación y geocerca repetida en cada proyecto); tipo de proyecto (hoy implícito en interruptores).

**Entidades que sobran:** `MaterialMaestro`, `TagChecklistItem`, `FavoriteBlock` si se integra con plantillas de proyecto (a evaluar), `Planning.blocks` como JSON (debería ser una tabla de asignaciones por día para poder consultarla y validarla).

---

## 12. Consistencia del sistema

| Concepto | Cómo se comporta en distintos módulos | Recomendación |
|---|---|---|
| **Crear** | Modal (usuarios, clientes, etiquetas, viajes), página (proyecto, OS, OT, informe, producto, vacante), asistente (proyecto nuevo), en línea (configuración) | Modal para entidades de pocos campos; página o asistente para las que generan documentos. Botón principal siempre en `ModuleHeader` |
| **Editar** | En el mismo modal (usuarios, clientes), en una ficha (presupuestos, viajes), en línea (configuración, precios rápidos) | Ficha con secciones editables |
| **Eliminar** | Borrado físico sin rastro (clientes), borrado físico en cascada con auditoría (personas, proyectos, documentos), anulación con motivo (ventas, cuentas corrientes), reversa (stock), cancelación (viajes, tickets), baja lógica (tarifas por cliente) | **Nunca borrar lo que tiene historia:** archivar o anular con motivo. Borrar solo borradores |
| **Activar / desactivar** | Booleano `activo` (personas, clientes, productos, proveedores, etiquetas, opciones) y, en proyectos, además un `estado` | Un solo mecanismo por entidad |
| **Archivar** | Solo existe en notificaciones (`archivedAt`) | Agregar "archivado" a clientes, personas, proyectos |
| **Estados** | Minúsculas con guion bajo (`por_hacer`, `en_progreso`), mayúsculas (`ABIERTA`, `PENDIENTE_FIRMA`), título con espacios (`En evaluación`, `En Curso`); mismo concepto con palabras distintas: `cerrado`/`CERRADA`/`Cerrado`/`completada`/`Implementada` | Un vocabulario común (borrador, pendiente, en curso, en revisión, cerrado, cancelado) y un componente de estado único |
| **Aprobar** | PIN de supervisor (ventas), pantalla de Aprobaciones (fichadas), notificación con botones (horas), modal de autorización (finalizar proyecto), "confirmado por supervisor" (checklist) | Un patrón: el pedido queda en la bandeja del aprobador con aprobar/rechazar y motivo, y el solicitante ve el estado |
| **Confirmar** | Tres componentes de confirmación distintos | Uno solo (`Dialog` de `@/components/ui`) |
| **Firmar** | Imagen + DNI por link (OS), portal con hash (OT), acta (EPP), firma electrónica de documentos (`DocumentSignatureAudit`), copia congelada con hash (presupuestos) | Un servicio de firma con el mismo sellado y la misma verificación pública |
| **Asignar** | Bloques de planificación (JSON), equipo del proyecto (`ProyectoAsignacion`), responsable del proyecto, involucrados de tareas, operadores de OS/OT | El equipo del proyecto alimenta la agenda y la precarga de órdenes |
| **Buscar** | Buscador por pantalla; paleta global sin registros | Paleta con búsqueda de registros (sección 17) |
| **Filtrar** | Persistente por vista (bien), con controles distintos en cada pantalla | Barra de filtros común |
| **Numeración** | `OT-2026-0001` (4 dígitos), `VTA-2026-000001`, `COT-…`, `REC-…`, `MOV-…` (6 dígitos), proyectos y OS con código opcional | Un formato y un contador común |
| **Nombres de campos** | `Sugerencia` usa `snake_case` (`fecha_creacion`, `usuario_id`); el resto `camelCase` | Normalizar en la próxima migración del módulo |
| **Encabezado de pantalla** | `ModuleHeader` en parte; `h1`/`h2` propios en Configuración, Usuarios, Clientes, OS, OT, Ventas y otras | `ModuleHeader` en todas (regla de `AGENTS.md`) |
| **Control de acceso en pantalla** | `useAcceso()` en parte; `localStorage` + comparación de rol en otras | Solo `useAcceso()` |

---

## 13. Arquitectura funcional propuesta

### 13.1 Reglas de diseño

1. **Un objeto, una ficha.** Cliente, persona, proyecto, producto, proveedor y orden tienen una sola pantalla donde se ve y se hace todo lo suyo.
2. **La configuración vive junto a lo que configura.** Cada módulo tiene su "Ajustes"; Ajustes global solo tiene lo transversal.
3. **"Mis…" es un filtro, no un módulo.** "Mis proyectos" es la lista de Proyectos filtrada; "Mis horas" es Asistencia filtrada a uno mismo.
4. **Lo pendiente llega a Inicio.** Nadie tiene que recorrer módulos para saber qué tiene que aprobar, firmar o hacer.
5. **Un dato se captura una vez.** Las horas, los materiales y los importes se precargan en el paso siguiente.
6. **Nada con historia se borra.** Se archiva o se anula con motivo.
7. **Permisos por módulo (ver, operar, administrar) más unas pocas funciones sensibles, siempre verificados en el servidor.**

### 13.2 Menú propuesto

```
Encabezado (siempre visible):  Buscar registros y acciones · Avisos · Ayuda y soporte · Mi cuenta

1. Inicio        "Mi día": pendientes, acción principal del rol, mis proyectos de hoy, mis horas
2. Proyectos     Proyectos · Agenda del equipo · Órdenes · Informes técnicos
3. Personas      Personas · Asistencia y horas · EPP · Viajes y viáticos · Selección
4. Comercial     Clientes · Presupuestos · Pliegos · Punto de venta · Productos y precios
5. Logística     Stock · Pedidos a obra · Herramientas y carros
6. Finanzas      Facturación y cobros · Cuentas corrientes · Gastos y facturas · Proveedores
7. Calidad       Documentos · Mejora · Riesgos · Formación y competencias · Auditoría
8. Indicadores   Tablero general · Objetivos e indicadores · Reportes
9. Ajustes       Organización y sedes · Accesos · Avisos automáticos · IA · Datos
```

| Rol | Módulos que ve | Hoy |
|---|---|---|
| Operario | Inicio, Proyectos (los suyos), Calidad (documentos y su formación) — 3 | 15 vistas en 5 secciones |
| Vendedor | Inicio, Comercial, Logística (consulta), Finanzas (cuentas corrientes) — 4 | 12 vistas en 6 secciones |
| Supervisor / QA | 8 (todo menos Ajustes) | 40–42 vistas en 7 secciones |
| Administrador | 9 | 41 vistas en 7 secciones |

### 13.3 Detalle por módulo

#### 1. Inicio ("Mi día")

- **Propósito:** que cada persona vea y resuelva su trabajo sin navegar.
- **Contiene:** la acción principal de su rol (estado de la jornada y botón de fichar; "Nueva venta"; "Nuevo presupuesto"); **bandeja de pendientes** (fichadas a aprobar, correcciones de horas pedidas, finalizaciones pedidas, actas de EPP por firmar, viajes por rendir, capacitaciones vencidas, acciones y tareas vencidas, bloqueos en mis proyectos, documentos por leer); mis proyectos de hoy según la agenda; mis horas de la semana; favoritos.
- **No contiene:** la grilla de módulos (para eso está el menú) ni tableros de dirección.
- **Usuarios:** todos.
- **Acciones principales:** fichar, confirmar horas del día, aprobar o rechazar en el lugar, abrir el pendiente.

#### 2. Proyectos

- **Propósito:** ejecutar obras y servicios de punta a punta.
- **Contiene:** lista de proyectos (filtros: míos, por cliente, estado, tipo; vistas lista, tablero y cronograma); Agenda del equipo (planificación diaria y semanal, carga por persona, mensaje de WhatsApp); Órdenes (OS y OT unificadas, lista global con número, cliente, estado de firma y de cobro); Informes técnicos (lista global).
- **Ficha del proyecto:** Resumen (avance, horas, costo, bloqueos) · Alcance y checklist · Equipo y agenda · Horas · Materiales (pedido, entrega, uso, devolución) · Órdenes · Bitácora (notas, bloqueantes, demoras del cliente) · Documentos (informes, pliego) · Costos (presupuestado vs. real) · Ajustes (tipo, sitio y fichaje, lista de precios).
- **Ajustes del módulo:** tipos de proyecto, especialidades, checklists por tipo o especialidad, áreas y motivos de demora.
- **No contiene:** tableros de dirección (Indicadores), stock (Logística), deuda del cliente (Finanzas; la ficha la muestra en solo lectura).
- **Usuarios:** supervisores (todo), operarios (sus proyectos), QA (consulta).
- **Acciones principales:** crear proyecto (asistente, con modo rápido), asignar equipo, registrar bitácora, emitir orden, pedir o autorizar finalización.

#### 3. Personas

- **Propósito:** todo lo de la gente: quién es, qué puede hacer, dónde y cuánto trabajó, con qué equipamiento y formación.
- **Contiene:** Personas (lista y ficha: datos y legajo, acceso, especialidades y competencias, categoría y tarifas, asistencia, EPP, formación, viajes); Asistencia y horas (Hoy, Excepciones, Período); EPP (matriz, solicitudes, actas, enlaces); Viajes y viáticos; Selección (vacantes y postulantes).
- **Ajustes del módulo:** causas de ausencia, tarifas de viáticos, catálogo de EPP, plantillas de mensajes de selección.
- **No contiene:** la definición de roles (Ajustes → Accesos) ni los cursos (Calidad → Formación), aunque la ficha muestra ambos.
- **Usuarios:** supervisores, administración y RRHH, administrador.
- **Acciones principales:** alta de persona, aprobar excepciones de asistencia, entregar EPP, planificar y aprobar viajes.

#### 4. Comercial

- **Propósito:** vender.
- **Contiene:** Clientes (ficha 360: datos fiscales, comercial, sitios, portal, proyectos, órdenes, presupuestos, cuenta corriente); Presupuestos (de servicio y de productos); Pliegos (análisis con IA, origen de un presupuesto); Punto de venta; Productos y precios.
- **Ajustes del módulo:** listas de precios, tarifas de mano de obra, condiciones comerciales por defecto.
- **No contiene:** existencias y movimientos (Logística), cobranza global (Finanzas).
- **Usuarios:** vendedores, supervisores, dirección.
- **Acciones principales:** nuevo cliente, nuevo presupuesto, convertir en proyecto o venta, vender en mostrador, actualizar precios.

#### 5. Logística

- **Propósito:** que los materiales y herramientas estén donde hacen falta.
- **Contiene:** Stock (existencias, movimientos, conteos, faltantes, transferencias); Pedidos a obra (vista global de la provisión de todos los proyectos); Herramientas y carros.
- **Ajustes del módulo:** almacenes y ubicaciones.
- **No contiene:** precios de venta (Comercial).
- **Usuarios:** depósito, supervisores, vendedores (consulta).
- **Acciones principales:** entregar a obra, recibir devoluciones, contar, ajustar, prestar herramientas.

#### 6. Finanzas

- **Propósito:** lo que entra y lo que sale.
- **Contiene:** Facturación y cobros (órdenes firmadas pendientes de facturar o cobrar, ventas a cuenta, recibos); Cuentas corrientes; Gastos y facturas de proveedores (alta, escaneo, importación); Proveedores (maestro único).
- **Ajustes del módulo:** códigos de gasto, plazos por defecto.
- **Usuarios:** administración, dirección, vendedores (cobro en mostrador).
- **FALTA INFORMACIÓN:** si la misma persona hace ventas y administración, Comercial y Finanzas pueden ser un solo módulo ("Comercial y cobranzas") sin perder claridad.

#### 7. Calidad

- **Propósito:** el sistema de gestión ISO 9001.
- **Contiene:** Documentos (biblioteca, vencimientos, historial, plantillas de checklist); Mejora (NC, acciones, oportunidades, sugerencias, con su pizarra pública); Riesgos; Formación y competencias (cursos, matriz, y "mi formación" para cada persona); Auditoría (bitácora de cambios y verificación de firmas).
- **Ajustes del módulo:** estructura documental, tipos de hallazgo.
- **No contiene:** objetivos e indicadores (Indicadores), soporte del software (encabezado).
- **Usuarios:** QA y supervisores; todos para documentos y su formación.

#### 8. Indicadores

- **Propósito:** ver cómo va el negocio y decidir.
- **Contiene:** Tablero general (lo que hoy es el Panel de Análisis, con los tableros de proyectos, servicios, personas y comercial); Objetivos e indicadores (OKR, KPI y objetivos de calidad); Reportes y exportaciones.
- **Usuarios:** dirección, supervisores, QA.

#### 9. Ajustes (solo administrador)

- **Contiene:** Organización y sedes (datos de la empresa, sedes con geocerca y QR); Accesos (matriz de roles y permisos, excepciones por persona); Avisos automáticos (recordatorio de horas, umbrales); IA (prompts y consumo); Datos (motor de datasets, diccionario); Sistema (dispositivos registrados, integraciones).
- **No contiene:** nada que pertenezca a un solo módulo.

---

## 14. Matriz actual vs. propuesta

| Módulo actual | Función actual | Problema | Acción | Nuevo módulo | Prioridad |
|---|---|---|---|---|---|
| Inicio | Grilla de módulos, favoritos, recientes | No muestra pendientes; recientes rotos | Separar y rediseñar ("Mi día") | Inicio | Alto |
| Notificaciones | Bandeja de avisos | Duplica la campana; lee avisos de cualquier usuario | Eliminar del menú, proteger API | Encabezado | Alto (API: Crítico) |
| Fichado | Jornada GPS/QR | Valida contra planificación desconectada | Mantener, integrar con asignaciones | Inicio (acción) + Personas | Alto |
| Registro de Tiempos | Carga de horas | Doble captura; rol enviado por el navegador | Simplificar (propuesta desde la fichada), proteger API | Inicio + Personas → Asistencia | Crítico (API) |
| Control horario | Cruce y ajuste | Escondido como botón | Fusionar | Personas → Asistencia y horas | Alto |
| Aprobaciones | Fichadas con alertas | Aprobador desde el cuerpo; sin acciones masivas | Fusionar | Personas → Asistencia + Inicio | Alto |
| Monitoreo de Fichadas | Tiempo real y cruce | En Trazabilidad, lejos de Aprobaciones | Fusionar | Personas → Asistencia ("Hoy") | Alto |
| Mis Proyectos (Resp.) | Vista del responsable | Duplica el detalle; pedidos rotos | Fusionar | Proyectos (filtro "míos" + ficha) | Alto |
| Gestión de Proyectos | Proyectos y 6 pestañas | Pestañas globales; alta doble; horas editables | Simplificar, Renombrar | Proyectos | Alto |
| Planificación | Agenda diaria | No recibe asignaciones | Mover, Automatizar | Proyectos → Agenda del equipo | Alto |
| Demoras del Cliente | Registro de demoras | Es una entrada de bitácora | Fusionar | Proyectos → Bitácora | Medio |
| Informes Técnicos | Relevamientos | También aparece como "Documentación" | Mover | Proyectos | Medio |
| Órdenes de Servicio | Certificación y cobro | Duplica OT; finaliza el proyecto; suma horas | Fusionar | Proyectos → Órdenes | Alto |
| Órdenes de Trabajo | Certificación por ciclos | Duplica OS; config de cliente adentro; 4 niveles | Fusionar | Proyectos → Órdenes | Alto |
| Tareas | Tareas generales | 6 conceptos de tarea; `?role=admin` | Simplificar, proteger API | Inicio ("Mis tareas") | Medio (API: Crítico) |
| Panel de Análisis | Métricas | Uno de seis tableros | Mover | Indicadores | Medio |
| OKR y KPI | Objetivos medidos | Duplica Objetivos de Calidad | Fusionar | Indicadores | Medio |
| Motor de Datasets | Consultas para KPI | Técnico en el menú de negocio | Mover | Ajustes → Datos | Bajo |
| Diccionario de Datos | Metadatos | Técnico | Mover | Ajustes → Datos | Bajo |
| Gestión de Usuarios | Personas y acceso | Escalada de rol; borrado en cascada; sin ficha | Fusionar, Renombrar | Personas | Crítico (permisos) / Alto |
| Recursos Humanos | Selección y EPP | "Personal" vacío | Fusionar | Personas | Alto |
| Mis EPP | Autoservicio | — | Mantener (como sección de Inicio) | Inicio | Bajo |
| Viajes y Viáticos | Viajes | Lista de roles propia | Mover | Personas | Bajo |
| Mis Viajes | Autoservicio | — | Mantener (como sección de Inicio) | Inicio | Bajo |
| Gestión de Clientes | Datos básicos | Sin datos fiscales; configuración repartida; API sin control | Fusionar (FU6), Renombrar | Comercial → Clientes | Alto (API: Crítico) |
| Gestión Comercial | Productos y precios | Doble navegación | Renombrar | Comercial → Productos y precios | Medio |
| Punto de Venta | Mostrador | No descuenta stock | Automatizar | Comercial | Alto |
| Cotizaciones | Presupuestos de productos | Duplica Presupuestos | Fusionar | Comercial → Presupuestos | Medio |
| Presupuestos de servicios | Presupuestos de servicio | — (bien hecho) | Fusionar como tipo | Comercial → Presupuestos | Medio |
| Análisis de Pliegos | Pliegos con IA | No conecta con Presupuestos | Mover, integrar | Comercial → Pliegos | Medio |
| Almacén y Stock | Existencias | Bajo Ventas; nadie lo mueve | Mover, Automatizar | Logística → Stock | Alto |
| Cuentas Corrientes | Saldos y cobranzas | No recibe servicios | Mover, Automatizar | Finanzas | Alto |
| Inventario (desactivada) | — | Su tabla sigue en uso | Eliminar | — | Alto |
| Provisión de Materiales | Materiales por obra | No mueve stock | Mover, Automatizar | Proyectos (ficha) + Logística (vista global) | Alto |
| Herramientas y Carros | Préstamos y verificación | — | Mantener | Logística | Bajo |
| Gastos y Facturas | Facturas de proveedores | Proveedores duplicados; API sin control | Mover, Fusionar proveedores | Finanzas | Alto (API: Crítico) |
| Calidad y Documentación | SGI en 12 pestañas | Sobrecargada | Separar | Calidad (4 entradas) | Medio |
| Formación Integral | Mis capacitaciones | Nombre poco claro | Renombrar, Mover | Calidad → Formación ("Mi formación") + Inicio | Bajo |
| Gestión de Sugerencias | Ideas ISO | Solapa con Oportunidades y Tickets | Fusionar | Calidad → Mejora | Medio |
| Tickets de Soporte | Soporte del software | En Calidad | Mover | Encabezado → Ayuda y soporte | Bajo |
| Centro de Ayuda | Base de conocimiento | En Calidad | Mover | Encabezado → Ayuda y soporte | Bajo |
| Auditoría | Bitácora de cambios | API sin control | Mover, proteger | Calidad → Auditoría | Medio (API: Crítico) |
| Verificación de Firmas | Integridad | — | Fusionar | Calidad → Auditoría | Bajo |
| Auditoría de IA | Consumo de IA | Nombre engañoso | Renombrar, Mover | Ajustes → IA | Bajo |
| Configuración → Etiquetas / Checklists / Desplegables | Catálogos | Lejos de su uso; "impacta métricas" sin efecto | Separar, Mover | Ajustes de Proyectos y Personas | Medio |
| Configuración → Sistema | Alertas y fichaje de la base | Mezcla; hora sin efecto | Separar, Mover | Ajustes → Organización / Avisos | Medio |
| Configuración → Órdenes de Servicio | Valor hora | Tercera tarifa | Fusionar (FU8) | Comercial → Tarifas | Alto |
| Configuración → Vistas | Roles y diseño del menú | Seguridad mezclada con diseño; editable por supervisor | Separar, Eliminar diseño | Ajustes → Accesos | Crítico (permisos) |
| Configuración → Tema de color | Preferencia | Personal en pantalla global | Mover | Mi cuenta | Bajo |

---

## 15. Flujos optimizados

### F3. Del presupuesto al cobro (el más importante)

**Actual (10 módulos, 5 secciones):**
Pliegos → (copiar a mano) → Presupuestos → Asistente → Planificación (reasignar) → Fichado (alerta) → Registro de Tiempos → Aprobaciones / Monitoreo / Control horario → OS u OT (horas otra vez, otra tarifa) → Cuentas Corrientes (cargo manual)

**Propuesto (3 módulos):**
Comercial → Presupuesto (desde el pliego, con tareas precargadas) → Aceptar → Convertir → **Proyecto** (el equipo asignado publica la agenda) → ejecución (la fichada valida contra la asignación; las horas se confirman en Inicio) → Proyecto → **Nueva orden** (precargada con horas confirmadas, materiales usados y la tarifa de la regla única) → firma (link o portal, mismo sellado) → **cargo automático** en la cuenta corriente → Finanzas → cobro

| Qué cambia | Por qué |
|---|---|
| Se elimina la copia manual del pliego | El análisis ya tiene tareas y materiales estructurados |
| Se elimina la reasignación en Planificación | La asignación del proyecto es la fuente (X10) |
| Se elimina la tercera carga de horas | La orden toma las horas confirmadas |
| Se elimina el cargo manual | La orden firmada genera la deuda |
| Se unifica la tarifa | FU8 |
| La OS deja de finalizar el proyecto | La finalización es una acción explícita (o una regla del tipo "servicio puntual") |

### F4. Jornada y control de horas (el más frecuente)

**Actual — operario:** Inicio → Fichado → iniciar → … → finalizar → Registro de Tiempos → nueva carga (proyecto, horas, extra, causa) → guardar.
**Propuesto — operario:** Inicio → **Iniciar jornada** → … → **Finalizar jornada** → el sistema propone "8 h en Proyecto X" (de la fichada y la agenda) → Confirmar (o repartir entre proyectos).

**Actual — supervisor:** Aprobaciones + Monitoreo + Control horario + campana.
**Propuesto — supervisor:** Inicio muestra "5 excepciones de asistencia" → Personas → Asistencia y horas → Excepciones → aprobar o ajustar en el lugar (de a una o varias).

Se eliminan: la segunda captura para el caso común, tres pantallas, y la conciliación manual de lo que el sistema ya sabe. Se mantiene: la validación antifraude y la posibilidad de repartir el día.

### F1. Alta de una persona

**Actual:** Administración → Usuarios → modal → (llave) → OT → cliente → valores hora (× cada cliente) → RRHH → EPP.
**Propuesto:** Personas → **Nueva persona** (datos, rol con descripción de lo que habilita, categoría de mano de obra, especialidades; PIN temporal) → la ficha queda abierta con pendientes sugeridos: "Entregar EPP de ingreso", "Capacitaciones asignadas: 4".

Se elimina la tarifa por cliente (la da la categoría) y la búsqueda de dónde se configura cada cosa.

### F2. Alta de un cliente

**Actual:** Administración → Clientes → modal → Gestión → OT → habilitar → configurar (4 pestañas) → Ventas → Cuentas Corrientes → crédito.
**Propuesto:** Comercial → **Nuevo cliente** (razón social, CUIT, condición de IVA, contacto, lista de precios) → ficha → completar lo que haga falta en sus pestañas (crédito, sitios, portal), todo en la misma pantalla.

### F5. Materiales para una obra

**Actual:** Logística → Provisión → cargar → Mis Proyectos → uso/devolución → (ajuste manual de stock) → OS/OT recargan materiales.
**Propuesto:** Proyecto → Materiales → **Pedir** → depósito **Entrega** (salida de stock automática) → operario registra **uso** → la orden toma lo usado → **devolución** (entrada de stock).

### F7. Dar un acceso

**Actual:** llave en Usuarios (por persona) o Configuración → Vistas (por rol) o el código (funciones por rol).
**Propuesto:** ficha de la persona → Acceso → "Agregar excepción", o Ajustes → Accesos → matriz por rol. Mismo lugar, mismo modelo, verificado por el servidor.

### F8. Pedir y dar una autorización

**Actual:** roto (X6); cuando funcionaba, el pedido era una notificación.
**Propuesto:** el pedido se crea como **solicitud** (tipo, objeto, motivo) → aparece en Inicio del aprobador → aprobar o rechazar con comentario → el solicitante ve el estado en su Inicio. Sirve para corrección de horas, finalización de proyecto, cambio de precio fuera de lista y gastos fuera de política.

### F9. Registrar una demora o un bloqueante

**Actual:** Operaciones → Demoras del Cliente (formulario aparte) o Mis Proyectos → bitácora.
**Propuesto:** Proyecto → Bitácora → **Nueva entrada** → tipo (nota, bloqueante, demora del cliente) → los campos de demora aparecen solo si corresponde → el bloqueante avisa al supervisor.

### F10. Cambiar un parámetro

**Actual:** saber en cuál de las 7 pestañas (o los 13 lugares del módulo) está.
**Propuesto:** el parámetro se cambia **donde se usa**: el motivo de demora desde el formulario de demora ("Agregar motivo", si tenés permiso); la tarifa en Comercial → Tarifas; la geocerca de la base en Ajustes → Sedes. El buscador del encabezado encuentra cualquier ajuste por nombre.

---

## 16. Priorización

Tipos: **F** funcional · **UX** experiencia · **A** arquitectura · **N** navegación · **S** simplificación · **Au** automatización. Esfuerzo estimado: S (días), M (1–3 semanas), L (más de un mes).

### Crítico

| ID | Propuesta | Tipo | Esfuerzo | Referencia |
|---|---|---|---|---|
| P1 | Verificar el permiso en el servidor en toda API que lee datos sensibles o modifica algo (configuración, clientes, proyectos, documentos, gastos, auditoría, tareas, horas, aprobaciones, avisos, dispositivos, capacitaciones) | A | M–L | X1 |
| P2 | Dejar de confiar en el rol o usuario que manda el navegador (`requestUserRole`, `?role=`, `userRole`, `approvedById`, `operatorId` de avisos) | A | S–M | X2 |
| P3 | Leer rol y estado activo de la base en cada pedido (o token de vida corta) y crear el cierre de sesión que borre la cookie | A | S | X3, X4 |
| P4 | Impedir la escalada de rol: solo quien tiene un permiso específico asigna roles, y nunca uno superior al propio | A, F | S | X5 |
| P5 | Restaurar los pedidos rotos (corrección de horas, finalización de proyecto, avisos de bloqueante) | F | S | X6 |
| P6 | Corregir el doble conteo de horas consumidas y quitar la edición manual del campo | F, Au | S | X7 |
| P7 | Reemplazar borrados físicos por archivar o anular en personas, clientes, proyectos y documentos | A | M | X14 |
| P8 | Una sola fuente de precios de materiales: migrar OT, costo de proyecto e importación de provisión de `MaterialMaestro` a `Producto` | F | M | X8 |
| P9 | Integrar consumos con el stock (PDV, entrega a obra, órdenes). **Crítico si el stock se usa para comprar o cobrar; si hoy no se usa, Alto** (FALTA INFORMACIÓN) | F, Au | L | X9 |

### Alto

| ID | Propuesta | Tipo | Esfuerzo |
|---|---|---|---|
| P10 | Reorganizar el menú por dominios (9 módulos). En una primera etapa alcanza con cambiar secciones, nombres y orden en `lib/viewAccess.ts` y sacar del menú lo técnico y lo personal | N | S–M |
| P11 | Inicio "Mi día" con bandeja de pendientes y solicitudes | UX, F | M |
| P12 | Ficha de cliente 360 con datos fiscales; mover la configuración de OT y el crédito a la ficha | F, UX | M |
| P13 | Asistencia y horas en una sola pantalla (Hoy, Excepciones, Período), con acciones masivas | UX, S | M |
| P14 | Que la asignación del proyecto alimente la agenda y la validación del fichado | Au | S–M |
| P15 | Que las órdenes firmadas generen el cargo en cuenta corriente | F, Au | M |
| P16 | Personas con ficha única (fusión de Usuarios y RRHH) | UX, A | M |
| P17 | Unificar los mecanismos de permisos en el catálogo (`requireSGIRole`, listas propias de módulos, comparaciones en pantallas) | A | M |
| P18 | Una sola pantalla de accesos (matriz rol × permiso y excepciones); quitar el diseño del menú de Configuración → Vistas | UX, S | M |
| P19 | Dividir Configuración y llevar cada ajuste a su módulo | S, N | M |
| P20 | Tarifas de mano de obra con una sola regla | F, S | M |
| P21 | Arreglar favoritos y recientes (clave por `id`) | F | S |
| P22 | Lista global de órdenes y búsqueda por número | N | S |
| P23 | PIN temporal generado y cambio obligatorio al primer ingreso | F, A | S |
| P24 | Proveedores únicos | A | M |
| P25 | Ficha del proyecto única (fusión de Mis Proyectos y el detalle) | UX | L |
| P26 | Fusionar OS y OT (después de confirmar el uso de cada una) | A, S | L |

### Medio

| ID | Propuesta | Tipo | Esfuerzo |
|---|---|---|---|
| P27 | Tipo de proyecto con valores por defecto; estados "en riesgo" y "atrasado" calculados; un solo estado | Au, S | M |
| P28 | Bitácora con tipos de entrada (absorbe Demoras); renombrar la pestaña "Riesgos" de Proyectos | S | S |
| P29 | Calidad en cuatro entradas; "Mejora" unifica NC, acciones, oportunidades y sugerencias | N, S | M |
| P30 | Objetivos e indicadores: OKR + objetivos de calidad | S | M |
| P31 | Acciones con origen y "Mis tareas" unificado | S | M |
| P32 | Búsqueda global de registros en la paleta | UX | M |
| P33 | Acciones masivas en aprobaciones, personas, órdenes y tareas | UX | S–M |
| P34 | Vocabulario de estados y componente de confirmación únicos | UX | M |
| P35 | Presupuestos unificados (de productos y de servicio) | S | L |
| P36 | Conectar Pliegos con Presupuestos | F, Au | M |
| P37 | Renombres: Auditoría de IA → Consumo de IA; Formación Integral → Mi formación; "accesos" de documentos → Estructura documental; títulos iguales al menú | UX | S |

### Bajo

| ID | Propuesta | Tipo | Esfuerzo |
|---|---|---|---|
| P38 | Eliminar código y datos sin uso: `TagChecklistItem`, "impacta métricas", `dailyReminderTime`, vista `/inventario` | S | S |
| P39 | Tema y preferencias en "Mi cuenta", guardadas en el servidor | UX | S |
| P40 | Datasets, Diccionario y Consumo de IA a Ajustes; Ayuda y Tickets al encabezado | N | S |
| P41 | Numeración común de documentos | UX | S |
| P42 | Stock de EPP dentro del Almacén | A | M |
| P43 | `ModuleHeader` en todas las pantallas | UX | M |

---

## 17. Funcionalidades faltantes

"Si el sistema pretende ser completo, ¿qué debería poder hacer y hoy no puede?" Todo lo de esta sección es **PROPUESTA**.

### Faltantes críticos

| Faltante | Por qué | Relación |
|---|---|---|
| Facturar servicios a la cuenta corriente | Hoy el trabajo firmado (OS/OT) no se convierte en deuda del cliente; la cobranza de servicios depende de una carga manual | P15 |
| Consumo de stock integrado | El kardex existe, pero ninguna salida real lo mueve | P9 |
| Solicitudes y aprobaciones como objeto propio | Los pedidos de autorización hoy viajan como notificaciones (y están rotos) | P5, P11 |
| Sesiones controlables | Cerrar sesión de verdad; revocar al desactivar o cambiar el rol | P3 |

### Faltantes importantes

| Faltante | Por qué |
|---|---|
| Datos fiscales del cliente y sitios con ubicación | Se tipean en cada documento; la geocerca se repite en cada proyecto |
| Legajo de personal | Fecha de ingreso, contacto de emergencia, vencimientos (aptos médicos, licencias de conducir, ART, habilitaciones). FALTA INFORMACIÓN: qué controla hoy RRHH fuera del sistema |
| Búsqueda global de registros | Encontrar una orden, un cliente o un producto por número o nombre desde cualquier pantalla |
| Archivar y restaurar | Alternativa segura al borrado |
| Horas reales por tarea | Ya previsto como fase 2 en `docs/presupuestos-servicio/README.md`; sin esto, el presupuestado vs. real queda a nivel proyecto |
| Compras y recepción de mercadería | Hoy la entrada de stock es un ajuste manual y la factura del proveedor no se vincula con lo recibido |
| Calendario único de vencimientos | EPP, verificación de herramientas, documentos, capacitaciones, certificados externos, validez de presupuestos, crédito de clientes: hoy cada módulo tiene el suyo o ninguno |
| Portal del cliente completo | Hoy solo muestra OT; podría firmar OS, aceptar presupuestos y ver su estado de cuenta |
| Integración contable o facturación electrónica | FALTA INFORMACIÓN: si se factura en otro sistema, hace falta al menos exportar; si no, es un faltante crítico |

### Nice to have

- Plantillas de proyecto por tipo (tareas, checklists, materiales habituales).
- Preferencias de avisos por persona (qué recibir y por qué canal).
- Delegación de aprobaciones durante ausencias.
- Vista de capacidad del equipo a varias semanas (la disponibilidad del asistente es un buen comienzo).
- Exportación estándar desde cada lista.
- Historial de cambios visible dentro de cada ficha (los datos ya están en `AuditLog`).
- Importación masiva de clientes y personas.

---

## 18. Resultado final

### A. Diagnóstico general

| Dimensión | Estado |
|---|---|
| Cobertura funcional | **Alta.** Cubre operación, comercial, stock, calidad ISO, RRHH, viajes y soporte |
| Calidad de los módulos más recientes | **Alta.** Presupuestos, Almacén, PDV, Cuentas corrientes, Viajes y Pliegos tienen buenos modelos de estado, auditoría y validación |
| Estructura y navegación | **Baja.** 43 vistas organizadas por cláusula ISO; tres secciones genéricas; conceptos duplicados |
| Integración entre módulos | **Baja.** Horas, materiales, tarifas e importes no fluyen de un paso al siguiente |
| Datos maestros | **Baja.** Cliente, persona, proveedor y tarifa fragmentados |
| Control de accesos | **Crítico.** Modelo correcto, aplicación mayormente ausente en el servidor |

El sistema es **potente pero no simple**: tiene casi todo, pero el usuario tiene que conocer cómo se construyó para usarlo.

### B. Los 10 problemas más importantes

1. La mayoría de las APIs no verifica permisos y algunas confían en el rol que manda el navegador (X1, X2).
2. El rol de la sesión no se actualiza, cerrar sesión no la cierra y un supervisor puede crear administradores (X3, X4, X5).
3. Pedidos de autorización rotos por una API inexistente (X6).
4. Horas consumidas contadas dos veces y editables a mano: los indicadores de eficiencia no son confiables (X7).
5. La misma hora se captura hasta cuatro veces y se concilia en tres pantallas (F4).
6. Stock que no se mueve con ventas ni consumos, y dos fuentes de precio de materiales (X8, X9).
7. Ciclo presupuesto → cobro partido en 10 módulos, con tres tarifas y cargo manual en la cuenta corriente (F3).
8. Cliente y persona sin ficha única; cliente sin datos fiscales; persona sin legajo (1.6).
9. Menú por cláusulas ISO, con "Gestión", "Administración" y "Configuración" como cajones genéricos (3.1).
10. Borrados físicos en cascada en un sistema que debe conservar trazabilidad (X14).

### C. Las 10 oportunidades de mayor impacto

1. Verificación de permisos en el servidor con un único mecanismo (P1–P4, P17).
2. Menú por dominios: de 43 entradas a 9 módulos (P10).
3. Inicio como bandeja de pendientes y solicitudes (P11).
4. Horas capturadas una vez, propuestas desde la fichada (P13, P14).
5. Órdenes firmadas que generan la deuda automáticamente (P15).
6. Ficha 360 de cliente con datos fiscales (P12).
7. Ficha única de persona (P16).
8. Stock integrado con todos los consumos y una sola fuente de precios (P8, P9).
9. Una regla de tarifas de mano de obra (P20).
10. Configuración junto a lo que configura, y Ajustes global mínimo (P18, P19).

### D. Módulos que deberían existir

Inicio · Proyectos · Personas · Comercial · Logística · Finanzas · Calidad · Indicadores · Ajustes, más en el encabezado: Buscar, Avisos, Ayuda y soporte, Mi cuenta. Detalle en la sección 13.

### E. Módulos que deberían desaparecer (y adónde va su funcionalidad)

| Desaparece | Su funcionalidad va a |
|---|---|
| Sección "Gestión y Seguimiento" | Proyectos, Personas e Indicadores |
| Sección "Administración" | Personas, Comercial, Finanzas y Ajustes |
| Sección "Auditoría y Trazabilidad" | Calidad → Auditoría, Personas → Asistencia, Ajustes → IA |
| Pantalla "Configuración" | Ajustes de cada módulo y Ajustes global |
| Notificaciones (como entrada de menú) | Campana del encabezado e Inicio |
| Aprobaciones · Monitoreo de Fichadas | Personas → Asistencia y horas, e Inicio |
| Mis Proyectos | Filtro "míos" de Proyectos y la ficha del proyecto |
| Demoras del Cliente | Bitácora del proyecto |
| Inventario de Materiales (desactivada) | Ya reemplazada por Productos y Stock; migrar sus últimos usos |
| Motor de Datasets · Diccionario · Auditoría de IA (como entradas de negocio) | Ajustes → Datos e IA |
| Centro de Ayuda · Tickets (como entradas de menú) | Encabezado → Ayuda y soporte |
| Formación Integral · Mis EPP · Mis Viajes (como entradas propias) | Secciones de Inicio y fichas correspondientes |

### F. Módulos que deberían fusionarse

| Fusión | Resultado |
|---|---|
| Gestión de Usuarios + RRHH | **Personas**, con ficha única |
| Aprobaciones + Monitoreo + Control horario | **Asistencia y horas** |
| Órdenes de Servicio + Órdenes de Trabajo | **Órdenes**, con modalidad única o por períodos (a confirmar) |
| Cotizaciones + Presupuestos de servicio | **Presupuestos**, con tipo |
| Proveedores de gastos + de ventas | **Proveedores** |
| Clientes + configuración de OT + crédito | **Ficha de cliente** |
| Objetivos de Calidad + OKR/KPI | **Objetivos e indicadores** |
| Tres valores hora | **Tarifas de mano de obra** |
| Acciones de mejora + planes de KPI + tareas | **Acciones** con origen |
| Gestión de Sugerencias + Oportunidades | **Mejora** (en Calidad) |
| Mis Proyectos + detalle de Proyectos | **Ficha del proyecto** |
| Auditoría + Verificación de firmas | **Auditoría** (en Calidad) |
| Centro de Ayuda + Tickets | **Ayuda y soporte** |
| Alta clásica + asistente | **Un solo alta** |

### G. Módulos que deberían dividirse

| Módulo | Criterio de división | Resultado |
|---|---|---|
| Configuración | Dueño de la decisión y alcance | Ajustes de cada módulo + Ajustes global + Mi cuenta |
| Calidad y Documentación (12 pestañas) | Proceso ISO | Documentos · Mejora · Riesgos · Formación y competencias |
| Ventas y Comercial | Comercial vs. logística | Comercial y Logística (Stock) |
| Configuración → Vistas | Seguridad vs. diseño | Accesos (se queda) y diseño del menú (se elimina como configuración) |
| Proyecto (interruptores) | Intención explícita | Tipo de proyecto con valores por defecto |
| Ficha de persona | Acceso vs. legajo | Secciones distintas de la misma ficha |

### H. Configuraciones que deberían simplificarse

| Configuración | Cómo |
|---|---|
| Valor de mano de obra (3 lugares) | Una regla: categoría → excepción por cliente → excepción por persona |
| Interruptores del proyecto | Valores por defecto según el tipo de proyecto; geocerca tomada del sitio del cliente |
| Categoría + tipo de actividad + etiquetas | Tipo de proyecto + especialidades |
| Roles por vista + funciones por rol en el código + permisos especiales | Una matriz rol × permiso y excepciones por persona, en una pantalla |
| Ubicación y sección de cada vista | Eliminar |
| "Impacta métricas", hora de la alerta, stock negativo global | Eliminar |
| Habilitar cliente para OT | Deducir |
| PIN por defecto | PIN temporal con cambio obligatorio |
| Tema de color | A Mi cuenta |
| Motivos y áreas de demora, causas de ausencia | Editables desde el formulario que los usa |

### I. Flujos a rediseñar, en orden

1. **Jornada y control de horas** (F4): el más frecuente y el que más trabajo genera al supervisor.
2. **Del presupuesto al cobro** (F3): el ciclo de ingresos del negocio.
3. **Pedir y dar autorizaciones** (F8): hoy roto.
4. **Materiales para una obra** (F5): define si el stock sirve.
5. **Alta de cliente** (F2) y **alta de persona** (F1): definen la calidad de los datos maestros.
6. **Dar accesos** (F7).
7. **Configurar un proyecto** (F6).
8. **Registrar demoras y bloqueantes** (F9) y **cambiar parámetros** (F10).

### J. Funcionalidades faltantes, en orden

1. Facturar servicios a la cuenta corriente.
2. Consumo de stock integrado.
3. Solicitudes y aprobaciones como objeto propio.
4. Sesiones controlables (cierre real y revocación).
5. Datos fiscales y sitios del cliente.
6. Búsqueda global de registros.
7. Archivar y restaurar.
8. Legajo de personal.
9. Calendario único de vencimientos.
10. Horas reales por tarea.
11. Compras y recepción.
12. Portal del cliente completo.
13. Integración contable (según cómo se facture hoy).

### K. Hoja de ruta recomendada

**1. Cambios inmediatos (próximas 2 semanas) — sin cambiar la estructura, cerrar riesgos**

- P1–P4: verificación de permisos en el servidor para configuración, usuarios, clientes, proyectos, horas, aprobaciones, tareas, avisos, auditoría y documentos; rol leído de la base; cierre de sesión real; sin escalada de rol.
- P5: restaurar los pedidos rotos (aunque sea creando la ruta que esas pantallas esperan, sobre el modelo `Activity`).
- P6: corregir el doble conteo de horas y bloquear la edición manual.
- P21: favoritos y recientes por `id`.
- P23: PIN temporal.
- P37 (los más baratos): renombrar "Auditoría de IA", "Formación Integral", la pestaña "Riesgos" de Proyectos y unificar títulos con el menú.

**2. Corto plazo (1–2 meses) — nueva navegación y primeras fichas**

- P10: menú por dominios (cambiando secciones, nombres y orden; sin mover código todavía).
- P11: Inicio "Mi día" con pendientes.
- P12: ficha de cliente con datos fiscales y su configuración.
- P13 + P14: Asistencia y horas unificada; asignaciones que alimentan agenda y fichado.
- P17 + P18: un solo mecanismo de permisos y una pantalla de accesos.
- P19: dividir Configuración.
- P22: lista global de órdenes.
- P7: archivar en lugar de borrar.

**3. Mediano plazo (2–6 meses) — integrar los datos**

- P8 + P9: una sola fuente de precios y stock integrado con ventas, obras y órdenes.
- P15: órdenes que generan deuda.
- P20: tarifas con una regla.
- P16 + P25: fichas de persona y de proyecto.
- P24: proveedores únicos.
- P26: fusión de OS y OT (con la información de uso confirmada).
- P27 + P28: tipo de proyecto, estados calculados, bitácora con tipos.

**4. Mejoras futuras**

- P29–P31: Calidad reorganizada, objetivos unificados, acciones con origen.
- P32–P36: búsqueda global, acciones masivas, estados comunes, presupuestos unificados, pliegos conectados.
- Faltantes importantes: legajo, vencimientos, compras, portal completo, integración contable.
- P38–P43: limpieza y consistencia.

---

## Anexo A. Información que falta para cerrar decisiones

| Pregunta | Qué decisión depende de esto |
|---|---|
| ¿Se siguen usando las Órdenes de Servicio o quedaron como modelo anterior a las OT? ¿Qué clientes usan cada una? | Fusión FU3 / P26 |
| ¿El stock del Almacén se usa hoy para decidir compras, valuar o cobrar? | Prioridad de P9 |
| ¿Se factura (AFIP) en otro sistema? | Si la integración contable es crítica |
| Organigrama: ¿quién hace ventas, quién administración, quién calidad, quién supervisa obras? ¿Una persona cubre varios puestos? | Roles por puesto; si Comercial y Finanzas van juntos |
| ¿Cuántos usuarios hay por rol y cuántos dispositivos compartidos (tablets de obra, base)? | Urgencia de X4 y del cierre de sesión |
| ¿Es frecuente que un operario reparta el día entre varios proyectos? | Diseño de la imputación automática (F4) |
| ¿Qué reportes usan "categoría de proyecto" y "tipo de actividad" por separado? | Simplificación a tipo de proyecto |
| ¿Se usan las Cotizaciones de productos fuera del PDV? | Fusión FU4 |
| ¿Se usa "Objetivos de Calidad" o el módulo OKR para la revisión por la dirección? | Fusión FU7 |
| ¿Qué controla RRHH fuera del sistema (planillas de legajo, vencimientos)? | Alcance del legajo |
| ¿Se usa la aplicación de escritorio (Electron)? | Mantenimiento de `electron/` |
| Datos de uso por pantalla (Vercel Analytics) | Confirmar la priorización por frecuencia |

## Anexo B. Alcance y método

- **Leído:** `lib/viewAccess.ts`, `lib/permisos.ts`, `lib/permisosServer.ts`, `lib/sgiAuth.ts`, `middleware.ts`, `lib/auth.ts`, `lib/dataLayer.ts`, `prisma/schema.prisma` completo (modelos centrales en detalle), las pantallas de Configuración, Usuarios, Clientes, Inicio, menú lateral y encabezado, Proyectos (lista, pestañas, asistente), Mis Proyectos, Planificación, OS, OT, Aprobaciones, Monitoreo, Control horario, Registro de Tiempos, Fichado, Gastos, Viajes, RRHH, Calidad, OKR, Datasets, Ventas (navegación, gestión, almacén), y la documentación en `docs/`.
- **Barrido automático:** las 331 rutas de API para detectar si verifican rol o función; usos de cada configuración; comparaciones de rol en pantallas; pantallas sin `ModuleHeader`.
- **No hecho:** pruebas en ejecución, consultas a la base, entrevistas a usuarios ni análisis de datos de uso. Las contradicciones X1–X16 están verificadas leyendo el código; conviene reproducirlas en un entorno de prueba antes de corregir.
- **Auditorías anteriores del repositorio** (`docs/UX_AUDIT.md`, `docs/UX_IMPROVEMENTS.md`, `docs/auditoria_post_optimizacion_10_de_10.md`) evaluaron la interfaz visual y la gestión documental. Esta auditoría es complementaria: se ocupa de la estructura funcional, los datos y los permisos, que esas no cubren.
