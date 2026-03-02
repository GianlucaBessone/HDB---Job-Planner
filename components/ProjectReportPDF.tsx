'use client';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr + 'T12:00:00');
        return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
        return dateStr ?? '—';
    }
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
    page: { padding: 36, backgroundColor: '#FFFFFF', fontFamily: 'Helvetica', fontSize: 9 },

    // Header
    header: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 2, borderBottomColor: '#0F172A', paddingBottom: 16, marginBottom: 20 },
    title: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#0F172A' },
    statusBadge: { fontSize: 8, color: '#10B981', marginTop: 4, letterSpacing: 1 },
    projectInfo: { alignItems: 'flex-end' },
    projectName: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: '#4F46E5' },
    clientName: { fontSize: 9, color: '#64748B', marginTop: 3 },
    dateRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
    dateLabel: { fontSize: 8, color: '#94A3B8' },

    // KPI row (5 boxes)
    kpiRow: { flexDirection: 'row', gap: 6, marginBottom: 16 },
    kpiBox: { flex: 1, backgroundColor: '#F8FAFC', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#F1F5F9', alignItems: 'center' },
    kpiBoxIndigo: { backgroundColor: '#EEF2FF', borderColor: '#E0E7FF' },
    kpiBoxAmber: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
    kpiBoxRose: { backgroundColor: '#FFF1F2', borderColor: '#FEE2E2' },
    kpiLabel: { fontSize: 7, color: '#94A3B8', marginBottom: 3, textAlign: 'center' },
    kpiValue: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#1E293B', textAlign: 'center' },
    kpiSub: { fontSize: 6, color: '#94A3B8', marginTop: 1, textAlign: 'center' },

    // Observaciones
    obsBox: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 8, padding: 10, marginBottom: 14 },
    obsTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    obsTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#92400E', letterSpacing: 0.5 },
    obsText: { fontSize: 8, color: '#44403C', lineHeight: 1.5 },

    // Summary columns
    contentRow: { flexDirection: 'row', gap: 20, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 14 },
    column: { flex: 1 },
    sectionTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1E293B', marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 3 },
    sectionSubtitle: { fontSize: 7, color: '#94A3B8', marginBottom: 6 },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, fontSize: 8, color: '#475569' },
    barContainer: { height: 3, backgroundColor: '#F1F5F9', borderRadius: 2, marginBottom: 7 },
    barFill: { height: '100%', borderRadius: 2 },
    emptyText: { fontSize: 8, color: '#94A3B8', fontStyle: 'italic' },

    // Tables
    tableWrapper: { marginBottom: 18 },
    tableTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1E293B', marginBottom: 7, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 3 },
    tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#CBD5E1', paddingBottom: 4, marginBottom: 2 },
    thCell: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#94A3B8' },
    tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F8FAFC', paddingVertical: 4 },
    tdCell: { fontSize: 8, color: '#475569' },
    tdBold: { fontFamily: 'Helvetica-Bold' },
    totalRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#CBD5E1', paddingTop: 4, marginTop: 2 },

    // Footer
    footer: { position: 'absolute', bottom: 24, left: 36, right: 36, textAlign: 'center', fontSize: 7, color: '#94A3B8', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 8 },
});

// ── Props ─────────────────────────────────────────────────────────────────────
interface PDFProps {
    project: any;
    totalRealHours: number;
    savedHours: number;
    IPT: string;
    operatorMap: { nombre: string; horas: number }[];
    delaysByArea: { area: string; horas: number }[];
    delayImpactPct: string;
    clientDelays: any[];
}

