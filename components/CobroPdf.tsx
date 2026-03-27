import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';
import React from 'react';
import { formatDate } from '@/lib/formatDate';

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatARS(num: number | null | undefined) {
    if (num === null || num === undefined) return '$0,00';
    return '$' + num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
    page: { padding: '20mm', backgroundColor: '#FFFFFF', fontFamily: 'Helvetica', fontSize: 9, color: '#1e293b' },

    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 3, borderBottomColor: '#6366f1', paddingBottom: 16, marginBottom: 15 },
    logo: { height: 90, objectFit: 'contain', alignSelf: 'flex-start', marginBottom: 5 },
    headLeft: { flexDirection: 'column', gap: 3, flex: 1 },
    headTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginTop: 10 },
    headSub: { fontSize: 10, color: '#64748b' },
    headRight: { alignItems: 'flex-end', gap: 6 },
    headDate: { fontSize: 9, color: '#94a3b8', fontFamily: 'Helvetica-Bold' },

    section: { marginBottom: 18 },
    sectionTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 4, marginBottom: 10 },

    grid2: { flexDirection: 'row', gap: 16 },
    field: { flex: 1 },
    fieldLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
    fieldValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1e293b' },

    // Table
    tableHeader: { flexDirection: 'row', backgroundColor: '#f8fafc', borderBottomWidth: 2, borderBottomColor: '#e2e8f0', paddingVertical: 6, paddingHorizontal: 10 },
    thCell: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 },
    tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingVertical: 7, paddingHorizontal: 10 },
    tdCell: { fontSize: 9, color: '#334155', fontFamily: 'Helvetica' },
    tdBold: { fontFamily: 'Helvetica-Bold' },
    textRight: { textAlign: 'right' },

    // Totals Box
    totalsWrapper: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 15 },
    totalsBox: { width: 200, backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 },
    totalsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    totalsLabel: { fontSize: 8, color: '#475569', fontFamily: 'Helvetica-Bold' },
    totalsVal: { fontSize: 9, color: '#475569', fontFamily: 'Helvetica-Bold' },
    totalsRowFinal: { borderTopWidth: 1, borderTopColor: '#e2e8f0', marginTop: 6, paddingTop: 6, flexDirection: 'row', justifyContent: 'space-between' },
    totalLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
    totalVal: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
    descText: { color: '#059669' },
    ivaText: { color: '#e11d48' },

    box: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6, padding: 10 },
    boxText: { fontSize: 9, color: '#334155', lineHeight: 1.6 },

    footer: { position: 'absolute', bottom: 20, left: '20mm', right: '20mm', borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 8, textAlign: 'center' },
    footerText: { fontSize: 7, color: '#94a3b8' },
});

// ── Component ──────────────────────────────────────────────────────────────────
export interface CobroPdfProps {
    os: any; // Using any for simplicity as it comes from Prisma include
    logoUrl?: string;
}

