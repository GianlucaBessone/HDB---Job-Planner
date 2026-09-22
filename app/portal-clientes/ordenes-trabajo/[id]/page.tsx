'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  FileText,
  ArrowLeft,
  Building2,
  FolderGit2,
  User,
  MapPin,
  Tag,
  Clock,
  DollarSign,
  Package,
  CheckCircle2,
  AlertCircle,
  Lock,
  Download,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  MessageSquare,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { formatDate, formatDateTime } from '@/lib/formatDate';
import { showToast } from '@/components/Toast';
import { OTPdfDocument } from '@/components/ot/OTPdfDocument';

const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then((mod) => mod.PDFDownloadLink),
  { ssr: false, loading: () => <span className="text-xs text-slate-400">Preparando PDF...</span> }
);

export default function PortalDetalleOtPage() {
  const params = useParams();
  const id = params.id as string;

  const [ot, setOt] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [integrityModal, setIntegrityModal] = useState<any | null>(null);
  const [checkingIntegrity, setCheckingIntegrity] = useState(false);

  useEffect(() => {
    if (id) loadOtDetail();
  }, [id]);

  const loadOtDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/portal-clientes/ordenes-trabajo/${id}`);
      if (res.ok) {
        const data = await res.json();
        setOt(data);
      } else {
        showToast('Orden de trabajo no encontrada o no autorizada', 'error');
      }
    } catch {
      showToast('Error al cargar la orden de trabajo', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyIntegrity = async (cicloId: string) => {
    setCheckingIntegrity(true);
    try {
      const res = await fetch(`/api/portal-clientes/verificar-integridad/${cicloId}`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setIntegrityModal(data);
      } else {
        const data = await res.json();
        showToast(data.error || 'Error al verificar integridad', 'error');
      }
    } catch {
      showToast('Error de conexión', 'error');
    } finally {
      setCheckingIntegrity(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-xs font-bold">Cargando orden de trabajo...</p>
      </div>
    );
  }

  if (!ot) return null;

  return (
    <div className="space-y-6">
      {/* Top back */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <Link
          href="/portal-clientes/ordenes-trabajo"
          className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al Listado
        </Link>

        <PDFDownloadLink
          document={<OTPdfDocument ot={ot} />}
          fileName={`${ot.numeroOT}_${ot.cliente?.nombre?.replace(/\s+/g, '_')}.pdf`}
          className="px-3.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 shadow-sm transition-colors"
        >
          <Download className="w-3.5 h-3.5 text-primary" />
          Descargar Informe PDF
        </PDFDownloadLink>
      </div>

      {/* Hero card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 font-mono">
                {ot.numeroOT}
              </h1>

              {ot.refCliente && (
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono">
                  Ref. Cliente: {ot.refCliente}
                </span>
              )}

              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                  ot.estado === 'ABIERTA'
                    ? 'bg-blue-500/10 text-blue-600'
                    : ot.estado === 'PAUSADA'
                    ? 'bg-amber-500/10 text-amber-600'
                    : ot.estado === 'PENDIENTE_FIRMA'
                    ? 'bg-purple-500/10 text-purple-600'
                    : 'bg-emerald-500/10 text-emerald-600'
                }`}
              >
                {ot.estado}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {ot.proyecto?.nombre} {ot.sector ? `· Sector: ${ot.sector}` : ''}
            </p>
          </div>
        </div>

        {/* Metadatos */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Responsable</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{ot.responsable?.nombreCompleto}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Fecha Creación</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{formatDate(ot.createdAt)}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Sector</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{ot.sector || 'Sin sector'}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Ciclos Totales</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{ot.ciclos.length}</span>
          </div>
        </div>
      </div>

      {/* Reporte de Trabajo */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-2">
        <h3 className="text-xs font-black uppercase text-slate-500 tracking-wider">Reporte Técnico de Trabajo</h3>
        <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
          {ot.reporteTrabajo}
        </p>
      </div>

      {/* Ciclos */}
      <div className="space-y-6">
        <h2 className="text-base font-black text-slate-900 dark:text-slate-100">
          Períodos y Ciclos de Facturación
        </h2>

        {ot.ciclos.map((ciclo: any) => {
          const isSigned = ciclo.estado === 'FIRMADO';

          return (
            <div
              key={ciclo.id}
              className={`rounded-2xl border p-5 sm:p-6 space-y-5 ${
                isSigned
                  ? 'bg-slate-100/60 dark:bg-slate-900/40 border-slate-300 dark:border-slate-800'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                      Ciclo {ciclo.numeroCiclo} ({ciclo.periodo})
                    </h3>
                    {isSigned ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        FIRMADO DIGITALMENTE
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                        ABIERTO
                      </span>
                    )}
                  </div>
                  {isSigned && (
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Firmado por <strong>{ciclo.firmanteNombre}</strong> el {formatDateTime(ciclo.fechaFirma)} · Cierre {ciclo.tipoCierre}
                    </p>
                  )}
                </div>

                {isSigned && ciclo.hashIntegridad && (
                  <button
                    onClick={() => handleVerifyIntegrity(ciclo.id)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm self-start sm:self-auto"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Verificar Integridad
                  </button>
                )}
              </div>

              {/* Técnicos */}
              {ciclo.operadores?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">Técnicos y Mano de Obra</h4>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                          <th className="py-2 px-4 font-bold text-slate-600 dark:text-slate-300">Técnico</th>
                          <th className="py-2 px-4 font-bold text-slate-600 dark:text-slate-300 text-right">Horas</th>
                          <th className="py-2 px-4 font-bold text-slate-600 dark:text-slate-300 text-right">Valor Hora</th>
                          <th className="py-2 px-4 font-bold text-slate-600 dark:text-slate-300 text-right">Mano de Obra</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {ciclo.operadores.map((op: any) => (
                          <tr key={op.id}>
                            <td className="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                              {op.operador?.nombreCompleto}
                            </td>
                            <td className="py-2.5 px-4 text-right font-semibold">{op.horas.toFixed(2)} h</td>
                            <td className="py-2.5 px-4 text-right text-slate-500 font-mono">
                              ${op.valorHoraSnapshot.toLocaleString('es-AR')}
                            </td>
                            <td className="py-2.5 px-4 text-right font-black text-slate-900 dark:text-slate-100 font-mono">
                              ${op.costoManoObra.toLocaleString('es-AR')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Materiales */}
              {ciclo.materiales?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">Materiales Utilizados</h4>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                          <th className="py-2 px-4 font-bold text-slate-600 dark:text-slate-300">Código</th>
                          <th className="py-2 px-4 font-bold text-slate-600 dark:text-slate-300">Material</th>
                          <th className="py-2 px-4 font-bold text-slate-600 dark:text-slate-300 text-right">Cant.</th>
                          <th className="py-2 px-4 font-bold text-slate-600 dark:text-slate-300 text-right">Mts.</th>
                          <th className="py-2 px-4 font-bold text-slate-600 dark:text-slate-300 text-right">Precio</th>
                          <th className="py-2 px-4 font-bold text-slate-600 dark:text-slate-300 text-right">Importe</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {ciclo.materiales.map((m: any) => (
                          <tr key={m.id}>
                            <td className="py-2.5 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                              {m.materialCodigo} {m.materialSource === 'MANUAL' ? '(Manual)' : ''}
                            </td>
                            <td className="py-2.5 px-4 text-slate-800 dark:text-slate-200">{m.descripcion}</td>
                            <td className="py-2.5 px-4 text-right font-semibold">{m.cantidad}</td>
                            <td className="py-2.5 px-4 text-right text-slate-500">{m.metros ? `${m.metros}m` : '-'}</td>
                            <td className="py-2.5 px-4 text-right font-mono text-slate-500">
                              ${m.precioFinalSnapshot.toLocaleString('es-AR')}
                            </td>
                            <td className="py-2.5 px-4 text-right font-black text-slate-900 dark:text-slate-100 font-mono">
                              ${m.importeTotal.toLocaleString('es-AR')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Totales */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <div className="flex items-center gap-6 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Horas</span>
                    <strong className="text-slate-700 dark:text-slate-300">{ciclo.totalHoras.toFixed(2)} h</strong>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Mano de Obra</span>
                    <strong className="text-slate-700 dark:text-slate-300">${ciclo.totalManoObra.toLocaleString('es-AR')}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Materiales</span>
                    <strong className="text-slate-700 dark:text-slate-300">${ciclo.totalMateriales.toLocaleString('es-AR')}</strong>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-primary block">Total Ciclo</span>
                  <span className="text-sm font-black text-primary font-mono">
                    ${ciclo.totalGeneral.toLocaleString('es-AR')}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Integrity Verification Modal */}
      {integrityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              {integrityModal.valido ? (
                <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-xl">
                  <ShieldCheck className="w-6 h-6" />
                </div>
              ) : (
                <div className="p-2 bg-rose-500/10 text-rose-600 rounded-xl">
                  <ShieldAlert className="w-6 h-6" />
                </div>
              )}
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                  {integrityModal.valido ? 'INTEGRIDAD VERIFICADA' : 'ADVERTENCIA'}
                </h3>
                <p className="text-xs text-slate-500">
                  {integrityModal.valido
                    ? 'La información coincide exactamente con el registro firmado.'
                    : 'La información actual no coincide con el contenido firmado.'}
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-1 text-xs font-mono break-all">
              <div className="text-[11px] text-slate-500">
                Firmado por: <strong>{integrityModal.firmanteNombre}</strong> ({formatDateTime(integrityModal.fechaFirma)})
              </div>
              <div>
                <strong>Hash Almacenado:</strong> {integrityModal.hashAlmacenado}
              </div>
              <div>
                <strong>Hash Calculado:</strong> {integrityModal.hashCalculado}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIntegrityModal(null)}
                className="px-5 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold rounded-xl"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
