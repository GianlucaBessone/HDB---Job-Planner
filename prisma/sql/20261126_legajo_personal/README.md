# Migración: legajo del personal

Auditoría, faltante "Legajo de personal". Crea dos tablas nuevas:

- `LegajoPersonal` (1 a 1 con `Operator`): número de legajo, fechas de ingreso y egreso, CUIL, fecha de nacimiento,
  contacto, obra social, grupo sanguíneo, contacto de emergencia y observaciones. El DNI sigue en `Operator.dni`.
- `DocumentoPersonal`: documentos de la persona con vencimiento (apto médico, licencia de conducir, ART,
  habilitaciones, seguros…), con archivo adjunto opcional en el almacenamiento de archivos (`rrhh/legajo/…`).
  Los vencimientos aparecen en el calendario único de vencimientos.

- **Aditiva: primero la base, después el código.** No toca tablas existentes (solo claves foráneas a `Operator`,
  con borrado en cascada).
- `down.sql` borra las dos tablas (primero volver el código). Los archivos adjuntos quedan en el almacenamiento.

## Despliegue

1. `psql "$DATABASE_URL" -f prisma/sql/20261126_legajo_personal/up.sql`
2. Mergear el PR.
