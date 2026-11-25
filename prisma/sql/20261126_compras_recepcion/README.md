# Migración: compras y recepción

Auditoría, faltante "Compras y recepción". Crea cuatro tablas nuevas:

- `OrdenCompra`: orden a un proveedor comercial (`ProveedorVentas`), con el almacén donde entra la mercadería,
  estado (`borrador`, `enviada`, `parcial`, `recibida`, `cancelada`) y la factura del proveedor vinculada
  (`facturaId` → `FacturaConsumo`, opcional).
- `OrdenCompraItem`: productos pedidos, cantidad, costo unitario sin IVA y cantidad recibida.
- `RecepcionCompra` / `RecepcionCompraItem`: cada entrega del proveedor (parcial o total), con su remito. Al
  registrarla entra stock al almacén con un movimiento de kardex (`referenciaTipo = 'COMPRA'`,
  `referenciaId` = la recepción). Anularla saca del stock lo que había entrado.

- **Aditiva: primero la base, después el código.** No toca tablas existentes (solo agrega claves foráneas desde las
  tablas nuevas).
- `down.sql` borra las cuatro tablas (primero volver el código).

## Despliegue

1. `psql "$DATABASE_URL" -f prisma/sql/20261126_compras_recepcion/up.sql`
2. Mergear el PR.
