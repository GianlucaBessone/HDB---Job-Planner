# Guía de marca — HDB SGI

La identidad visual del Sistema de Gestión Integral de HDB Servicios Eléctricos. Para los valores exactos y los componentes, ver [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).

---

## 1. Concepto: "precisión operativa"

HDB SGI es una herramienta de trabajo. La usan técnicos en una obra, con el teléfono en una mano y poca señal, y supervisores frente a un monitor durante horas. Ninguno de los dos abre el sistema para mirarlo: lo abre para registrar una hora, aprobar una fichada o cerrar una orden.

La interfaz se inspira en el **tablero eléctrico bien rotulado**: superficies neutras, rótulos claros, un solo color de acción y señales de color reservadas para el estado de las cosas. Lo que importa es el dato y la próxima acción; todo lo demás se retira.

## 2. Personalidad

| Es | No es |
|---|---|
| Sobria, técnica, confiable | Lúdica, decorativa, "startup" |
| Densa cuando hace falta (tablas, tableros) | Apretada ni ilegible |
| Directa: dice qué pasó y qué sigue | Ambigua ("¡Listo!", "Algo salió mal") |
| Consistente entre módulos | Una colección de pantallas independientes |

Tono de los textos: español rioplatense, voseo, frases cortas. Botones con verbos que nombran la acción ("Eliminar cliente", "Guardar cambios"), nunca "Aceptar" u "OK".

## 3. Principios de diseño

1. **El dato primero.** Los números usan cifras tabulares y peso semibold; las etiquetas, gris y tamaño menor. Un indicador no necesita un ícono de color para ser importante.
2. **Un color para actuar.** El color de marca identifica lo interactivo y lo seleccionado. Si algo es azul y no se puede tocar, está mal.
3. **El color de estado significa algo.** Verde = completado o válido, ámbar = requiere atención, rojo = error o vencido, celeste = en curso. Nunca se usa para decorar.
4. **Elevación con propósito.** Las superficies apoyadas en la página llevan borde, no sombra. Solo lo que flota (menús, diálogos, avisos) proyecta sombra.
5. **Una sola manera de hacer cada cosa.** Un diálogo de confirmación, un encabezado de página, un estilo de pestañas.
6. **Movimiento que explica.** Las transiciones duran 150–200 ms y solo acompañan un cambio de estado (abrir, cerrar, aparecer). Nada se mueve en reposo ni al pasar el mouse.
7. **Accesible por defecto.** Contraste AA, foco visible, objetivos táctiles de 40 px en móvil, zoom habilitado.

## 4. Logotipo

### Isotipo

Una **"H" cuyo travesaño es una chispa**: dos verticales firmes unidas por una línea que se quiebra como un arco eléctrico. Une la inicial de HDB con su oficio. Se dibuja en `components/shell/BrandMark.tsx` (SVG, trazo de 2,4 sobre una grilla de 24).

- Siempre en blanco sobre un cuadrado de color de marca con radio de 8 px (`rounded-lg`).
- Tamaños: 28 px en barras de navegación, 36 px en el ingreso, 48 px en la pantalla de carga.
- Área de respeto: la mitad del lado del cuadrado.
- No rotar, no aplicar degradados ni sombras, no cambiar el trazo.

### Logotipo

`HDB` en IBM Plex Sans semibold + `SGI` en regular y gris (`BrandWordmark`). El nombre comercial completo, "HDB Servicios Eléctricos", se usa en documentos impresos y en el portal de clientes.

## 5. Color

### Marca — Cobalto

| Uso | Token | Valor |
|---|---|---|
| Acción primaria, selección | `brand-600` / `primary` | `#1F60C1` (6,0:1 sobre blanco) |
| Hover de acción primaria | `brand-700` | `#1A51A2` |
| Fondos de selección | `brand-50` | `#F2F6FD` |
| Texto de marca en oscuro | `brand-300` | `#96B9EE` |

Un azul cobalto, más profundo y menos saturado que el azul "por defecto" de las librerías. Funciona en pantallas de baja calidad y a pleno sol.

**Temas de acento.** Desde Configuración → Tema cada persona puede cambiar el acento (Índigo, Naranja, Verde, Celeste, Rojo, Rosa, Violeta, Grafito). Cada tema es una rampa completa 50–950 generada con la misma curva de luminosidad y verificada para que el tono 600 tenga al menos 4,5:1 con texto blanco. **Los temas cambian solo el acento**: neutros y colores de estado no varían, así la legibilidad no depende del gusto.

### Neutros — Grafito

Grises fríos de baja saturación (tono 220). Son el 90 % de la interfaz.

| Token | Claro | Uso |
|---|---|---|
| `neutral-50` | `#F6F7F9` | Fondo de la aplicación |
| `neutral-200` | `#E1E4E9` | Bordes y divisores |
| `neutral-400` | `#6E7787` | Texto terciario, íconos (4,5:1) |
| `neutral-500` | `#5A6372` | Texto secundario |
| `neutral-900` | `#161B24` | Texto principal |

En modo oscuro la rampa se reajusta (no se invierte) para que los mismos pares de clases sigan cumpliendo contraste: el fondo es `#0E1116` y las superficies `#1E232C`.

