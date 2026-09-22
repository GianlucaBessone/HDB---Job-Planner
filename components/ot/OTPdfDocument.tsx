import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { formatDate, formatDateTime } from '@/lib/formatDate';

const styles = StyleSheet.create({
  page: {
    padding: '18mm',
    backgroundColor: '#FFFFFF',
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#1e293b',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 2,
    borderBottomColor: '#059669',
    paddingBottom: 12,
    marginBottom: 14,
  },
  brandTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    letterSpacing: 0.5,
  },
  brandSub: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#059669',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  docTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#1e293b',
    textAlign: 'right',
  },
  otCode: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#059669',
    textAlign: 'right',
    marginTop: 2,
  },
  refCliente: {
    fontSize: 8,
    color: '#64748b',
    textAlign: 'right',
    marginTop: 1,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 3,
    marginBottom: 8,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  metaItem: {
    width: '48%',
    marginBottom: 4,
  },
  metaLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    marginTop: 1,
  },
  reportBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    padding: 10,
  },
  reportText: {
    fontSize: 8.5,
    lineHeight: 1.5,
    color: '#334155',
  },
  // Tables
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1.5,
    borderBottomColor: '#cbd5e1',
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  th: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: '#475569',
    textTransform: 'uppercase',
  },
  td: {
    fontSize: 8,
    color: '#334155',
  },
  tdRight: {
    textAlign: 'right',
  },
  totalBox: {
    marginTop: 8,
    padding: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalItem: {
    textAlign: 'center',
  },
  totalLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  totalValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    marginTop: 2,
  },
  // Firma & Integridad
  signatureBox: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 6,
    padding: 10,
    marginTop: 10,
  },
  sigTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#166534',
    marginBottom: 4,
  },
  sigText: {
    fontSize: 8,
    color: '#15803d',
    lineHeight: 1.4,
  },
  hashCode: {
    fontSize: 7,
    fontFamily: 'Courier',
    color: '#0f172a',
    backgroundColor: '#dcfce7',
    padding: 4,
    borderRadius: 4,
    marginTop: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 15,
    left: '18mm',
    right: '18mm',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#94a3b8',
  },
});

export interface OTPdfDocumentProps {
  ot: {
    numeroOT: string;
    refCliente?: string | null;
    estado: string;
    sector?: string | null;
    reporteTrabajo: string;
    createdAt: string | Date;
    cliente: { nombre: string; direccion?: string | null; telefono?: string | null };
    proyecto: { nombre: string; codigoProyecto?: string | null };
    responsable: { nombreCompleto: string };
    ciclos: {
      numeroCiclo: number;
      periodo: string;
      estado: string;
      totalHoras: number;
      totalManoObra: number;
      totalMateriales: number;
      totalGeneral: number;
      fechaFirma?: string | Date | null;
      firmanteNombre?: string | null;
      tipoCierre?: string | null;
      hashIntegridad?: string | null;
      operadores: {
        operador: { nombreCompleto: string };
        horas: number;
        valorHoraSnapshot: number;
        costoManoObra: number;
      }[];
      materiales: {
        materialCodigo: string;
        descripcion: string;
        cantidad: number;
        metros?: number | null;
        precioFinalSnapshot: number;
        importeTotal: number;
        materialSource: string;
      }[];
    }[];
  };
}

