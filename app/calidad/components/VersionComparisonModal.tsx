import React, { useState, useEffect } from 'react';
import { X, GitCompare, ChevronRight, FileText, Sparkles, User, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatDateInline } from '@/lib/formatDate';
import { useModalScroll } from '@/lib/useModalScroll';

interface VersionComparisonModalProps {
    currentDoc: any;
    selectedVersion: any;
    onClose: () => void;
}

export default function VersionComparisonModal({ currentDoc, selectedVersion, onClose }: VersionComparisonModalProps) {
    useModalScroll(true);
    const [loading, setLoading] = useState(true);
    const [diffData, setDiffData] = useState<any>(null);

    useEffect(() => {
        // Analizamos las diferencias reales si el snapshot existe, de lo contrario usamos un fallback de "Datos no registrados"
        const timer = setTimeout(() => {
            // Find the correct snapshot for selectedVersion
            let oldSnapshot = selectedVersion.documentSnapshot || {};
            
            // Helpers
            const getStatus = (oldVal: any, newVal: any) => {
                if (oldVal === undefined) return 'unchanged'; // Si no hay snapshot histórico, no podemos decir que cambió
                return oldVal !== newVal ? 'modified' : 'unchanged';
            };

            // 1. General
            const general = {
                titulo: { status: getStatus(oldSnapshot.titulo, currentDoc.titulo), old: oldSnapshot.titulo, new: currentDoc.titulo },
                codigo: { status: getStatus(oldSnapshot.codigoDocumental, currentDoc.codigoDocumental), old: oldSnapshot.codigoDocumental, new: currentDoc.codigoDocumental },
                criticidad: { status: getStatus(oldSnapshot.nivelCriticidad, currentDoc.nivelCriticidad), old: oldSnapshot.nivelCriticidad, new: currentDoc.nivelCriticidad }
            };

            // 2. Contenido / Descripción
            const isDigital = currentDoc.descripcion && currentDoc.descripcion.trim().startsWith('{');
            let currentDigitalData: any = {};
            let oldDigitalData: any = {};
            
            if (isDigital) {
                try { currentDigitalData = JSON.parse(currentDoc.descripcion); } catch (e) {}
                try { 
                    if (oldSnapshot.descripcion && oldSnapshot.descripcion.trim().startsWith('{')) {
                        oldDigitalData = JSON.parse(oldSnapshot.descripcion); 
                    }
                } catch (e) {}
            } else {
                currentDigitalData = { texto: currentDoc.descripcion };
                oldDigitalData = { texto: oldSnapshot.descripcion };
            }

            const contenido = {
                objetivo: { 
                    status: getStatus(oldDigitalData.objetivo, currentDigitalData.objetivo), 
                    old: oldDigitalData.objetivo || 'No registrado',
                    new: currentDigitalData.objetivo || 'Sin especificar' 
                },
                desarrollo: { 
                    status: getStatus(oldDigitalData.desarrollo || oldDigitalData.texto, currentDigitalData.desarrollo || currentDigitalData.texto), 
                    old: oldDigitalData.desarrollo || oldDigitalData.texto || 'No registrado en esta versión.',
                    new: currentDigitalData.desarrollo || currentDigitalData.texto || 'Sin contenido.'
                }
            };

            // 3. LMS
            const formatLms = (req: boolean, val: number) => req ? `Requiere capacitación obligatoria (Vence cada ${val || 12} meses).` : 'Sin requerimiento de capacitación.';
            const oldLmsStr = formatLms(oldSnapshot.requiereCapacitacion, oldSnapshot.validezMeses);
            const newLmsStr = formatLms(currentDoc.requiereCapacitacion, currentDoc.validezMeses);
            const lms = {
                status: oldSnapshot.requiereCapacitacion === undefined ? 'unchanged' : (oldLmsStr !== newLmsStr ? 'modified' : 'unchanged'),
                old: oldSnapshot.requiereCapacitacion === undefined ? 'Datos no registrados' : oldLmsStr,
                new: newLmsStr
            };

            // 4. Referencias (Mockeado o parseado de tags si aplica)
            const oldTags = Array.isArray(oldSnapshot.tags) ? oldSnapshot.tags : [];
            const newTags = Array.isArray(currentDoc.tags) ? currentDoc.tags : [];
            const referencias: any[] = [];
            
            oldTags.forEach((t: string) => {
                if (!newTags.includes(t)) referencias.push({ status: 'deleted', text: t });
            });
            newTags.forEach((t: string) => {
                if (!oldTags.includes(t)) referencias.push({ status: 'added', text: t });
                else referencias.push({ status: 'unchanged', text: t });
            });
            if (referencias.length === 0) {
                referencias.push({ status: 'unchanged', text: 'Sin referencias o etiquetas asociadas.' });
            }

            // 5. Generar IA Resumen Heurístico
            const resumenIA = [];
            if (general.criticidad.status === 'modified') resumenIA.push(`La criticidad fue actualizada a nivel ${general.criticidad.new}.`);
            if (contenido.objetivo.status === 'modified') resumenIA.push(`Se reformuló el objetivo principal del documento.`);
            if (contenido.desarrollo.status === 'modified') resumenIA.push(`Se detectaron modificaciones sustanciales en el desarrollo/texto del contenido.`);
            if (lms.status === 'modified') resumenIA.push(`Se actualizaron los requerimientos de LMS y capacitación.`);
            const addedRefs = referencias.filter(r => r.status === 'added').length;
            if (addedRefs > 0) resumenIA.push(`Se agregaron ${addedRefs} nuevas etiquetas/referencias.`);

            if (resumenIA.length === 0) {
                resumenIA.push(selectedVersion.documentSnapshot ? "No se detectaron cambios estructurales significativos. Es posible que solo se hayan corregido errores ortográficos menores." : "Esta es una versión heredada sin snapshot de datos completo registrado en el sistema. Las diferencias precisas no pueden ser calculadas automáticamente.");
            }

            setDiffData({
                resumenIA,
                general,
                contenido,
                referencias,
                lms,
                hasSnapshot: Object.keys(oldSnapshot).length > 0
            });
            setLoading(false);
        }, 800);

        return () => clearTimeout(timer);
    }, [currentDoc, selectedVersion]);

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 sm:p-6 pt-20 sm:pt-24 animate-in fade-in duration-200">
            <div className="bg-card text-card-foreground rounded-3xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200 dark:border-slate-800">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                            <GitCompare className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                Comparación de Versiones
                            </h2>
                            <div className="flex items-center gap-2 text-sm mt-1">
                                <span className="font-bold text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded">
                                    v{currentDoc.versionMayor}.{currentDoc.versionMenor} (Actual)
                                </span>
                                <span className="text-slate-400 font-medium">vs</span>
                                <span className="font-bold text-slate-500 dark:text-slate-400 bg-muted text-muted-foreground/50 px-2 py-0.5 rounded">
                                    v{selectedVersion.versionLabel} (Seleccionada)
                                </span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-0 bg-background text-foreground relative">
                    {loading ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
                            <p className="text-slate-600 dark:text-slate-400 font-bold animate-pulse">Analizando diferencias reales...</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">Extrayendo snapshots inmutables del documento</p>
                        </div>
                    ) : (
                        <div className="p-6 space-y-6 max-w-5xl mx-auto">
                            
                            {!diffData.hasSnapshot && (
                                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 p-4 rounded-xl flex gap-3 text-amber-800 dark:text-amber-400 text-sm">
                                    <AlertCircle className="w-5 h-5 shrink-0" />
                                    <p>Esta es una versión heredada anterior a la implementación del motor de snapshots completos. No se pueden calcular las diferencias precisas del contenido, pero se conservan los metadatos y la justificación de auditoría.</p>
                                </div>
                            )}

                            {/* Resumen Ejecutivo IA */}
                            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <Sparkles className="w-24 h-24" />
                                </div>
                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                        <h3 className="font-black text-indigo-900 dark:text-indigo-100">Resumen de Cambios (Análisis Automático)</h3>
                                    </div>
                                    <ul className="space-y-2">
                                        {diffData.resumenIA.map((item: string, i: number) => (
                                            <li key={i} className="flex items-start gap-2 text-sm text-indigo-800 dark:text-indigo-200 font-medium">
                                                <ChevronRight className="w-4 h-4 mt-0.5 shrink-0 opacity-50" />
                                                <span>{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            {/* Justificación y Metadata */}
                            <div className="bg-card text-card-foreground p-5 rounded-2xl border border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Datos de la Versión Seleccionada (v{selectedVersion.versionLabel})</h4>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-slate-500 flex items-center gap-2"><Calendar className="w-4 h-4"/> Fecha</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200">{formatDateInline(selectedVersion.createdAt)}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-slate-500 flex items-center gap-2"><User className="w-4 h-4"/> Autor</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200">{selectedVersion.autorNombre || 'N/A'}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-slate-500 flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/> Aprobador</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200">{selectedVersion.aprobadorNombre || 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700 pt-4 md:pt-0 md:pl-6 flex flex-col">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2 shrink-0">Justificación del Cambio</h4>
                                    <div className="bg-background text-foreground/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex-1 overflow-y-auto">
                                        <p className="text-sm text-slate-700 dark:text-slate-300 italic">
                                            "{currentDoc.versions?.find((v:any) => v.versionMayor === currentDoc.versionMayor && v.versionMenor === currentDoc.versionMenor)?.motivoCambio || selectedVersion.motivoCambio || 'Sin justificación registrada.'}"
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Detalle de Cambios Visual */}
                            {diffData.hasSnapshot && (
                                <div className="space-y-4">
                                    <h3 className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 mt-6">
                                        <FileText className="w-5 h-5 text-slate-400" /> Comparación Detallada (Snapshot)
                                    </h3>

                                    {/* Atributos Generales */}
                                    {Object.entries(diffData.general).some(([_, v]: any) => v.status === 'modified') && (
                                    <div className="bg-card text-card-foreground rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                                        <div className="bg-background text-foreground/50 px-4 py-2 border-b border-slate-200 dark:border-slate-700">
                                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Atributos Generales</span>
                                        </div>
                                        <div className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-xs sm:text-sm">
                                            {Object.entries(diffData.general).filter(([_, v]: any) => v.status === 'modified').map(([key, data]: any) => (
                                                <div key={key} className="flex flex-col">
                                                    <div className="px-3 py-1 bg-muted text-muted-foreground/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider">{key}</div>
                                                    <div className="bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-300 p-3 flex gap-4">
                                                        <span className="font-bold select-none opacity-50">-</span>
                                                        <div className="flex-1">{String(data.old)}</div>
                                                    </div>
                                                    <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 p-3 flex gap-4">
                                                        <span className="font-bold select-none opacity-50">+</span>
                                                        <div className="flex-1">{String(data.new)}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    )}

                                    {/* Objetivo */}
                                    {diffData.contenido.objetivo.status === 'modified' && (
                                    <div className="bg-card text-card-foreground rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                                        <div className="bg-background text-foreground/50 px-4 py-2 border-b border-slate-200 dark:border-slate-700">
                                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Objetivo del Documento</span>
                                        </div>
                                        <div className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-xs sm:text-sm">
                                            <div className="bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-300 p-3 flex gap-4 overflow-x-auto whitespace-pre-wrap">
                                                <span className="font-bold select-none opacity-50">-</span>
                                                <div className="flex-1">{diffData.contenido.objetivo.old}</div>
                                            </div>
                                            <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 p-3 flex gap-4 overflow-x-auto whitespace-pre-wrap">
                                                <span className="font-bold select-none opacity-50">+</span>
                                                <div className="flex-1">{diffData.contenido.objetivo.new}</div>
                                            </div>
                                        </div>
                                    </div>
                                    )}

                                    {/* Desarrollo */}
                                    {diffData.contenido.desarrollo.status === 'modified' && (
                                    <div className="bg-card text-card-foreground rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                                        <div className="bg-background text-foreground/50 px-4 py-2 border-b border-slate-200 dark:border-slate-700">
                                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Contenido del Documento / Desarrollo</span>
                                        </div>
                                        <div className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-xs sm:text-sm">
                                            <div className="bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-300 p-3 flex gap-4 overflow-x-auto whitespace-pre-wrap">
                                                <span className="font-bold select-none opacity-50">-</span>
                                                <div className="flex-1">{diffData.contenido.desarrollo.old}</div>
                                            </div>
                                            <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 p-3 flex gap-4 overflow-x-auto whitespace-pre-wrap">
                                                <span className="font-bold select-none opacity-50">+</span>
                                                <div className="flex-1">{diffData.contenido.desarrollo.new}</div>
                                            </div>
                                        </div>
                                    </div>
                                    )}

                                    {/* Referencias */}
                                    {diffData.referencias.filter((r:any) => r.status !== 'unchanged').length > 0 && (
                                    <div className="bg-card text-card-foreground rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                                        <div className="bg-background text-foreground/50 px-4 py-2 border-b border-slate-200 dark:border-slate-700">
                                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Etiquetas / Referencias</span>
                                        </div>
                                        <div className="font-mono text-xs sm:text-sm">
                                            {diffData.referencias.map((ref: any, idx: number) => (
                                                <div key={idx} className={`p-3 flex gap-4 ${
                                                    ref.status === 'added' ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300' :
                                                    ref.status === 'deleted' ? 'bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-300' :
                                                    'bg-card text-card-foreground text-slate-600 dark:text-slate-400'
                                                }`}>
                                                    <span className="font-bold select-none opacity-50">
                                                        {ref.status === 'added' ? '+' : ref.status === 'deleted' ? '-' : ' '}
                                                    </span>
                                                    <div className="flex-1">{ref.text}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    )}

                                    {/* LMS */}
                                    {diffData.lms.status === 'modified' && (
                                    <div className="bg-card text-card-foreground rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                                        <div className="bg-background text-foreground/50 px-4 py-2 border-b border-slate-200 dark:border-slate-700">
                                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">LMS & Capacitación</span>
                                        </div>
                                        <div className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-xs sm:text-sm">
                                            <div className="bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-300 p-3 flex gap-4">
                                                <span className="font-bold select-none opacity-50">-</span>
                                                <div className="flex-1">{diffData.lms.old}</div>
                                            </div>
                                            <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 p-3 flex gap-4">
                                                <span className="font-bold select-none opacity-50">+</span>
                                                <div className="flex-1">{diffData.lms.new}</div>
                                            </div>
                                        </div>
                                    </div>
                                    )}

                                </div>
                            )}

                            <div className="text-center pt-8 pb-4">
                                <p className="text-xs text-slate-400 font-medium">Trazabilidad asegurada. Los snapshots históricos son inmutables y preservados para auditoría ISO 9001.</p>
                            </div>

                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
