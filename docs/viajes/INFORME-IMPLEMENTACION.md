# Viajes y viáticos — Informe de implementación

Módulo para planificar viajes de trabajo, registrar sus gastos desde el celular y rendirlos.
Dos vistas:

| Vista | Ruta | Roles | Sección |
|---|---|---|---|
| Gestión de Viajes | `/viajes` | admin, supervisor, qa | Administración |
| Mis Viajes | `/mis-viajes` | todos los roles internos | Operaciones |

---

## 1. Flujo

```
 ADM crea el viaje            Responsable                         ADM
 ─────────────────            ─────────────────────────           ───────────────────────
 Planificado  ──iniciar──▶  En curso  ──concluir──▶  Finalizado  ──cerrar──▶  Cerrado
     │                         │  registra gastos         │  verifica cada gasto
     │                         │  extiende estadía        │  (checklist)
     │                         │                          │
     └──────cancelar───────────┴──▶ Cancelado             └──devolver──▶ En curso
```

1. **Administración** crea el viaje: motivo, origen, destino, fechas, proyecto (opcional),
   participantes, responsable, modalidad de fondos y costos estimados.
2. **El responsable** lo ve en *Mis Viajes*, lo inicia y registra los gastos con foto del ticket.
   Ve en todo momento lo gastado contra lo estimado y el saldo de los fondos entregados.
   Puede extender la estadía y marcar los gastos que pagó con sus medios.
3. **El responsable concluye** el viaje. Ya no puede cargar ni editar gastos.
4. **Administración rinde**: revisa cada gasto (aprobar, observar con monto ajustado o rechazar),
   y cierra el informe. Si falta algo, lo devuelve al responsable con un motivo.

Los participantes que no son responsables ven el viaje en *Mis Viajes* en modo lectura.

## 2. Reglas de negocio

### Modalidad de fondos
- **Anticipo (pre-viaje):** se entrega un monto antes de salir. Los gastos se pagan por defecto
  con *fondos del viaje*.
- **Contra rendición:** no se entrega dinero. Todo gasto se paga con *medios propios* y se reintegra.

En ambos casos el responsable puede marcar un gasto como pagado con **medios propios**
(p. ej. cuando se extiende la estadía y el anticipo no alcanza).

### Costos estimados
Cada línea tiene categoría, monto unitario y **base de cálculo**:
`total` · `por día` · `por noche` · `por persona` · `por persona y día` · `por persona y noche`.
El estimado se recalcula solo con los días/noches y la cantidad de personas, así que **extender la
estadía actualiza el presupuesto** sin recargarlo.

- Días = fecha de inicio a fecha de fin, inclusive. Noches = días − 1.
- Personas = participantes del viaje.

### Gastos
- Fecha, categoría, monto, descripción, comercio, N° de comprobante, hasta 6 fotos/PDF.
- **Alcance:** *global* (todo el viaje, ej. combustible) o *individual* (se eligen los participantes
  a los que afecta; el monto se reparte en partes iguales).
- **Medio de pago:** *fondos del viaje* o *medios propios*.
- Se cargan/editan mientras el viaje está *planificado* o *en curso*, solo por el responsable.

### Saldo y liquidación
| Indicador | Cálculo |
|---|---|
| Estimado | Suma de las líneas de costo |
| Gastado | Suma de los gastos |
| Disponible vs. estimado | Estimado − Gastado |
| Saldo de fondos | Anticipo − gastos pagados con fondos |
| A reintegrar al responsable | Gastos pagados con medios propios |
| **Resultado de la rendición** | Anticipo − Total aprobado → si es positivo el responsable **devuelve**; si es negativo la empresa **reintegra** |

En la rendición cada gasto queda *aprobado*, *observado* (con monto aprobado distinto) o
*rechazado*. No se puede cerrar con gastos pendientes. Al cerrar se guarda una foto fija de los
totales (estimado, gastado, aprobado, anticipo, resultado), aunque después cambie la configuración.

