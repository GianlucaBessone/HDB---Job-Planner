import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma';
import {
    ensureCuentaCorrienteTables,
    actualizarConfiguracionCC,
    obtenerDetalleCuentaCorrienteCliente,
    listarResumenCuentasCorrientes,
    registrarCobranzaCC,
    registrarMovimientoManualCC,
    anularMovimientoCC,
} from '../lib/ventas/cuentaCorrienteService';
import {
    ensureCotizacionTables,
    guardarCotizacion,
    listarCotizaciones,
    obtenerCotizacionPorId,
    cambiarEstadoCotizacion,
} from '../lib/ventas/cotizacionService';
import { confirmarVentaPDV, anularVentaPDV } from '../lib/ventas/pdvService';

async function main() {
    console.log('=== Iniciando pruebas de integración: Cuentas Corrientes y Cotizaciones ===');

    await ensureCuentaCorrienteTables();
    await ensureCotizacionTables();

    const suffix = Date.now().toString().slice(-6);
    let testClientId = '';
    let testProductId = '';
    const createdVentaIds: string[] = [];
    const createdCotizacionIds: string[] = [];
    const initialCounters = await prisma.cuentaCorrienteCounter.findMany();

    try {
        // 1. Crear cliente y producto de prueba
        const cliente = await prisma.hdbClient.create({
            data: {
                nombre: `TEST_CC_COT_CLIENTE_${suffix}`,
                telefono: '11-5555-0000',
                email: `test_${suffix}@hdb.local`,
                direccion: 'Av. Industrial 1234',
                activo: true,
            },
        });
        testClientId = cliente.id;

        const producto = await prisma.producto.create({
            data: {
                sku: `TST-SKU-${suffix}`,
                descripcion: `Producto Test CC y Cotizador ${suffix}`,
                precioBase: 10000,
                activo: true,
            },
        });
        testProductId = producto.id;

        console.log('✓ 1. Cliente y producto de prueba creados.');

        // 2. Configurar Cuenta Corriente (límite $50.000, plazo 15 días, ACTIVO)
        const cfg = await actualizarConfiguracionCC(
            testClientId,
            {
                limiteCredito: 50000,
                plazoDias: 15,
                estadoCredito: 'ACTIVO',
                observaciones: 'Acuerdo test automatizado',
            },
            undefined,
            'Tester'
        );
        assert.equal(cfg.limiteCredito, 50000);
        assert.equal(cfg.plazoDias, 15);
        console.log('✓ 2. Configuración crediticia guardada.');

        // 3. Crear Cotización con ítem de catálogo + ítem manual + descuento
        const cot1 = await guardarCotizacion({
            clienteId: testClientId,
            clienteNombre: cliente.nombre,
            clienteIdentificacion: `30-99${suffix}-9`,
            validezDias: 15,
            condicionPago: 'Cuenta Corriente 15 días',
            plazoEntrega: 'Inmediata',
            referenciaObra: 'Obra Planta Industrial Sur',
            descuentoPorcentaje: 10,
            ivaDiscriminado: false,
            items: [
                {
                    productoId: testProductId,
                    esManual: false,
                    sku: producto.sku,
                    descripcion: producto.descripcion,
                    unidad: 'u',
                    cantidad: 2,
                    precioOriginal: 10000,
                    precioUnitario: 10000,
                    descuentoPorcentaje: 0,
                    ivaPorcentaje: 21,
                },
                {
                    productoId: null,
                    esManual: true,
                    sku: 'MO-TAB',
                    descripcion: 'Ingeniería y armado de tablero',
                    unidad: 'gl',
                    cantidad: 1,
                    precioOriginal: 10000,
                    precioUnitario: 10000,
                    descuentoPorcentaje: 0,
                    ivaPorcentaje: 21,
                },
            ],
        });
        createdCotizacionIds.push(cot1.id);
        // Bruto = 30.000, desc global 10% = 3.000 -> Total = 27.000
        assert.equal(cot1.total, 27000);
        assert.equal(cot1.items.length, 2);
        assert.ok(cot1.numero.startsWith('COT-'));
        console.log(`✓ 3. Cotización creada (${cot1.numero}) por $27.000.`);

        // 4. Editar cotización (quitar el ítem manual para convertirla en venta de producto)
        const cotEditada = await guardarCotizacion({
            cotizacionId: cot1.id,
            clienteId: testClientId,
            clienteNombre: cliente.nombre,
            clienteIdentificacion: `30-99${suffix}-9`,
            validezDias: 30,
            condicionPago: 'Cuenta Corriente 15 días',
            plazoEntrega: 'Inmediata',
            referenciaObra: 'Obra Planta Industrial Sur',
            descuentoPorcentaje: 0,
            ivaDiscriminado: false,
            items: [
                {
                    productoId: testProductId,
                    esManual: false,
                    sku: producto.sku,
                    descripcion: producto.descripcion,
                    unidad: 'u',
                    cantidad: 3,
                    precioOriginal: 10000,
                    precioUnitario: 10000,
                    descuentoPorcentaje: 0,
                    ivaPorcentaje: 21,
                },
            ],
        });
        assert.equal(cotEditada.total, 30000);
        assert.equal(cotEditada.items.length, 1);

        // Cambiar estado a APROBADA
        const cotAprob = await cambiarEstadoCotizacion(cot1.id, 'APROBADA');
        assert.equal(cotAprob.estado, 'APROBADA');
        console.log('✓ 4. Cotización editada ($30.000) y marcada como APROBADA.');

        // 5. Convertir Cotización en Venta PDV fiada en Cuenta Corriente ($30.000)
        const venta1 = await confirmarVentaPDV({
            cotizacionId: cot1.id,
            clienteId: testClientId,
            clienteNombre: cliente.nombre,
            clienteIdentificacion: `30-99${suffix}-9`,
            vendedorNombre: 'Tester',
            vendedorRol: 'vendedor',
            items: [
                {
                    productoId: testProductId,
                    sku: producto.sku,
                    descripcion: producto.descripcion,
                    unidad: 'u',
                    cantidad: 3,
                    precioOriginal: 10000,
                    precioUnitario: 10000,
                    descuentoPorcentaje: 0,
                    descuentoMonto: 0,
                    ivaPorcentaje: 21,
                },
            ],
            pagos: [
                {
                    metodo: 'CUENTA_CORRIENTE',
                    monto: 30000,
                },
            ],
        });
        createdVentaIds.push(venta1.id);
        assert.equal(venta1.saldoPendiente, 30000);
        assert.equal(venta1.estadoPago, 'PENDIENTE');

        const cotVerif = await obtenerCotizacionPorId(cot1.id);
        assert.equal(cotVerif.estado, 'CONVERTIDA');
        assert.equal(cotVerif.ventaId, venta1.id);
        console.log(
            `✓ 5. Cotización convertida en Venta PDV (${venta1.numero}) en Cuenta Corriente ($30.000).`
        );

        // 6. Verificar bloqueo por exceso de límite de crédito ($30.000 + $25.000 = $55.000 > $50.000)
        let bloqueoExcesoOk = false;
        try {
            await confirmarVentaPDV({
                clienteId: testClientId,
                clienteNombre: cliente.nombre,
                vendedorRol: 'vendedor',
                items: [
                    {
                        productoId: testProductId,
                        sku: producto.sku,
                        descripcion: producto.descripcion,
                        cantidad: 2.5,
                        precioOriginal: 10000,
                        precioUnitario: 10000,
                        descuentoPorcentaje: 0,
                        descuentoMonto: 0,
                        ivaPorcentaje: 21,
                    },
                ],
                pagos: [{ metodo: 'CUENTA_CORRIENTE', monto: 25000 }],
            });
        } catch (err: any) {
            if (err.message.includes('margen de crédito disponible')) {
                bloqueoExcesoOk = true;
            }
        }
        assert.equal(bloqueoExcesoOk, true, 'Debió bloquear venta que excede el límite de crédito');

        // 6b. Verificar bloqueo por cuenta SUSPENDIDA
        await actualizarConfiguracionCC(testClientId, {
            limiteCredito: 50000,
            plazoDias: 15,
            estadoCredito: 'SUSPENDIDO',
        });
        let bloqueoSuspendidoOk = false;
        try {
            await confirmarVentaPDV({
                clienteId: testClientId,
                clienteNombre: cliente.nombre,
                vendedorRol: 'admin',
                items: [
                    {
                        productoId: testProductId,
                        sku: producto.sku,
                        descripcion: producto.descripcion,
                        cantidad: 1,
                        precioOriginal: 10000,
                        precioUnitario: 10000,
                        descuentoPorcentaje: 0,
                        descuentoMonto: 0,
                        ivaPorcentaje: 21,
                    },
                ],
                pagos: [{ metodo: 'CUENTA_CORRIENTE', monto: 10000 }],
            });
        } catch (err: any) {
            if (err.message.includes('SUSPENDIDA')) {
                bloqueoSuspendidoOk = true;
            }
        }
        assert.equal(bloqueoSuspendidoOk, true, 'Debió bloquear venta cuando la CC está SUSPENDIDA');
        await actualizarConfiguracionCC(testClientId, {
            limiteCredito: 50000,
            plazoDias: 15,
            estadoCredito: 'ACTIVO',
        });
        console.log('✓ 6. Control de límite de crédito y bloqueo por cuenta SUSPENDIDA en PDV verificados.');

        // 7. Cobranza parcial FIFO ($12.000) -> Saldo de venta1 debe bajar a $18.000
        const recibo1 = await registrarCobranzaCC({
            clienteId: testClientId,
            modoImputacion: 'FIFO',
            mediosPago: [{ metodo: 'TRANSFERENCIA', monto: 12000, referencia: 'TRF-001' }],
            operadorNombre: 'Tester',
        });
        assert.ok(recibo1.numero.startsWith('REC-'));

        let det = await obtenerDetalleCuentaCorrienteCliente(testClientId);
        assert.equal(det.resumen.saldoActual, 18000);
        assert.equal(det.comprobantesPendientes.length, 1);
        assert.equal(det.comprobantesPendientes[0].saldoPendiente, 18000);
        console.log(
            `✓ 7. Cobranza parcial FIFO (${recibo1.numero} por $12.000) aplicada. Saldo restante: $18.000.`
        );

        // 8. Anular recibo1 -> Saldo de venta1 debe restaurarse a $30.000
        await anularMovimientoCC(recibo1.id, 'Prueba de reversión de imputación', undefined, 'Tester');
        det = await obtenerDetalleCuentaCorrienteCliente(testClientId);
        assert.equal(det.resumen.saldoActual, 30000);
        assert.equal(det.comprobantesPendientes[0].saldoPendiente, 30000);
        console.log(
            '✓ 8. Anulación de recibo revirtió correctamente el saldo pendiente a $30.000.'
        );

        // 9. Registrar Cargo Manual ($5.000) y Nota de Crédito con imputación FIFO ($10.000)
        const cargo = await registrarMovimientoManualCC({
            clienteId: testClientId,
            tipo: 'CARGO_MANUAL',
            monto: 5000,
            concepto: 'Cargo por flete en obra',
            operadorNombre: 'Tester',
        });
        assert.ok(cargo.numero.startsWith('ND-'));

        det = await obtenerDetalleCuentaCorrienteCliente(testClientId);
        assert.equal(det.resumen.saldoActual, 35000);
        assert.equal(det.comprobantesPendientes.length, 2);

        const nc = await registrarMovimientoManualCC({
            clienteId: testClientId,
            tipo: 'NOTA_CREDITO',
            monto: 10000,
            concepto: 'Bonificación volumen',
            imputarFifo: true,
            operadorNombre: 'Tester',
        });
        assert.ok(nc.numero.startsWith('NC-'));

        det = await obtenerDetalleCuentaCorrienteCliente(testClientId);
        assert.equal(det.resumen.saldoActual, 25000);
        console.log(
            '✓ 9. Nota de Débito ($5.000) y Nota de Crédito FIFO ($10.000) verificadas. Saldo: $25.000.'
        );

        // 10. Saldar el total restante ($25.000) mediante selección MANUAL
        const reciboFinal = await registrarCobranzaCC({
            clienteId: testClientId,
            modoImputacion: 'MANUAL',
            mediosPago: [
                { metodo: 'EFECTIVO', monto: 5000 },
                { metodo: 'CHEQUE', monto: 20000, referencia: 'CHQ-9988' },
            ],
            imputacionesManuales: det.comprobantesPendientes.map((c) => ({
                destinoTipo: c.destinoTipo,
                destinoId: c.id,
                monto: c.saldoPendiente,
            })),
            operadorNombre: 'Tester',
        });
        assert.equal(reciboFinal.haber, 25000);

        det = await obtenerDetalleCuentaCorrienteCliente(testClientId);
        assert.equal(det.resumen.saldoActual, 0);
        assert.equal(det.comprobantesPendientes.length, 0);
        console.log(
            '✓ 10. Cancelación total en modo MANUAL verificada. Comprobantes pendientes = 0, Saldo = $0.'
        );

        // 11. Convertir cotización CON ítem manual + descuento por línea con cambio de cantidad en PDV y luego anular venta liberando la cotización
        const cotConManual = await guardarCotizacion({
            clienteId: testClientId,
            clienteNombre: cliente.nombre,
            validezDias: 15,
            items: [
                {
                    productoId: testProductId,
                    esManual: false,
                    sku: producto.sku,
                    descripcion: producto.descripcion,
                    unidad: 'u',
                    cantidad: 1,
                    precioOriginal: 10000,
                    precioUnitario: 10000,
                    descuentoPorcentaje: 10, // 10% desc
                    ivaPorcentaje: 21,
                },
                {
                    productoId: null,
                    esManual: true,
                    sku: 'SRV-INST',
                    descripcion: 'Servicio de puesta en marcha en planta',
                    unidad: 'gl',
                    cantidad: 1,
                    precioOriginal: 5000,
                    precioUnitario: 5000,
                    descuentoPorcentaje: 0,
                    ivaPorcentaje: 21,
                },
            ],
        });
        createdCotizacionIds.push(cotConManual.id);
        assert.equal(cotConManual.total, 14000);

        // Simular que en el PDV el usuario incrementó la cantidad del ítem 1 de 1 a 2 (bruto 20.000, 10% desc = 2.000 -> 18.000) + ítem manual 5.000 = 23.000
        const ventaConManual = await confirmarVentaPDV({
            cotizacionId: cotConManual.id,
            clienteId: testClientId,
            clienteNombre: cliente.nombre,
            vendedorNombre: 'Tester',
            vendedorRol: 'vendedor',
            items: [
                {
                    productoId: testProductId,
                    esManual: false,
                    sku: producto.sku,
                    descripcion: producto.descripcion,
                    unidad: 'u',
                    cantidad: 2,
                    precioOriginal: 10000,
                    precioUnitario: 10000,
                    descuentoPorcentaje: 10,
                    descuentoMonto: 1000, // valor viejo antes de cambiar cantidad: calcularTotalesVenta debe recalcular 2000 por descPorc=10%
                    ivaPorcentaje: 21,
                },
                {
                    productoId: null,
                    esManual: true,
                    sku: 'SRV-INST',
                    descripcion: 'Servicio de puesta en marcha en planta',
                    unidad: 'gl',
                    cantidad: 1,
                    precioOriginal: 5000,
                    precioUnitario: 5000,
                    descuentoPorcentaje: 0,
                    descuentoMonto: 0,
                    ivaPorcentaje: 21,
                },
            ],
            pagos: [{ metodo: 'EFECTIVO', monto: 23000 }],
        });
        createdVentaIds.push(ventaConManual.id);
        assert.equal(ventaConManual.total, 23000);
        assert.equal(ventaConManual.items.length, 2);
        assert.equal(ventaConManual.items.some((i) => i.productoId === null), true);

        let cotEstado = await obtenerCotizacionPorId(cotConManual.id);
        assert.equal(cotEstado.estado, 'CONVERTIDA');

        // Anular la venta y verificar que la cotización vuelve a APROBADA
        await anularVentaPDV(ventaConManual.id, 'Prueba de liberación de cotización', '', 'Tester', 'supervisor');
        cotEstado = await obtenerCotizacionPorId(cotConManual.id);
        assert.equal(cotEstado.estado, 'APROBADA');
        assert.equal(cotEstado.ventaId, null);
        console.log(
            '✓ 11. Conversión de cotización con ítems manuales + recálculo de descuentos por línea y liberación al anular venta verificadas.'
        );

        console.log('=== TODAS LAS PRUEBAS PASARON EXITOSAMENTE ===');
    } finally {
        // Limpieza de datos de prueba creados
        try {
            if (testClientId) {
                await prisma.cuentaCorrienteMovimiento.deleteMany({
                    where: { clienteId: testClientId },
                });
                await prisma.cuentaCorrienteConfig.deleteMany({
                    where: { clienteId: testClientId },
                });
            }
            for (const cotId of createdCotizacionIds) {
                await prisma.cotizacionItem.deleteMany({ where: { cotizacionId: cotId } }).catch(() => {});
                await prisma.cotizacion.deleteMany({ where: { id: cotId } });
            }
            for (const vId of createdVentaIds) {
                await prisma.ventaPago.deleteMany({ where: { ventaId: vId } });
                await prisma.ventaItem.deleteMany({ where: { ventaId: vId } });
                await prisma.venta.deleteMany({ where: { id: vId } });
            }
            if (testProductId) {
                await prisma.producto.deleteMany({ where: { id: testProductId } });
            }
            if (testClientId) {
                await prisma.auditLog.deleteMany({
                    where: {
                        OR: [
                            { entityId: testClientId },
                            { entityId: { in: createdVentaIds } },
                            { entityId: { in: createdCotizacionIds } },
                        ],
                    },
                }).catch(() => {});
                await prisma.hdbClient.deleteMany({ where: { id: testClientId } });
            }
            // Restaurar contadores iniciales de Cuenta Corriente
            const totalRealMovs = await prisma.cuentaCorrienteMovimiento.count();
            if (totalRealMovs === 0) {
                await prisma.cuentaCorrienteCounter.updateMany({
                    data: { currentNumber: 0 },
                });
            } else {
                for (const ic of initialCounters) {
                    await prisma.cuentaCorrienteCounter.update({
                        where: { serie_year: { serie: ic.serie, year: ic.year } },
                        data: { currentNumber: ic.currentNumber },
                    });
                }
            }
            console.log('✓ Limpieza exhaustiva de registros temporales de prueba completada.');
        } catch (cleanupErr) {
            console.error('Advertencia en limpieza:', cleanupErr);
        }
        await prisma.$disconnect();
    }
}

main().catch((err) => {
    console.error('❌ FALLÓ EL TEST:', err);
    process.exit(1);
});
