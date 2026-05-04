import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

import { formatDate as fmtDate, formatDateTime as fmtDateTime } from '@/lib/formatDate';

// ── Styles ────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
    page: { padding: '20mm', backgroundColor: '#FFFFFF', fontFamily: 'Helvetica', fontSize: 9, color: '#1e293b' },

    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 3, borderBottomColor: '#059669', paddingBottom: 16, marginBottom: 15 },
    logo: { height: 90, objectFit: 'contain', alignSelf: 'flex-start', marginBottom: 5 },
    headLeft: { flexDirection: 'column', gap: 3 },
    headTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginTop: 10 },
    headSub: { fontSize: 10, color: '#64748b' },
    badge: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20, fontSize: 9, fontFamily: 'Helvetica-Bold', letterSpacing: 0.8 },
    badgeFirmada: { backgroundColor: '#d1fae5', color: '#065f46' },
    badgePendiente: { backgroundColor: '#fef3c7', color: '#92400e' },
    headRight: { alignItems: 'flex-end', gap: 6 },
    headDate: { fontSize: 9, color: '#94a3b8' },

    section: { marginBottom: 18 },
    sectionTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 4, marginBottom: 10 },

    grid2: { flexDirection: 'row', gap: 16 },
    field: { flex: 1 },
    fieldLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
    fieldValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#1e293b' },

    reportBox: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6, padding: 10 },
    reportText: { fontSize: 9, color: '#334155', lineHeight: 1.6 },

    // Table
    tableHeader: { flexDirection: 'row', backgroundColor: '#f8fafc', borderBottomWidth: 2, borderBottomColor: '#e2e8f0', paddingVertical: 6, paddingHorizontal: 10 },
    thCell: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 },
    tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingVertical: 7, paddingHorizontal: 10 },
    tdCell: { fontSize: 9, color: '#334155', fontFamily: 'Helvetica' },
    tdBold: { fontFamily: 'Helvetica-Bold' },

    // Firma
    firmaBox: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#a7f3d0', borderRadius: 6, padding: 12 },
    firmaImg: { maxWidth: 200, maxHeight: 60, marginTop: 8 },

    footer: { position: 'absolute', bottom: 20, left: '20mm', right: '20mm', flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 8 },
    footerText: { fontSize: 8, color: '#94a3b8' },
});

// ── Props ──────────────────────────────────────────────────────────────────────
export interface OSPdfProps {
    os: {
        id: string;
        codigoOS?: string | null;
        estado: string;
        reporte: string;
        comentario?: string | null;
        fechaCreacion: string;
        project: {
            nombre: string;
            codigoProyecto?: string | null;
            cliente?: string | null;
            client?: { nombre: string } | null;
            responsableUser?: { nombreCompleto: string } | null;
        };
        materiales: { id: string; material: string; cantidad: number; unidadMedida: string }[];
        operadores: { id: string; horas: number; isExtra?: boolean; operador: { nombreCompleto: string } }[];
        firma?: {
            nombre: string;
            dni: string;
            firmaImagen: string;
            fechaFirma: string;
        } | null;
    };
    logoUrl?: string;
}

