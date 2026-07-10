'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Loader2, ArrowLeft, Building2 } from 'lucide-react';
import Link from 'next/link';
import { safeApiRequest } from '@/lib/offline';
import { showToast } from '@/components/Toast';

export default function NuevoInformePage() {
    const router = useRouter();
    const [templates, setTemplates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [creatingId, setCreatingId] = useState<string | null>(null);

    useEffect(() => {
        loadTemplates();
    }, []);

    const loadTemplates = async () => {
        try {
            const res = await safeApiRequest('/api/informes-tecnicos/templates');
            const data = await res.json();
            if (Array.isArray(data)) setTemplates(data);
        } catch {
            showToast('Error al cargar tipos de informe', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateDraft = async (templateId: string) => {
        setCreatingId(templateId);
        try {
            const res = await fetch('/api/informes-tecnicos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ templateId })
            });

            if (!res.ok) throw new Error();
            const data = await res.json();
            
            showToast('Borrador creado. Completá los datos.', 'success');
            router.push(`/informes-tecnicos/${data.id}`);
        } catch {
            showToast('Error al crear informe', 'error');
            setCreatingId(null);
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            {/* Header */}
            <div className="space-y-4">
                <Link
                    href="/informes-tecnicos"
                    className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Volver
                </Link>
                <div>
                    <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight flex items-center gap-2 md:gap-3">
                        <FileText className="w-6 h-6 md:w-8 md:h-8 text-primary" />
                        Nuevo Informe Técnico
                    </h2>
                    <p className="text-sm text-slate-500 font-medium mt-1">Seleccioná el tipo de informe que deseas confeccionar.</p>
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-muted rounded-2xl animate-pulse" />)}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {templates.map(template => (
                        <button
                            key={template.id}
                            onClick={() => handleCreateDraft(template.id)}
                            disabled={creatingId !== null}
                            className="group text-left p-5 sm:p-6 bg-card border border-slate-200 dark:border-slate-700 rounded-2xl hover:border-primary/50 transition-all shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-primary/10 transition-colors" />
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-2">
                                {template.name}
                            </h3>
                            <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">
                                {template.description}
                            </p>
                            
                            <div className="mt-4 flex items-center justify-between">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    {template.schema?.sections?.length || 0} SECCIONES
                                </span>
                                {creatingId === template.id ? (
                                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                                ) : (
                                    <span className="text-primary font-bold text-xs uppercase tracking-wider group-hover:translate-x-1 transition-transform">
                                        Crear →
                                    </span>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
