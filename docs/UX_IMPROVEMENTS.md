# Mejoras de UX/UI implementadas

Qué cambió, por qué, y cómo se implementó. El diagnóstico de partida está en [UX_AUDIT.md](UX_AUDIT.md); las reglas resultantes, en [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).

## Estrategia

Con 89 rutas y ~113.000 líneas de TSX, reescribir cada pantalla a mano habría tardado meses y arriesgado la lógica de negocio. El rediseño se hizo en tres capas, de la más amplia a la más específica:

1. **Tokens.** Tailwind pasó a ser la capa de tokens del sistema: `slate`, `indigo`, `emerald`, `amber`, `rose`, etc. apuntan ahora a rampas definidas en variables CSS. Cambiar un token cambia las 89 vistas a la vez, sin tocar su lógica.
2. **Codemod.** `scripts/design-system/migrate-classes.js` normaliza en todos los archivos los patrones que ningún token puede corregir (pesos 900, tamaños de 9 px, mayúsculas en botones, degradados…). Es idempotente y versionado: cualquiera puede revisar qué hace y volver a correrlo.
3. **Componentes y vistas.** Shell, Inicio, ingreso, diálogos, encabezados, avisos, paleta de comandos, centro de actividad, Panel de Análisis y portal de clientes se rediseñaron a mano sobre los nuevos componentes de `components/ui`.

No se modificaron APIs, modelos de datos, autenticación, permisos, validaciones ni integraciones.

---

## 1. Navegación

| Antes | Después |
|---|---|
| Menú lateral siempre oculto; había que abrirlo para cada cambio de módulo | **Barra lateral fija en escritorio (≥1024 px)**, panel deslizante en móvil. Se puede ocultar con el botón del encabezado del menú y vuelve con el botón ☰ (preferencia guardada por dispositivo) |
| Solo la primera sección abierta | **La sección del módulo actual se abre sola** al navegar |
| Ítem activo solo con coincidencia exacta de ruta | Activo por prefijo: `/ventas/gestion/productos/nuevo` marca "Gestión Comercial" |
| Migas de pan en una fila extra dentro del contenido | **Migas de pan en la barra superior**; en móvil se reducen a "Volver" + página actual |
| "Cerrar sesión" y "Activar notificaciones" como botones grandes en mayúsculas | **Menú de usuario** en el pie de la barra lateral (avatar con iniciales, nombre, rol en palabras) |
| Pie "© 2026 HDB SGI" en cada vista | Eliminado |
| Buscador global como un botón pequeño "Buscar…" | Campo visible "Buscar" con `Ctrl K` en la barra superior |
| PDV y Cotizaciones con el mismo encabezado | Siguen en pantalla completa: la barra lateral no se fija ahí para no robar ancho al mostrador |

Implementación: `components/shell/AppSidebar.tsx`, `AppTopbar.tsx`, `BrandMark.tsx`; `app/layout.tsx` conserva toda su lógica (sesión, vistas por rol, recientes, páginas públicas, PDV) y solo cambia la composición.

## 2. Arquitectura de pantallas

- **Contenedor único de página.** El layout aplica ancho máximo (1600 px) y márgenes; se quitaron fondos y rellenos propios de diez vistas (`/ordenes-trabajo/**`, `/rrhh/**`, `/mis-epp`, `/my-projects`, `/gestion-sugerencias`, `/centro-ayuda/**`, `/datasets`, `/diccionario-datos`, `/capacitacion`) que generaban doble margen.
- **Títulos de página unificados.** De 30 combinaciones de tamaño/peso/tracking a una escala (`text-title`; `text-display` en portadas públicas). El ícono del título pasó a 20 px en color de marca en todas las vistas, incluidas las que usan `ModuleHeader`.
- **Encabezado de página (`ModuleHeader`)**: búsqueda con ícono, `toolbar` para controles propios, acción primaria siempre a la derecha, pestañas subrayadas con contador y navegación por teclado.
- **Panel de Análisis**: las pestañas tipo "pastilla" (cada una de un color) se reemplazaron por las pestañas del sistema. Los indicadores muestran el valor en grande con cifras tabulares, la etiqueta en tipo oración y un ícono sobre tinte suave; se quitó el pulso permanente.

