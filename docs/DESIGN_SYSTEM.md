# Sistema de diseño — HDB SGI

Fuente de verdad visual de la aplicación. La identidad (concepto, color, tipografía) está en [BRAND_GUIDELINES.md](BRAND_GUIDELINES.md); este documento cubre la implementación.

```
app/globals.css            → tokens (variables CSS), clases de componente, capa de compatibilidad oscura
tailwind.config.ts         → mapea los tokens a utilidades (bg-primary, text-title, rounded-xl…)
components/ui/*            → componentes React del sistema (index.ts los exporta todos)
components/ModuleHeader    → encabezado de página (alias PageHeader)
components/shell/*         → barra lateral, barra superior, isotipo
lib/cn.ts                  → combina clases y resuelve conflictos (clsx + tailwind-merge)
scripts/design-system/     → codemod de migración (idempotente)
```

**Regla de oro:** una vista nueva se arma con `components/ui` y utilidades de token. Si necesitás un color, radio o sombra que no existe, se agrega como token, no como valor suelto.

---

## 1. Tokens

Todos los colores son tripletes RGB en variables CSS para que Tailwind aplique opacidad (`bg-primary/10`).

### 1.1 Color

| Familia | Utilidades | Notas |
|---|---|---|
| Neutros | `neutral-*`, alias `slate-*` y `gray-*` | Reajustados en `.dark` (no invertidos) |
| Marca | `brand-*`, alias `indigo-*`; `primary`, `primary-hover` | Cambian con el tema de acento (`[data-color-theme]`) |
| Éxito | `success-*`, alias `emerald-*`, `green-*` | |
| Atención | `warning-*`, alias `amber-*`, `yellow-*` | |
| Peligro | `danger-*`, alias `red-*`, `rose-*` | |
| Información | `info-*`, alias `blue-*` | Distinto de la marca a propósito |
| Acento IA | alias `violet-*`, `purple-*` | Solo funciones de IA y categorías |
| Semánticos | `background`, `foreground`, `card`, `popover`, `muted`, `muted-foreground`, `border`, `input`, `ring`, `surface-sunken`, `destructive` | Úsalos en código nuevo |

Los alias existen para que el código heredado (19.000 usos de `slate`, 2.300 de `indigo`) adopte el sistema sin reescribirse. En código nuevo preferí los nombres semánticos (`success`, `danger`, `brand`).

### 1.2 Tipografía

| Utilidad | Tamaño (base 14 px) | Uso |
|---|---|---|
| `text-display` | 24,5 px / 600 | Portadas, saludo de Inicio |
| `text-title` | 19,25 px / 600 | **Título de página** |
| `text-heading` | 14,9 px / 600 | Título de panel o diálogo |
| `text-body` | 13,1 px | Párrafos de lectura |
| `text-sm` | 12,25 px | Texto de interfaz, celdas |
| `text-[13px]` | 13 px | Botones, navegación, etiquetas de campo |
| `text-caption` | 11,4 px | Descripciones |
| `text-xs` | 11,2 px | Metadatos |
| `eyebrow` (clase) | 11,2 px, mayúsculas, 600 | Rótulos de sección y columnas |

Familias: `font-sans` (IBM Plex Sans), `font-mono` (IBM Plex Mono). Base `html` de 14 px en escritorio y 14,5 px en móvil.

### 1.3 Espaciado y dimensiones

- Escala de Tailwind (múltiplos de 4 px).
- Altura de controles: 32 px (`sm`), **36 px (por defecto)**, 44 px (`lg`). En móvil todo control mide al menos 40 px (regla global en `globals.css`).
- Barra superior: `--topbar-h` = 56 px. Barra lateral: `--sidebar-w` = 248 px.
- Ancho máximo del contenido: `max-w-page` (1600 px).
- Márgenes de página: 16 px (móvil), 24 px (tablet), 32 px (≥1200 px). Los aplica el layout: **las vistas no agregan su propio relleno exterior**.

### 1.4 Forma

| Utilidad | Valor | Uso |
|---|---|---|
| `rounded-sm` | 3 px | Insignias pequeñas, `kbd` |
| `rounded` / `rounded-md` | 5 px | Insignias |
| `rounded-lg` | 6 px | Botones, campos, ítems de menú |
| `rounded-xl` | 8 px | Mosaicos, menús desplegables |
| `rounded-2xl` | 10 px | Paneles y tarjetas |
| `rounded-3xl` | 12 px | Diálogos y hojas |
| `rounded-full` | — | Avatares, contadores, FAB |

