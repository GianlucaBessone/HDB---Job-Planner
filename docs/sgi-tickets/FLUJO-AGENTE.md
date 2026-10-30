# Flujo para resolver tickets con un agente

Cualquier agente con acceso al repositorio (Claude Code, OpenCode, Cursor, Codex, etc.) puede resolver
tickets usando la API HTTP `/api/agente`. No hace falta instalar nada en el agente ni darle credenciales
de la base: solo un token.

---

## 1. Piezas

| Pieza | Dónde | Qué hace |
|---|---|---|
| Instrucciones | `GET /api/agente/instrucciones` | Texto para el agente: protocolo, endpoints y reglas. Público, sin datos. |
| API | `app/api/agente/**` | Leer tickets, tomarlos, comentar, escalar y registrar la solución. |
| Tokens | modelo `TicketAgenteToken`, `lib/ticketsAgente.ts` | Acceso por ticket (48 h) o general. Se guarda solo el hash. |
| Botón | pestaña **Análisis del agente** en `/tickets` | "Copiar para agente" y "Revocar acceso". Solo `admin`, `qa`, `supervisor`. |

## 2. Flujo

```
Persona (gestor)                       Agente (con el repo)                 Sistema
─────────────────                      ────────────────────                 ───────
Copiar para agente  ──── texto ───────▶ lee /instrucciones
                                       GET  /tickets/{codigo}
                                       POST /tickets/{codigo}/tomar  ──────▶ en_progreso (bloqueo 4 h)
                                       trabaja en la rama ticket/{codigo}
                                       POST /tickets/{codigo}/solucion ────▶ en_revision + aviso a gestores
                                         (o /escalar si no corresponde) ──▶ pendiente_aprobacion + aviso
Revisa el PR, mergea y publica
Marca "resuelto" en /tickets ─────────────────────────────────────────────▶ respuesta de Gemini + push al usuario
```

El agente **no puede** marcar un ticket como resuelto ni cerrarlo: no existe un endpoint para eso.
"Resuelto" significa que el arreglo está publicado, y eso lo decide una persona.

## 3. Delegar un ticket

1. Abrí el ticket en `/tickets` → pestaña **Análisis del agente**.
2. Si hace falta, **Analizar con IA** para que Gemini deje un diagnóstico previo.
3. **Copiar para agente**. Se copia un texto como este:

   ```text
   Resolvé el ticket de soporte TCK-2026-0007 de HDB SGI en este repositorio.
   Antes de empezar, leé las instrucciones: https://sgi.hdb-se.com.ar/api/agente/instrucciones
   Token de acceso (header "Authorization: Bearer ..."): sgia_…
   El token sirve solo para este ticket y vence el 01/11/2026, 18:00.
   ```

4. Pegalo en el agente, abierto en una copia del repositorio.
5. Cuando el agente termina, el ticket pasa a `en_revision` con la rama, el commit y el PR visibles en la misma pestaña.

Generar un acceso nuevo revoca el anterior. **Revocar acceso** corta el token en el momento.

## 4. Endpoints

Todas las rutas, salvo `/instrucciones`, piden `Authorization: Bearer <token>`.

| Método | Ruta | Efecto |
|---|---|---|
| GET | `/api/agente/instrucciones` | Ninguno. |
| GET | `/api/agente/tickets` | Token de ticket: ese ticket. Token general: los `listo_para_fix`. |
| GET | `/api/agente/tickets/{codigo}` | Ninguno. Incluye análisis previo, adjuntos, comentarios (también internos) e historial. |
| GET | `/api/agente/tickets/{codigo}/adjuntos/{id}` | Ninguno. |
| POST | `/api/agente/tickets/{codigo}/tomar` | → `en_progreso`, bloqueado 4 h para otros tokens. |
| POST | `/api/agente/tickets/{codigo}/comentarios` | Comentario (interno por defecto). |
| POST | `/api/agente/tickets/{codigo}/escalar` | → `pendiente_aprobacion`, nota interna y push a gestores. |
| POST | `/api/agente/tickets/{codigo}/solucion` | → `en_revision`, guarda resolución, rama, commit y PR; push a gestores. |

Desde dónde se puede tomar un ticket:

- **Token de un ticket**: `nuevo`, `triaje`, `en_analisis`, `pendiente_aprobacion`, `listo_para_fix`, `en_progreso`, `en_revision` (lo generó una persona para ese ticket).
- **Token general**: solo `listo_para_fix`.

`/solucion` exige haber tomado el ticket con el mismo token. `commit` tiene que ser un hash de git y `prUrl` una URL `https`.

## 5. Seguridad

- El token da acceso solo a la API de tickets, no a la base ni al resto del sistema.
- Se muestra una sola vez; en la base queda el hash SHA-256.
- Los tokens de ticket vencen a las 48 h (`TOKEN_TICKET_HORAS` en `lib/ticketsAgente.ts`).
- Cada acción queda en `TicketEventoAgente`, en el historial del ticket y, al generar el token, en el `AuditLog`.
- Los avisos push a gestores solo se envían en producción.
- El control real es la revisión humana: el agente trabaja en una rama y una persona decide qué se publica.

## 6. Problemas comunes

| Síntoma | Causa | Qué hacer |
|---|---|---|
| `401` | Token vencido, revocado o mal copiado. | Generar uno nuevo desde el ticket. |
| `404` en un ticket | El token es de otro ticket. | Usar el token del ticket correcto. |
| `409` al tomar | Estado no tomable u otro agente lo tiene bloqueado. | Esperar el bloqueo o generar un acceso nuevo (libera el bloqueo). |
| `409` en `/solucion` | No se tomó el ticket con ese token. | `POST /tomar` primero. |

## 7. Pendiente

- Tokens generales (sin ticket) desde la UI: el modelo y la API los soportan, falta la pantalla para crearlos.
- Pasar a `resuelto` automáticamente cuando el commit con el código del ticket llega a producción (webhook de GitHub o Vercel).