### Estados

| Significado | Rampa | Ejemplo |
|---|---|---|
| Éxito, completado, firmado | `success` (esmeralda) | "Resuelto", "Firmada" |
| Atención, pendiente, por vencer | `warning` (ámbar) | "Fuera de SLA", "Pendiente de firma" |
| Error, vencido, crítico, eliminar | `danger` (rojo) | "Crítica", "Eliminar" |
| Información, en curso | `info` (celeste) | "En revisión", "En curso" |
| Funciones de IA y categorías secundarias | `accent` (violeta) | Asistente técnico, auditoría IA |

`red`/`rose`, `green`/`emerald`, `yellow`/`amber`, `purple`/`violet` apuntan a la misma rampa: hay un solo rojo, un solo verde y un solo ámbar.

### Proporción

≈ 90 % neutros · ≈ 7 % marca · ≈ 3 % estados. Si una pantalla tiene más color que eso, probablemente está decorando.

## 6. Tipografía

**IBM Plex Sans** para la interfaz y **IBM Plex Mono** para códigos, números de documento y PIN. Plex nació como tipografía corporativa de una empresa de ingeniería: es técnica sin ser fría, tiene cifras claras y distingue bien `1`, `l` e `I`, importante en códigos de OT y legajos.

| Estilo | Clase | Tamaño / interlineado | Peso | Uso |
|---|---|---|---|---|
| Display | `text-display` | 24,5 / 30 px | 600 | Saludo de Inicio, portadas públicas |
| Título | `text-title` | 19 / 24,5 px | 600 | Título de página (uno por vista) |
| Encabezado | `text-heading` | 15 / 21 px | 600 | Títulos de panel y de diálogo |
| Cuerpo | `text-sm`, `text-body` | 12,25–13 px | 400 | Texto general, celdas |
| Leyenda | `text-caption`, `text-xs` | 11,4 / 11,2 px | 400–500 | Ayudas, metadatos |
| Rótulo | `eyebrow` | 11,2 px, mayúsculas, +4 % | 600 | Encabezados de sección, columnas de tabla |

Reglas:
- Pesos permitidos: 400, 500, 600 y 700. El 800/900 no se usa.
- Mayúsculas solo en rótulos `eyebrow` y encabezados de tabla. Botones, etiquetas de formulario y descripciones van en tipo oración.
- Tamaño mínimo de texto: 11 px (metadatos, rótulos). Los 10 px quedan reservados a contadores dentro de insignias.
- Cifras tabulares (`tabular-nums`) en tablas, montos y KPI.

## 7. Iconografía

- Librería única: **Lucide** (`lucide-react`), trazo 2 px, esquinas redondeadas.
- Tamaños: 16 px en botones y controles, 18 px en navegación, 20 px junto al título de página.
- Color: hereda el del texto. Solo el ícono del título de página usa el color de marca.
- El ícono acompaña, no reemplaza: los botones de solo ícono llevan `aria-label` y `title`.
- Sin íconos sobre cuadrados de color sólido. Si hace falta un contenedor, es un cuadrado neutro (`bg-slate-100`) que toma el tinte de marca al pasar el mouse.

## 8. Composición

- **Retícula:** contenido con ancho máximo de 1600 px, márgenes laterales de 16/24/32 px según el ancho de pantalla, espaciado en múltiplos de 4 px.
- **Ritmo vertical:** 20 px entre el encabezado y el contenido; 32 px entre secciones; 10–12 px entre tarjetas de una grilla.
- **Una acción primaria por vista**, en el extremo derecho del encabezado (donde termina la lectura).
- **No anidar tarjetas.** Dentro de un panel se separa con divisores o espacio.
- **Alineación a la izquierda** para texto y títulos; números alineados a la derecha en tablas.

## 9. Aplicación

| Pieza | Cómo se ve |
|---|---|
| Barra lateral | Superficie blanca con borde derecho; sección actual abierta; ítem activo con fondo `brand-50` y texto `brand-700` |
| Barra superior | Translúcida sobre el fondo, 56 px, migas de pan a la izquierda; buscador, ayuda, tema y actividad a la derecha |
| Encabezado de página | Ícono de marca 20 px + título + descripción gris; acciones a la derecha; pestañas subrayadas debajo |
| Ingreso | Panel de marca grafito a la izquierda (escritorio) y formulario de dos campos a la derecha |
| Diálogo | Hoja inferior en móvil, centrado en escritorio, radio 12 px, sombra de overlay, acción destructiva en rojo y foco inicial en "Cancelar" |
| Aviso (toast) | Abajo a la derecha en escritorio, arriba en móvil; ícono de estado de color, texto neutro |

Capturas: [`docs/assets/ux/despues/`](assets/ux/despues/).

## 10. Qué evitar

- Degradados, brillos (`shadow-color`), desenfoques decorativos.
- Escalar o desplazar elementos al pasar el mouse.
- Íconos blancos sobre cuadrados de colores distintos para cada módulo.
- Texto gris claro sobre blanco para información que hay que leer.
- MAYÚSCULAS ESPACIADAS en botones y etiquetas.
- Más de un botón primario en la misma vista o diálogo.
