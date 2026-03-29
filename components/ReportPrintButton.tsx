'use client';
import { Loader2, FileText } from 'lucide-react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { ProjectReportPDF } from './ProjectReportPDF';
import { useEffect, useState } from 'react';

interface ReportPrintButtonProps {
    project: any;
    totalRealHours: number;
    savedHours: number;
    IPT: string;
    operatorMap: any[];
    delaysByArea: any[];
    delayImpactPct: string;
    clientDelays: any[];
}

export default function ReportPrintButton({
    project,
    totalRealHours,
    savedHours,
    IPT,
    operatorMap,
    delaysByArea,
    delayImpactPct,
    clientDelays,
}: ReportPrintButtonProps) {
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) return (
        <button className="bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 px-6 py-3 rounded-xl font-bold flex items-center gap-2 cursor-wait">
            <Loader2 className="w-5 h-5 animate-spin" />
            Cargando Generador...
        </button>
    );

    const filename = `Reporte_${project.nombre.replace(/\s+/g, '_')}.pdf`;

    return (
        <PDFDownloadLink
            document={
                <ProjectReportPDF
                    project={project}
                    totalRealHours={totalRealHours}
                    savedHours={savedHours}
                    IPT={IPT}
                    operatorMap={operatorMap}
                    delaysByArea={delaysByArea}
                    delayImpactPct={delayImpactPct}
                    clientDelays={clientDelays}
                />
            }
            fileName={filename}
            className="no-underline"
        >
            {({ loading }) => (
                <button
                    disabled={loading}
                    className={`bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-xl transition-all ${loading ? 'opacity-70 cursor-wait' : 'active:scale-95'}`}
                >
                    {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <FileText className="w-5 h-5" />
                    )}
                    {loading ? 'Preparando PDF...' : 'Descargar PDF Oficial'}
                </button>
            )}
        </PDFDownloadLink>
    );
}
