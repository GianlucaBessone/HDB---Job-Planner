import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

const S = StyleSheet.create({
    page: {
        paddingTop: 20,
        paddingBottom: 34,
        paddingHorizontal: 28,
        backgroundColor: '#FFFFFF',
        fontFamily: 'Helvetica',
        fontSize: 8.5,
        color: '#1e293b',
        lineHeight: 1.25,
    },

    // Header superior
    headerContainer: {
        flexDirection: 'row',
        borderWidth: 1,
        borderColor: '#0f172a',
        borderRadius: 4,
        marginBottom: 8,
    },
    headerLeft: {
        width: '45%',
        padding: 6,
        flexDirection: 'column',
        justifyContent: 'space-between',
        borderRightWidth: 1,
        borderRightColor: '#0f172a',
    },
    logo: {
        width: 120,
        height: 34,
        objectFit: 'contain',
        marginBottom: 3,
    },
    companyName: {
        fontSize: 10.5,
        fontFamily: 'Helvetica-Bold',
        color: '#0f172a',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    companyTagline: {
        fontSize: 7,
        fontFamily: 'Helvetica-Bold',
        color: '#0284c7',
        marginTop: 1,
    },
    companyFiscal: {
        fontSize: 6.5,
        color: '#475569',
        marginTop: 2,
        lineHeight: 1.25,
    },

    // Letra Central "P"
    headerCenter: {
        width: '12%',
        padding: 4,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
        borderRightWidth: 1,
        borderRightColor: '#0f172a',
    },
    letterBox: {
        width: 26,
        height: 26,
        borderWidth: 1,
        borderColor: '#0f172a',
        borderRadius: 4,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
    },
    letterText: {
        fontSize: 15,
        fontFamily: 'Helvetica-Bold',
        color: '#0f172a',
    },
    letterSub: {
        fontSize: 5,
        fontFamily: 'Helvetica-Bold',
        color: '#64748b',
        textAlign: 'center',
        marginTop: 2,
        textTransform: 'uppercase',
    },

    // Header Derecho
    headerRight: {
        width: '43%',
        padding: 6,
        flexDirection: 'column',
        justifyContent: 'space-between',
    },
    docTypeTitle: {
        fontSize: 9.5,
        fontFamily: 'Helvetica-Bold',
        color: '#0369a1',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    docNumber: {
        fontSize: 11.5,
        fontFamily: 'Helvetica-Bold',
        color: '#0f172a',
        marginTop: 2,
    },
    docDates: {
        marginTop: 3,
        fontSize: 7,
        color: '#334155',
        lineHeight: 1.3,
    },

    // Bloque 2 columnas: Cliente y Condiciones
    metadataContainer: {
        flexDirection: 'row',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 4,
        marginBottom: 8,
        backgroundColor: '#f8fafc',
    },
    metadataCol: {
        width: '50%',
        padding: 6,
    },
    metadataColDivider: {
        borderRightWidth: 1,
        borderRightColor: '#cbd5e1',
    },
    metaTitle: {
        fontSize: 7,
        fontFamily: 'Helvetica-Bold',
        color: '#0369a1',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        paddingBottom: 2,
        marginBottom: 3,
    },
    metaRow: {
        flexDirection: 'row',
        marginBottom: 1.5,
    },
    metaLabel: {
        width: '32%',
        fontSize: 6.8,
        fontFamily: 'Helvetica-Bold',
        color: '#64748b',
        textTransform: 'uppercase',
    },
    metaValue: {
        width: '68%',
        fontSize: 7.2,
        color: '#0f172a',
        fontFamily: 'Helvetica',
    },
    metaValueBold: {
        fontFamily: 'Helvetica-Bold',
    },

    // Tabla de ítems
    table: {
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 4,
        marginBottom: 6,
        overflow: 'hidden',
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#0f172a',
        paddingVertical: 4.5,
        paddingHorizontal: 6,
        alignItems: 'center',
    },
    thText: {
        fontSize: 6.8,
        fontFamily: 'Helvetica-Bold',
        color: '#ffffff',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    tableRow: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingVertical: 3.5,
        paddingHorizontal: 6,
        alignItems: 'flex-start',
    },
    tableRowEven: {
        backgroundColor: '#ffffff',
    },
    tableRowOdd: {
        backgroundColor: '#f8fafc',
    },
    tdText: {
        fontSize: 7.2,
        color: '#334155',
    },
    tdBold: {
        fontFamily: 'Helvetica-Bold',
        color: '#0f172a',
    },
    tdRight: {
        textAlign: 'right',
    },
    tdCenter: {
        textAlign: 'center',
    },
    itemNote: {
        fontSize: 6.2,
        color: '#64748b',
        fontFamily: 'Helvetica-Oblique',
        marginTop: 1,
    },

    // Anchos de columnas
    colIdx: { width: '4%' },
    colSku: { width: '13%' },
    colDesc: { width: '41%' },
    colCant: { width: '9%' },
    colPrice: { width: '16%', paddingRight: 6 },
    colDisc: { width: '6%' },
    colSub: { width: '11%', paddingRight: 3 },

    // Espaciador flexible para anclar el bloque de cierre al pie de la página
    spacer: {
        flexGrow: 1,
        minHeight: 6,
    },

    // Contenedor integral de cierre (Observaciones + Resumen + Firmas)
    closingSection: {
        marginTop: 'auto',
    },

    // Bloque inferior (Observaciones + Resumen)
    bottomContainer: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 0,
    },
    observacionesBox: {
        width: '58%',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 4,
        padding: 7,
        backgroundColor: '#f8fafc',
        justifyContent: 'space-between',
    },
    obsTitle: {
        fontSize: 7.2,
        fontFamily: 'Helvetica-Bold',
        color: '#475569',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 3,
    },
    obsText: {
        fontSize: 6.8,
        color: '#334155',
        lineHeight: 1.35,
    },
    termsText: {
        fontSize: 6.2,
        color: '#64748b',
        lineHeight: 1.25,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        paddingTop: 3,
        marginTop: 5,
    },

    totalesBox: {
        width: '42%',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 4,
        padding: 7,
        backgroundColor: '#f8fafc',
        justifyContent: 'space-between',
    },
    totalesBody: {
        gap: 2,
    },
    totRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        fontSize: 7.2,
    },
    totLabel: {
        color: '#475569',
    },
    totValue: {
        fontFamily: 'Helvetica-Bold',
        color: '#0f172a',
    },
    totDiscountValue: {
        fontFamily: 'Helvetica-Bold',
        color: '#16a34a',
    },
    totalFinalContainer: {
        borderTopWidth: 1,
        borderTopColor: '#cbd5e1',
        paddingTop: 4,
        marginTop: 4,
    },
    totalFinalBox: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
    },
    totalFinalLabel: {
        fontSize: 8.5,
        fontFamily: 'Helvetica-Bold',
        color: '#0f172a',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    totalFinalValue: {
        fontSize: 12.5,
        fontFamily: 'Helvetica-Bold',
        color: '#0f172a',
    },
    totalCurrencyNote: {
        fontSize: 6.2,
        color: '#64748b',
        textAlign: 'right',
        marginTop: 5,
    },

    // Bloque de Firmas
    signaturesContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 30,
        marginTop: 10,
        marginBottom: 2,
    },
    signatureBlock: {
        width: '45%',
        borderTopWidth: 1,
        borderTopColor: '#94a3b8',
        paddingTop: 3,
        alignItems: 'center',
    },
    signatureTitle: {
        fontSize: 7.2,
        fontFamily: 'Helvetica-Bold',
        color: '#334155',
    },
    signatureSub: {
        fontSize: 6.2,
        color: '#64748b',
        marginTop: 1,
    },

    // Footer fijo en cada página
    footer: {
        position: 'absolute',
        bottom: 10,
        left: 28,
        right: 28,
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: '#cbd5e1',
        paddingTop: 4,
        fontSize: 6.2,
        color: '#64748b',
    },
});