También se informa el **costo por persona**: gastos individuales de cada uno + gastos globales
prorrateados.

## 3. Modelo de datos (Prisma)

Tablas nuevas, todas con prefijo `Viaje` y borrado en cascada desde `Viaje`:

| Modelo | Contenido |
|---|---|
| `ViajeCounter` | Numerador anual del código (`VJE-2026-0001`) |
| `Viaje` | Cabecera: motivo, origen, destino, fechas, estado, modalidad, anticipo, responsable, proyecto, datos de cierre y totales congelados |
| `ViajeParticipante` | Personas del viaje: operador del sistema o externo (solo nombre) |
| `ViajeCostoEstimado` | Líneas de presupuesto con base de cálculo |
| `ViajeGasto` | Gastos con alcance, medio de pago y verificación (estado, monto aprobado, observación, quién y cuándo) |
| `ViajeGastoAfectado` | Participantes afectados por un gasto individual |
| `ViajeComprobante` | Fotos/PDF de tickets guardados en la base (Vercel no tiene disco), como `TicketAdjunto` |
| `ViajeExtension` | Historial de extensiones de estadía (fecha anterior, nueva, motivo) |
| `ViajeHistorial` | Línea de tiempo del viaje (trazabilidad ISO 9001) |

`Operator` y `Project` solo suman relaciones inversas; no cambia ninguna columna existente.
Montos en `Float` redondeados a 2 decimales (mismo criterio que el resto del sistema). Fechas de
viaje y de gasto en `@db.Date` (sin hora, sin problemas de zona horaria).

## 4. API (`app/api/viajes/**`)

Todas validan con Zod, devuelven `NextResponse.json` y usan `x-user-id` / `x-user-role` del middleware.

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `GET /api/viajes` | Gestores: todos (filtros `estado`, `q`). Resto: `?mios=1` | Lista con totales calculados |
| `POST /api/viajes` | Gestores | Crea el viaje y notifica al responsable |
| `GET /api/viajes/[id]` | Gestores, responsable, participantes | Detalle completo + resumen financiero |
| `PATCH /api/viajes/[id]` | Gestores (no cerrado/cancelado) | Edita configuración, participantes y costos |
| `DELETE /api/viajes/[id]` | Gestores (solo planificado sin gastos) | Elimina |
| `POST /api/viajes/[id]/estado` | Según acción | `iniciar`, `concluir`, `devolver`, `cerrar`, `cancelar` |
| `POST /api/viajes/[id]/extensiones` | Responsable | Extiende la fecha de fin con motivo |
| `POST /api/viajes/[id]/gastos` | Responsable | Registra un gasto |
| `PATCH/DELETE /api/viajes/[id]/gastos/[gastoId]` | Responsable (editable) | Edita o elimina |
| `POST /api/viajes/[id]/verificacion` | Gestores (finalizado) | Verifica uno o varios gastos |
| `POST /api/viajes/comprobantes` | Sesión | Sube un comprobante (valida firma del archivo) |
| `GET /api/viajes/comprobantes/[id]` | Gestores, responsable, participantes | Descarga/visualiza |

Las fotos se **comprimen en el celular** antes de subir (máx. 1600 px, JPEG) para no superar el
límite de 4,5 MB de Vercel y no inflar la base. Los comprobantes sueltos que nunca se vinculan a un
gasto se borran a las 24 h.

Notificaciones (actividad interna + push OneSignal): al responsable cuando se le asigna un viaje o
se le devuelve; a supervisores/administradores cuando un viaje se concluye y queda para rendir.
Todo cambio de estado se registra en `ViajeHistorial` y en `AuditLog`.

## 5. Interfaz

### Gestión de Viajes (`/viajes`) — escritorio primero
- `ModuleHeader` con buscador, pestañas *Activos · Por rendir · Cerrados · Cancelados* y "Nuevo viaje".
- Indicadores: viajes en curso, por rendir, estimado activo, gastado activo.
- Tabla (en móvil, tarjetas): código, motivo, ruta, fechas, responsable, modalidad, avance de gasto, estado.
- Diálogo de alta/edición en secciones: datos, participantes y responsable, fondos, costos estimados
  con vista previa del total.