### 1.5 Elevación

| Utilidad | Token | Uso |
|---|---|---|
| `shadow-xs` / `shadow-sm` | `--shadow-xs` | Separación mínima (control seleccionado) |
| `shadow` / `shadow-md` | `--shadow-sm` | Hover de mosaicos |
| `shadow-lg` | `--shadow-md` | Botón flotante |
| `shadow-xl` | `--shadow-lg` | Menús, popovers, toasts |
| `shadow-2xl` | `--shadow-xl` | Diálogos y paneles laterales |
| `shadow-focus` | anillo de 3 px | Foco de campos |

Las sombras de color (`shadow-primary/20`) no tienen efecto: los tokens de sombra no admiten color.

### 1.6 Movimiento

- Duraciones: 100–150 ms (hover, foco), 200 ms (entrar/salir). Curva `ease-standard` (`cubic-bezier(.2,0,0,1)`).
- `tailwindcss-animate` está registrado: `animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200`.
- No se anima en reposo (sin `pulse`/`ping` permanentes) ni se escala al pasar el mouse.
- `prefers-reduced-motion: reduce` anula animaciones y transiciones.

---

## 2. Componentes

Importá desde `@/components/ui`:

```tsx
import { Button, Input, Select, Badge, Panel, Stat, Dialog, EmptyState, Tabs, Pagination, PageHeader } from '@/components/ui';
```

### 2.1 Button

| Variante | Cuándo |
|---|---|
| `primary` | La acción principal de la vista o diálogo. **Una sola.** |
| `secondary` (alias `outline`) | Acciones secundarias con peso (Exportar, Actualizar) |
| `tonal` | Acción destacada pero no principal (filtros activos, "Agregar otro") |
| `ghost` | Acciones de baja jerarquía, botones de solo ícono, barras de herramientas |
| `danger` | Confirmar algo destructivo (solo dentro de un diálogo de confirmación) |
| `danger-ghost` | Disparar una acción destructiva desde una lista o barra |

Tamaños: `sm` (32 px), `md` (36 px), `lg` (44 px), `icon`, `icon-sm`. Props: `isLoading` (deshabilita y muestra spinner), `icon`. El `type` por defecto es `button`.

Estados: hover (fondo un paso más oscuro), active (dos pasos), focus-visible (contorno de 2 px `ring`), disabled (50 % y sin puntero), loading (`aria-busy`).

Sin React: `<button class="btn btn-primary btn-sm">`.

### 2.2 Campos: `Field`, `Input`, `Select`, `Textarea`

- Etiqueta arriba, en tipo oración, 13 px, `field-label`. Obligatorio = asterisco rojo (con `aria-hidden`; el `required` lo anuncia).
- Ayuda debajo (`hint`); si hay error, reemplaza a la ayuda, se anuncia con `role="alert"` y el campo recibe `aria-invalid` y borde rojo.
- Campo: 36 px, fondo `card`, borde `input`; hover oscurece el borde; foco = borde de marca + `shadow-focus`.
- Sin React: `<input class="input">`. Además, todo `input`/`select`/`textarea` hereda por defecto fondo, color y placeholder del sistema (`:where()` en `globals.css`, especificidad 0).

### 2.3 Badge

`tone`: `neutral | brand | success | warning | danger | info`, opcional `dot`. 22 px de alto, tipo oración. El tono comunica estado (ver Brand §5); para categorías sin significado usá `neutral`.

### 2.4 Panel y Stat

- `Panel`: contenedor de una unidad (tabla, formulario, gráfico) con `title`, `description`, `actions`, `footer`. Borde, sin sombra, radio 10 px. **No anidar paneles.**
- `Stat`: indicador numérico (`label`, `value`, `hint`, `tone`). El valor es protagonista (24 px semibold, cifras tabulares).
- Sin React: `.surface`, `.surface-header`, `.surface-title`.

### 2.5 Dialog y confirmación

