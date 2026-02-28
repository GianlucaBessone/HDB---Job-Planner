'use client';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Register fonts if needed, otherwise use defaults
// Font.register({ family: 'Inter', src: '...' });

const styles = StyleSheet.create({
    page: {
        padding: 40,
        backgroundColor: '#FFFFFF',
        fontFamily: 'Helvetica',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderBottomWidth: 2,
        borderBottomColor: '#0F172A',
        paddingBottom: 20,
        marginBottom: 30,
    },
    title: {
        fontSize: 24,
        fontWeight: 'extrabold',
        color: '#0F172A',
    },
    status: {
        fontSize: 10,
        color: '#94A3B8',
        marginTop: 4,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    projectInfo: {
        textAlign: 'right',
    },
    projectName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#4F46E5',
    },
    clientName: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 4,
    },
    metricsGrid: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 30,
    },
    metricBox: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        padding: 15,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        alignItems: 'center',
    },
    metricBoxIndigo: {
        backgroundColor: '#EEF2FF',
        borderColor: '#E0E7FF',
    },
    metricLabel: {
        fontSize: 8,
        color: '#94A3B8',
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    metricLabelIndigo: {
        color: '#818CF8',
    },
    metricValue: {
        fontSize: 16,
        fontWeight: 'black',
        color: '#1E293B',
    },
    metricValueIndigo: {
        color: '#4F46E5',
    },
    contentRow: {
        flexDirection: 'row',
        gap: 30,
        marginBottom: 30,
    },
    column: {
        flex: 1,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 10,
        paddingBottom: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
        fontSize: 10,
        color: '#475569',
    },
    progressBarContainer: {
        height: 4,
        backgroundColor: '#F1F5F9',
        borderRadius: 2,
        marginTop: 2,
        marginBottom: 8,
    },
    progressBarEffect: {
        height: '100%',
        backgroundColor: '#6366F1',
        borderRadius: 2,
    },
    table: {
        marginTop: 20,
    },
    tableHeader: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        paddingBottom: 4,
        marginBottom: 8,
    },
    tableHeaderColumn: {
        fontSize: 8,
        color: '#94A3B8',
        textTransform: 'uppercase',
        fontWeight: 'bold',
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC',
        paddingVertical: 6,
    },
    tableCell: {
        fontSize: 9,
        color: '#475569',
    },
    footer: {
        position: 'absolute',
        bottom: 30,
        left: 0,
        right: 0,
        textAlign: 'center',
        fontSize: 8,
        color: '#94A3B8',
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        paddingTop: 10,
    }
});

interface PDFProps {
    project: any;
    totalRealHours: number;
    savedHours: number;
    IPT: string;
    operatorMap: any[];
    delaysByArea: any[];
}

