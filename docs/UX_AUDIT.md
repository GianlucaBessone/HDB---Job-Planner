# Auditoría UX/UI — HDB SGI (estado previo al rediseño)

Fecha: 30/10/2026 · Alcance: toda la aplicación web (`app/`, `components/`, `lib/`) · Rama: `claude/redeseno-ui-ux-completo-57be0a`

Este documento describe la aplicación **tal como estaba antes del rediseño**. Las mejoras aplicadas están en [UX_IMPROVEMENTS.md](UX_IMPROVEMENTS.md) y la verificación en [QA_REPORT.md](QA_REPORT.md).

---

## 1. Diagnóstico general

HDB SGI es el sistema de gestión integral de HDB Servicios Eléctricos: órdenes de trabajo y de servicio, proyectos, fichado con GPS/QR, calidad ISO 9001, capacitación, EPP, herramientas, ventas (PDV, cotizaciones, stock, cuentas corrientes), RR. HH., tickets de soporte y un portal para clientes. Lo usan técnicos en campo (móvil, a veces sin conexión), supervisores y administración (escritorio, jornadas largas) y clientes externos (portal y vistas públicas de firma).

La aplicación **funciona** y tiene una base técnica razonable (Tailwind, variables CSS, un registro central de vistas en `lib/viewAccess.ts`, una paleta de comandos). El problema no es la falta de funcionalidad sino la **falta de un sistema**: cada módulo se construyó por separado, con clases utilitarias escritas a mano, y las migraciones automáticas posteriores (modo oscuro, color primario) dejaron capas contradictorias.

Síntomas medibles en el código original (≈113.000 líneas de TSX, 89 rutas):

| Indicador | Valor original | Lectura |
|---|---|---|
| `font-black` (peso 900) | 1.873 usos | Todo "grita"; no hay jerarquía porque todo es máximo |
| `uppercase` / `tracking-widest` | 1.795 / 844 | Etiquetas, botones y descripciones en mayúsculas espaciadas |
| Texto de 8, 9 y 10 px | 1.757 usos | Ilegible en móvil; incumple la intención de WCAG 1.4.4 |
| Inputs con `text-foreground/50` | 299 | El valor tipeado se mostraba al 50 % de opacidad (contraste ≈ 2,7:1) |
| Clases de color contradictorias | 113+ | `text-card-foreground text-slate-700` en el mismo elemento |
| `text-slate-400` como texto | 2.005 | Gris #94a3b8 sobre blanco: 2,6:1, falla AA |
| Radios distintos | 7 escalas + 85 arbitrarios (`rounded-[2.5rem]`) | El radio base era 14 px; tarjetas, botones e inputs muy redondeados |
| Sombras de color ("glow") | 233 | `shadow-primary/20`, `shadow-emerald-200`… |
| Degradados decorativos | 37 | Botones y cabeceras con `from-indigo-600 to-violet-600` |
| Escalas en hover/active | 226 | `active:scale-95`, `hover:-translate-y-1` |
| `animate-in` (tailwindcss-animate) | 366 | **Clases muertas**: el plugin estaba instalado pero no registrado |
| Combinaciones de título de página | 30 | Ningún título se veía igual a otro |
| `ModuleHeader` (encabezado compartido) | 22 de 89 vistas | El resto tenía encabezados propios |
| `components/ui/Button` | 2 archivos | El componente existía pero nadie lo usaba |
| Diálogos de confirmación | 3 componentes distintos | `ConfirmDialog`, `ConfirmModal`, `ui/ConfirmModal`, con estilos y comportamientos diferentes |

Capturas del estado inicial: [`docs/assets/ux/antes/`](assets/ux/antes/).

---

## 2. Inventario funcional

### 2.1 Roles

Definidos en `Operator.role` y aplicados por `lib/viewAccess.ts` (UI) y `middleware.ts` + rutas de API (servidor):

