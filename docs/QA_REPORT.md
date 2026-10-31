# Informe de QA — Rediseño UX/UI

Fecha: 30/10/2026 · Entorno: `npm run dev` local (Next.js 15.5, puerto 3333) contra la base de desarrollo del `.env` local · Navegador: Chromium integrado, sesión de administrador ya iniciada.

## 1. Resumen

| Verificación | Resultado |
|---|---|
| Type checker (`npx tsc --noEmit`) | ✅ 0 errores |
| Codemod de diseño en modo verificación (`--dry`) | ✅ 0 archivos pendientes |
| Compilación de las 87 rutas (`curl` a cada una) | ✅ 87/87 responden 200 sin error de compilación |
| Ejecución en el navegador de 66 vistas (barrido con iframes) | ✅ Sin errores de ejecución; 1 advertencia preexistente |
| Recorridos manuales (shell, Inicio, diálogo, PDV, ingreso, móvil, oscuro) | ✅ |
| Linter (`npm run lint`) | ⚠️ No ejecutado: el repo no tiene configuración de ESLint y el comando abre un asistente interactivo (ver `AGENTS.md`) |
| Tests unitarios / integración / E2E | ⚠️ No existen en el repo: `playwright.config.ts` apunta a `./tests`, que no existe |

## 2. Pruebas ejecutadas

### 2.1 Estáticas

- `npx tsc --noEmit` después de cada etapa (tokens, shell, componentes, codemod, vistas). Último resultado: exit 0.
- `node scripts/design-system/migrate-classes.js --dry` → "Archivos modificados: 0" (idempotente: una segunda pasada no cambia nada).
- Métricas de cumplimiento sobre `app/` y `components/`:

| Regla | Antes | Después |
|---|---|---|
| `font-black` / `font-extrabold` | 1.873 / 75 | 0 / 0 |
| Texto de 8–10 px | 1.757 | 0 |
| `tracking-widest` | 844 | 0 |
| Inputs con `text-foreground/50` | 299 | 0 |
| Radios arbitrarios (`rounded-[2rem]`…) | 85 | 0 |
| Degradados `bg-gradient-to-*` | 37 | 1 (línea de tiempo decorativa de 1 px en Calidad › Historial) |
| Sombras de color | 233 | 0 |
| `<label>` en mayúsculas | 354 | 0 |
| Combinaciones de título de página | 30 | 19 (las diferencias restantes son de layout: `flex`, `gap`, `truncate`) |

### 2.2 Compilación de rutas

Se pidió cada `page.tsx` (rutas dinámicas con un id ficticio `test-id`) y se buscó en la respuesta `__next_error__`, "Build Error" o "Module not found". 80 respondieron en la primera pasada; 7 rutas de Ventas dieron timeout por la compilación en frío del servidor de desarrollo y respondieron 200 al reintentar.

### 2.3 Ejecución en el navegador

Cada vista se cargó en un iframe con la sesión real, se esperó 6–9 s y se registraron `window.onerror`, `console.error`, el título renderizado y el largo del contenido de `<main>`.

- **Primera tanda (30 vistas)**: Inicio, Gastos (+ crear, importar), Aprobaciones, Auditoría, Auditoría IA, Calidad, Capacitación, Centro de ayuda, Clientes, Configuración, Panel de Análisis, Datasets, Demoras, Diccionario de datos, Gestión de sugerencias, Herramientas, Informes técnicos (+ nuevo), Inventario, Mis EPP, Monitoreo de fichadas, Mis proyectos, OKR/KPI, Operadores, Órdenes de servicio (+ generar), Órdenes de trabajo (+ nueva).
- **Segunda tanda (31 vistas)**: Planificación, Proyectos y sus 6 subvistas, Provisión de materiales, RR. HH. y sus 8 subvistas, Tareas, Tickets, Registro de tiempos, Almacén, Cotizaciones, Cuentas corrientes, Gestión comercial (+ importar, nuevo producto), PDV, Verificación de firmas, Notificaciones.
- **Públicas y portal (5)**: `/portal-clientes/login`, `/public/verificar-firma`, `/public/herramientas`, `/ideas-sugerencias-reclamos`, `/ordenes-servicio/generar` (tras la corrección).

Resultado: ninguna vista mostró el overlay de error de Next ni errores no capturados. El Panel de Análisis tarda más de 9 s en cargar datos en desarrollo; se verificó aparte en la pestaña principal y renderiza correctamente (captura `despues/panel-analisis.jpg`).

No se ejecutaron en el barrido `/fichado` (pide geolocalización y cámara), `/administracion/gastos/escanear` (cámara) ni las rutas con id real (`/ordenes-trabajo/[id]`, `/informes-tecnicos/[id]`, `/os/[token]`, etc.): compilan, pero su contenido depende de datos reales.

### 2.4 Recorridos manuales

