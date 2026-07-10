import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { formatDate as fmtDate, formatDateTime as fmtDateTime } from '@/lib/formatDate';

// ── Styles ────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
    page: { padding: '20mm', backgroundColor: '#FFFFFF', fontFamily: 'Helvetica', fontSize: 9, color: '#1e293b' },

    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 3, borderBottomColor: '#3b82f6', paddingBottom: 16, marginBottom: 15 },
    logo: { height: 90, objectFit: 'contain', alignSelf: 'flex-start', marginBottom: 5 },
    headLeft: { flexDirection: 'column', gap: 3 },
    headTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginTop: 10 },
    headSub: { fontSize: 10, color: '#64748b' },
    headRight: { alignItems: 'flex-end', gap: 6 },
    headDate: { fontSize: 9, color: '#94a3b8' },

    section: { marginBottom: 18 },
    sectionTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 4, marginBottom: 10 },

    grid3: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
    field: { width: '30%', marginBottom: 10 },
    fieldFull: { width: '100%', marginBottom: 10 },
    fieldLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
    fieldValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1e293b' },

    reportBox: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6, padding: 10 },
    reportText: { fontSize: 9, color: '#334155', lineHeight: 1.6 },

    // Table
    tableHeader: { flexDirection: 'row', backgroundColor: '#f8fafc', borderBottomWidth: 2, borderBottomColor: '#e2e8f0', paddingVertical: 6, paddingHorizontal: 10 },
    thCell: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 },
    tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingVertical: 7, paddingHorizontal: 10 },
    tdCell: { fontSize: 9, color: '#334155', fontFamily: 'Helvetica' },
    tdBold: { fontFamily: 'Helvetica-Bold' },

    // Firma
    firmaBox: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#a7f3d0', borderRadius: 6, padding: 12, marginTop: 20 },
    firmaImg: { maxWidth: 200, maxHeight: 60, marginTop: 8 },

    footer: { position: 'absolute', bottom: 20, left: '20mm', right: '20mm', flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 8 },
    footerText: { fontSize: 8, color: '#94a3b8' },
});

export interface TechnicalReportPdfProps {
    report: any;
    logoUrl?: string;
    qrCodeUrl?: string;
}

