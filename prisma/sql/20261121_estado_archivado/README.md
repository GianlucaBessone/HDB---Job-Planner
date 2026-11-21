# Migración: un solo estado del proyecto ("archivado")

Auditoría, E9. El proyecto tenía dos campos para lo mismo: `estado` y el interruptor `activo`. Ahora el estado
tiene un valor más, `archivado` (fuera de uso, se conserva por su historial), que reemplaza a `activo = false`.

- **Solo datos, sin cambios de esquema.** La columna `activo` queda en la base, sincronizada desde el estado
  (`activo = estado !== 'archivado'`, en `lib/dataLayer.ts`), porque muchas pantallas filtran por ella.
- El formulario ya no muestra el interruptor "Activo"; "Eliminar" un proyecto con historial lo archiva.

En producción (21/11/2026) los 120 proyectos tienen `activo = true`: la migración no cambia ninguna fila. Se
deja para otras bases y para dejar registro.

| Archivo | Qué hace |
|---|---|
| `up.sql` | Pasa a `archivado` los proyectos con `activo = false` |
| `down.sql` | Vuelve los archivados a `activo` con `activo = false` (el estado previo exacto no se guarda) |

## Despliegue

Da igual el orden: el código nuevo archiva al leer `activo = false` en una edición, y el viejo ignora el estado
`archivado` salvo para mostrarlo.

```bash
psql "$DATABASE_URL" -f prisma/sql/20261121_estado_archivado/up.sql
```