## 3. Inicio

- Saludo según la hora y fecha, rol en palabras ("Administrador") y cantidad de módulos disponibles.
- **Buscador de módulos** que filtra por nombre, descripción o sección, con estado vacío y "Limpiar búsqueda".
- **Recientes como accesos de un clic** (hasta 8), visibles sin desplegar.
- Mosaicos neutros: ícono gris que toma el tinte de marca al pasar el mouse. Se abandonó la paleta de 14 colores sin significado.
- "Personalizar" conserva todo: mostrar/ocultar recientes y favoritos, marcar favoritos con la estrella, arrastrar a Favoritos.

## 4. Flujos

| Flujo | Mejora |
|---|---|
| Cambiar de módulo (escritorio) | De 3 interacciones (abrir menú, abrir sección, elegir) a 1 |
| Llegar a un módulo desde Inicio | Escribir 2–3 letras en "Buscar un módulo" |
| Confirmar una eliminación | Un solo diálogo, foco inicial en "Cancelar", Escape cierra, el foco vuelve al botón de origen |
| Ingresar | Selector de usuario anunciado como combobox, abre con Enter/flecha, Enter elige si hay un único resultado; botón con estado "Ingresando…" |
| Leer un error | El aviso queda 6 s (antes 3 s) y se anuncia a lectores de pantalla |

## 5. Componentes

Nuevos o reescritos en `components/ui`:

| Componente | Notas |
|---|---|
| `Button` | Variantes primary/secondary/tonal/ghost/danger/danger-ghost, tamaños, `isLoading`, `icon`; compatible con la API anterior |
| `Field`, `Input`, `Select`, `Textarea` | Etiqueta, ayuda y error con `htmlFor`/`aria-describedby`/`aria-invalid` |
| `Badge` | Seis tonos con significado |
| `Panel`, `Stat` | Contenedor y KPI |
| `Dialog`, `ConfirmDialogBase` | Foco atrapado, Escape, retorno de foco, hoja inferior en móvil |
| `EmptyState`, `ErrorState`, `LoadingState`, `Spinner`, `Skeleton` | Estados de vista |
| `Tabs`, `SegmentedControl` | Patrón WAI-ARIA |
| `Pagination`, `Tooltip` | Nuevos |
| `index.ts` | Punto de importación único |

Unificados sobre los anteriores (misma API, nuevo comportamiento):
- `components/ConfirmDialog`, `components/ConfirmModal`, `components/ui/ConfirmModal` → `ConfirmDialogBase`.
- `components/Toast` → abajo a la derecha en escritorio, `aria-live`, duración por tipo.
- `components/ThemeToggle` → botón de ícono (antes un interruptor de 48×24 px).
- `components/ui/Drawer`, `components/ui/Breadcrumbs`, `components/CommandPalette`, `components/ActivityCenterDropdown`, `components/TechAssistantChat` (botón flotante sin animación infinita, con etiqueta), `components/LoginScreen`, `app/portal-clientes/layout.tsx`.

Clases de componente en `globals.css` (`btn`, `input`, `field-label`, `surface`, `badge-*`, `eyebrow`, `kbd`, `skeleton`, `scrim`, `nav-item`) para el código que no usa los componentes React.

## 6. Identidad visual

- Tipografía: Outfit → **IBM Plex Sans + IBM Plex Mono**.
- Color primario único (**Cobalto `#1F60C1`**) aplicado a `primary` e `indigo-*`; antes convivían `#2563eb`, `#4f46e5` y `#6366f1`.
- Temas de acento regenerados como rampas completas con contraste verificado; ya no tiñen fondos.
- Neutros "grafito" con un 400 que cumple 4,5:1 como texto.
- Rojos, verdes y amarillos unificados en una rampa por significado.
- Radios de 3 a 12 px (antes hasta 40 px); sombras solo en lo que flota; sin degradados.
- Gráficos de ECharts con la paleta del sistema.

## 7. Codemod aplicado (`scripts/design-system/migrate-classes.js`)