| Recorrido | Verificado |
|---|---|
| Barra lateral fija en 1440 px; sección actual abierta; ítem activo por prefijo | ✅ |
| Panel deslizante en 375 px: abre con ☰, cierra con Escape y al navegar | ✅ |
| Migas de pan en la barra superior; "Volver" | ✅ |
| Buscador `Ctrl K` desde la barra superior | ✅ (paleta restilizada, mismas acciones) |
| Inicio: saludo, buscador de módulos, secciones por rol | ✅ |
| Diálogo de eliminar cliente: abre, foco en "Cancelar", Escape cierra, se libera el scroll del fondo, **no se eliminó nada** | ✅ |
| PDV: pantalla completa sin barra lateral fija | ✅ |
| Ingreso: selector de usuario, PIN, estados (visto sin enviar credenciales) | ✅ |
| Modo oscuro (Tickets, Inicio) | ✅ |
| Móvil 375 px (Inicio, menú) y ancho de tablet (~800 px, Órdenes de trabajo) | ✅ |
| `/ordenes-servicio/generar` sin proyecto muestra estado vacío con salida | ✅ |

**Limitación importante:** no se crearon, editaron ni eliminaron registros. La base del `.env` local es compartida y el objetivo era no alterar datos. Los formularios conservan su lógica (el codemod solo cambia `className`; no se tocaron handlers, validaciones ni llamadas a la API), pero el guardado no se probó extremo a extremo.

## 3. Errores encontrados y corregidos durante el rediseño

| Error | Causa | Corrección |
|---|---|---|
| Valores de campos al 50 % de opacidad | Migración automática previa (`text-foreground/50`) | Color pleno (codemod) |
| 366 animaciones sin efecto | `tailwindcss-animate` no registrado | Registrado en `tailwind.config.ts`; duraciones acotadas |
| Tema de color aplicado a medias | `indigo-*` fijo en cientos de componentes | `indigo` y `primary` apuntan a la misma rampa por tema |
| `showToast` sin efecto en vistas públicas | Sin `ToastContainer` en ese layout | Agregado |
| `/ordenes-servicio/generar` sin `projectId` quedaba cargando para siempre | El efecto salía sin apagar `loading` | Estado vacío con enlace a Mis Proyectos |
| Zoom bloqueado en móvil | `user-scalable=no` | Quitado |
| Dos errores de compilación de CSS durante el desarrollo (`ease-standard`, `bg-primary-hover`) | El servidor no recargó `tailwind.config.ts` | Reinicio del servidor; no afecta a builds |

## 4. Pendientes y observaciones

| Tipo | Detalle |
|---|---|
| Preexistente | `/herramientas` emite en consola "Cannot update a component while rendering a different component" (actualización de `useViewState` durante el render). Solo cambiaron clases en ese archivo; no se corrigió porque el comportamiento esperado de la selección de pestaña por rol no es inequívoco |
| Preexistente | 4 archivos usan `window.confirm` nativo en lugar del diálogo del sistema |
| Deuda | Capa de compatibilidad de modo oscuro (`globals.css`) reescrita sobre tokens pero conservada |
| Deuda | Los gráficos usan colores fijos del sistema; no siguen al tema de acento ni al modo oscuro |
| Visual | La miga de pan de `/ordenes-servicio/generar` muestra "generar" en minúscula (viene del historial de títulos) |
| Cobertura | Sin suite automatizada: se recomienda agregar `tests/` con Playwright para login (con usuario de prueba), navegación y un CRUD sobre una base descartable |

## 5. Capturas

| Vista | Antes | Después |
|---|---|---|
| Inicio | [antes/inicio-oscuro.jpg](assets/ux/antes/inicio-oscuro.jpg) | [despues/inicio.jpg](assets/ux/despues/inicio.jpg), [despues/inicio-movil.jpg](assets/ux/despues/inicio-movil.jpg) |
| Tickets | [antes/tickets.jpg](assets/ux/antes/tickets.jpg) | [despues/tickets.jpg](assets/ux/despues/tickets.jpg), [despues/tickets-oscuro.jpg](assets/ux/despues/tickets-oscuro.jpg) |
| Clientes | [antes/clientes.jpg](assets/ux/antes/clientes.jpg) | [despues/clientes.jpg](assets/ux/despues/clientes.jpg) |
| Órdenes de trabajo | [antes/ordenes-trabajo.jpg](assets/ux/antes/ordenes-trabajo.jpg) | [despues/ordenes-trabajo.jpg](assets/ux/despues/ordenes-trabajo.jpg) |
| Panel de Análisis | [antes/panel-analisis.jpg](assets/ux/antes/panel-analisis.jpg) | [despues/panel-analisis.jpg](assets/ux/despues/panel-analisis.jpg) |
| Ingreso | — | [despues/ingreso.jpg](assets/ux/despues/ingreso.jpg) |
| Diálogo de confirmación | — | [despues/dialogo-confirmacion.jpg](assets/ux/despues/dialogo-confirmacion.jpg) |
| Menú móvil | — | [despues/menu-movil.jpg](assets/ux/despues/menu-movil.jpg) |
| PDV | — | [despues/pdv.jpg](assets/ux/despues/pdv.jpg) |
| Estado vacío | — | [despues/estado-vacio-generar-os.jpg](assets/ux/despues/estado-vacio-generar-os.jpg) |
