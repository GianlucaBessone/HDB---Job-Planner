'use client';

import { useState, useEffect } from 'react';
import { ShieldCheck, Calendar, Clock, User, Building2, Package, MapPin, Hash, CheckCircle2 } from 'lucide-react';

export default function PublicInformePage({ params }: { params: { signatureId: string } }) {
    const [report, setReport] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`/api/public/informe/${params.signatureId}`)
            .then(res => res.json())
            .then(data => {
                if (!data.error) setReport(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [params.signatureId]);

    if (loading) return <div className="min-h-screen flex items-center justify-center p-4"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
    if (!report) return <div className="min-h-screen flex items-center justify-center p-4 text-center text-slate-500">Documento no encontrado o no válido.</div>;

    const prCode = report.project?.codigoProyecto;

    const formatDate = (d: string | Date) => new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const formatDateTime = (d: string | Date) => new Date(d).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 font-sans">
            <div className="max-w-3xl mx-auto space-y-6">
                
                {/* Header */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 dark:border-slate-800">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-6 mb-6">
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 dark:text-white">
                                {report.template?.name || 'Informe Técnico'}
                            </h1>
                            <p className="text-slate-500 mt-1 font-medium">Nº {report.reportNumber}</p>
                        </div>
                        <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 px-3 py-1.5 rounded-xl text-sm font-bold">
                            <ShieldCheck className="w-4 h-4" />
                            Copia Digital Auténtica
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                        {report.project && (
                            <div className="space-y-1">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Building2 className="w-3 h-3" /> Proyecto</label>
                                <p className="font-semibold text-slate-700 dark:text-slate-300">{prCode ? `${prCode} | ` : ''}{report.project.nombre}</p>
                            </div>
                        )}
                        {report.client && (
                            <div className="space-y-1">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><User className="w-3 h-3" /> Cliente</label>
                                <p className="font-semibold text-slate-700 dark:text-slate-300">{report.client.nombre}</p>
                            </div>
                        )}
                        <div className="space-y-1">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Fecha Emisión</label>
                            <p className="font-semibold text-slate-700 dark:text-slate-300">{formatDate(report.createdAt)}</p>
                        </div>
                        {report.planta && (
                            <div className="space-y-1">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><MapPin className="w-3 h-3" /> Planta</label>
                                <p className="font-semibold text-slate-700 dark:text-slate-300">{report.planta}</p>
                            </div>
                        )}
                        {report.sector && (
                            <div className="space-y-1">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><MapPin className="w-3 h-3" /> Sector</label>
                                <p className="font-semibold text-slate-700 dark:text-slate-300">{report.sector}</p>
                            </div>
                        )}
                        {report.equipo && (
                            <div className="space-y-1">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Package className="w-3 h-3" /> Equipo/Activo</label>
                                <p className="font-semibold text-slate-700 dark:text-slate-300">{report.equipo}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Secciones */}
                {report.template?.schema?.sections?.map((section: any, idx: number) => (
                    <div key={idx} className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 dark:border-slate-800">
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-3 mb-5">
                            {section.title}
                        </h3>
                        <div className="grid grid-cols-1 gap-6">
                            {section.fields?.map((field: any, fIdx: number) => {
                                const val = report.data?.[field.id];
                                
                                if (field.type === 'table') {
                                    const rows = Array.isArray(val) ? val : [];
                                    if (rows.length === 0) return null;
                                    return (
                                        <div key={fIdx} className="overflow-x-auto">
                                            <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">{field.label}</p>
                                            <table className="w-full text-sm text-left">
                                                <thead className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/50 uppercase font-black">
                                                    <tr>
                                                        {field.columns.map((c: any, cIdx: number) => (
                                                            <th key={cIdx} className="px-4 py-3 rounded-t-lg">{c.label}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {rows.map((row: any, rIdx: number) => (
                                                        <tr key={rIdx} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                                                            {field.columns.map((c: any, cIdx: number) => (
                                                                <td key={cIdx} className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">
                                                                    {row[c.id] || '-'}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    );
                                }
                                
                                return (
                                    <div key={fIdx}>
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-1.5">{field.label}</label>
                                        {field.type === 'textarea' ? (
                                            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-medium">
                                                {val || '-'}
                                            </div>
                                        ) : (
                                            <p className="text-slate-700 dark:text-slate-300 font-semibold">{val || '-'}</p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}

                {/* Verificación de Firma */}
                {report.signature && (
                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-900/20 rounded-3xl p-6 md:p-8 border border-emerald-200 dark:border-emerald-800/50 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                            <ShieldCheck className="w-40 h-40" />
                        </div>
                        
                        <div className="relative z-10 space-y-6">
                            <div className="flex items-center gap-3">
                                <div className="bg-emerald-500 text-white p-2 rounded-xl shadow-lg shadow-emerald-500/20">
                                    <CheckCircle2 className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-emerald-900 dark:text-emerald-100">Firma Digital Verificada</h3>
                                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">La integridad de este documento está garantizada criptográficamente.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white/60 dark:bg-slate-900/60 p-5 rounded-2xl backdrop-blur-sm">
                                <div className="space-y-1">
                                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Firmante</p>
                                    <p className="font-bold text-slate-800 dark:text-slate-200">{report.signature.UserName}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Fecha y Hora (UTC)</p>
                                    <p className="font-bold text-slate-800 dark:text-slate-200">{formatDateTime(report.signature.SignedAtUTC)}</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <p className="text-xs font-black text-emerald-700 dark:text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                                    <Hash className="w-3.5 h-3.5" /> Identidad Digital (Hash de Verificación)
                                </p>
                                <div className="bg-emerald-900 text-emerald-50 font-mono text-xs md:text-sm p-4 rounded-xl break-all shadow-inner">
                                    {report.signature.HashSignature}
                                </div>
                                <p className="text-[10px] md:text-xs text-emerald-600 dark:text-emerald-500 font-semibold mt-2">
                                    ID de Firma: {report.signature.SignatureID}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
