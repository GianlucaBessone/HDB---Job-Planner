import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { formatCuit } from '@/lib/ventas/proveedorVentas';

/**
 * Proveedores únicos (auditoría, P24 / FU5). Antes había dos maestros: `Proveedor` (Gastos y facturas,
 * CUIT obligatorio) y `ProveedorVentas` (productos, CUIT opcional), y el mismo proveedor se cargaba dos
 * veces. Ahora hay uno solo, `ProveedorVentas`, con el CUIT único y siempre con el formato 30-12345678-9.
 * Lo usan los productos, las facturas de gastos y, a futuro, las compras.
 */

type Db = Prisma.TransactionClient | typeof prisma;

/** Dígito verificador del CUIT (módulo 11). */
export function cuitValido(cuit: string | null | undefined): boolean {
    const d = (cuit || '').replace(/\D/g, '');
    if (d.length !== 11) return false;
    const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    const suma = pesos.reduce((a, p, i) => a + p * Number(d[i]), 0);
    const resto = 11 - (suma % 11);
    const verificador = resto === 11 ? 0 : resto === 10 ? 9 : resto;
    return verificador === Number(d[10]);
}

/** CUIT con el formato del sistema, o null si no tiene 11 dígitos. */
export function normalizarCuit(cuit: string | null | undefined): string | null {
    const d = (cuit || '').replace(/\D/g, '');
    return d.length === 11 ? formatCuit(d) : null;
}

/** Proveedor por CUIT, sin importar cómo esté escrito (con o sin guiones). */
export async function proveedorPorCuit(db: Db, cuit: string) {
    const normal = normalizarCuit(cuit);
    if (!normal) return null;
    return db.proveedorVentas.findFirst({ where: { cuit: { in: [normal, normal.replace(/\D/g, '')] } } });
}

/**
 * Busca el proveedor por CUIT o lo crea (importación y escaneo de facturas). Si existía inactivo, lo reactiva.
 */
export async function proveedorPorCuitOCrear(db: Db, datos: { cuit: string; razonSocial: string; condicionIva?: string | null; direccion?: string | null; nombreFantasia?: string | null }) {
    const cuit = normalizarCuit(datos.cuit);
    if (!cuit) throw new Error(`El CUIT ${datos.cuit} no tiene 11 dígitos`);
    const existente = await proveedorPorCuit(db, cuit);
    if (existente) {
        if (!existente.activo) return db.proveedorVentas.update({ where: { id: existente.id }, data: { activo: true } });
        return existente;
    }
    return db.proveedorVentas.create({
        data: {
            cuit,
            razonSocial: datos.razonSocial.trim() || 'Proveedor importado',
            nombreFantasia: datos.nombreFantasia || null,
            condicionIva: datos.condicionIva || null,
            direccion: datos.direccion || null,
        },
    });
}

/**
 * Forma que esperan las pantallas de Gastos (antes leían el modelo `Proveedor`, con `domicilio`).
 */
export function comoProveedorGastos<T extends { direccion: string | null }>(p: T): T & { domicilio: string | null } {
    return { ...p, domicilio: p.direccion };
}

/**
 * Proveedores "de gastos": solo tienen facturas de gastos (peajes, combustible, comidas de viaje…) y ningún
 * producto. No aparecen en los selectores de productos ni de materiales; pasan a comerciales al vincularles
 * un producto.
 */
export const PROVEEDORES_DE_GASTOS: Prisma.ProveedorVentasWhereInput = { productos: { none: {} }, facturas: { some: {} } };
export const PROVEEDORES_COMERCIALES: Prisma.ProveedorVentasWhereInput = { OR: [{ productos: { some: {} } }, { facturas: { none: {} } }] };
