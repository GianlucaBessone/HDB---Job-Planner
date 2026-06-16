'use client';

import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';

const COMMON_TEXT_COLOR = '#64748b'; // slate-500
const COMMON_GRID = { left: '3%', right: '4%', bottom: '3%', containLabel: true };

interface BaseChartProps {
    data: any;
    className?: string;
    height?: string | number;
}

// ----------------------------------------------------
// Trend/Area Chart (Replaces ElegantTrendChart)
// ----------------------------------------------------
export function TrendChart({ 
    data, 
    color = '#2563eb', 
    height = 224, 
    valuePrefix = '', 
    valueSuffix = '',
    onEvents
}: { 
    data: { label: string; value: number }[], 
    color?: string, 
    height?: number | string,
    valuePrefix?: string,
    valueSuffix?: string,
    onEvents?: any
}) {
    const option = useMemo(() => ({
        tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            borderColor: 'rgba(255,255,255,0.1)',
            textStyle: { color: '#f8fafc', fontSize: 12 },
            formatter: (params: any) => {
                const val = params[0];
                return `<div style="font-weight:bold;margin-bottom:4px;color:#94a3b8;font-size:10px;text-transform:uppercase;letter-spacing:1px">${val.name}</div>
                        <div style="font-size:14px;font-weight:bold;color:${color}">${valuePrefix}${val.value}${valueSuffix}</div>`;
            }
        },
        grid: { ...COMMON_GRID, top: 10 },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: data.map(d => d.label),
            axisLabel: { color: COMMON_TEXT_COLOR, fontSize: 10, margin: 12 },
            axisLine: { lineStyle: { color: '#e2e8f0' } },
            axisTick: { show: false }
        },
        yAxis: {
            type: 'value',
            splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } },
            axisLabel: { color: COMMON_TEXT_COLOR, fontSize: 10 },
            axisLine: { show: false },
            axisTick: { show: false }
        },
        series: [{
            data: data.map(d => d.value),
            type: 'line',
            smooth: 0.4,
            symbol: 'circle',
            symbolSize: 6,
            showSymbol: false,
            lineStyle: { width: 3, color },
            itemStyle: { color, borderWidth: 2, borderColor: '#fff' },
            areaStyle: {
                color: {
                    type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                    colorStops: [
                        { offset: 0, color: `${color}40` }, // 25% opacity
                        { offset: 1, color: `${color}00` }  // 0% opacity
                    ]
                }
            }
        }]
    }), [data, color, valuePrefix, valueSuffix]);

    return (
        <ReactECharts 
            option={option} 
            style={{ height, width: '100%' }} 
            opts={{ renderer: 'svg' }} 
            onEvents={onEvents}
        />
    );
}

// ----------------------------------------------------
// Bar Chart (For IPT / Horizontal bars)
// ----------------------------------------------------
export function BasicBarChart({ 
    data, 
    height = 224, 
    isHorizontal = false,
    valuePrefix = '',
    valueSuffix = '',
    colors = ['#3b82f6', '#94a3b8'] // [Good/Active, Bad/Inactive]
}: { 
    data: { name: string; value: number; isHighlight?: boolean; code?: string }[], 
    height?: number | string,
    isHorizontal?: boolean,
    valuePrefix?: string,
    valueSuffix?: string,
    colors?: string[]
}) {
    const option = useMemo(() => {
        const categories = data.map(d => d.name);
        const values = data.map(d => ({
            value: d.value,
            name: d.code ? `${d.code} | ${d.name}` : d.name,
            itemStyle: { color: d.isHighlight !== false ? colors[0] : colors[1] }
        }));

        return {
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                borderColor: 'rgba(255,255,255,0.1)',
                textStyle: { color: '#f8fafc', fontSize: 12 },
                formatter: (params: any) => {
                    const val = params[0];
                    return `<div style="font-weight:bold;margin-bottom:4px;color:#94a3b8;font-size:10px;text-transform:uppercase;letter-spacing:1px">${val.data.name}</div>
                            <div style="font-size:14px;font-weight:bold;color:${val.color}">${valuePrefix}${val.value}${valueSuffix}</div>`;
                }
            },
            grid: { ...COMMON_GRID, top: 10 },
            xAxis: isHorizontal ? {
                type: 'value',
                splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } },
                axisLabel: { color: COMMON_TEXT_COLOR, fontSize: 10 },
            } : {
                type: 'category',
                data: categories,
                axisLabel: { 
                    color: COMMON_TEXT_COLOR, 
                    fontSize: 10, 
                    rotate: 45, 
                    interval: 0,
                    width: 60,
                    overflow: 'truncate'
                },
                axisLine: { lineStyle: { color: '#e2e8f0' } },
                axisTick: { show: false }
            },
            yAxis: isHorizontal ? {
                type: 'category',
                data: categories,
                axisLabel: { 
                    color: COMMON_TEXT_COLOR, 
                    fontSize: 10,
                    width: 80,
                    overflow: 'truncate'
                },
                axisLine: { lineStyle: { color: '#e2e8f0' } },
                axisTick: { show: false }
            } : {
                type: 'value',
                splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } },
                axisLabel: { color: COMMON_TEXT_COLOR, fontSize: 10 },
            },
            series: [{
                data: values,
                type: 'bar',
                barMaxWidth: 32,
                itemStyle: { borderRadius: isHorizontal ? [0, 4, 4, 0] : [4, 4, 0, 0] }
            }]
        };
    }, [data, isHorizontal, colors, valuePrefix, valueSuffix]);

    return (
        <ReactECharts 
            option={option} 
            style={{ height, width: '100%' }} 
            opts={{ renderer: 'svg' }} 
        />
    );
}

