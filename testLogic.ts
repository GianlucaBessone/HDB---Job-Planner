import { calcularAvanceOkr, calcularCumplimientoKpi } from './lib/okrKpiEngine';

const kpis = [
    { valorObjetivo: 80, valorMaximoEsperado: 100, ultimoValor: 95, estado: 'Activo' },
    { valorObjetivo: 80, valorMaximoEsperado: 100, ultimoValor: 95, estado: 'Activo' },
    { valorObjetivo: 80, valorMaximoEsperado: 100, ultimoValor: 96.67, estado: 'Activo' }
];

console.log('Avance OKR:', calcularAvanceOkr(kpis));
console.log('Cumplimiento KPI 1:', calcularCumplimientoKpi(95, 80, 100));