| Rol | Uso típico |
|---|---|
| `operador` | Técnico de campo: fichado, tiempos, proyectos propios, informes técnicos, EPP, tareas, OT |
| `supervisor` | Planificación, aprobaciones, monitoreo, gestión de proyectos y OT, calidad |
| `admin` | Todo, incluida configuración y usuarios |
| `qa` | Calidad, auditorías, documentación ISO, datasets |
| `vendedor` | Ventas (PDV, cotizaciones, stock, cuentas corrientes), clientes, OT |
| Cliente (portal) | Sesión separada (`lib/portalAuth.ts`): proyectos, OT y métricas propias |
| Público | Firma de OS (`/os/[token]`), verificación de firmas, matriz EPP, herramientas por QR, sugerencias |

La configuración de vistas por rol es editable desde **Configuración → Vistas** y se guarda en la base (`/api/config/views`). El rediseño no modifica ese mecanismo.

### 2.2 Módulos y rutas

Agrupados por las secciones de `DEFAULT_SECTIONS` (alineadas a cláusulas ISO 9001):

| Sección | Rutas |
|---|---|
| Inicio | `/` (accesos por sección, recientes, favoritos, asistente técnico IA) |
| Operaciones | `/fichado`, `/timesheets`, `/my-projects`, `/delays`, `/informes-tecnicos` (+ `/nuevo`, `/[id]`), `/mis-epp` |
| Gestión y seguimiento | `/dashboard`, `/planning`, `/projects` (+ `cronograma`, `dashboard`, `documentacion`, `recursos`, `reportes`, `riesgos`, `[id]/report`), `/ordenes-servicio` (+ `generar`, `qr/[id]`), `/ordenes-trabajo` (+ `nueva`, `[id]`, `cliente/[clientId]`, `…/proyecto/[projectId]`), `/aprobaciones`, `/tareas`, `/okr-kpi` |
| Ventas y comercial | `/ventas/gestion` (+ productos nuevo/editar/importar), `/ventas/pdv`, `/ventas/cotizaciones`, `/ventas/almacen` (+ `conteos/[id]`), `/ventas/cuentas-corrientes` |
| Logística y materiales | `/provision-materiales`, `/herramientas`, `/inventario` (desactivada por configuración) |
| Calidad y mejora continua | `/calidad`, `/capacitacion`, `/gestion-sugerencias`, `/tickets`, `/centro-ayuda` (+ artículo, categoría) |
| Administración | `/datasets`, `/diccionario-datos`, `/administracion/gastos` (+ crear, escanear, importar), `/operators`, `/clients`, `/rrhh` (+ personal, EPP, reclutamiento, vacantes, postulantes, pipeline), `/configuracion`, `/notifications` |
| Auditoría y trazabilidad | `/monitoreo-fichadas`, `/auditoria`, `/auditoria-ia`, `/verificacion-firmas` |
| Portal de clientes | `/portal-clientes` (+ `login`, `primer-acceso`, `dashboard`, `ordenes-trabajo`, `[id]`) |
| Públicas | `/os/[token]`, `/ideas-sugerencias-reclamos`, `/public/doc-print/[token]`, `/public/epp-matriz/[token]`, `/public/herramientas` (+ `[id]`), `/public/informe/[signatureId]`, `/public/verificar-firma` |

### 2.3 Acciones globales (presentes en todas las vistas internas)

- Navegación lateral por secciones, con favoritos.
- Buscador global y paleta de comandos (`Ctrl/Cmd + K`), con acciones que registran los módulos vía `useCommandStore`.
- Reportar falla o sugerencia (abre el ticket guiado `ReportTicketModal`).
- Centro de actividad (notificaciones) y página `/notifications`.
- Activar notificaciones push (OneSignal).
- Indicador de sincronización y modo sin conexión (`lib/offline.ts`).
- Cambio de tema claro/oscuro y tema de color de acento (Configuración).
- Migas de pan con "Volver" (historial propio, `useHistoryStore`).
- Panel lateral global (`GlobalDrawer`) para detalle de OS y cobros por URL (`?drawer=…&id=…`).
- Cerrar sesión.

### 2.4 Recorridos principales evaluados

