# Análisis de Pliegos

Módulo de Operaciones (`/pliegos`). Un admin sube el PDF de un pliego de cliente; la IA lo analiza y devuelve tareas en orden de ejecución, materiales (los del pliego evaluados y sugeridos), herramientas, personal, Higiene y Seguridad y alertas (errores, omisiones, ambigüedades y riesgos). Operadores, supervisores, admin y QA lo consultan desde el celular y marcan cada tarea dentro o fuera del pliego.

## Archivos

| Capa | Archivo |
|---|---|
| Modelos | `prisma/schema.prisma` → `Pliego`, `PliegoArchivo`, `PliegoAnalisis`, `PliegoTarea`, `PliegoTareaMarca` |
| Contrato y etiquetas (cliente y servidor) | `lib/pliegos.ts` |
| IA | `lib/pliegosIA.ts` + prompt `PLIEGO_ANALISIS` en `lib/ai/prompts.ts` y ruta en `lib/ai/router.ts` |
| Almacenamiento S3 | `lib/objectStorage.ts` (URLs prefirmadas SigV4, sin SDK) |
| Servidor | `lib/pliegosServer.ts` (actor, alta, subida, análisis, marcas) |
| API | `app/api/pliegos/**` |
| UI | `app/pliegos/**`, `components/pliegos/**` |
| Menú | `lib/viewAccess.ts` (`/pliegos`, sección Operaciones) |

## Permisos

- Ver y marcar tareas: `operador`, `supervisor`, `admin`, `qa` (`PLIEGO_ROLES_VER`).
- Subir, analizar, re-analizar y borrar: `admin` (`PLIEGO_ROLES_GESTION`).
- `vendedor` no accede. Las rutas responden 403; el menú se controla desde `lib/viewAccess.ts`.

## Flujo

1. `POST /api/pliegos` crea el pliego y devuelve una URL prefirmada (15 min) para subir el PDF.
2. El navegador hace `PUT` del PDF **directo al almacenamiento**, sin pasar por Vercel, así que no aplica el límite de 4,5 MB por request. El máximo es 14 MB, por el límite de Gemini con el archivo en base64.
3. `POST /api/pliegos/[id]/archivo/confirmar` verifica tamaño y firma `%PDF-` y guarda el SHA-256. Si no coincide, borra el objeto.
4. `POST /api/pliegos/[id]/analizar` (`maxDuration` 300 s) lee el PDF, llama a `performOCR` de `lib/ai` con un esquema de respuesta, valida con Zod y reintenta una vez si no cumple el contrato. Cada intento queda en `AiRequestLog` (Auditoría de IA).
5. Cada análisis es una versión (`PliegoAnalisis.version`). Solo la última admite marcas; las anteriores son de solo lectura. Al re-analizar, la marca vigente y el historial se copian a las tareas de la versión nueva que tengan el mismo título (sin distinguir mayúsculas, acentos ni signos).
6. `PATCH /api/pliegos/tareas/[id]` marca la tarea. "Fuera" exige qué se modificó y por qué. Cada marca queda en `PliegoTareaMarca` con nombre, rol, fecha y motivo.

Cada ítem del análisis lleva `origen` `PLIEGO` (con `referencia` a página e ítem) o `IA`. Si la IA no lo informa, se asume `IA`.

## Variables de entorno

| Variable | Uso |
|---|---|
| `GEMINI_API_KEY` | Ya usada por `lib/ai`. |
| `PLIEGO_AI_MODEL` | Opcional. Reemplaza el modelo de la ruta `PLIEGO_ANALISIS` (por defecto `gemini-2.5-flash`). |
| `AWS_ENDPOINT_URL_S3` | Endpoint S3 de Neon Storage de la rama de producción. |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Credenciales de Neon Storage. |
| `AWS_REGION` | Por defecto `us-east-1`. |
| `S3_BUCKET` | Por defecto `sgi-archivos` (bucket privado). Los PDF van con la clave `pliegos/<uuid>.pdf`. |

Sin las variables de almacenamiento, el alta responde 503 con un mensaje claro.

## Puesta en producción

1. Cargar las variables de arriba en Vercel (Production y Preview).
2. Aplicar el esquema con `npx prisma db push`, el método que usa el proyecto. Solo crea las 5 tablas nuevas, sus índices y FKs; no modifica tablas existentes.
3. Desplegar.

## Pruebas

Se probó de punta a punta con Postgres local, Neon Storage real y un servidor que imita la API de Gemini (vía `VERCEL_AI_GATEWAY_URL`): permisos por rol, alta, subida directa, verificación, descarga, análisis con reintento, marcas con historial, re-análisis con arrastre de marcas, versión de solo lectura y la interfaz en un iPhone emulado. La llamada real a Gemini queda pendiente de la clave de API.