export interface CotizacionPdfDocumentProps {
    cotizacion: any;
    logoBase64?: string | null;
}

const fmtARS = (n: number) => {
    const val = Number(n) || 0;
    return (
        '$ ' +
        val.toLocaleString('es-AR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })
    );
};

const fmtDate = (iso: string | Date | null) => {
    if (!iso) return '—';
    try {
        const d = new Date(iso);
        return d.toLocaleDateString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    } catch {
        return String(iso);
    }
};

export function CotizacionPdfDocument({ cotizacion, logoBase64 }: CotizacionPdfDocumentProps) {
    const items: any[] = Array.isArray(cotizacion?.items) ? cotizacion.items : [];

    const totalDescuentos =
        (Number(cotizacion.descuentoMonto) || 0) +
        items.reduce((acc, it) => acc + (Number(it.descuentoMonto) || 0), 0);

    const hasLineDiscounts = items.some((it) => (Number(it.descuentoPorcentaje) || 0) > 0);

    return (
        <Document
            title={`Cotización_${cotizacion?.numero || 'HDB'}`}
            author="HDB Servicios Eléctricos"
            subject={`Presupuesto Comercial ${cotizacion?.numero}`}
        >
            <Page size="A4" orientation="portrait" style={S.page}>
                {/* ── Encabezado Institucional HDB ── */}
                <View style={S.headerContainer}>
                    {/* Left: Emisor */}
                    <View style={S.headerLeft}>
                        {logoBase64 ? <Image style={S.logo} src={logoBase64} /> : null}
                        <View>
                            <Text style={S.companyName}>HDB SERVICIOS ELÉCTRICOS</Text>
                            <Text style={S.companyTagline}>
                                Materiales Eléctricos • Tableros • Obras e Ingeniería
                            </Text>
                            <Text style={S.companyFiscal}>
                                Razón Social: Bassignana Hernán David{'\n'}
                                C.U.I.T.: 20-26566944-2{'\n'}
                                Dirección: Juan Bautista Alberdi 448, Arroyito (2434), Córdoba
                            </Text>
                        </View>
                    </View>

                    {/* Center: Letra "P" de Presupuesto */}
                    <View style={S.headerCenter}>
                        <View style={S.letterBox}>
                            <Text style={S.letterText}>P</Text>
                        </View>
                        <Text style={S.letterSub}>DOCUMENTO NO VÁLIDO COMO FACTURA</Text>
                    </View>

                    {/* Right: Datos del Presupuesto */}
                    <View style={S.headerRight}>
                        <View>
                            <Text style={S.docTypeTitle}>COTIZACIÓN / PRESUPUESTO</Text>
                            <Text style={S.docNumber}>Nº {cotizacion?.numero || 'COT-XXXX'}</Text>
                        </View>
                        <View style={S.docDates}>
                            <Text>
                                <Text style={{ fontFamily: 'Helvetica-Bold' }}>Fecha de Emisión: </Text>
                                {fmtDate(cotizacion?.fecha)}
                            </Text>
                            <Text>
                                <Text style={{ fontFamily: 'Helvetica-Bold' }}>Válido hasta: </Text>
                                {fmtDate(cotizacion?.fechaVencimiento)}{' '}
                                {cotizacion?.validezDias ? `(${cotizacion.validezDias} días)` : ''}
                            </Text>
                            {(cotizacion?.vendedorNombre || cotizacion?.operadorNombre) && (
                                <Text>
                                    <Text style={{ fontFamily: 'Helvetica-Bold' }}>Atendido por: </Text>
                                    {cotizacion.vendedorNombre || cotizacion.operadorNombre}
                                </Text>
                            )}
                        </View>
                    </View>
                </View>

                {/* ── Destinatario y Condiciones Comerciales ── */}
                <View style={S.metadataContainer}>
                    {/* Cliente */}
                    <View style={[S.metadataCol, S.metadataColDivider]}>
                        <Text style={S.metaTitle}>Destinatario / Cliente</Text>
                        <View style={S.metaRow}>
                            <Text style={S.metaLabel}>Cliente:</Text>
                            <Text style={[S.metaValue, S.metaValueBold]}>
                                {cotizacion?.clienteNombre || 'Consumidor Final'}
                            </Text>
                        </View>
                        <View style={S.metaRow}>
                            <Text style={S.metaLabel}>CUIT / DNI:</Text>
                            <Text style={S.metaValue}>
                                {cotizacion?.clienteIdentificacion ||
                                    cotizacion?.clienteCuit ||
                                    'Consumidor Final'}
                            </Text>
                        </View>
                        <View style={S.metaRow}>
                            <Text style={S.metaLabel}>Dirección:</Text>
                            <Text style={S.metaValue}>
                                {cotizacion?.clienteDireccion || '—'}
                            </Text>
                        </View>
                        <View style={S.metaRow}>
                            <Text style={S.metaLabel}>Contacto:</Text>
                            <Text style={S.metaValue}>
                                {[cotizacion?.clienteTelefono, cotizacion?.clienteEmail]
                                    .filter(Boolean)
                                    .join(' · ') || '—'}
                            </Text>
                        </View>
                    </View>

                    {/* Condiciones */}
                    <View style={S.metadataCol}>
                        <Text style={S.metaTitle}>Condiciones Comerciales</Text>
                        <View style={S.metaRow}>
                            <Text style={S.metaLabel}>Cond. Pago:</Text>
                            <Text style={[S.metaValue, S.metaValueBold]}>
                                {cotizacion?.condicionPago || 'Contado / Transferencia'}
                            </Text>
                        </View>
                        <View style={S.metaRow}>
                            <Text style={S.metaLabel}>Plazo Entrega:</Text>
                            <Text style={S.metaValue}>
                                {cotizacion?.plazoEntrega || 'Inmediata s/stock'}
                            </Text>
                        </View>
                        <View style={S.metaRow}>
                            <Text style={S.metaLabel}>Obra / Ref:</Text>
                            <Text style={S.metaValue}>
                                {cotizacion?.referenciaObra || '—'}
                            </Text>
                        </View>
                        <View style={S.metaRow}>
                            <Text style={S.metaLabel}>Lista Precios:</Text>
                            <Text style={S.metaValue}>
                                {cotizacion?.listaPrecioNombre || 'Lista General'}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* ── Tabla de Artículos y Servicios Cotizados ── */}
                <View style={S.table}>
                    <View style={S.tableHeader} fixed>
                        <Text style={[S.thText, S.colIdx]}>#</Text>
                        <Text style={[S.thText, S.colSku]}>Código</Text>
                        <Text style={[S.thText, S.colDesc]}>Descripción del Material / Servicio</Text>
                        <Text style={[S.thText, S.colCant, S.tdCenter]}>Cant.</Text>
                        <Text style={[S.thText, S.colPrice, S.tdRight]}>P. Unit. (ARS)</Text>
                        <Text style={[S.thText, S.colDisc, S.tdCenter]}>Bonif%</Text>
                        <Text style={[S.thText, S.colSub, S.tdRight]}>Subtotal (ARS)</Text>
                    </View>

                    {items.map((it: any, index: number) => {
                        const isEven = index % 2 === 0;
                        const cant = Number(it.cantidad) || 1;
                        const unid = it.unidad || 'u';
                        const descPct = Number(it.descuentoPorcentaje || it.descuentoPct) || 0;
                        const pUnit = Number(it.precioUnitario) || 0;
                        const sub = Number(it.subtotal) || 0;

                        return (
                            <View
                                key={it.id || index}
                                style={[S.tableRow, isEven ? S.tableRowEven : S.tableRowOdd]}
                                wrap={false}
                            >
                                <Text style={[S.tdText, S.colIdx]}>{index + 1}</Text>
                                <Text style={[S.tdText, S.tdBold, S.colSku]}>
                                    {it.sku || it.codigo || '—'}
                                </Text>
                                <View style={S.colDesc}>
                                    <Text style={[S.tdText, S.tdBold]}>
                                        {it.descripcion || it.nombre}
                                    </Text>
                                    {(it.motivoModificacion || it.observacion) && (
                                        <Text style={S.itemNote}>
                                            Nota: {it.motivoModificacion || it.observacion}
                                        </Text>
                                    )}
                                    {it.marca && (
                                        <Text style={S.itemNote}>Marca: {it.marca}</Text>
                                    )}
                                </View>
                                <Text style={[S.tdText, S.colCant, S.tdCenter]}>
                                    {cant} {unid}
                                </Text>
                                <Text style={[S.tdText, S.colPrice, S.tdRight]}>
                                    {fmtARS(pUnit)}
                                </Text>
                                <Text style={[S.tdText, S.colDisc, S.tdCenter]}>
                                    {descPct > 0 ? `${descPct}%` : '—'}
                                </Text>
                                <Text style={[S.tdText, S.tdBold, S.colSub, S.tdRight]}>
                                    {fmtARS(sub)}
                                </Text>
                            </View>
                        );
                    })}
                </View>

                {/* ── Espaciador flexible para anclar el bloque de cierre al pie de página ── */}
                <View style={S.spacer} />

                {/* ── Bloque Integral de Cierre: Observaciones, Totales y Firmas ── */}
                <View style={S.closingSection} wrap={false}>
                    <View style={S.bottomContainer}>
                        {/* Observaciones y Términos */}
                        <View style={S.observacionesBox}>
                            <View>
                                <Text style={S.obsTitle}>Observaciones y Alcance de la Oferta</Text>
                                <Text style={S.obsText}>
                                    {cotizacion?.observaciones ||
                                        'Presupuesto formal sujeto a verificación de stock y variación de listas de fábrica. Precios expresados en Pesos Argentinos (ARS). Los plazos de entrega comienzan a computarse a partir de la confirmación formal del pedido.'}
                                </Text>
                            </View>
                            <Text style={S.termsText}>
                                Validez sujeta a los días indicados en este documento. La aceptación de este presupuesto autoriza la preparación y reserva de los materiales detallados.
                            </Text>
                        </View>

                        {/* Resumen Económico */}
                        <View style={S.totalesBox}>
                            <View style={S.totalesBody}>
                                <View style={S.totRow}>
                                    <Text style={S.totLabel}>Subtotal ({items.length} ítems):</Text>
                                    <Text style={S.totValue}>
                                        {fmtARS(
                                            Number(cotizacion?.subtotal) ||
                                                items.reduce((a, b) => a + (Number(b.subtotal) || 0), 0)
                                        )}
                                    </Text>
                                </View>

                                {totalDescuentos > 0 && (
                                    <View style={S.totRow}>
                                        <Text style={S.totLabel}>
                                            Descuentos / Bonif.
                                            {Number(cotizacion.descuentoPorcentaje) > 0
                                                ? ` (${cotizacion.descuentoPorcentaje}%)`
                                                : ''}
                                            :
                                        </Text>
                                        <Text style={S.totDiscountValue}>- {fmtARS(totalDescuentos)}</Text>
                                    </View>
                                )}

                                {Number(cotizacion?.recargoMonto) > 0 && (
                                    <View style={S.totRow}>
                                        <Text style={S.totLabel}>Recargos financieros:</Text>
                                        <Text style={S.totValue}>{fmtARS(cotizacion.recargoMonto)}</Text>
                                    </View>
                                )}

                                {cotizacion?.ivaDiscriminado && (
                                    <>
                                        <View style={S.totRow}>
                                            <Text style={S.totLabel}>Subtotal Neto Gravado:</Text>
                                            <Text style={S.totValue}>
                                                {fmtARS(
                                                    (Number(cotizacion?.subtotal) || 0) -
                                                        (Number(cotizacion?.descuentoMonto) || 0)
                                                )}
                                            </Text>
                                        </View>
                                        <View style={S.totRow}>
                                            <Text style={S.totLabel}>IVA Discriminado:</Text>
                                            <Text style={S.totValue}>
                                                {fmtARS(Number(cotizacion?.impuestosMonto) || 0)}
                                            </Text>
                                        </View>
                                    </>
                                )}
                            </View>

                            <View style={S.totalFinalContainer}>
                                <View style={S.totalFinalBox}>
                                    <Text style={S.totalFinalLabel}>TOTAL COTIZADO</Text>
                                    <Text style={S.totalFinalValue}>{fmtARS(cotizacion?.total)}</Text>
                                </View>
                                <Text style={S.totalCurrencyNote}>
                                    {cotizacion?.ivaDiscriminado
                                        ? 'Precios con IVA discriminado incluido en el Total'
                                        : 'Precios finales (IVA incluido) — Moneda: ARS'}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* ── Firmas de Conformidad ── */}
                    <View style={S.signaturesContainer}>
                        <View style={S.signatureBlock}>
                            <Text style={S.signatureTitle}>HDB SERVICIOS ELÉCTRICOS</Text>
                            <Text style={S.signatureSub}>Firma y Sello Autorizado</Text>
                        </View>
                        <View style={S.signatureBlock}>
                            <Text style={S.signatureTitle}>
                                {cotizacion?.clienteNombre || 'CONFORMIDAD DEL CLIENTE'}
                            </Text>
                            <Text style={S.signatureSub}>Firma, Aclaración y DNI/CUIT</Text>
                        </View>
                    </View>
                </View>

                {/* ── Pie de Página Oficial ── */}
                <View style={S.footer} fixed>
                    <Text>
                        HDB Servicios Eléctricos · Juan Bautista Alberdi 448, Arroyito (Cba) · CUIT 20-26566944-2 · SGI
                    </Text>
                    <Text
                        render={({ pageNumber, totalPages }) =>
                            `Cotización ${cotizacion?.numero || ''} — Pág. ${pageNumber} de ${totalPages}`
                        }
                    />
                </View>
            </Page>
        </Document>
    );
}
export default CotizacionPdfDocument;