export function OTPdfDocument({ ot }: OTPdfDocumentProps) {
  const latestCycle = ot.ciclos[ot.ciclos.length - 1] || ot.ciclos[0];
  const allOperators = ot.ciclos.flatMap((c) => c.operadores);
  const allMaterials = ot.ciclos.flatMap((c) => c.materiales);

  const grandTotalHoras = ot.ciclos.reduce((s, c) => s + c.totalHoras, 0);
  const grandTotalMO = ot.ciclos.reduce((s, c) => s + c.totalManoObra, 0);
  const grandTotalMat = ot.ciclos.reduce((s, c) => s + c.totalMateriales, 0);
  const grandTotal = ot.ciclos.reduce((s, c) => s + c.totalGeneral, 0);

  const signedCycles = ot.ciclos.filter((c) => c.estado === 'FIRMADO' && c.hashIntegridad);

  return (
    <Document title={`OT_${ot.numeroOT}`} author="HDB Servicios Eléctricos">
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brandTitle}>HDB</Text>
            <Text style={styles.brandSub}>Servicios Eléctricos · SGI</Text>
          </View>
          <View>
            <Text style={styles.docTitle}>ORDEN DE TRABAJO</Text>
            <Text style={styles.otCode}>{ot.numeroOT}</Text>
            {ot.refCliente && <Text style={styles.refCliente}>Ref. Cliente: {ot.refCliente}</Text>}
          </View>
        </View>

        {/* Metadatos */}
        <View style={styles.section}>
          <View style={styles.metaGrid}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Cliente</Text>
              <Text style={styles.metaValue}>{ot.cliente.nombre}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Proyecto</Text>
              <Text style={styles.metaValue}>
                {ot.proyecto.nombre} {ot.proyecto.codigoProyecto ? `(${ot.proyecto.codigoProyecto})` : ''}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Sector / Planta</Text>
              <Text style={styles.metaValue}>{ot.sector || 'No especificado'}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Responsable</Text>
              <Text style={styles.metaValue}>{ot.responsable.nombreCompleto}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Fecha Creación</Text>
              <Text style={styles.metaValue}>{formatDate(ot.createdAt)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Estado OT</Text>
              <Text style={styles.metaValue}>{ot.estado}</Text>
            </View>
          </View>
        </View>

        {/* Reporte de Trabajo */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reporte de Trabajo</Text>
          <View style={styles.reportBox}>
            <Text style={styles.reportText}>{ot.reporteTrabajo}</Text>
          </View>
        </View>

        {/* Técnicos y Mano de Obra */}
        {allOperators.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Técnicos y Mano de Obra</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { width: '45%' }]}>Técnico</Text>
              <Text style={[styles.th, styles.tdRight, { width: '15%' }]}>Horas</Text>
              <Text style={[styles.th, styles.tdRight, { width: '20%' }]}>Valor Hora</Text>
              <Text style={[styles.th, styles.tdRight, { width: '20%' }]}>Subtotal</Text>
            </View>
            {allOperators.map((op, idx) => (
              <View key={idx} style={styles.tableRow}>
                <Text style={[styles.td, { width: '45%' }]}>{op.operador.nombreCompleto}</Text>
                <Text style={[styles.td, styles.tdRight, { width: '15%' }]}>{op.horas.toFixed(2)} h</Text>
                <Text style={[styles.td, styles.tdRight, { width: '20%' }]}>
                  ${op.valorHoraSnapshot.toLocaleString('es-AR')}
                </Text>
                <Text style={[styles.td, styles.tdRight, { width: '20%', fontFamily: 'Helvetica-Bold' }]}>
                  ${op.costoManoObra.toLocaleString('es-AR')}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Materiales Utilizados */}
        {allMaterials.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Materiales Utilizados</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { width: '15%' }]}>Código</Text>
              <Text style={[styles.th, { width: '40%' }]}>Material</Text>
              <Text style={[styles.th, styles.tdRight, { width: '12%' }]}>Cant.</Text>
              <Text style={[styles.th, styles.tdRight, { width: '15%' }]}>Precio Unit.</Text>
              <Text style={[styles.th, styles.tdRight, { width: '18%' }]}>Subtotal</Text>
            </View>
            {allMaterials.map((mat, idx) => (
              <View key={idx} style={styles.tableRow}>
                <Text style={[styles.td, { width: '15%' }]}>
                  {mat.materialCodigo} {mat.materialSource === 'MANUAL' ? '(M)' : ''}
                </Text>
                <Text style={[styles.td, { width: '40%' }]}>{mat.descripcion}</Text>
                <Text style={[styles.td, styles.tdRight, { width: '12%' }]}>
                  {mat.cantidad} {mat.metros ? `(${mat.metros}m)` : ''}
                </Text>
                <Text style={[styles.td, styles.tdRight, { width: '15%' }]}>
                  ${mat.precioFinalSnapshot.toLocaleString('es-AR')}
                </Text>
                <Text style={[styles.td, styles.tdRight, { width: '18%', fontFamily: 'Helvetica-Bold' }]}>
                  ${mat.importeTotal.toLocaleString('es-AR')}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Resumen de Totales */}
        <View style={styles.totalBox}>
          <View style={styles.totalItem}>
            <Text style={styles.totalLabel}>Horas Totales</Text>
            <Text style={styles.totalValue}>{grandTotalHoras.toFixed(2)} h</Text>
          </View>
          <View style={styles.totalItem}>
            <Text style={styles.totalLabel}>Mano de Obra</Text>
            <Text style={styles.totalValue}>${grandTotalMO.toLocaleString('es-AR')}</Text>
          </View>
          <View style={styles.totalItem}>
            <Text style={styles.totalLabel}>Materiales</Text>
            <Text style={styles.totalValue}>${grandTotalMat.toLocaleString('es-AR')}</Text>
          </View>
          <View style={styles.totalItem}>
            <Text style={styles.totalLabel}>Costo Total</Text>
            <Text style={[styles.totalValue, { color: '#059669', fontSize: 11 }]}>
              ${grandTotal.toLocaleString('es-AR')}
            </Text>
          </View>
        </View>

        {/* Firma e Integridad Documental */}
        {signedCycles.length > 0 && (
          <View style={styles.section}>
            {signedCycles.map((sc, i) => (
              <View key={i} style={styles.signatureBox}>
                <Text style={styles.sigTitle}>
                  DOCUMENTO FIRMADO Y SELLADO CRIPTOGRÁFICAMENTE (Ciclo {sc.numeroCiclo} - Cierre {sc.tipoCierre})
                </Text>
                <Text style={styles.sigText}>
                  Firmado por: {sc.firmanteNombre} el {formatDateTime(sc.fechaFirma)}
                </Text>
                <Text style={styles.sigText}>
                  Integridad garantizada mediante algoritmo SHA-256 canónico inalterable:
                </Text>
                <Text style={styles.hashCode}>HASH: {sc.hashIntegridad}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>HDB Servicios Eléctricos · Sistema de Gestión Integral (SGI)</Text>
          <Text>Documento generado el {formatDateTime(new Date())}</Text>
        </View>
      </Page>
    </Document>
  );
}