| Regla | Ocurrencias |
|---|---|
| `font-black` / `font-extrabold` → `font-bold` (o `font-semibold` en rótulos) | 1.940 |
| Tamaños de 8–10 px → 10–11 px | 2.049 |
| `tracking-widest` y tracking arbitrario → `tracking-wider` | 860 |
| Etiquetas `<label>` en mayúsculas → tipo oración, 13 px, contraste AA | 354 |
| Botones en mayúsculas → tipo oración | 59 (con `className` literal) |
| Valor de campos al 50 % → color pleno | 299 |
| Clases de color contradictorias eliminadas | 279 |
| Sombras de color eliminadas | 233 |
| Sombras en botones sólidos eliminadas / hover por token | 225 / 71 |
| `scale`/`translate` en hover/active eliminados | 230 |
| Scrims de modales unificados (sin desenfoque) | 155 |
| Animaciones de entrada acotadas (≤200 ms, 8 px) | 213 |
| Radios arbitrarios → escala | 85 |
| Títulos de página → `text-title`/`text-display` | 66 |
| Degradados → color plano con el mismo significado | 32 (+1 dinámico a mano) |
| Fondos de campos → superficie | 35 archivos |

## 8. Accesibilidad

- Zoom habilitado: se quitó `maximum-scale=1, user-scalable=no` (WCAG 1.4.4). El zoom automático de iOS se sigue evitando con campos de 16 px en móvil.
- Contraste: inputs, texto secundario y etiquetas cumplen AA en claro y oscuro.
- Foco visible común a todo control (contorno de 2 px); en oscuro ya no se apaga.
- "Saltar al contenido" como primer elemento enfocable.
- `aria-label` en todos los botones de solo ícono del shell, migas de pan como `<nav><ol>` con `aria-current`, secciones del menú con `aria-expanded`/`aria-controls`.
- Diálogos con `role="dialog"`, `aria-modal`, foco atrapado y retorno de foco.
- Pestañas con flechas/Inicio/Fin; tooltips de KPI accesibles con foco.
- Avisos en región `aria-live`; errores con `role="alert"`.
- Sin animaciones infinitas en el shell; `prefers-reduced-motion` respetado.
- Piso tipográfico de 11 px (`text-xs` pasó de 10,5 a 11,2 px).

## 9. Correcciones de comportamiento

Solo donde el comportamiento esperado era inequívoco:

1. **`tailwindcss-animate` no estaba registrado**: 366 clases de animación no hacían nada. Se registró y se acotaron duraciones.
2. **Temas de color parciales**: al elegir otro acento, botones y pestañas seguían en índigo. Ahora todo el acento sigue al tema.
3. **Vistas públicas sin contenedor de avisos**: `showToast` no mostraba nada en `/public/**`, `/os/**` y el portal. Se agregó `ToastContainer`.
4. **Valores de inputs al 50 %** (descrito arriba).
5. **`/ordenes-servicio/generar` sin proyecto** quedaba en el esqueleto de carga indefinidamente; ahora explica que la OS se genera desde un proyecto y lleva a Mis Proyectos.

## 10. Decisiones de diseño relevantes

- **Los temas solo cambian el acento.** Teñir fondos bajaba el contraste y hacía que cada persona viera una aplicación distinta.
- **Información ≠ marca.** `blue-*` es celeste informativo y no cobalto, para que "En revisión" no se confunda con un botón.
- **Mosaicos neutros en Inicio.** El campo `color` de cada vista se mantiene en la configuración (no se borra nada), pero ya no se usa para pintar íconos.
- **Capa de compatibilidad oscura conservada** y reescrita sobre tokens: eliminarla habría exigido revisar a mano miles de clases claras sin par oscuro.
- **Codemod en el repositorio** para que la migración sea auditable y repetible, en lugar de cambios invisibles.

## 11. Pendiente / próximos pasos recomendados

- Migrar los encabezados propios restantes a `ModuleHeader` (hoy lucen iguales gracias al codemod, pero duplican marcado).
- Reemplazar los botones escritos a mano por `Button` progresivamente al tocar cada módulo.
- Retirar la capa de compatibilidad oscura módulo por módulo.
- Pasar los colores de ECharts a leer las variables CSS para que sigan al tema de acento y al modo oscuro.
- Revisar `Gestión de Clientes` como tabla en lugar de tarjetas (cientos de registros).
