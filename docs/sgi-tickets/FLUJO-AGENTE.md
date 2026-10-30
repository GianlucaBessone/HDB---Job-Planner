# Flujo del agente OpenCode + MCP `sgi`

Documento operativo de cómo el agente evalúa y resuelve un ticket.

---

## 1. Arquitectura

```
Usuario
  │  reporta desde Ctrl+K o el header
  ▼
Next.js  /api/tickets  ─────────►  PostgreSQL (Ticket, Historial, Comentarios, Eventos)
  ▲                                        ▲
  │  vista /tickets                        │ Prisma
  │                                        │
Persona (gestor)                    MCP `sgi` (stdio)
                                           ▲
                                           │ tools/call
                                     OpenCode + agente sgi-ticket-fixer
                                           │
                                           ▼
                                     Repositorio local (edits + checks)
```

El MCP no edita archivos: **el agente edita**. El MCP es el que aplica las reglas, registra el análisis, crea el respaldo y mueve el estado. Así el código y los datos quedan sincronizados.

---

## 2. Secuencia obligatoria

```
1. tickets_policy            → leer límites
2. tickets_list / tickets_get → elegir y entender
3. tickets_start_analysis     → nuevo/triaje → en_analisis
4. tickets_record_analysis    → guarda diagnóstico + riesgo
                                ├─ riesgo bajo + error + auto-fix  → listo_para_fix
                                └─ cualquier otro caso             → pendiente_aprobacion
5. tickets_check_change       → validar archivos/líneas/diff
6. tickets_begin_fix          → backup + en_progreso (solo si permitido)
7. [edición de código]
8. npx tsc --noEmit          → (opcional: npm run lint)
9. tickets_record_fix         → en_revision + verificaciones
10. persona valida            → resuelto → cerrado
```

**Regla:** si en cualquier paso el resultado no es el esperado, se escala. No se fuerza.

---

## 3. Herramientas MCP

| Tool | Para qué | Efecto en el ticket |
|---|---|---|
| `tickets_policy` | Leer la política vigente. | Ninguno. |
| `tickets_list` | Listar con filtros. | Ninguno. |
| `tickets_get` | Ver detalle, historial y análisis. | Ninguno. |
| `tickets_start_analysis` | Marcar inicio del análisis. | → `en_analisis` |
| `tickets_record_analysis` | Guardar diagnóstico, alcance, esfuerzo y riesgo. | → `listo_para_fix` o `pendiente_aprobacion` |
| `tickets_check_change` | Validar un cambio contra guardrails. | Ninguno. |
| `tickets_begin_fix` | Aprobar y respaldar archivos. | → `en_progreso` |
| `tickets_record_fix` | Registrar cambio y verificaciones. | → `en_revision` |
| `tickets_add_comment` | Comentario o nota interna. | Comentario. |
| `tickets_update_status` | Mover estado respetando transiciones. | Cambio + historial. |
| `tickets_escalate` | Derivar a decisión humana. | → `pendiente_aprobacion` |
| `tickets_close` | Pasar a `resuelto` o `cerrado`. | Cierre. |

Los nombres que ve OpenCode son `sgi_tickets_policy`, `sgi_tickets_list`, etc. En Code Mode (el modo por defecto de V2) se llaman `tools.sgi.tickets_policy`, `tools.sgi.tickets_list`, etc.

Recursos:

- `sgi://policy` — política completa en JSON.
- `sgi://tickets/open` — tickets abiertos.

---

## 4. Ejemplos de prompts

### Triaje rápido

```text
Revisá los tickets nuevos con el MCP sgi. Clasificá cada uno y decime cuáles
son de bajo riesgo y cuáles necesitan mi aprobación. No edites nada todavía.
```

### Analizar uno

```text
Analizá el ticket TCK-2026-0003. Quiero causa raíz, alcance, esfuerzo y riesgo.
Si es bajo, corregilo y dejalo en revisión.
```

### Corregir varios de bajo riesgo

```text
Tomá todos los tickets en estado listo_para_fix de tipo error y resolvelos
de a uno. Después de cada uno corré tsc y lint.
```

### Consulta o funcionalidad

```text
Analizá el ticket TCK-2026-0007 (nueva función). Estimá alcance y pasalo a
pendiente_aprobacion con un plan. No toques código.
```

### Revisar un cambio del agente

```text
Mostrame qué cambió para el ticket TCK-2026-0003, dónde está el respaldo y
qué verificaciones corrió.
```

---

## 5. Formato del análisis

El agente escribe en `ticket.analisisAgente`:

```json
{
  "resumen": "El botón Guardar no envía el formulario si el título supera 120 caracteres.",
  "causaRaiz": "La validación del cliente trunca el string y deja el submit sin efecto.",
  "alcance": "Corregir la validación y el mensaje. No cambia el modelo de datos.",
  "plan": "1. Ajustar límite. 2. Mostrar error. 3. Probar caso borde.",
  "archivosProbables": ["components/projects/ProjectForm.tsx", "lib/validation/project.ts"],
  "esfuerzo": "S",
  "horas": 1.5,
  "confianza": "alta",
  "riesgo": "bajo",
  "requiereAprobacion": false,
  "categorias": [],
  "agente": "opencode",
  "fecha": "2026-10-29T12:00:00.000Z"
}
```

Y en `ticket.estimacion`:

```json
{ "esfuerzo": "S", "horas": 1.5, "confianza": "alta", "riesgo": "bajo" }
```

Esto se ve en la pestaña **Análisis del agente** de `/tickets`.

---

## 6. Escalamiento

Se escala a `pendiente_aprobacion` cuando:

- El riesgo es medio, alto o crítico.
- El tipo no es `error`.
- El ticket no tiene `autoFixPermitido`.
- Faltan pasos para reproducir o el problema no es claro.
- El cambio supera 4 archivos o 150 líneas.
- Toca autenticación, permisos, facturación, datos personales, migraciones o dependencias.
- `tickets_check_change` devuelve bloqueos.
- Ya se intentó corregir 2 veces y falló.

El gestor ve el ticket en **Pendiente de aprobación**, revisa el análisis y usa **Aprobar corrección** o **Escalar**.

Cuando se aprueba, el ticket pasa a `listo_para_fix` y el agente puede reintentar.

---

## 7. Respaldos y rollback

Cada `tickets_begin_fix` crea:

```
.sgi-backups/TCK-2026-0003/2026-10-29T12-30-00-000Z/
  components/projects/ProjectForm.tsx
  lib/validation/project.ts
```

Rollback:

1. Copiar el archivo del respaldo a su ruta original.
2. O usar el editor/IDE para revertir.
3. Registrar el rollback con `tickets_add_comment` (nota interna) y `tickets_escalate`.

La carpeta está en `.gitignore`; no se versiona.

---

## 8. Verificaciones

Obligatoria:

```bash
npx tsc --noEmit
```

Recomendada (si el proyecto tiene configuración de ESLint):

```bash
npm run lint
```

Recomendadas para UI:

```bash
npm run dev
# probar la pantalla afectada en desktop y mobile
```

El agente registra el resultado en `verificaciones`. Si faltan, el ticket queda en `en_revision` con `verificado = false`.

---

## 9. Problemas frecuentes

| Síntoma | Causa probable | Solución |
|---|---|---|
| `sgi` no aparece en `opencode mcp list` | `opencode.json` inválido o `node` fuera del PATH. | Validar JSON y `node -v`. |
| `No se pudo cargar @prisma/client` | Falta `npm install` o `prisma generate`. | Ejecutar ambos. |
| `Falta DATABASE_URL` | No existe `.env` o está vacío. | Crear `.env` con `DATABASE_URL`. |
| `No existe el ticket` | ID/código mal escrito. | Usar `tickets_list` para obtener el código. |
| `Transición inválida` | Se intentó saltar estados. | Respetar el flujo; usar `tickets_record_analysis` primero. |
| `Ruta prohibida` | El cambio toca una denylist. | Escalar; no editar. |
| `El cambio requiere aprobación` | Supera archivos/líneas o toca categoría sensible. | Aprobar desde `/tickets` o reducir el alcance. |
| `@prisma/client no expone PrismaClient` | Versión incompatible. | Verificar `@prisma/client@5.22`. |

---

## 10. Cómo extender

- **Nuevo estado**: agregarlo en `policy.json → transiciones`, en `lib/tickets.ts` (`TICKET_ESTADOS`, `TICKET_TRANSICIONES`, labels) y en el `z.enum` de `app/api/tickets/[id]/route.ts`.
- **Nueva regla de auto-fix**: agregar la categoría en `requiresApprovalCategories` y documentarla.
- **Nuevo tipo**: agregar en `TICKET_TIPOS` y en el `z.enum` de creación.
- **Notificaciones**: enganchar `sendPushNotification` en el PATCH de estado, como hace `app/api/sugerencias/[id]/route.ts`.
- **Adjuntos en la nube**: reemplazar el handler `app/api/tickets/upload/route.ts`.