export function CobroPdf({ os, logoUrl }: CobroPdfProps) {
    const horasNormales = os.operadores.filter((op: any) => !op.isExtra).reduce((acc: number, op: any) => acc + (op.horas || 0), 0);
    const horasExtras = os.operadores.filter((op: any) => op.isExtra).reduce((acc: number, op: any) => acc + (op.horas || 0), 0);
    
    const subtotalMoNormal = horasNormales * (os.cobroValorManoObra || 0);
    const subtotalMoExtras = horasExtras * (os.cobroValorManoObra || 0) * 2;
    const subtotalMo = subtotalMoNormal + subtotalMoExtras;

    const subtotalMat = os.materiales.reduce((acc: number, m: any) => acc + (m.cantidad * (m.precioUnitario || 0)), 0);
    const subtotalBruto = subtotalMo + subtotalMat;
    
    const descuentoPorcentaje = os.cobroDescuentoPorcentaje || 0;
    const montoDescuento = subtotalBruto * (descuentoPorcentaje / 100);
    const subtotalConDescuento = subtotalBruto - montoDescuento;
    const montoIva = os.cobroAplicarIva ? (subtotalConDescuento * 0.21) : 0;
    const totalFinal = subtotalConDescuento + montoIva;

    const osCode = os.codigoOS || `#${os.id.slice(-8).toUpperCase()}`;

    return (
        <Document>
            <Page size="A4" style={S.page}>
                {/* ── Header ── */}
                <View style={S.header}>
                    <View style={S.headLeft}>
                        {logoUrl && <Image style={S.logo} src={logoUrl} />}
                        <Text style={S.headTitle}>Orden de Cobro — {osCode}</Text>
                        <Text style={S.headSub}>{os.project.codigoProyecto ? os.project.codigoProyecto + ' | ' : ''}{os.project.nombre}</Text>
                    </View>
                    <View style={S.headRight}>
                        <Text style={S.headDate}>Fecha: {formatDate(os.cobroFechaGeneracion || new Date())}</Text>
                    </View>
                </View>

                {/* ── Datos del Cliente y Proyecto ── */}
                <View style={S.section}>
                    <View style={S.grid2}>
                        <View style={S.field}>
                            <Text style={S.fieldLabel}>Cliente</Text>
                            <Text style={S.fieldValue}>{os.project.client?.nombre || os.project.cliente || 'No especificado'}</Text>
                        </View>
                        <View style={S.field}>
                            <Text style={S.fieldLabel}>Condición de Pago</Text>
                            <Text style={S.fieldValue}>{os.cobroCondicionPago || 'A convenir'}</Text>
                        </View>
                    </View>
                </View>

                {/* ── Mano de Obra ── */}
                <View style={S.section}>
                    <Text style={S.sectionTitle}>Mano de Obra</Text>
                    <View style={S.tableHeader}>
                        <Text style={[S.thCell, { flex: 4 }]}>Concepto</Text>
                        <Text style={[S.thCell, { flex: 1, textAlign: 'right' }]}>Horas</Text>
                        <Text style={[S.thCell, { flex: 2, textAlign: 'right' }]}>Valor Hora</Text>
                        <Text style={[S.thCell, { flex: 2, textAlign: 'right' }]}>Subtotal</Text>
                    </View>
                    {horasNormales > 0 && (
                        <View style={S.tableRow}>
                            <Text style={[S.tdCell, { flex: 4 }]}>Mano de Obra Especializada (Horas Normales)</Text>
                            <Text style={[S.tdCell, { flex: 1, textAlign: 'right' }]}>{horasNormales}h</Text>
                            <Text style={[S.tdCell, { flex: 2, textAlign: 'right' }]}>{formatARS(os.cobroValorManoObra)}</Text>
                            <Text style={[S.tdCell, S.tdBold, { flex: 2, textAlign: 'right' }]}>{formatARS(subtotalMoNormal)}</Text>
                        </View>
                    )}
                    {horasExtras > 0 && (
                        <View style={S.tableRow}>
                            <Text style={[S.tdCell, { flex: 4 }]}>Mano de Obra Especializada (Horas Extras - Cobro Doble)</Text>
                            <Text style={[S.tdCell, { flex: 1, textAlign: 'right' }]}>{horasExtras}h</Text>
                            <Text style={[S.tdCell, { flex: 2, textAlign: 'right' }]}>{formatARS((os.cobroValorManoObra || 0) * 2)}</Text>
                            <Text style={[S.tdCell, S.tdBold, { flex: 2, textAlign: 'right' }]}>{formatARS(subtotalMoExtras)}</Text>
                        </View>
                    )}
                </View>

                {/* ── Materiales ── */}
                {os.materiales.length > 0 && (
                    <View style={S.section}>
                        <Text style={S.sectionTitle}>Materiales Suministrados</Text>
                        <View style={S.tableHeader}>
                            <Text style={[S.thCell, { flex: 4 }]}>Material</Text>
                            <Text style={[S.thCell, { flex: 1, textAlign: 'right' }]}>Cant.</Text>
                            <Text style={[S.thCell, { flex: 2, textAlign: 'right' }]}>Precio Unit.</Text>
                            <Text style={[S.thCell, { flex: 2, textAlign: 'right' }]}>Subtotal</Text>
                        </View>
                        {os.materiales.map((m: any) => (
                            <View key={m.id} style={S.tableRow}>
                                <Text style={[S.tdCell, { flex: 4 }]}>{m.material}</Text>
                                <Text style={[S.tdCell, { flex: 1, textAlign: 'right' }]}>{m.cantidad}</Text>
                                <Text style={[S.tdCell, { flex: 2, textAlign: 'right' }]}>{formatARS(m.precioUnitario)}</Text>
                                <Text style={[S.tdCell, S.tdBold, { flex: 2, textAlign: 'right' }]}>{formatARS(m.cantidad * (m.precioUnitario || 0))}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* ── Mensajes / Observaciones ── */}
                {os.comentario && (
                    <View style={S.section}>
                        <Text style={S.sectionTitle}>Comentario de OS</Text>
                        <View style={S.box}>
                            <Text style={S.boxText}>{os.comentario}</Text>
                        </View>
                    </View>
                )}

                {os.cobroObservaciones && (
                    <View style={S.section}>
                        <Text style={S.sectionTitle}>Observaciones de Cobro</Text>
                        <View style={S.box}>
                            <Text style={S.boxText}>{os.cobroObservaciones}</Text>
                        </View>
                    </View>
                )}

                {/* ── Totales ── */}
                <View style={S.totalsWrapper}>
                    <View style={S.totalsBox}>
                        <View style={S.totalsRow}>
                            <Text style={S.totalsLabel}>Subtotal</Text>
                            <Text style={S.totalsVal}>{formatARS(subtotalBruto)}</Text>
                        </View>
                        {descuentoPorcentaje > 0 && (
                            <View style={S.totalsRow}>
                                <Text style={[S.totalsLabel, S.descText]}>Descuento ({descuentoPorcentaje}%)</Text>
                                <Text style={[S.totalsVal, S.descText]}>-{formatARS(montoDescuento)}</Text>
                            </View>
                        )}
                        {os.cobroAplicarIva && (
                            <View style={S.totalsRow}>
                                <Text style={[S.totalsLabel, S.ivaText]}>IVA (21%)</Text>
                                <Text style={[S.totalsVal, S.ivaText]}>+{formatARS(montoIva)}</Text>
                            </View>
                        )}
                        <View style={S.totalsRowFinal}>
                            <Text style={S.totalLabel}>TOTAL FINAL</Text>
                            <Text style={S.totalVal}>{formatARS(totalFinal)}</Text>
                        </View>
                    </View>
                </View>

                {/* ── Footer ── */}
                <View style={S.footer}>
                    <Text style={S.footerText}>Documento de control interno y detalle de servicios. No válido como factura electrónica AFIP.</Text>
                </View>
            </Page>
        </Document>
    );
}