export const ProjectReportPDF = ({ project, totalRealHours, savedHours, IPT, operatorMap, delaysByArea }: PDFProps) => (
    <Document>
        <Page size="A4" style={styles.page}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>Reporte de Proyecto</Text>
                    <Text style={styles.status}>PROYECTO FINALIZADO</Text>
                </View>
                <View style={styles.projectInfo}>
                    <Text style={styles.projectName}>{project.nombre}</Text>
                    <Text style={styles.clientName}>{project.client?.nombre || project.cliente || 'Sin Cliente'}</Text>
                </View>
            </View>

            {/* Metrics */}
            <View style={styles.metricsGrid}>
                <View style={styles.metricBox}>
                    <Text style={styles.metricLabel}>Horas Estimadas</Text>
                    <Text style={styles.metricValue}>{project.horasEstimadas}h</Text>
                </View>
                <View style={styles.metricBox}>
                    <Text style={styles.metricLabel}>Horas Reales</Text>
                    <Text style={[styles.metricValue, { color: totalRealHours > project.horasEstimadas ? '#F43F5E' : '#10B981' }]}>
                        {totalRealHours.toFixed(1)}h
                    </Text>
                </View>
                <View style={styles.metricBox}>
                    <Text style={styles.metricLabel}>Ahorro / Desvío</Text>
                    <Text style={[styles.metricValue, { color: savedHours >= 0 ? '#10B981' : '#F43F5E' }]}>
                        {savedHours > 0 ? '+' : ''}{savedHours.toFixed(1)}h
                    </Text>
                </View>
                <View style={[styles.metricBox, styles.metricBoxIndigo]}>
                    <Text style={[styles.metricLabel, styles.metricLabelIndigo]}>Eficiencia (IPT)</Text>
                    <Text style={[styles.metricValue, styles.metricValueIndigo]}>{IPT}</Text>
                </View>
            </View>

            {/* Summary Content */}
            <View style={styles.contentRow}>
                {/* Operators */}
                <View style={styles.column}>
                    <Text style={styles.sectionTitle}>Resumen por Operador</Text>
                    {operatorMap.map((op, idx) => {
                        const percentage = totalRealHours > 0 ? (Math.min(op.horas / totalRealHours, 1)) * 100 : 0;
                        return (
                            <View key={idx}>
                                <View style={styles.row}>
                                    <Text>{op.nombre}</Text>
                                    <Text>{op.horas.toFixed(1)}h</Text>
                                </View>
                                <View style={styles.progressBarContainer}>
                                    <View style={[styles.progressBarEffect, { width: `${percentage}%` }]} />
                                </View>
                            </View>
                        );
                    })}
                </View>

                {/* Delays */}
                <View style={styles.column}>
                    <Text style={styles.sectionTitle}>Demoras del Cliente</Text>
                    {delaysByArea.map((d, idx) => {
                        const totalDelays = delaysByArea.reduce((acc, curr) => acc + curr.horas, 0);
                        const percentage = totalDelays > 0 ? (d.horas / totalDelays) * 100 : 0;
                        return (
                            <View key={idx}>
                                <View style={styles.row}>
                                    <Text>{d.area}</Text>
                                    <Text style={{ color: '#F59E0B' }}>{d.horas.toFixed(1)}h</Text>
                                </View>
                                <View style={styles.progressBarContainer}>
                                    <View style={[styles.progressBarEffect, { backgroundColor: '#FBBF24', width: `${percentage}%` }]} />
                                </View>
                            </View>
                        );
                    })}
                </View>
            </View>

            {/* Breakdown Table */}
            <View style={styles.table}>
                <Text style={styles.sectionTitle}>Desglose de Tiempos Operativos</Text>
                <View style={styles.tableHeader}>
                    <Text style={[styles.tableHeaderColumn, { flex: 2 }]}>Fecha</Text>
                    <Text style={[styles.tableHeaderColumn, { flex: 3 }]}>Operador</Text>
                    <Text style={[styles.tableHeaderColumn, { flex: 2 }]}>Horario</Text>
                    <Text style={[styles.tableHeaderColumn, { flex: 1, textAlign: 'right' }]}>Horas</Text>
                </View>
                {project.timeEntries.map((e: any) => (
                    <View key={e.id} style={styles.tableRow}>
                        <Text style={[styles.tableCell, { flex: 2 }]}>{e.fecha}</Text>
                        <Text style={[styles.tableCell, { flex: 3 }]}>{e.operator.nombreCompleto}</Text>
                        <Text style={[styles.tableCell, { flex: 2 }]}>{e.horaIngreso} - {e.horaEgreso}</Text>
                        <Text style={[styles.tableCell, { flex: 1, textAlign: 'right', fontWeight: 'bold' }]}>{e.horasTrabajadas}h</Text>
                    </View>
                ))}
            </View>

            {/* Footer */}
            <Text style={styles.footer}>
                Reporte Oficial | Generado automáticamente por HDB Job Planner el {new Date().toLocaleDateString('es-AR')}
            </Text>
        </Page>
    </Document>
);