// ── Component ─────────────────────────────────────────────────────────────────
export const ProjectReportPDF = ({
    project,
    totalRealHours,
    savedHours,
    IPT,
    operatorMap,
    delaysByArea,
    delayImpactPct,
    clientDelays,
}: PDFProps) => {
    const totalDelaysHours = delaysByArea.reduce((a, d) => a + d.horas, 0);
    const impact = parseFloat(delayImpactPct);
    const hasClientStr = project.client?.nombre || project.cliente || 'Sin cliente';
    const hasObs = !!project.observaciones;

    // KPI impact colour
    const impactColor = impact > 20 ? '#F43F5E' : impact > 10 ? '#F59E0B' : '#10B981';
    const impactBoxStyle = impact > 20 ? S.kpiBoxRose : impact > 10 ? S.kpiBoxAmber : S.kpiBox;

    return (
        <Document>
            <Page size="A4" style={S.page}>

                {/* ── Header ── */}
                <View style={S.header}>
                    <View>
                        <Text style={S.title}>Reporte de Proyecto</Text>
                        <Text style={S.statusBadge}>✓  PROYECTO FINALIZADO</Text>
                    </View>
                    <View style={S.projectInfo}>
                        <Text style={S.projectName}>{project.nombre}</Text>
                        <Text style={S.clientName}>{hasClientStr}</Text>
                        <View style={S.dateRow}>
                            <Text style={S.dateLabel}>Inicio: {fmtDate(project.fechaInicio)}</Text>
                            <Text style={S.dateLabel}>  →  </Text>
                            <Text style={S.dateLabel}>Fin: {fmtDate(project.fechaFin)}</Text>
                        </View>
                    </View>
                </View>

                {/* ── KPI Cards ── */}
                <View style={S.kpiRow}>
                    <View style={S.kpiBox}>
                        <Text style={S.kpiLabel}>Hs. Estimadas</Text>
                        <Text style={S.kpiValue}>{project.horasEstimadas}h</Text>
                    </View>
                    <View style={S.kpiBox}>
                        <Text style={S.kpiLabel}>Hs. Reales</Text>
                        <Text style={[S.kpiValue, { color: totalRealHours > project.horasEstimadas ? '#F43F5E' : '#10B981' }]}>
                            {totalRealHours.toFixed(1)}h
                        </Text>
                    </View>
                    <View style={S.kpiBox}>
                        <Text style={S.kpiLabel}>Ahorro / Desvío</Text>
                        <Text style={[S.kpiValue, { color: savedHours >= 0 ? '#10B981' : '#F43F5E' }]}>
                            {savedHours > 0 ? '+' : ''}{savedHours.toFixed(1)}h
                        </Text>
                    </View>
                    <View style={[S.kpiBox, S.kpiBoxIndigo]}>
                        <Text style={[S.kpiLabel, { color: '#818CF8' }]}>Eficiencia (IPT)</Text>
                        <Text style={[S.kpiValue, { color: '#4F46E5' }]}>{IPT}</Text>
                    </View>
                    <View style={[S.kpiBox, impactBoxStyle]}>
                        <Text style={[S.kpiLabel, { color: impactColor }]}>Impacto Demoras</Text>
                        <Text style={[S.kpiValue, { color: impactColor }]}>{delayImpactPct}%</Text>
                        <Text style={[S.kpiSub, { color: impactColor }]}>sobre ejecutado</Text>
                    </View>
                </View>

                {/* ── Observaciones ── */}
                {hasObs && (
                    <View style={S.obsBox}>
                        <View style={S.obsTitleRow}>
                            <Text style={S.obsTitle}>OBSERVACIONES DEL PROYECTO</Text>
                        </View>
                        <Text style={S.obsText}>{project.observaciones}</Text>
                    </View>
                )}

                {/* ── Resúmenes ── */}
                <View style={S.contentRow}>
                    {/* Operadores */}
                    <View style={S.column}>
                        <Text style={S.sectionTitle}>Resumen por Operador</Text>
                        {operatorMap.length === 0 && <Text style={S.emptyText}>Sin registros confirmados.</Text>}
                        {operatorMap.map((op, idx) => {
                            const pct = totalRealHours > 0 ? Math.min(op.horas / totalRealHours, 1) * 100 : 0;
                            return (
                                <View key={idx}>
                                    <View style={S.row}>
                                        <Text>{op.nombre}</Text>
                                        <Text>{op.horas.toFixed(1)}h</Text>
                                    </View>
                                    <View style={S.barContainer}>
                                        <View style={[S.barFill, { backgroundColor: '#6366F1', width: `${pct}%` }]} />
                                    </View>
                                </View>
                            );
                        })}
                    </View>

                    {/* Demoras resumen */}
                    <View style={S.column}>
                        <Text style={S.sectionTitle}>
                            Demoras del Cliente — {totalDelaysHours}h ({delayImpactPct}% carga)
                        </Text>
                        {delaysByArea.length === 0 && <Text style={S.emptyText}>Sin demoras registradas.</Text>}
                        {delaysByArea.map((d, idx) => {
                            const pct = totalDelaysHours > 0 ? (d.horas / totalDelaysHours) * 100 : 0;
                            return (
                                <View key={idx}>
                                    <View style={S.row}>
                                        <Text>{d.area}</Text>
                                        <Text style={{ color: '#F59E0B' }}>{d.horas.toFixed(1)}h</Text>
                                    </View>
                                    <View style={S.barContainer}>
                                        <View style={[S.barFill, { backgroundColor: '#FBBF24', width: `${pct}%` }]} />
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                </View>

                {/* ── Tabla Tiempos Operativos (sin columna Horas) ── */}
                <View style={S.tableWrapper}>
                    <Text style={S.tableTitle}>Desglose de Tiempos Operativos</Text>
                    {project.timeEntries.length === 0 ? (
                        <Text style={S.emptyText}>Sin registros de tiempo confirmados.</Text>
                    ) : (
                        <>
                            <View style={S.tableHeader}>
                                <Text style={[S.thCell, { flex: 2 }]}>FECHA</Text>
                                <Text style={[S.thCell, { flex: 3 }]}>OPERADOR</Text>
                                <Text style={[S.thCell, { flex: 2 }]}>HORARIO</Text>
                            </View>
                            {project.timeEntries.map((e: any) => (
                                <View key={e.id} style={S.tableRow}>
                                    <Text style={[S.tdCell, { flex: 2 }]}>{fmtDate(e.fecha)}</Text>
                                    <Text style={[S.tdCell, { flex: 3 }]}>{e.operator.nombreCompleto}</Text>
                                    <Text style={[S.tdCell, S.tdBold, { flex: 2 }]}>{e.horaIngreso} → {e.horaEgreso}</Text>
                                </View>
                            ))}
                        </>
                    )}
                </View>

                {/* ── Tabla Demoras Detallada (con Responsable Área) ── */}
                {clientDelays.length > 0 && (
                    <View style={S.tableWrapper}>
                        <Text style={S.tableTitle}>Detalle de Demoras Externas</Text>
                        <View style={S.tableHeader}>
                            <Text style={[S.thCell, { flex: 1.5 }]}>FECHA</Text>
                            <Text style={[S.thCell, { flex: 2 }]}>ÁREA</Text>
                            <Text style={[S.thCell, { flex: 2 }]}>RESP. ÁREA</Text>
                            <Text style={[S.thCell, { flex: 4 }]}>MOTIVO</Text>
                            <Text style={[S.thCell, { flex: 1, textAlign: 'right' }]}>HS</Text>
                        </View>
                        {clientDelays.map((d: any) => (
                            <View key={d.id} style={S.tableRow}>
                                <Text style={[S.tdCell, { flex: 1.5 }]}>{fmtDate(d.fecha)}</Text>
                                <Text style={[S.tdCell, { flex: 2, color: '#D97706' }]}>{d.area}</Text>
                                <Text style={[S.tdCell, { flex: 2 }]}>{d.responsableArea || '—'}</Text>
                                <Text style={[S.tdCell, { flex: 4 }]}>
                                    &quot;{d.motivo}&quot;
                                </Text>
                                <Text style={[S.tdCell, S.tdBold, { flex: 1, textAlign: 'right', color: '#D97706' }]}>
                                    {d.duracion}h
                                </Text>
                            </View>
                        ))}
                        {/* Total row */}
                        <View style={S.totalRow}>
                            <Text style={[S.tdCell, { flex: 9.5, textAlign: 'right', color: '#94A3B8', fontSize: 7 }]}>
                                TOTAL DEMORAS
                            </Text>
                            <Text style={[S.tdCell, S.tdBold, { flex: 1, textAlign: 'right', color: '#D97706' }]}>
                                {totalDelaysHours}h
                            </Text>
                        </View>
                    </View>
                )}

                {/* ── Footer ── */}
                <Text style={S.footer}>
                    Reporte Oficial · Generado por HDB Job Planner el {new Date().toLocaleDateString('es-AR')}
                </Text>
            </Page>
        </Document>
    );
};
