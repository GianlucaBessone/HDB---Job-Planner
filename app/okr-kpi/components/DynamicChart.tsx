'use client';

import React, { useEffect, useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { COMMON_GRID } from '@/app/dashboard/EChartsComponents';
import { AlertTriangle } from 'lucide-react';

interface DynamicChartProps {
    grafico: any; // GraficoConfig
    height?: number | string;
    onEvents?: any;
}

export default function DynamicChart({ grafico, height = 300, onEvents }: DynamicChartProps) {
    const [data, setData] = useState<any[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        const fetchData = async () => {
            if (!grafico.datasetId) {
                setLoading(false);
                setError('Gráfico sin Dataset asignado');
                return;
            }

            try {
                // We use the same endpoint as dataset test, but we should use dataset execute
                // Wait, if we use datasets/[id]/ejecutar it logs an execution. For dashboards, we might want a silent fetch or just use raw data.
                // For now, let's call the ejecutar route.
                const res = await fetch(`/api/datasets/${grafico.datasetId}/ejecutar`, {
                    method: 'POST',
                });
                const json = await res.json();
                
                if (res.ok) {
                    if (mounted) setData(json.datos || []);
                } else {
                    if (mounted) setError(json.error || 'Error al ejecutar dataset');
                }
            } catch (err: any) {
                if (mounted) setError(err.message || 'Error de conexión');
            } finally {
                if (mounted) setLoading(false);
            }
        };

        fetchData();
        return () => { mounted = false; };
    }, [grafico.datasetId]);

    const option = useMemo(() => {
        if (!data || data.length === 0) return null;

        const config = grafico.configuracion || {};
        const xAxisField = config.ejeX || Object.keys(data[0])[0];
        const seriesFields = config.series || [Object.keys(data[0])[1] || Object.keys(data[0])[0]];

        const categories = data.map(row => row[xAxisField]);
        const colors = config.colores || ['#2f74da', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

        const baseOption = {
            tooltip: {
                trigger: 'axis',
                backgroundColor: 'rgba(22, 27, 36, 0.96)',
                borderColor: 'rgba(255,255,255,0.1)',
                textStyle: { color: '#f6f7f9', fontSize: 12 },
            },
            grid: { ...COMMON_GRID, top: 20 },
            xAxis: {
                type: 'category',
                data: categories,
                axisLabel: { color: '#5a6372', fontSize: 10 },
                axisLine: { lineStyle: { color: '#e1e4e9' } },
            },
            yAxis: {
                type: 'value',
                splitLine: { lineStyle: { type: 'dashed', color: '#eef0f3' } },
                axisLabel: { color: '#5a6372', fontSize: 10 },
            },
        };

        if (grafico.tipoGrafico === 'Linea') {
            return {
                ...baseOption,
                series: seriesFields.map((field: string, idx: number) => ({
                    name: field,
                    type: 'line',
                    smooth: true,
                    data: data.map(row => row[field]),
                    itemStyle: { color: colors[idx % colors.length] },
                    lineStyle: { width: 3 },
                    symbolSize: 6,
                }))
            };
        }

        if (grafico.tipoGrafico === 'Barra') {
            return {
                ...baseOption,
                series: seriesFields.map((field: string, idx: number) => ({
                    name: field,
                    type: 'bar',
                    data: data.map(row => row[field]),
                    itemStyle: { color: colors[idx % colors.length], borderRadius: [4, 4, 0, 0] },
                }))
            };
        }

        if (grafico.tipoGrafico === 'Torta') {
            return {
                tooltip: {
                    trigger: 'item',
                    backgroundColor: 'rgba(22, 27, 36, 0.96)',
                    borderColor: 'rgba(255,255,255,0.1)',
                    textStyle: { color: '#f6f7f9', fontSize: 12 },
                },
                series: [{
                    type: 'pie',
                    radius: ['40%', '70%'],
                    data: data.map((row, idx) => ({
                        name: row[xAxisField],
                        value: row[seriesFields[0]],
                        itemStyle: { color: colors[idx % colors.length] }
                    })),
                    itemStyle: {
                        borderColor: '#fff',
                        borderWidth: 2
                    },
                    label: { show: false }
                }]
            };
        }

        // Fallback or other types (Gauge, Indicador) can be implemented here
        return baseOption;

    }, [data, grafico]);

    if (loading) {
        return (
            <div className="flex items-center justify-center bg-background text-foreground rounded-xl" style={{ height }}>
                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center bg-rose-50 dark:bg-rose-900/20 rounded-xl text-rose-500 p-4 text-center" style={{ height }}>
                <AlertTriangle className="w-8 h-8 mb-2 opacity-50" />
                <span className="text-sm font-bold">{error}</span>
            </div>
        );
    }

    if (!data || data.length === 0 || !option) {
        return (
            <div className="flex items-center justify-center bg-background text-foreground rounded-xl text-slate-400 text-xs font-bold uppercase tracking-wider" style={{ height }}>
                Sin Datos
            </div>
        );
    }

    return (
        <ReactECharts 
            option={option} 
            style={{ height, width: '100%' }} 
            opts={{ renderer: 'svg' }} 
            onEvents={onEvents}
        />
    );
}