// ── Component ──────────────────────────────────────────────────────────────────
export function OSPdf({ os, logoUrl }: OSPdfProps) {
    const isFirmada = os.estado === 'firmada';
    const clienteName = os.project.client?.nombre || os.project.cliente || 'No especificado';
    const osCode = os.codigoOS || `#${os.id.slice(-8).toUpperCase()}`;
    const prCode = os.project.codigoProyecto;

    return (
        <Document>
            <Page size="A4" style={S.page}>

                {/* ── Header ── */}
                <View style={S.header}>
                    <View style={S.headLeft}>
                        {logoUrl && <Image style={S.logo} src={logoUrl} />}
                        <Text style={S.headTitle}>
                            Orden de Servicio — {osCode}
                        </Text>
                        <Text style={S.headSub}>
                            {prCode ? `${prCode} | ` : ''}{os.project.nombre}
                        </Text>
                    </View>
                    <View style={S.headRight}>
                        <View style={[S.badge, isFirmada ? S.badgeFirmada : S.badgePendiente]}>
                            <Text>{isFirmada ? '✓ Firmada' : 'Pendiente de firma'}</Text>
                        </View>
                        <Text style={S.headDate}>Emitida: {fmtDate(os.fechaCreacion)}</Text>
                    </View>
                </View>

                {/* ── Datos del Proyecto ── */}
                <View style={S.section} wrap={false}>
                    <Text style={S.sectionTitle}>Datos del Proyecto</Text>
                    <View style={S.grid2}>
                        <View style={S.field}>
                            <Text style={S.fieldLabel}>Cliente</Text>
                            <Text style={S.fieldValue}>{clienteName}</Text>
                        </View>
                        {os.project.responsableUser && (
                            <View style={S.field}>
                                <Text style={S.fieldLabel}>Responsable</Text>
                                <Text style={S.fieldValue}>{os.project.responsableUser.nombreCompleto}</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* ── Reporte ── */}
                <View style={S.section} wrap={false}>
                    <Text style={S.sectionTitle}>Reporte del Trabajo</Text>
                    <View style={S.reportBox}>
                        <Text style={S.reportText}>{os.reporte}</Text>
                    </View>
                </View>

                {/* ── Operadores ── */}
                <View style={S.section} wrap={false}>
                    <Text style={S.sectionTitle}>Operadores</Text>
                    <View style={S.tableHeader} wrap={false}>
                        <Text style={[S.thCell, { flex: 4 }]}>Nombre</Text>
                        <Text style={[S.thCell, { flex: 1, textAlign: 'right' }]}>Horas</Text>
                    </View>
                    {os.operadores.map((op, idx) => (
                        <View key={idx} style={S.tableRow} wrap={false}>
                            <View style={{ flex: 4 }}>
                                <Text style={S.tdCell}>{op.operador.nombreCompleto}</Text>
                                {op.isExtra && (
                                    <Text style={[S.tdCell, { fontSize: 7, color: '#92400e', fontFamily: 'Helvetica-Bold' }]}>HORAS EXTRAS</Text>
                                )}
                            </View>
                            <Text style={[S.tdCell, S.tdBold, { flex: 1, textAlign: 'right' }]}>{op.horas}h</Text>
                        </View>
                    ))}
                </View>

                {/* ── Materiales ── */}
                {os.materiales.length > 0 && (
                    <View style={S.section} wrap={false}>
                        <Text style={S.sectionTitle}>Materiales Utilizados</Text>
                        <View style={S.tableHeader} wrap={false}>
                            <Text style={[S.thCell, { flex: 4 }]}>Material</Text>
                            <Text style={[S.thCell, { flex: 1, textAlign: 'right' }]}>Cant.</Text>
                            <Text style={[S.thCell, { flex: 2, textAlign: 'right' }]}>Unidad</Text>
                        </View>
                        {os.materiales.map((m) => (
                            <View key={m.id} style={S.tableRow} wrap={false}>
                                <Text style={[S.tdCell, { flex: 4 }]}>{m.material}</Text>
                                <Text style={[S.tdCell, S.tdBold, { flex: 1, textAlign: 'right' }]}>{m.cantidad}</Text>
                                <Text style={[S.tdCell, { flex: 2, textAlign: 'right' }]}>{m.unidadMedida}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* ── Comentario ── */}
                {os.comentario && (
                    <View style={S.section} wrap={false}>
                        <Text style={S.sectionTitle}>Comentario Adicional</Text>
                        <View style={S.reportBox}>
                            <Text style={S.reportText}>{os.comentario}</Text>
                        </View>
                    </View>
                )}

                {/* ── Firma ── */}
                {isFirmada && os.firma && (
                    <View style={S.section} wrap={false}>
                        <Text style={S.sectionTitle}>Firma del Cliente</Text>
                        <View style={S.firmaBox}>
                            <View style={S.grid2}>
                                <View style={S.field}>
                                    <Text style={S.fieldLabel}>Nombre</Text>
                                    <Text style={S.fieldValue}>{os.firma.nombre}</Text>
                                </View>
                                <View style={S.field}>
                                    <Text style={S.fieldLabel}>DNI</Text>
                                    <Text style={S.fieldValue}>{os.firma.dni}</Text>
                                </View>
                                <View style={S.field}>
                                    <Text style={S.fieldLabel}>Fecha de Firma</Text>
                                    <Text style={S.fieldValue}>{fmtDateTime(os.firma.fechaFirma)}</Text>
                                </View>
                            </View>
                            <Image style={S.firmaImg} src={os.firma.firmaImagen} />
                        </View>
                    </View>
                )}

                {/* ── Footer ── */}
                <View style={S.footer} fixed>
                    <Text style={S.footerText}>HDB Job Planner — Gestión de Órdenes de Servicio</Text>
                    <Text style={S.footerText}>{osCode}{prCode ? ` — ${prCode}` : ''} — {fmtDate(os.fechaCreacion)}</Text>
                </View>

            </Page>
        </Document>
    );
}