- `Dialog`: título, descripción, cuerpo con scroll, pie con acciones. Tamaños `sm | md | lg | xl | full`. Hoja inferior en móvil.
- Comportamiento: foco al primer control (o al marcado con `data-autofocus`), Tab atrapado dentro, Escape y clic fuera cierran, el foco vuelve al disparador, bloqueo de scroll del fondo. `dismissible={false}` mientras hay una operación en curso.
- `ConfirmDialogBase`: confirmación con tono `danger | warning | primary`. En `danger` el foco inicial queda en **Cancelar** para que Enter no borre por accidente.
- Las APIs existentes `components/ConfirmDialog`, `components/ConfirmModal` y `components/ui/ConfirmModal` conservan sus props y ahora renderizan este mismo diálogo.
- Orden de botones: secundaria a la izquierda, primaria a la derecha (en móvil, primaria arriba).

### 2.6 Encabezado de página (`ModuleHeader` / `PageHeader`)

Responde las tres preguntas de cada vista: dónde estoy (título + ícono), qué veo (descripción, pestañas), qué puedo hacer (acciones).

```tsx
<ModuleHeader
  title="Tickets de Soporte"
  description="Fallas, pedidos y sugerencias del sistema"
  icon={<LifeBuoy />}
  searchValue={q} onSearchChange={setQ} searchPlaceholder="Buscar por código…"
  toolbar={<Filtros />}
  actions={[
    { id: 'refresh', label: 'Actualizar', icon: <RefreshCw />, onClick: reload, variant: 'outline' },
    { id: 'new', label: 'Nuevo ticket', icon: <Plus />, onClick: create, variant: 'primary' },
  ]}
  tabs={[{ id: 'abiertos', label: 'Abiertos', count: 4 }, …]} activeTabId={tab} onTabChange={setTab}
  helpSlug="tickets"
/>
```

La acción `primary` se ubica siempre última. Un `h1` por vista: el del encabezado.

### 2.7 Tabs y SegmentedControl

- `Tabs`: secciones de una vista. Subrayado de 2 px en color de marca, contador opcional, navegación con flechas/Inicio/Fin (`role="tablist"`).
- `SegmentedControl`: alternar 2–4 modos del mismo dato (Lista / Tablero). `role="radiogroup"`.
- No usar botones sólidos de colores como pestañas.

### 2.8 Navegación

- **Barra lateral** (`components/shell/AppSidebar`): fija en ≥1024 px, panel deslizante en móvil y en PDV/Cotizaciones. Secciones colapsables; la del módulo actual se abre sola. Ítem activo por prefijo de ruta (`isRouteActive`) con `aria-current="page"`. El usuario puede ocultarla (preferencia en `localStorage`: `sgi:sidebar-pinned`).
- **Barra superior** (`AppTopbar`): migas de pan con "Volver", buscador (`Ctrl K`), indicador de sincronización, reportar falla, tema, actividad.
- **Menú de usuario** (pie de la barra lateral): activar notificaciones, cerrar sesión.
- Clase utilitaria `.nav-item` para cualquier lista de navegación (portal de clientes incluido).

### 2.9 Avisos (toast)

`showToast(mensaje, 'success' | 'error' | 'info')`. Abajo a la derecha en escritorio, arriba en móvil. Éxito/info: 4 s; error: 6 s. `role="status"` o `role="alert"`, región `aria-live`. Mensajes en pasado y concretos: "Cliente eliminado", no "¡Operación exitosa!".

### 2.10 Tooltip

`<Tooltip content="…">` aparece con hover y con foco (200 ms de demora). Solo información complementaria.

### 2.11 Paginación

`<Pagination page pageSize total onPageChange />` al pie de la tabla. Muestra rango ("21–40 de 312") y página actual.

### 2.12 Estados de carga, vacío y error

| Estado | Componente | Regla |
|---|---|---|
| Carga de vista | `LoadingState` | Spinner + texto ("Cargando tickets…") |
| Carga de bloque con forma conocida | `Skeleton` | Mismo tamaño que el contenido final |
| Acción en curso | `Button isLoading` | El botón se deshabilita y conserva el ancho |
| Vacío | `EmptyState` | Qué falta + por qué + acción siguiente ("Crear el primero") |
| Vacío por filtros | `EmptyState` | Ofrecer "Limpiar filtros" |
| Error | `ErrorState` | Mensaje en lenguaje llano + "Reintentar" |

### 2.13 Tablas

- Densidad única en escritorio: filas de 36 px, celdas 13 px, encabezados 11 px en mayúsculas semibold gris (definido globalmente en `globals.css`).
- En móvil las celdas crecen a 40 px de alto.
- Números y montos alineados a la derecha con `tabular-nums`; acciones de fila al final, como botones `ghost` de solo ícono con `aria-label`.
- Hover de fila: fondo `slate-50` (en oscuro, gris translúcido).
- Para listas de más de 50 elementos, paginar o filtrar; no usar tarjetas para datos tabulares.

