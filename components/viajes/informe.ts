// Informe de rendición imprimible (ventana nueva + window.print, mismo patrón que el resto del sistema).
import { formatARS } from '@/lib/formatCurrency';
import {
    ALCANCE_LABEL, baseLabel, categoriaLabel, formatFechaCorta, formatRangoFechas, MEDIO_PAGO_LABEL, MODALIDAD_LABEL,
    VERIFICACION_LABEL, VIAJE_ESTADO_LABEL, type ModalidadFondos, type VerificacionEstado, type ViajeEstado,
} from '@/lib/viajes';

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const m = (n: number | null | undefined) => esc(formatARS(n ?? 0));

export function imprimirInforme(v: any) {
    const r = v.estado === 'cerrado' && v.cierre ? { ...v.resumen, ...v.cierre } : v.resumen;
    const nombres: Record<string, string> = Object.fromEntries(v.participantes.map((p: any) => [p.id, p.nombre]));
    const resultado = r.resultado as number;
    const resultadoTxt = resultado > 0 ? `Devuelve el responsable ${m(resultado)}`
        : resultado < 0 ? `Reintegra la empresa ${m(-resultado)}` : 'Sin saldo pendiente';

    const filasGastos = [...v.gastos]
        .sort((a: any, b: any) => a.fecha.localeCompare(b.fecha))
        .map((g: any) => `
            <tr>
                <td>${esc(formatFechaCorta(g.fecha))}</td>
                <td>${esc(categoriaLabel(g.categoria))}${g.descripcion ? `<div class="sub">${esc(g.descripcion)}</div>` : ''}</td>
                <td>${esc(g.comercio || '')}${g.numeroComprobante ? `<div class="sub">N° ${esc(g.numeroComprobante)}</div>` : ''}</td>
                <td>${esc(ALCANCE_LABEL[g.alcance])}${g.alcance === 'individual' ? `<div class="sub">${esc(g.afectados.map((a: any) => nombres[a.participanteId]).join(', '))}</div>` : ''}</td>
                <td>${esc(MEDIO_PAGO_LABEL[g.medioPago])}</td>
                <td class="c">${g.comprobantes.length || '—'}</td>
                <td class="n">${m(g.monto)}</td>
                <td>${esc(VERIFICACION_LABEL[g.estadoVerificacion as VerificacionEstado])}${g.observacion ? `<div class="sub">${esc(g.observacion)}</div>` : ''}</td>
                <td class="n">${g.estadoVerificacion === 'pendiente' ? '—' : m(g.montoAprobado ?? 0)}</td>
            </tr>`).join('');

    const filasCostos = v.costos.map((c: any) => `
        <tr><td>${esc(categoriaLabel(c.categoria))}</td><td>${esc(baseLabel(c.base))}</td><td class="n">${m(c.monto)}</td></tr>`).join('');

    const filasPersonas = (r.porPersona || []).map((p: any) => `
        <tr><td>${esc(p.nombre)}</td><td class="n">${m(p.individual)}</td><td class="n">${m(p.global)}</td><td class="n"><b>${m(p.total)}</b></td></tr>`).join('');

    const extensiones = v.extensiones.length ? `
        <h2>Extensiones de estadía</h2>
        <table><thead><tr><th>Fecha</th><th>De</th><th>A</th><th>Motivo</th><th>Registró</th></tr></thead><tbody>
        ${v.extensiones.map((e: any) => `<tr><td>${esc(new Date(e.createdAt).toLocaleDateString('es-AR'))}</td><td>${esc(formatFechaCorta(e.fechaFinAnterior))}</td><td>${esc(formatFechaCorta(e.fechaFinNueva))}</td><td>${esc(e.motivo)}</td><td>${esc(e.usuarioNombre)}</td></tr>`).join('')}
        </tbody></table>` : '';

    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Rendición ${esc(v.codigo)}</title>
<style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { font-family: "IBM Plex Sans", system-ui, sans-serif; color: #1d2330; font-size: 11px; margin: 0; }
    header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1d2330; padding-bottom: 8px; margin-bottom: 12px; }
    h1 { font-size: 17px; margin: 0 0 2px; font-weight: 600; }
    h2 { font-size: 12px; margin: 16px 0 6px; font-weight: 600; text-transform: uppercase; color: #5a6372; }
    .muted { color: #5a6372; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px 16px; }
    .grid div span { display: block; color: #5a6372; font-size: 10px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-bottom: 1px solid #e1e4e9; padding: 4px 5px; text-align: left; vertical-align: top; }
    th { font-size: 9.5px; text-transform: uppercase; color: #5a6372; font-weight: 600; }
    .n { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .c { text-align: center; }
    .sub { color: #5a6372; font-size: 10px; }
    .totales { margin-top: 10px; margin-left: auto; width: 420px; }
    .totales td:first-child { white-space: nowrap; }
    .totales td { border: 0; padding: 2px 5px; }
    .totales tr.res td { border-top: 1px solid #1d2330; font-weight: 600; font-size: 12px; padding-top: 5px; }
    .firmas { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 48px; }
    .firmas div { border-top: 1px solid #1d2330; padding-top: 4px; text-align: center; color: #5a6372; }
</style></head><body>
<header>
    <div>
        <div class="muted">HDB · Informe de rendición de viáticos</div>
        <h1>${esc(v.motivo)}</h1>
        <div>${esc(v.origen)} → ${esc(v.destino)} · ${esc(formatRangoFechas(v.fechaInicio, v.fechaFin))}</div>
    </div>
    <div style="text-align:right">
        <div style="font-family:monospace;font-size:13px">${esc(v.codigo)}</div>
        <div>${esc(VIAJE_ESTADO_LABEL[v.estado as ViajeEstado])}</div>
        ${v.fechaCierre ? `<div class="muted">Cerrado ${esc(new Date(v.fechaCierre).toLocaleDateString('es-AR'))}</div>` : ''}
    </div>
</header>
<div class="grid">
    <div><span>Responsable</span>${esc(v.responsable?.nombreCompleto)}</div>
    <div><span>Modalidad</span>${esc(MODALIDAD_LABEL[v.modalidadFondos as ModalidadFondos])}</div>
    <div><span>Anticipo entregado</span>${m(r.anticipo)}</div>
    <div><span>Duración</span>${esc(r.dias)} días · ${esc(r.personas)} personas</div>
    <div><span>Proyecto</span>${esc(v.project ? `${v.project.codigoProyecto ? v.project.codigoProyecto + ' · ' : ''}${v.project.nombre}` : '—')}</div>
    <div><span>Participantes</span>${esc(v.participantes.map((p: any) => p.nombre).join(', '))}</div>
</div>

<h2>Gastos rendidos (${v.gastos.length})</h2>
<table><thead><tr><th>Fecha</th><th>Categoría</th><th>Comercio</th><th>Alcance</th><th>Pago</th><th class="c">Comp.</th><th class="n">Monto</th><th>Verificación</th><th class="n">Aprobado</th></tr></thead>
<tbody>${filasGastos || '<tr><td colspan="9" class="muted">Sin gastos.</td></tr>'}</tbody></table>

<table class="totales"><tbody>
    <tr><td>Estimado</td><td class="n">${m(r.estimado)}</td></tr>
    <tr><td>Total gastado</td><td class="n">${m(r.gastado)}</td></tr>
    <tr><td>Pagado con fondos del viaje</td><td class="n">${m(r.gastadoFondos)}</td></tr>
    <tr><td>Pagado con medios propios</td><td class="n">${m(r.gastadoPropio)}</td></tr>
    <tr><td>No reconocido (rechazado / ajustado)</td><td class="n">${m(r.rechazado)}</td></tr>
    <tr><td>Total aprobado</td><td class="n">${m(r.aprobado)}</td></tr>
    <tr><td>Anticipo entregado</td><td class="n">${m(r.anticipo)}</td></tr>
    <tr class="res"><td>Resultado</td><td class="n">${resultadoTxt}</td></tr>
</tbody></table>

${filasCostos ? `<h2>Presupuesto estimado</h2><table><thead><tr><th>Categoría</th><th>Base</th><th class="n">Monto unitario</th></tr></thead><tbody>${filasCostos}</tbody></table>` : ''}

<h2>Costo por persona</h2>
<table><thead><tr><th>Persona</th><th class="n">Individual</th><th class="n">Global prorrateado</th><th class="n">Total</th></tr></thead><tbody>${filasPersonas}</tbody></table>

${extensiones}
${v.observacionCierre ? `<h2>Observaciones de cierre</h2><p>${esc(v.observacionCierre)}</p>` : ''}

<div class="firmas"><div>${esc(v.responsable?.nombreCompleto)}<br>Responsable del viaje</div><div>${esc(v.cerradoPorNombre || '')}<br>Administración</div></div>
<script>window.onload=function(){setTimeout(function(){window.focus();window.print();},300);};</script>
</body></html>`;

    const win = window.open('', '_blank');
    if (!win) return false;
    win.document.write(html);
    win.document.close();
    return true;
}