// ----------------------------------------------------
// Donut Chart
// ----------------------------------------------------
export function DonutChart({ 
    data, 
    height = 200,
    colors = ['#1e293b', '#334155', '#475569', '#64748b', '#94a3b8'],
    centerText = '',
    centerSubtext = '',
    onEvents
}: { 
    data: { name: string; value: number }[], 
    height?: number | string,
    colors?: string[],
    centerText?: string | number,
    centerSubtext?: string,
    onEvents?: any
}) {
    const option = useMemo(() => ({
        tooltip: {
            trigger: 'item',
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            borderColor: 'rgba(255,255,255,0.1)',
            textStyle: { color: '#f8fafc', fontSize: 12 },
            formatter: '{b}: {c} ({d}%)'
        },
        color: colors,
        title: {
            text: centerText.toString(),
            subtext: centerSubtext.toUpperCase(),
            left: 'center',
            top: 'center',
            textStyle: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
            subtextStyle: { fontSize: 9, fontWeight: 'bold', color: '#94a3b8', letterSpacing: 1 }
        },
        series: [{
            type: 'pie',
            radius: ['65%', '85%'],
            avoidLabelOverlap: false,
            itemStyle: {
                borderColor: '#fff',
                borderWidth: 2
            },
            label: { show: false, position: 'center' },
            labelLine: { show: false },
            data: data
        }]
    }), [data, colors, centerText, centerSubtext]);

    return (
        <ReactECharts 
            option={option} 
            style={{ height, width: '100%' }} 
            opts={{ renderer: 'svg' }} 
            onEvents={onEvents}
        />
    );
}

// ----------------------------------------------------
// Divergent Bar Chart (Savings vs Overruns)
// ----------------------------------------------------
export function DivergentBarChart({ 
    data, 
    height = 224 
}: { 
    data: { name: string; value: number }[], 
    height?: number | string 
}) {
    const option = useMemo(() => {
        const maxAbs = Math.max(...data.map(d => Math.abs(d.value)), 1);
        return {
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                borderColor: 'rgba(255,255,255,0.1)',
                textStyle: { color: '#f8fafc', fontSize: 12 },
                formatter: (params: any) => {
                    const val = params[0];
                    const isPositive = val.value >= 0;
                    const color = isPositive ? '#10b981' : '#f43f5e';
                    const text = isPositive ? 'AHORRO' : 'DESVÍO';
                    return `<div style="font-weight:bold;margin-bottom:4px;color:#94a3b8;font-size:10px;text-transform:uppercase;letter-spacing:1px">${val.name}</div>
                            <div style="font-size:14px;font-weight:bold;color:${color}">${Math.abs(val.value)}H ${text}</div>`;
                }
            },
            grid: { left: '2%', right: '2%', bottom: '0%', top: '0%', containLabel: true },
            xAxis: {
                type: 'value',
                min: -maxAbs * 1.1,
                max: maxAbs * 1.1,
                splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } },
                axisLabel: { show: false },
                axisLine: { show: false },
                axisTick: { show: false }
            },
            yAxis: {
                type: 'category',
                data: data.map(d => d.name),
                axisLine: { show: false },
                axisTick: { show: false },
                axisLabel: { 
                    color: COMMON_TEXT_COLOR, 
                    fontSize: 10,
                    width: 100,
                    overflow: 'truncate'
                }
            },
            series: [{
                type: 'bar',
                data: data.map(d => ({
                    value: d.value,
                    itemStyle: { color: d.value >= 0 ? '#10b981' : '#f43f5e', borderRadius: d.value >= 0 ? [0, 4, 4, 0] : [4, 0, 0, 4] }
                })),
                barMaxWidth: 16,
            }]
        };
    }, [data]);

    return (
        <ReactECharts 
            option={option} 
            style={{ height, width: '100%' }} 
            opts={{ renderer: 'svg' }} 
        />
    );
}

