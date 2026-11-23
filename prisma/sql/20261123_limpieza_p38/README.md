# Migración: limpieza de datos sin uso (P38)

Auditoría, P38. **Destructiva: primero el código, después la base.**

| Cambio | Detalle |
|---|---|
| `ProjectTag.impactsMetrics` | Se borra. "Impacta métricas" no tenía efecto: la exclusión de métricas es por proyecto (`noEnMetricas`) y por tipo de proyecto |
| `SystemSetting.dailyReminderTime` | Pasa a opcional, sin valor preseteado (antes `16:45`), y queda vacía: hay que elegir la hora en Configuración → Asistencia → Ajustes. Sin hora no se envía el aviso |

`TagChecklistItem` **no se borra**: la auditoría la marcó como sin uso, pero `lib/proyectos/checklistsPorEtiqueta.ts`
la lee (relación `checklists`) para armar el checklist de los proyectos nuevos según sus etiquetas.

## Recordatorio diario: cron-job.org en lugar de Vercel

Antes Vercel llamaba a `/api/cron/reminders` una vez por día a hora fija (21:00 UTC = 18:00 de Argentina) y la
hora configurada no tenía efecto. Ahora `vercel.json` no programa nada y la llamada la hace **cron-job.org**:

- **URL**: `https://<dominio de producción>/api/cron/reminders` (GET).
- **Encabezado**: `Authorization: Bearer <CRON_SECRET>` (la misma variable de entorno de Vercel).
- **Frecuencia**: cada 5 minutos (o cada 15). El endpoint envía la primera vez que la hora de Argentina llega a la
  hora configurada; la clave `daily-reminder-<fecha>` evita repetirlo en el día. Antes de la hora responde
  "Todavía no"; sin hora, "Sin hora configurada".

## Prueba realizada (23/11/2026)

Base local PostgreSQL 16 con el esquema de `main`: ida, vuelta e ida otra vez, 0 diferencias en cada paso.

## Despliegue

1. **Código**: mergear el PR (el código nuevo no lee `impactsMetrics` y acepta la hora vacía).
2. **Base**, con la URL directa de producción:
   ```bash
   psql "$DATABASE_URL" -f prisma/sql/20261123_limpieza_p38/up.sql
   ```
3. **Configuración → Asistencia → Ajustes**: elegir la hora del aviso.
4. **cron-job.org**: crear el trabajo (arriba).

**Vuelta**: `down.sql` (vuelve `impactsMetrics` en false y la hora en 16:45), después el código.