export function TechnicalReportPdf({ report, logoUrl, qrCodeUrl }: TechnicalReportPdfProps) {
    const prCode = report.project?.codigoProyecto;
    return (
        <Document>
            <Page size="A4" orientation="portrait" style={S.page}>

                {/* ── Header ── */}
                <View style={S.header}>
                    <View style={S.headLeft}>
                        {logoUrl && <Image style={S.logo} src={logoUrl} />}
                        <Text style={S.headTitle}>
                            {report.template?.name || 'Informe Técnico'} — {report.reportNumber}
                        </Text>
                        <Text style={S.headSub}>
                            {prCode ? `${prCode} | ` : ''}{report.project?.nombre || report.client?.nombre || 'General'}
                        </Text>
                    </View>
                    <View style={S.headRight}>
                        <Text style={S.headDate}>Emitido: {fmtDate(report.createdAt)}</Text>
                    </View>
                </View>

                {/* ── Datos Generales ── */}
                <View style={S.section} wrap={false}>
                    <Text style={S.sectionTitle}>Datos Generales</Text>
                    <View style={S.grid3}>
                        {report.project && (
                            <View style={S.field}>
                                <Text style={S.fieldLabel}>Proyecto</Text>
                                <Text style={S.fieldValue}>{report.project.nombre}</Text>
                            </View>
                        )}
                        {report.client && (
                            <View style={S.field}>
                                <Text style={S.fieldLabel}>Cliente</Text>
                                <Text style={S.fieldValue}>{report.client.nombre}</Text>
                            </View>
                        )}
                        {report.planta && (
                            <View style={S.field}>
                                <Text style={S.fieldLabel}>Planta</Text>
                                <Text style={S.fieldValue}>{report.planta}</Text>
                            </View>
                        )}
                        {report.sector && (
                            <View style={S.field}>
                                <Text style={S.fieldLabel}>Sector</Text>
                                <Text style={S.fieldValue}>{report.sector}</Text>
                            </View>
                        )}
                        {report.equipo && (
                            <View style={S.field}>
                                <Text style={S.fieldLabel}>Equipo/Activo</Text>
                                <Text style={S.fieldValue}>{report.equipo}</Text>
                            </View>
                        )}
                        {report.responsable && (
                            <View style={S.field}>
                                <Text style={S.fieldLabel}>Responsable</Text>
                                <Text style={S.fieldValue}>{report.responsable.nombreCompleto}</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* ── Secciones Dinámicas ── */}
                {report.template?.schema?.sections?.map((section: any, idx: number) => (
                    <View key={idx} style={S.section} wrap={false}>
                        <Text style={S.sectionTitle}>{section.title}</Text>
                        {section.fields?.map((field: any, fIdx: number) => {
                            const val = report.data?.[field.id];
                            if (field.type === 'table') {
                                const rows = Array.isArray(val) ? val : [];
                                if (rows.length === 0) return null;
                                return (
                                    <View key={fIdx} style={{ marginBottom: 10 }}>
                                        <Text style={[S.fieldLabel, { marginBottom: 4 }]}>{field.label}</Text>
                                        <View style={S.tableHeader}>
                                            {field.columns.map((c: any, cIdx: number) => (
                                                <Text key={cIdx} style={[S.thCell, { flex: 1 }]}>{c.label}</Text>
                                            ))}
                                        </View>
                                        {rows.map((row: any, rIdx: number) => (
                                            <View key={rIdx} style={S.tableRow}>
                                                {field.columns.map((c: any, cIdx: number) => (
                                                    <Text key={cIdx} style={[S.tdCell, { flex: 1 }]}>{row[c.id] || '-'}</Text>
                                                ))}
                                            </View>
                                        ))}
                                    </View>
                                );
                            }
                            if (field.type === 'textarea') {
                                return (
                                    <View key={fIdx} style={S.fieldFull}>
                                        <Text style={S.fieldLabel}>{field.label}</Text>
                                        <View style={S.reportBox}>
                                            <Text style={S.reportText}>{val || '-'}</Text>
                                        </View>
                                    </View>
                                );
                            }
                            return (
                                <View key={fIdx} style={S.fieldFull}>
                                    <Text style={S.fieldLabel}>{field.label}</Text>
                                    <Text style={S.fieldValue}>{val || '-'}</Text>
                                </View>
                            );
                        })}
                    </View>
                ))}

                {/* ── Firma ── */}
                {report.signature && (
                    <View style={S.section} wrap={false}>
                        <Text style={S.sectionTitle}>Firma Digital de Conformidad</Text>
                        <View style={S.firmaBox}>
                            <View style={S.grid3}>
                                <View style={S.field}>
                                    <Text style={S.fieldLabel}>Nombre</Text>
                                    <Text style={S.fieldValue}>{report.signature.UserName}</Text>
                                </View>
                                <View style={S.field}>
                                    <Text style={S.fieldLabel}>Fecha de Firma (UTC)</Text>
                                    <Text style={S.fieldValue}>{fmtDateTime(report.signature.SignedAtUTC)}</Text>
                                </View>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                                <View style={{ flex: 1, padding: 8, backgroundColor: '#d1fae5', borderRadius: 4 }}>
                                    <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#065f46', marginBottom: 2 }}>✓ IDENTIDAD DIGITAL VERIFICADA (HASH)</Text>
                                    <Text style={{ fontSize: 7, color: '#064e3b', fontFamily: 'Helvetica' }}>{report.signature.HashSignature}</Text>
                                    <Text style={{ fontSize: 6, color: '#064e3b', marginTop: 2 }}>ID: {report.signature.SignatureID}</Text>
                                </View>
                                {qrCodeUrl && (
                                    <View style={{ width: 40, height: 40 }}>
                                        <Image src={qrCodeUrl} style={{ width: '100%', height: '100%' }} />
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>
                )}

                {/* ── Footer ── */}
                <View style={S.footer} fixed>
                    <Text style={S.footerText}>HDB SGI — Informes Técnicos</Text>
                    <Text style={S.footerText}>{report.reportNumber} — {fmtDate(report.createdAt)}</Text>
                </View>

            </Page>
        </Document>
    );
}