// ----------------------------------------------------
// Target Horizontal Bar Chart (For Services)
// ----------------------------------------------------
export function TargetBarChart({
    data,
    target,
    height = 200
}: {
    data: { name: string; value: number }[],
    target: number,
    height?: number | string
}) {
    const option = useMemo(() => {
        return {
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                borderColor: 'rgba(255,255,255,0.1)',
                textStyle: { color: '#f8fafc', fontSize: 12 },
                formatter: (params: any) => {
                    const val = params[0];
                    const isAboveTarget = val.value >= target;
                    const color = isAboveTarget ? '#10b981' : '#f59e0b';
                    return `<div style="font-weight:bold;margin-bottom:4px;color:#94a3b8;font-size:10px;text-transform:uppercase;letter-spacing:1px">${val.name}</div>
                            <div style="font-size:14px;font-weight:bold;color:${color}">${val.value}/10</div>`;
                }
            },
            grid: { left: '0%', right: '5%', bottom: '0%', top: '0%', containLabel: true },
            xAxis: {
                type: 'value',
                max: 10,
                splitLine: { show: false },
                axisLabel: { show: false },
                axisLine: { show: false },
                axisTick: { show: false }
            },
            yAxis: {
                type: 'category',
                data: data.map(d => d.name),
                axisLine: { show: false },
                axisTick: { show: false },
                axisLabel: { color: COMMON_TEXT_COLOR, fontSize: 10 }
            },
            series: [
                {
                    type: 'bar',
                    data: data.map(d => ({
                        value: d.value,
                        itemStyle: { color: d.value >= target ? '#3b82f6' : '#94a3b8', borderRadius: [0, 4, 4, 0] }
                    })),
                    barMaxWidth: 16,
                    z: 2
                },
                {
                    type: 'scatter',
                    symbol: 'rect',
                    symbolSize: [2, '100%'],
                    data: data.map(() => target),
                    itemStyle: { color: '#ef4444' }, // Red target line
                    z: 3,
                    silent: true
                }
            ]
        };
    }, [data, target]);

    return (
        <ReactECharts 
            option={option} 
            style={{ height, width: '100%' }} 
            opts={{ renderer: 'svg' }} 
        />
    );
}

// ----------------------------------------------------
// Multi Trend Chart (For CSAT, multiple lines)
// ----------------------------------------------------
export function MultiTrendChart({ 
    data, 
    target = 8,
    height = 224,
    colors = ['#3b82f6', '#10b981', '#f59e0b'] // Attention, Quality, Time
}: { 
    data: { label: string; atencion: number; calidad: number; tiempo: number }[], 
    target?: number,
    height?: number | string,
    colors?: string[]
}) {
    const option = useMemo(() => ({
        tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            borderColor: 'rgba(255,255,255,0.1)',
            textStyle: { color: '#f8fafc', fontSize: 12 },
            formatter: (params: any) => {
                const label = params[0].name;
                let html = `<div style="font-weight:bold;margin-bottom:4px;color:#94a3b8;font-size:10px;text-transform:uppercase;letter-spacing:1px">${label}</div>`;
                params.forEach((p: any) => {
                    html += `<div style="display:flex;align-items:center;gap:8px;margin-top:2px;">
                                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background-color:${p.color}"></span>
                                <span style="color:#cbd5e1;font-size:12px">${p.seriesName}:</span>
                                <span style="color:${p.color};font-weight:bold">${p.value}/10</span>
                             </div>`;
                });
                return html;
            }
        },
        legend: {
            data: ['Atención', 'Calidad', 'Tiempo'],
            icon: 'circle',
            itemWidth: 8,
            textStyle: { color: COMMON_TEXT_COLOR, fontSize: 10, fontWeight: 'bold' },
            bottom: 0
        },
        grid: { ...COMMON_GRID, top: 20, bottom: 30 },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: data.map(d => d.label),
            axisLabel: { color: COMMON_TEXT_COLOR, fontSize: 10, margin: 12 },
            axisLine: { lineStyle: { color: '#e2e8f0' } },
            axisTick: { show: false }
        },
        yAxis: {
            type: 'value',
            min: 0,
            max: 10,
            splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } },
            axisLabel: { color: COMMON_TEXT_COLOR, fontSize: 10 },
            axisLine: { show: false },
            axisTick: { show: false }
        },
        series: [
            {
                name: 'Atención',
                type: 'line',
                data: data.map(d => d.atencion),
                smooth: 0.4,
                symbolSize: 6,
                lineStyle: { width: 3, color: colors[0] },
                itemStyle: { color: colors[0] }
            },
            {
                name: 'Calidad',
                type: 'line',
                data: data.map(d => d.calidad),
                smooth: 0.4,
                symbolSize: 6,
                lineStyle: { width: 3, color: colors[1] },
                itemStyle: { color: colors[1] }
            },
            {
                name: 'Tiempo',
                type: 'line',
                data: data.map(d => d.tiempo),
                smooth: 0.4,
                symbolSize: 6,
                lineStyle: { width: 3, color: colors[2] },
                itemStyle: { color: colors[2] }
            },
            {
                name: 'Target',
                type: 'line',
                markLine: {
                    data: [{ yAxis: target, name: 'Objetivo' }],
                    label: { show: true, position: 'end', color: '#ef4444', formatter: 'Objetivo', fontSize: 9 },
                    lineStyle: { color: '#ef4444', type: 'dashed', width: 2 },
                    symbol: 'none'
                }
            }
        ]
    }), [data, target, colors]);

    return (
        <ReactECharts 
            option={option} 
            style={{ height, width: '100%' }} 
            opts={{ renderer: 'svg' }} 
        />
    );
}
