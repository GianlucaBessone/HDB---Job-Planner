# Viajes y viáticos — Reporte de pruebas

Fecha: 4 nov 2026. Entorno: Postgres 16 local descartable + `npm run dev`, sin conexión a la base
de producción. Al terminar se vaciaron las tablas del módulo y se borró la base de prueba.

## 1. API — 85 de 85 casos OK

| Bloque | Qué se verificó |
|---|---|
| Autenticación y permisos | Sin sesión → 401. Un operador no lista todos los viajes, no crea, no edita, no elimina, no verifica (403). Un ajeno no ve el viaje ni sus comprobantes (404). El participante ve el viaje en modo lectura y no puede iniciar ni cargar gastos. Administración no carga gastos (separación de funciones). |
| Validaciones | Fin anterior al inicio, motivo corto, participantes repetidos, monto 0, gasto individual sin personas, persona ajena al viaje, comprobante subido por otro o ya usado, archivo que no es imagen/PDF (por firma, no por extensión). |
| Alta | Código correlativo `VJE-AAAA-NNNN`; el responsable se agrega solo como participante; estimado con bases por día/noche/persona (365.000 = 80.000 + 25.000×3×2 + 15.000×3×3). |
| Gastos | Global, individual, medios propios, con foto; edición (monto y personas afectadas) y borrado; saldos recalculados. Contra rendición fuerza medios propios y anticipo 0. |
| Estados | Iniciar (una sola vez), extender (solo a fecha posterior y con motivo; el estimado pasa de 365.000 a 485.000), concluir (bloquea gastos y extensiones), devolver con motivo, cerrar solo sin pendientes, cancelar con motivo, eliminar solo planificado sin gastos. Transiciones concurrentes protegidas. |
| Rendición | Aprobación en lote, observación con monto ajustado (no puede superar el gasto, exige motivo), rechazo con motivo. Un gasto corregido tras una devolución vuelve a pendiente; los ya verificados se conservan. |
| Liquidación | Aprobado 306.000, no reconocido 10.000, anticipo 320.000 → devuelve el responsable 14.000. Costo por persona 102.000 c/u (suma = aprobado). Totales congelados al cerrar. Viaje cerrado no se edita ni se verifica. |
| Trazabilidad | `ViajeHistorial` con cada paso, `AuditLog` (CREATE/UPDATE/DELETE/APPROVE), notificaciones internas al responsable (asignación, devolución, cierre, cancelación) y a supervisores/administradores (conclusión, extensión). |
| Listado | Filtro por estado y búsqueda por destino. |

## 2. UI/UX — recorrido completo con Playwright

- **Administración, escritorio 1440 px:** listado vacío y con datos, alta de viaje (responsable,
  participante del sistema y externo, costos sugeridos, "Igualar al estimado"), detalle, rendición
  (observar con ajuste, aprobar pendientes), cierre con observación e informe imprimible.
- **Responsable, iPhone 13:** Mis Viajes, detalle, iniciar, tres gastos (combustible con foto desde
  la cámara, cena individual para 2 personas, hotel con medios propios con aviso de saldo), menú de
  acciones, extender estadía, concluir y vista del cierre.
- **Modo oscuro** (celular) y **administración desde el celular**.

Controles automáticos en cada pantalla: sin scroll horizontal, objetivos táctiles ≥ 36 px en móvil
(los principales miden 44 px), sin errores de consola propios del módulo.

### Hallazgos corregidos durante la prueba
| Hallazgo | Corrección |
|---|---|
| Selectores de costos truncados en el diálogo ("Combustibl…", "Por persona y…") | Diálogo más ancho y columnas con ancho mínimo |
| Miga de pan con el id interno del viaje | Muestra el código (`VJE-2026-0005`) |
| Título largo truncado en el celular | El título ajusta en dos líneas |
| Botón "Actualizar" solo en una fila en Mis Viajes (celular) | Se quitó: la lista se recarga al entrar |
| Botones Aprobar / Observar / Rechazar con alturas desparejas | Alto fijo por botón |
| Montos partidos en dos líneas en tablas (celular) | `whitespace-nowrap` en montos |
| Etiquetas partidas en el bloque de totales del informe | Bloque más ancho, etiquetas en una línea |
| Historial mostraba el anticipo sin formato | Formato ARS |

### Observación ajena al módulo
La advertencia de React "Each child in a list should have a unique key" proviene de `RootLayout`
y aparece también en `/tickets`; no la introduce este cambio.

## 3. Verificaciones estáticas
- `npx tsc --noEmit`: sin errores.
- `node scripts/design-system/migrate-classes.js --dry`: 0 archivos.

## 4. Limpieza
Las tablas `Viaje*` de la base de prueba se vaciaron (0 filas) y luego se eliminó la base y el
servidor de prueba. El código no incluye datos semilla: en producción las tablas nacen vacías.
