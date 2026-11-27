# Presupuestos de servicio → proyectos

Reemplaza el Excel de presupuestos de servicio. Un presupuesto aceptado se convierte en proyecto con
cliente, tareas, horas, materiales y fechas precargados; el supervisor solo ajusta fechas y asigna
el equipo.

## Flujo

```
borrador ──enviar──▶ enviado ──aceptar──▶ aceptado ──convertir──▶ proyecto
   ▲                    │  └──rechazar──▶ rechazado
   └──nueva revisión────┘  └──(validez)──▶ vencido
```

- **Revisiones**: antes de la aceptación, "Nueva revisión" congela la versión enviada y abre otra
  en borrador. El historial compara versiones.
- **Aceptar** registra la aceptación del cliente (fecha, referencia, comentario) y guarda una
  **copia congelada** (`PresupuestoServicioSnapshot`) con hash SHA-256. Un trigger de la base
  impide modificarla o borrarla.
- **Convertir en proyecto** abre el asistente con todo precargado. La conversión es una sola
  transacción: el presupuesto queda tomado por un único proyecto aunque dos personas conviertan a
  la vez.
- **Vencido**: un presupuesto enviado pasa a vencido al cumplirse su validez.

## Montos

- **Materiales**: precio de la lista de precios del cliente; si no tiene, se elige una para el
  presupuesto. La lista ajusta solo materiales.
- **Mano de obra**: categorías (oficial, medio oficial, ayudante…) con valor hora en
  *Presupuestos de servicios › Mano de obra* (admin y supervisor). Cada línea tiene tres modos,
  siempre editables: manual, costo según tiempo, tiempo según costo.
- **IVA**: discriminado o incluido según la configuración de la lista de precios de Ventas y
  Comercial. Los totales usan el mismo cálculo que las ventas (hay un test de paridad).
- **Documento**: vista en vivo con un deslizador de agrupamiento (Detallado → Por tarea →
  Subtotales → Total) y PDF.

## Plazo

Se estima con las horas de mano de obra ÷ (operarios en simultáneo × **horas por día**). Las horas por
día son la jornada de cada obra (8 por defecto) y se cargan en el presupuesto, en *Plazo, validez y
condiciones*. El documento, la copia congelada y el asistente de proyectos usan ese valor; las copias
congeladas anteriores a este campo se toman con 8.

## Asistente de nuevo proyecto (`/projects/nuevo`)

Seis pasos: origen, datos generales, tareas y horas, materiales, fechas y equipo (con
disponibilidad), revisión. Marca qué dato viene del presupuesto, valida en línea y guarda borrador
por usuario. El alta clásica sigue disponible en `/projects?alta=clasica`.

Las horas por día del paso 5 vienen del presupuesto (o 8 en un proyecto manual), se pueden cambiar
y quedan en el equipo asignado.

La asignación de operadores se registra (`ProyectoAsignacion`); no crea bloques en
Planificación. La disponibilidad cuenta Planificación, otras asignaciones, viajes y vacaciones.
El fichado acepta la asignación como válida: un operario del equipo asignado no recibe la alerta
"no asignado" aunque no figure en la agenda del día.

## Presupuestado vs. real

Pestaña en *Costo del proyecto* para proyectos con presupuesto. Compara contra la copia congelada:

- **Horas**: `Project.horasConsumidas`, el mismo valor del dashboard. Sale solo del registro de
  tiempos (por registro `ceil(horas)`, extras ×2, sin devoluciones); generar una OS no lo cambia y
  no se edita a mano. Para alinear datos viejos: `scripts/recalcular-horas-consumidas.ts`.
- **Materiales**: lo usado, o lo entregado si no hay usos (igual que *Costo real*).
- **Monto neto**: valorizado con los precios del presupuesto.

**Horas reales por tarea** (fase 2): el registro de horas puede indicar la tarea del proyecto (`TimeEntry.proyectoTareaId`); la tabla suma la columna "Reales" y una fila "Sin tarea indicada".
Los proyectos sin presupuesto no muestran nada nuevo y sus KPI no cambian.

## Permisos y auditoría

Ver `docs/CONTROL_ACCESOS.md`. Auditoría registra creación, edición, envío, revisiones,
aceptación, rechazo, duplicado y conversión (`CONVERT`), con el usuario de la sesión.

## Código

| Qué | Dónde |
|---|---|
| Modelo y migración | `prisma/schema.prisma`, `prisma/sql/20261118_presupuestos_servicio/` |
| Lógica | `lib/presupuestosServicio/`, `lib/proyectos/` |
| API | `app/api/presupuestos-servicio/**`, `app/api/projects/{wizard,borradores}`, `app/api/projects/[id]/{tareas,asignaciones,presupuesto-vs-real}`, `app/api/operators/disponibilidad` |
| Pantallas | `app/presupuestos-servicio/**`, `app/projects/nuevo`, `components/presupuestosServicio/`, `components/projects/wizard/` |

## Despliegue y reversión

Ver `prisma/sql/20261118_presupuestos_servicio/README.md`: respaldo, migración (primero la base,
después el código), verificación y vuelta atrás.

## Pruebas

Unitarias (sin base):

```bash
npx tsx --test scripts/tests/presupuestos-calculos.test.ts
```

Integración: crean y limpian sus propios datos, pero **solo contra una base de prueba** con la
migración aplicada (nunca producción):

```bash
DATABASE_URL=<base de prueba> npx tsx scripts/test-presupuestos-integracion.ts
```

```bash
DATABASE_URL=<base de prueba> npx tsx scripts/test-proyectos-wizard-integracion.ts
```

```bash
DATABASE_URL=<base de prueba> npx tsx scripts/test-regresion-proyectos-sin-presupuesto.ts
```

La última comprueba que un proyecto sin presupuesto se lista, se edita y se reporta igual (listado,
detalle, costo, dashboard) antes y después de usar todo el módulo.
