'use client';

import { useState } from 'react';
import ProjectsHeader from '@/components/projects/ProjectsHeader';
import { PieChart, Download, Loader2 } from 'lucide-react';
import { safeApiRequest } from '@/lib/offline';
import { Project, STATUS_CONFIG } from '@/lib/projectTypes';
import * as XLSX from 'xlsx';

export default function ReportesPage() {
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const res = await safeApiRequest('/api/projects');
            if (!res.ok) throw new Error('Error al obtener proyectos');
            const data: Project[] = await res.json();

            // Transform data for Excel
            const excelData = data.map(p => ({
                'ID': p.codigoProyecto || p.id,
                'Proyecto': p.nombre,
                'Cliente': p.client?.nombre || p.cliente || 'Sin asignar',
                'Estado': STATUS_CONFIG[p.estado]?.label || p.estado,
                'Responsable': p.responsableUser?.nombreCompleto || p.responsable || 'Sin asignar',
                'Horas Estimadas': p.horasEstimadas,
                'Horas Consumidas': p.horasConsumidas,
                'Desviación (Hs)': p.horasEstimadas - p.horasConsumidas,
                'Eficiencia (%)': p.horasEstimadas > 0 ? Math.round((p.horasConsumidas / p.horasEstimadas) * 100) : 0,
                'Fecha Inicio': p.fechaInicio || '-',
                'Fecha Fin': p.fechaFin || '-'
            }));

            // Create workbook and worksheet
            const ws = XLSX.utils.json_to_sheet(excelData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Proyectos');

            // Format column widths
            const colWidths = [
                { wch: 15 }, // ID
                { wch: 40 }, // Proyecto
                { wch: 30 }, // Cliente
                { wch: 15 }, // Estado
                { wch: 25 }, // Responsable
                { wch: 15 }, // Horas E.
                { wch: 15 }, // Horas C.
                { wch: 15 }, // Desviación
                { wch: 15 }, // Eficiencia
                { wch: 15 }, // Fecha I.
                { wch: 15 }  // Fecha F.
            ];
            ws['!cols'] = colWidths;

            // Generate file and download
            XLSX.writeFile(wb, `Reporte_Proyectos_${new Date().toISOString().split('T')[0]}.xlsx`);

        } catch (e) {
            console.error('Export error:', e);
            alert('Hubo un error al generar el reporte.');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <ProjectsHeader activeTabId="reportes" />
            
            <div className="py-24 flex flex-col items-center justify-center bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-[2.5rem] shadow-sm border-dashed">
                <div className="p-6 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-full mb-6">
                    <PieChart className="w-12 h-12" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Centro de Reportes</h2>
                <p className="text-sm text-slate-500 mt-2 text-center max-w-md mb-8">
                    Genera reportes gerenciales con el estado actual del portfolio de proyectos, incluyendo métricas de rentabilidad y tiempos.
                </p>

                <button
                    onClick={handleExport}
                    disabled={isExporting}
                    className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
                >
                    {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                    {isExporting ? 'Generando Reporte...' : 'Descargar Reporte Excel'}
                </button>
            </div>
        </div>
    );
}