| Recorrido | Pasos antes | Fricción detectada |
|---|---|---|
| Técnico: iniciar jornada | Menú (hamburguesa) → abrir sección Operaciones → Fichado → acción | El menú se cerraba en cada navegación y solo la primera sección venía abierta: 3 interacciones antes de llegar al módulo |
| Supervisor: revisar una OT | Menú → abrir "Gestión y Seguimiento" → Órdenes de Trabajo → cliente → proyecto → OT | Encabezado distinto en cada nivel; el contenedor de OT agregaba su propio fondo y relleno, desalineado del resto |
| Administración: cambiar a otro módulo | Siempre a través del menú oculto o del buscador | Sin navegación persistente en escritorio, aunque había espacio de sobra |
| Cualquiera: confirmar una eliminación | Diálogo | Tres diseños distintos; ninguno movía el foco al diálogo ni lo atrapaba, y el orden de los botones variaba |
| Cualquiera: encontrar un módulo en Inicio | Recorrer 37 tarjetas multicolor | Sin búsqueda en Inicio; recientes colapsados por defecto |
| Vendedor: PDV | Pantalla completa con encabezado | Correcto; se preserva |

---

## 3. Problemas detectados

### 3.1 Arquitectura de información y navegación

1. **Navegación oculta en escritorio.** La barra lateral era siempre un panel deslizante: en una pantalla de 1440 px el usuario debía abrir el menú para cada cambio de módulo (NN/g #6, reconocer antes que recordar).
2. **Secciones colapsadas sin contexto.** Solo la primera sección arrancaba abierta; la sección del módulo actual quedaba cerrada, así que el menú no respondía "¿dónde estoy?".
3. **Estado activo solo por coincidencia exacta.** En `/ventas/gestion/productos/nuevo` ningún ítem aparecía activo.
4. **Migas de pan dentro del contenido**, ocupando una fila más en cada vista y con un ícono de "Volver" separado del título.
5. **Pie de página** "© 2026 HDB SGI" en todas las vistas internas: ruido sin función.
6. **Inicio sin jerarquía.** 37 tarjetas con 14 colores de ícono distintos (verde, violeta, cian, ámbar…) sin significado; recientes colapsados; ninguna forma de filtrar.
7. **Contenedores de página inconsistentes.** Diez vistas agregaban su propio `max-w-7xl p-4 md:p-8` o `min-h-screen bg-slate-50`, con doble margen y un fondo distinto al resto.

### 3.2 Consistencia visual

1. **Tres azules para "primario".** El logo y `bg-primary` eran `#2563eb`; los botones de `ModuleHeader` y cientos de componentes usaban `indigo-600` (`#4f46e5`); el login usaba `indigo-500`. Al elegir otro tema de color (p. ej. Naranja) solo cambiaba una parte.
2. **Temas de color que teñían todo.** Los temas "Verde", "Rosa", etc. tintaban también fondos y bordes, bajando el contraste del texto secundario.
3. **Tipografía sin escala.** Outfit (geométrica, de aspecto "plantilla") con 30 combinaciones de título, pesos 800/900 omnipresentes y micro-etiquetas en mayúsculas de 9–10 px.
4. **Radios excesivos y variados** (`rounded-2xl`, `rounded-3xl`, `rounded-[2.5rem]`) con un radio base de 14 px.
5. **Sombras y brillos de color** en botones y tarjetas; degradados índigo→violeta en acciones de IA y cabeceras.
6. **Componentes equivalentes con comportamientos distintos:** tres confirmaciones, al menos cuatro estilos de botón primario, pestañas tipo "pastilla" en el Panel de Análisis y subrayadas en otros módulos.
7. **Indicadores (KPI) con íconos de color sólido** y animación de pulso permanente que compiten con el dato.

### 3.3 Accesibilidad (WCAG 2.2 AA)

| Criterio | Problema | Severidad |
|---|---|---|
| 1.4.3 Contraste mínimo | Valores de inputs al 50 % de opacidad; `slate-400` (#94a3b8) como texto; etiquetas de 9–10 px en gris claro | Alta |
| 1.4.4 Cambio de tamaño | `maximum-scale=1, user-scalable=no` bloqueaba el zoom en móviles | Alta |
| 2.4.7 / 2.4.11 Foco visible | Sin estilo de foco común; en oscuro el anillo se forzaba casi transparente (`rgba(99,102,241,.15)`) | Alta |
| 4.1.2 Nombre, función, valor | Botones de solo ícono sin `aria-label` (menú, notificaciones, cerrar, eliminar); combobox del login sin rol | Media |
| 2.1.1 Teclado | Diálogos sin trampa de foco ni retorno al disparador; pestañas sin flechas | Media |
| 2.2.2 Pausar, detener | Animaciones `ping`/`pulse` infinitas en el asistente y en los KPI | Baja |
| 1.3.1 Información y relaciones | Etiquetas de formulario sin `htmlFor`; títulos `h2` como título de página | Media |
| 2.5.8 Tamaño del objetivo | Botones de 28–32 px en escritorio; en móvil había una regla global de 40 px (se conserva) | Baja |
| 4.1.3 Mensajes de estado | Toasts sin `role="status"`/`aria-live`; errores visibles solo 3 s | Media |

### 3.4 Feedback e interacción

- Los toasts aparecían arriba al centro, sobre encabezados y acciones, y desaparecían a los 3 s también en errores.
- Estados vacíos y de error resueltos de forma distinta en cada módulo (íconos de 48 px al 20 % de opacidad, textos en mayúsculas).
- 366 clases de animación que no hacían nada (plugin no registrado) y, en su lugar, `scale` en hover/active que mueve el contenido.

### 3.5 Deuda técnica de estilos

- `app/globals.css` tenía ~350 líneas de reglas `.dark .clase { … !important }` para "arreglar" en oscuro clases claras, con valores índigo fijos (`rgba(99,102,241,…)`) que ignoraban el tema elegido.
- Scripts de migración sueltos en la raíz (`dark-migrator.js`, `clean_colors.js`) que generaron los pares contradictorios.
- Componentes base (`components/ui/Button`, `Input`) sin adopción y con estilos propios divergentes.

---

## 4. Priorización

| Prioridad | Problema | Impacto | Esfuerzo |
|---|---|---|---|
| P0 | Contraste de inputs y texto secundario, zoom bloqueado, foco invisible | Accesibilidad y uso real en campo | Bajo (tokens + codemod) |
| P0 | Navegación oculta en escritorio y sección activa cerrada | Cada cambio de módulo | Medio (shell) |
| P1 | Color primario inconsistente y temas parciales | Identidad y confianza | Bajo (rampa de marca por variables) |
| P1 | Escala tipográfica, pesos y mayúsculas | Legibilidad de todas las vistas | Medio (fuente + codemod) |
| P1 | Diálogos de confirmación divergentes | Riesgo de acciones destructivas | Bajo (un primitivo) |
| P2 | Encabezados y contenedores de página dispares | Sensación de "varias aplicaciones" | Medio |
| P2 | Radios, sombras, degradados y escalas en hover | Aspecto genérico | Bajo (tokens + codemod) |
| P2 | Inicio sin jerarquía ni búsqueda | Descubrimiento de módulos | Bajo |
| P3 | Gráficos con paleta propia | Coherencia de tableros | Bajo |
| P3 | Capa `!important` de modo oscuro | Mantenibilidad | Medio (se reescribió sobre tokens) |

## 5. Oportunidades

- Convertir Tailwind en la capa de tokens: re-mapear `slate`, `indigo`, `emerald`, etc. a variables CSS permite corregir 19.000 usos de color sin editar cada archivo.
- Registrar `tailwindcss-animate` y acotar duraciones/distancias en lugar de borrar 366 intenciones de animación.
- Un único `Dialog` con foco atrapado, usado por las tres APIs de confirmación existentes (sin cambiar sus props).
- Barra lateral fija en escritorio con la sección actual abierta, y migas de pan en la barra superior.
- Un codemod idempotente y versionado para que la normalización sea reproducible y revisable.
