import { Document, Page, Text, View, StyleSheet, Image, Svg, Path, Circle, Polyline } from '@react-pdf/renderer';
import { formatDate } from '@/lib/formatDate';

// ── Styles ────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
    page: { padding: 36, backgroundColor: '#FFFFFF', fontFamily: 'Helvetica', fontSize: 9 },

    header: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 2, borderBottomColor: '#0F172A', paddingBottom: 16, marginBottom: 15, alignItems: 'flex-start' },
    logo: { height: 90, objectFit: 'contain', alignSelf: 'flex-start', marginBottom: 5 },
    title: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#0F172A', marginTop: 10 },
    statusBadgeContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
    statusBadge: { fontSize: 8, fontFamily: 'Helvetica-Bold', letterSpacing: 1 },
    projectInfo: { alignItems: 'flex-end' },
    projectName: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: '#4F46E5' },
    clientName: { fontSize: 9, color: '#64748B', marginTop: 3 },
    dateRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
    dateLabel: { fontSize: 8, color: '#94A3B8' },
    filterPeriodBadge: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#4F46E5', backgroundColor: '#EEF2FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4 },

    // KPI row (6 boxes)
    kpiRow: { flexDirection: 'row', gap: 4, marginBottom: 16 },
    kpiBox: { flex: 1, backgroundColor: '#F8FAFC', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#F1F5F9', alignItems: 'center' },
    kpiBoxIndigo: { backgroundColor: '#EEF2FF', borderColor: '#E0E7FF' },
    kpiBoxAmber: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
    kpiBoxRose: { backgroundColor: '#FFF1F2', borderColor: '#FEE2E2' },
    kpiLabel: { fontSize: 7, color: '#94A3B8', marginBottom: 3, textAlign: 'center' },
    kpiValue: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#1E293B', textAlign: 'center' },

    // Observaciones
    obsBox: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 8, padding: 10, marginBottom: 14 },
    obsTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    obsTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#92400E', letterSpacing: 0.5 },
    obsText: { fontSize: 8, color: '#44403C', lineHeight: 1.5 },

    // Summary columns
    contentRow: { flexDirection: 'row', gap: 20, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 14 },
    column: { flex: 1 },
    sectionTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1E293B', marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 3, flexDirection: 'row', alignItems: 'center', gap: 4 },
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

    // Checklist
    checklistGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    checklistItem: { width: '48%', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 8, padding: 8, flexDirection: 'row', gap: 6 },
    checklistItemDone: { backgroundColor: '#ECFDF5', borderColor: '#D1FAE5' },
    checkIcon: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
    checkIconDone: { backgroundColor: '#10B981', borderColor: '#10B981' },
    checkText: { flex: 1 },
    checkDesc: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#334155' },
    checkDescDone: { color: '#064E3B' },
    checkTagRow: { flexDirection: 'row', gap: 4, marginTop: 3, alignItems: 'center' },
    checkTag: { fontSize: 5, color: '#94A3B8', backgroundColor: '#FFFFFF', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3, borderWidth: 0.5, borderColor: '#E2E8F0' },
    checkStatus: { fontSize: 5, fontFamily: 'Helvetica-Bold' },

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
    dateRange?: { start?: string; end?: string };
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
    dateRange,
}: PDFProps) => {
    const totalDelaysHours = delaysByArea.reduce((a, d) => a + d.horas, 0);
    const hasClientStr = project.client?.nombre || project.cliente || 'Sin cliente';
    const hasObs = !!project.observaciones;
    const estimatedHours = project.proyectoFijo ? totalRealHours : (project.horasEstimadas || 0);

    // Dynamic status badge without broken unicode
    const STATUS_MAP: Record<string, { label: string; color: string }> = {
        por_hacer:   { label: 'POR HACER',   color: '#94A3B8' },
        planificado: { label: 'PLANIFICADO', color: '#3B82F6' },
        activo:      { label: 'EN CURSO',    color: '#6366F1' },
        en_riesgo:   { label: 'EN RIESGO',   color: '#F59E0B' },
        atrasado:    { label: 'ATRASADO',    color: '#F43F5E' },
        finalizado:  { label: 'FINALIZADO',  color: '#10B981' },
    };
    const statusInfo = STATUS_MAP[project.estado] ?? {
        label: (project.estado ?? 'SIN ESTADO').toUpperCase(),
        color: '#94A3B8'
    };

    const isFiltered = Boolean(dateRange && (dateRange.start || dateRange.end));

    return (
        <Document>
            <Page size="A4" style={S.page}>

                {/* ── Header ── */}
                <View style={S.header}>
                    <View style={{ flexDirection: 'row', gap: 15, alignItems: 'center' }}>
                        <Image style={S.logo} src={(typeof window !== 'undefined' ? window.location.origin : '') + "/logo-hdb.jpg"} />
                        <View>
                            <Text style={S.title}>Informe de Proyecto</Text>
                            <View style={S.statusBadgeContainer}>
                                <View style={[S.statusDot, { backgroundColor: statusInfo.color }]} />
                                <Text style={[S.statusBadge, { color: statusInfo.color }]}>
                                    {statusInfo.label} {project.proyectoFijo ? '• FIJO' : ''}
                                </Text>
                            </View>
                        </View>
                    </View>
                    <View style={S.projectInfo}>
                        <Text style={S.projectName}>{project.nombre}</Text>
                        <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1E293B', textAlign: 'right', marginBottom: 2 }}>HDB Servicios Eléctricos</Text>
                        <Text style={S.clientName}>{hasClientStr}</Text>
                        <View style={S.dateRow}>
                            <Text style={S.dateLabel}>Inicio: {formatDate(project.fechaInicio)}</Text>
                            <Text style={S.dateLabel}> — </Text>
                            <Text style={S.dateLabel}>Fin: {formatDate(project.fechaFin)}</Text>
                        </View>
                        {isFiltered && (
                            <Text style={S.filterPeriodBadge}>
                                Período Filtrado: {dateRange?.start ? formatDate(dateRange.start) : 'Inicio'} a {dateRange?.end ? formatDate(dateRange.end) : 'Actualidad'}
                            </Text>
                        )}
                    </View>
                </View>

                {/* ── KPI Cards ── */}
                <View style={S.kpiRow}>
                    <View style={S.kpiBox}>
                        <Text style={S.kpiLabel}>Hs. Estimadas</Text>
                        <Text style={S.kpiValue}>
                            {project.proyectoFijo ? `${totalRealHours.toFixed(1)}h` : `${project.horasEstimadas}h`}
                        </Text>
                    </View>
                    <View style={S.kpiBox}>
                        <Text style={S.kpiLabel}>Hs. Reales</Text>
                        <Text style={[S.kpiValue, { color: totalRealHours > estimatedHours ? '#F43F5E' : '#10B981' }]}>
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
                    <View style={[S.kpiBox, S.kpiBoxAmber]}>
                        <Text style={[S.kpiLabel, { color: '#F59E0B' }]}>Impacto Demoras</Text>
                        <Text style={[S.kpiValue, { color: '#F59E0B' }]}>{delayImpactPct}%</Text>
                    </View>
                    <View style={[S.kpiBox, { backgroundColor: '#ECFDF5', borderColor: '#D1FAE5' }]}>
                        <Text style={[S.kpiLabel, { color: '#10B981' }]}>Avance Técnico</Text>
                        <Text style={[S.kpiValue, { color: '#059669', fontSize: 10 }]}>
                            {project.checklistItems?.filter((i: any) => i.completed && !i.excluded).length || 0} / {project.checklistItems?.filter((i: any) => !i.excluded).length || 0}
                        </Text>
                    </View>
                </View>

                {/* ── Observaciones ── */}
                {hasObs && (
                    <View style={S.obsBox} wrap={false}>
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

                {/* ── Tabla Tiempos Operativos ── */}
                <View style={S.tableWrapper}>
                    <Text style={S.tableTitle}>
                        Desglose de Tiempos Operativos {isFiltered ? `(${project.timeEntries?.length || 0} registros)` : ''}
                    </Text>
                    {(!project.timeEntries || project.timeEntries.length === 0) ? (
                        <Text style={S.emptyText}>Sin registros de tiempo confirmados para este período.</Text>
                    ) : (
                        <>
                            <View style={S.tableHeader}>
                                <Text style={[S.thCell, { flex: 2 }]}>FECHA</Text>
                                <Text style={[S.thCell, { flex: 3.5 }]}>OPERADOR</Text>
                                <Text style={[S.thCell, { flex: 2 }]}>HORARIO</Text>
                                <Text style={[S.thCell, { flex: 1.5, textAlign: 'right' }]}>HS</Text>
                            </View>
                            {project.timeEntries.map((e: any) => {
                                const hs = e.isExtra ? e.horasTrabajadas * 2 : e.horasTrabajadas;
                                return (
                                    <View key={e.id} style={S.tableRow} wrap={false}>
                                        <Text style={[S.tdCell, { flex: 2 }]}>{formatDate(e.fecha)}</Text>
                                        <Text style={[S.tdCell, { flex: 3.5 }]}>
                                            {e.operator?.nombreCompleto || 'Desconocido'} {e.isExtra ? '(Extra)' : ''}
                                        </Text>
                                        <Text style={[S.tdCell, S.tdBold, { flex: 2 }]}>{e.horaIngreso} — {e.horaEgreso}</Text>
                                        <Text style={[S.tdCell, S.tdBold, { flex: 1.5, textAlign: 'right' }]}>{hs.toFixed(1)}h</Text>
                                    </View>
                                );
                            })}
                        </>
                    )}
                </View>

                {/* ── Tabla Demoras Detallada ── */}
                {clientDelays.length > 0 && (
                    <View style={S.tableWrapper}>
                        <Text style={S.tableTitle}>Detalle de Demoras Externas</Text>
                        <View style={S.tableHeader}>
                            <Text style={[S.thCell, { flex: 1.5 }]}>FECHA</Text>
                            <Text style={[S.thCell, { flex: 2 }]}>ÁREA</Text>
                            <Text style={[S.thCell, { flex: 2 }]}>RESP. ÁREA</Text>
                            <Text style={[S.thCell, { flex: 3.5 }]}>MOTIVO</Text>
                            <Text style={[S.thCell, { flex: 1, textAlign: 'right' }]}>HS</Text>
                        </View>
                        {clientDelays.map((d: any) => (
                            <View key={d.id} style={S.tableRow} wrap={false}>
                                <Text style={[S.tdCell, { flex: 1.5 }]}>{formatDate(d.fecha)}</Text>
                                <Text style={[S.tdCell, { flex: 2, color: '#D97706' }]}>{d.area}</Text>
                                <Text style={[S.tdCell, { flex: 2 }]}>{d.responsableArea || '—'}</Text>
                                <Text style={[S.tdCell, { flex: 3.5 }]}>
                                    &quot;{d.motivo}&quot;
                                </Text>
                                <Text style={[S.tdCell, S.tdBold, { flex: 1, textAlign: 'right', color: '#D97706' }]}>
                                    {d.duracion}h
                                </Text>
                            </View>
                        ))}
                        {/* Total row */}
                        <View style={S.totalRow}>
                            <Text style={[S.tdCell, { flex: 9, textAlign: 'right', color: '#94A3B8', fontSize: 7 }]}>
                                TOTAL DEMORAS
                            </Text>
                            <Text style={[S.tdCell, S.tdBold, { flex: 1, textAlign: 'right', color: '#D97706' }]}>
                                {totalDelaysHours}h
                            </Text>
                        </View>
                    </View>
                )}

                {/* ── Checklist Técnico ── */}
                <View style={S.tableWrapper}>
                    <Text style={S.tableTitle}>Avance Técnico (Checklist)</Text>
                    {(!project.checklistItems || project.checklistItems.filter((i: any) => !i.excluded).length === 0) ? (
                        <Text style={S.emptyText}>Sin tareas documentadas en el checklist.</Text>
                    ) : (
                        <View style={S.checklistGrid}>
                            {project.checklistItems.filter((item: any) => !item.excluded).map((item: any) => (
                                <View key={item.id} style={[S.checklistItem, item.completed && S.checklistItemDone]} wrap={false}>
                                    <View style={[S.checkIcon, item.completed && S.checkIconDone]}>
                                        {item.completed ? (
                                            <Svg width={7} height={7} viewBox="0 0 24 24">
                                                <Polyline points="20 6 9 17 4 12" stroke="#FFFFFF" strokeWidth={3.5} fill="none" />
                                            </Svg>
                                        ) : null}
                                    </View>
                                    <View style={S.checkText}>
                                        <Text style={[S.checkDesc, item.completed && S.checkDescDone]}>
                                            {item.description}
                                        </Text>
                                        <View style={S.checkTagRow}>
                                            <Text style={S.checkTag}>{item.tag}</Text>
                                            <Text style={[S.checkStatus, { color: item.completed ? '#10B981' : '#CBD5E1' }]}>
                                                {item.completed ? 'COMPLETADO' : 'PENDIENTE'}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
                </View>

                {/* ── Footer ── */}
                <Text style={S.footer}>
                    Informe Oficial · Generado por HDB SGI para HDB Servicios Eléctricos el {formatDate(new Date())}
                </Text>
            </Page>
        </Document>
    );
};