- Detalle `/viajes/[id]`: resumen financiero, costos, gastos con fotos, **rendición tipo checklist**
  (aprobar / observar / rechazar, "Aprobar pendientes"), cierre con resultado de liquidación,
  costo por persona, historial e informe imprimible.

### Mis Viajes (`/mis-viajes`) — celular primero
- Tarjetas grandes por viaje con estado, ruta, fechas y barra de consumo.
- Detalle `/mis-viajes/[id]`: tarjeta de saldo (gastado / estimado / saldo de fondos), barra de
  acción fija abajo con **"Registrar gasto"**, menú con *Extender estadía* y *Concluir viaje*.
- Registro de gasto en hoja inferior: monto grande con teclado numérico, categorías en chips,
  global/individual con selección de personas, fondos/medios propios, **cámara directa** para el
  ticket y miniaturas.
- Objetivos táctiles ≥ 40 px, sin scroll horizontal, sin zoom de iOS (campos de 16 px).

Todo con `components/ui` y tokens del sistema de diseño; acceso a vistas declarado en
`lib/viewAccess.ts`; acción "Nuevo viaje" registrada en `useCommandStore`.

## 6. Archivos

```
prisma/schema.prisma                          modelos Viaje*
lib/viajes.ts                                 catálogos, etiquetas, cálculo de estimado y resumen
lib/viajesServer.ts                           permisos, carga del viaje, historial, notificaciones
lib/viewAccess.ts / lib/iconRegistry.tsx      vistas e ícono nuevos
app/api/viajes/**                             API
app/viajes/page.tsx, app/viajes/[id]/page.tsx gestión
app/mis-viajes/page.tsx, [id]/page.tsx        responsable
components/viajes/*                           formularios, listas, resumen, comprobantes
docs/viajes/                                  este informe y el reporte de pruebas
```

## 7. Despliegue

Las tablas nuevas se crean con `npx prisma db push` contra la base de producción (no hay
migraciones activas en el repo). Es un cambio **solo aditivo**: no modifica ni borra columnas
existentes. Las tablas quedan vacías: el módulo no trae datos semilla.

1. Mergear el PR y desplegar.
2. Con `DATABASE_URL` de producción: `npx prisma db push` (crea las 9 tablas `Viaje*`).
3. Si un rol personalizó la configuración de vistas, las dos nuevas aparecen solas (se agregan a
   la configuración guardada); revisar sus roles en Configuración.

Si se hacen pruebas en producción antes de la carga real, se vacían con:

```sql
TRUNCATE "Viaje", "ViajeCounter" RESTART IDENTITY CASCADE;
DELETE FROM "ViajeComprobante";
DELETE FROM "ActivityRecipient" WHERE "activityId" IN (SELECT id FROM "Activity" WHERE "entityType" = 'viaje');
DELETE FROM "Activity" WHERE "entityType" = 'viaje';
```

(El `CASCADE` vacía participantes, costos, gastos, afectados, extensiones e historial.)

## 8. Valores de referencia y precálculo

En **Viajes y Viáticos**, el ícono de engranaje (entre el buscador y "Actualizar") abre los valores
de referencia: desayuno, almuerzo/cena en lugar de residencia y en viaje, hotelería, auto propio,
combustible gas y nafta. Cada guardado crea una versión con su **vigencia desde** (tabla
`ViajeTarifa`), y la vigente es la última con vigencia hasta hoy, así que se puede cargar con
anticipación. Los viajes ya creados conservan sus montos. Mientras no se guarde nada se usan los de
la planilla del 04/11/2026.

Al crear un viaje se elige el **medio de transporte** y los **km de ida** (con "ida y vuelta"), y
los costos estimados se precalculan solos:

| Línea | Base | Cálculo |
|---|---|---|
| Transporte (auto propio, nafta o gas) | Monto total | km totales × valor por km |
| Desayuno | Por persona y día | valor de desayuno |
| Almuerzo y cena | Por persona y día | valor por comida (en viaje o en lugar de residencia) × comidas por día |
| Hotelería | Por persona y noche | valor de hotelería |

Si se toca una línea a mano, deja de recalcularse ("Volver a precalcular" la restituye). Al editar
un viaje existente los costos no cambian salvo con "Recalcular con valores vigentes". El viaje
guarda medio, km, ida y vuelta y la versión de valores usada (`medioTransporte`, `kmIda`,
`idaYVuelta`, `tarifaId`).

**Origen y destino en el mapa.** Los campos de origen y destino sugieren lugares mientras se
escribe (desde la tercera letra, con 300 ms de pausa), con localidades primero y limitadas a
Argentina. También se puede tocar el mapa para marcar el punto (el control "Origen / Destino" indica
cuál) o arrastrar los marcadores A y B. Con los dos puntos ubicados, se dibuja la ruta y los km de ida
se calculan solos. Si se escribe un lugar sin elegirlo de la lista, "Calcular km" toma la primera
coincidencia.

**Proveedor de mapas.**

| | Con Google Maps | Sin clave (o si Google la rechaza) |
|---|---|---|
| Sugerencias | Places API (New), limitado a Argentina, en español | Photon (OpenStreetMap) |
| Tocar el mapa | Geocoding API | Photon (búsqueda inversa) |
| Mapa | Maps JavaScript API | Leaflet + mosaicos de OpenStreetMap |
| Ruta y km | OSRM (OpenStreetMap) | OSRM (OpenStreetMap) |

Google se activa con la variable `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` en Vercel (Production y
Preview). **No va en el repositorio.** Es una clave de navegador, visible en la página por
diseño, así que en Google Cloud Console hay que:

1. Crear la clave en *APIs y servicios → Credenciales → Crear credenciales → Clave de API*.
   Empieza con `AIza…`; las claves `AQ.…` de Vertex AI no sirven para Maps.
2. Habilitar **Maps JavaScript API**, **Places API (New)** y **Geocoding API**, con la
   facturación activa en el proyecto.
3. Restringirla por **referente HTTP** a los dominios de la app (producción y vistas previas de
   Vercel) y por **API** a esas tres.

Si la clave falta, es inválida o no tiene permisos, el sistema lo detecta (`gm_authFailure`), deja
un aviso `[VIAJES_MAPS]` en la consola y sigue con OpenStreetMap. Las coordenadas no se guardan: el
viaje guarda el nombre del lugar y los km, así que al editar un viaje el mapa arranca vacío.

## 9. Notificaciones

Cada evento se avisa (actividad interna + push) al **creador** y al **responsable** del viaje,
salvo a quien hizo la acción. El responsable recibe el enlace a Mis Viajes y el creador a la gestión.

| Evento | Responsable | Creador |
|---|---|---|
| Creado / reasignado | ✔ | — (lo hizo él) |
| Iniciado, extendido, concluido | si lo hizo otro | ✔ |
| Cerrado, devuelto, cancelado | ✔ | si lo hizo otro gestor |

Si el creador y el responsable son la misma persona, no se autonotifica. Si el viaje no tiene creador
(usuario dado de baja), conclusión y extensión van a supervisores y administradores. El envío a
OneSignal se espera (con un tope de 6 s) para que Vercel no corte la función antes de mandarlo.

## 10. Fuera de alcance (posibles mejoras)
- Lectura automática del ticket con IA (ya existe para Gastos y Facturas; se puede reutilizar).
- Carga sin conexión (cola offline).
- Exportación contable / vínculo con `FacturaConsumo`.
- Múltiples entregas de fondos con su propio registro (hoy el anticipo es un único monto editable,
  auditado en el historial).