### 2.14 Gráficos

Paleta de series (ECharts), en este orden: marca `#2F74DA`, éxito `#10B981`, atención `#F59E0B`, peligro `#EF4444`, acento `#8B5CF6`, neutro `#5A6372`. Ejes y grilla en `#E1E4E9` / `#EEF0F3`, etiquetas en `#5A6372`. Sin degradados salvo el área bajo una línea de tendencia (25 % → 0 %).

---

## 3. Patrones de interacción

| Patrón | Regla |
|---|---|
| Crear | Botón primario "Nuevo X" en el encabezado → diálogo o vista de formulario → toast de éxito → el nuevo elemento visible en la lista |
| Editar | Acción de fila o clic en la fila → mismo formulario precargado |
| Eliminar | Acción `danger-ghost` → `ConfirmDialog` que nombra el elemento → toast |
| Buscar | Campo de búsqueda en el encabezado; filtra en vivo |
| Filtrar | Controles en `toolbar` del encabezado o fila de filtros sobre la tabla; mostrar "Limpiar filtros" cuando hay alguno activo |
| Navegar a detalle | Migas de pan actualizadas; "Volver" respeta el historial |
| Acción global | Registrarla en `useCommandStore` para que aparezca en `Ctrl K` |

## 4. Responsive

| Ancho | Comportamiento |
|---|---|
| < 640 px | Una columna; acciones del encabezado debajo del título; diálogos como hoja inferior; migas de pan reducidas a "Volver" + página actual; toasts arriba |
| 640–1023 px | Grillas de 2 columnas; barra lateral deslizante |
| ≥ 1024 px | Barra lateral fija; grillas de 3 columnas |
| ≥ 1600 px | Grillas de 4 columnas; el contenido no supera 1600 px |

Objetivos táctiles de 40 px en móvil (`button { min-height: 40px }`), campos con 16 px de fuente para evitar el zoom automático de iOS.

## 5. Accesibilidad

- Contraste AA verificado en tokens: texto principal 15:1, secundario (`neutral-500`) 6:1, terciario (`neutral-400`) 4,5:1; acción primaria 6:1 con blanco; en oscuro, `neutral-400` sobre superficie 5,7:1.
- Foco visible global (`:focus-visible` → contorno de 2 px `ring`).
- Enlace "Saltar al contenido" al inicio del layout.
- Zoom habilitado (`viewport` sin `maximum-scale`).
- Botones de solo ícono con `aria-label`. Diálogos con `role="dialog"`, `aria-modal`, `aria-labelledby`.
- Navegación con `aria-current="page"`; secciones con `aria-expanded`/`aria-controls`.

## 6. Modo oscuro

Se activa con la clase `.dark` (next-themes). Los neutros y los semánticos se redefinen en `.dark`; las rampas de estado no cambian. Para código nuevo, usá pares explícitos (`text-slate-700 dark:text-slate-200`) o tokens semánticos.

La sección "Capa de compatibilidad de modo oscuro" de `globals.css` adapta clases claras heredadas sin variante `dark:`. Está construida sobre tokens (sigue al tema de acento) pero es deuda: no agregues código que dependa de ella.

## 7. Reglas de consistencia

1. Un `h1` por vista, con `ModuleHeader`.
2. Una acción primaria por vista o diálogo.
3. Las vistas no definen fondo ni relleno exterior; lo hace el layout.
4. Sin pesos 800/900, sin `tracking-widest`, sin texto menor a 11 px.
5. Sin degradados, sin sombras de color, sin `scale`/`translate` en hover.
6. Color de estado solo con significado de estado.
7. Diálogos siempre con `Dialog`/`ConfirmDialog`; nunca `window.confirm` en código nuevo.
8. Íconos de Lucide, heredando el color del texto.

## 8. Migración del código heredado

`scripts/design-system/migrate-classes.js` aplica las reglas automatizables (pesos, tamaños, tracking, radios, sombras, degradados, scrims, conflictos de color, etiquetas y botones en mayúsculas, títulos de página, fondos de campos). Es idempotente:

```bash
node scripts/design-system/migrate-classes.js --dry
```

Si devuelve "Archivos modificados: 0", el código cumple las reglas. Correlo antes de abrir un PR que toque UI.
