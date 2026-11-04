'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { FileText, Printer } from 'lucide-react';
import { Button, Dialog } from '@/components/ui';
import { formatDate } from '@/lib/formatDate';
import {
    calcularTotales,
    ESTADO_LABEL,
    evaluarFila,
    formatDiferencia,
    formatHoras,
    formatRango,
    TOLERANCIA_HORAS,
    TOLERANCIA_MINUTOS,
    type ControlHorarioRow,
    type TotalesControl,
} from '@/lib/controlHorario';

export interface InformeFiltros {
    from: string;
    to: string;
    operador?: string | null;
    proyecto?: string | null;
}

interface Props {
    open: boolean;
    onClose: () => void;
    rows: ControlHorarioRow[];
    filtros: InformeFiltros;
    emitidoPor?: string | null;
}

const PRINT_ROOT_ID = 'control-horario-print-root';

export default function InformeControlHorario({ open, onClose, rows, filtros, emitidoPor }: Props) {
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => setMounted(true), []);

    React.useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
                e.preventDefault();
                window.print();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open]);

    if (!open) return null;

    const emitido = new Date();

    return (
        <>
            <style
                dangerouslySetInnerHTML={{
                    __html: `
                @media print {
                    @page { size: A4 landscape; margin: 10mm; }
                    html, body { height: auto !important; overflow: visible !important; background: white !important; }
                    body.modal-open { position: static !important; top: auto !important; }
                    body > *:not(#${PRINT_ROOT_ID}) { display: none !important; }
                    #${PRINT_ROOT_ID} {
                        display: block !important;
                        color: black;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    #${PRINT_ROOT_ID} thead { display: table-header-group; }
                    #${PRINT_ROOT_ID} tfoot { display: table-row-group; }
                    #${PRINT_ROOT_ID} tr { break-inside: avoid; }
                    #${PRINT_ROOT_ID} .informe-seccion { break-inside: auto; }
                    #${PRINT_ROOT_ID} .informe-salto { break-before: page; }
                    .dark #${PRINT_ROOT_ID}, .dark #${PRINT_ROOT_ID} * {
                        color: black !important;
                        border-color: #94a3b8 !important;
                    }
                    .dark #${PRINT_ROOT_ID} * { background-color: transparent !important; }
                }
            `,
                }}
            />
            {/* Copia para imprimir: directo en <body>, fuera del diálogo con scroll */}
            {mounted &&
                createPortal(
                    <div id={PRINT_ROOT_ID} className="hidden">
                        <DocumentoControlHorario rows={rows} filtros={filtros} emitidoPor={emitidoPor} emitido={emitido} paraImprimir />
                    </div>,
                    document.body
                )}

            <Dialog
                open={open}
                onClose={onClose}
                size="full"
                icon={<div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-200 flex items-center justify-center"><FileText className="w-[18px] h-[18px]" /></div>}
                title="Informe de control horario"
                description="Vista previa del informe, lista para imprimir o guardar en PDF (A4 horizontal)."
                bodyClassName="bg-surface-sunken p-4 sm:p-6"
                footer={
                    <>
                        <Button variant="secondary" onClick={onClose}>Cerrar</Button>
                        <Button icon={<Printer />} onClick={() => window.print()}>Imprimir o guardar PDF</Button>
                    </>
                }
            >
                <div className="bg-card text-slate-800 dark:text-slate-100 p-6 sm:p-8 rounded-xl border border-border mx-auto max-w-[1100px] overflow-x-auto">
                    <DocumentoControlHorario rows={rows} filtros={filtros} emitidoPor={emitidoPor} emitido={emitido} />
                </div>
            </Dialog>
        </>
    );
}

// ── Documento ────────────────────────────────────────────────────────

const TABLE = 'w-full text-left text-[11px] border-collapse border border-slate-300 dark:border-slate-600';
const THEAD_ROW = 'bg-slate-100 dark:bg-slate-700/60 border-b border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 uppercase';
const TH = 'py-1.5 px-2 border-r border-slate-300 dark:border-slate-600 font-semibold whitespace-nowrap';
const TD = 'py-1 px-2 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap';
const NUM = 'text-right tabular-nums';
const MARCA = 'bg-warning-50 dark:bg-warning-900/20';
const TOTAL_ROW = 'bg-slate-100 dark:bg-slate-700/60 border-t-2 border-slate-400 dark:border-slate-500 font-semibold';

function DocumentoControlHorario({
    rows,
    filtros,
    emitidoPor,
    emitido,
    paraImprimir = false,
}: {
    rows: ControlHorarioRow[];
    filtros: InformeFiltros;
    emitidoPor?: string | null;
    emitido: Date;
    paraImprimir?: boolean;
}) {
    const totales = calcularTotales(rows);
    const conDiferencia = rows.filter(r => evaluarFila(r).conDiferencia);
    const totalesDif = calcularTotales(conDiferencia);

    const porOperador = new Map<string, { nombre: string; rows: ControlHorarioRow[] }>();
    for (const r of rows) {
        const g = porOperador.get(r.operatorId) ?? { nombre: r.operatorName, rows: [] };
        g.rows.push(r);
        porOperador.set(r.operatorId, g);
    }
    const grupos = Array.from(porOperador.values());

    return (
        <div className={paraImprimir ? 'text-slate-900 text-xs space-y-5' : 'text-xs space-y-5'}>
            {/* Encabezado */}
            <header className="flex items-start justify-between gap-6 border-b-2 border-slate-800 dark:border-slate-400 pb-3">
                <div>
                    <p className="text-lg font-semibold text-slate-900 dark:text-slate-50">HDB Servicios Eléctricos</p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">Sistema de Gestión Integral · Recursos Humanos</p>
                </div>
                <div className="text-right">
                    <p className="text-sm font-semibold uppercase text-slate-900 dark:text-slate-50">Informe de control horario</p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                        Período: <strong>{formatDate(filtros.from)}</strong> al <strong>{formatDate(filtros.to)}</strong>
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">
                        Emitido el {formatDate(emitido)} a las {emitido.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                        {emitidoPor ? ` por ${emitidoPor}` : ''}
                    </p>
                </div>
            </header>

            {/* Alcance */}
            <div className="grid grid-cols-3 gap-3 text-[11px]">
                <Dato label="Operador" valor={filtros.operador || 'Todos'} />
                <Dato label="Proyecto" valor={filtros.proyecto || 'Todos'} />
                <Dato label="Jornadas analizadas" valor={`${totales.dias} (${totales.operadores} ${totales.operadores === 1 ? 'operador' : 'operadores'})`} />
            </div>

            {/* 1. Sumatorias */}
            <section className="informe-seccion space-y-2">
                <Titulo>1. Resumen de horas</Titulo>
                <ResumenTotales t={totales} />
            </section>

            {/* 2. Por operador */}
            <section className="informe-seccion space-y-2">
                <Titulo>2. Totales por operador</Titulo>
                <table className={TABLE}>
                    <thead>
                        <tr className={THEAD_ROW}>
                            <th className={TH}>Operador</th>
                            <th className={`${TH} ${NUM}`}>Jornadas</th>
                            <th className={`${TH} ${NUM}`}>H. registro</th>
                            <th className={`${TH} ${NUM}`}>H. extra</th>
                            <th className={`${TH} ${NUM}`}>H. GPS</th>
                            <th className={`${TH} ${NUM}`}>Dif. GPS − reg.</th>
                            <th className={`${TH} ${NUM}`}>Ajustes</th>
                            <th className={`${TH} ${NUM}`}>H. finales</th>
                            <th className={`py-1.5 px-2 font-semibold ${NUM}`}>Con diferencia</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {grupos.map(g => {
                            const t = calcularTotales(g.rows);
                            return (
                                <tr key={g.nombre}>
                                    <td className={TD}>{g.nombre}</td>
                                    <td className={`${TD} ${NUM}`}>{t.dias}</td>
                                    <td className={`${TD} ${NUM}`}>{formatHoras(t.horasRegistro)}</td>
                                    <td className={`${TD} ${NUM}`}>{formatHoras(t.horasExtra)}</td>
                                    <td className={`${TD} ${NUM}`}>{formatHoras(t.horasGps)}</td>
                                    <td className={`${TD} ${NUM} ${Math.abs(t.diferenciaNeta) > TOLERANCIA_HORAS ? MARCA + ' font-semibold' : ''}`}>{formatDiferencia(t.diferenciaNeta)}</td>
                                    <td className={`${TD} ${NUM}`}>{t.ajustes}</td>
                                    <td className={`${TD} ${NUM} font-semibold`}>{formatHoras(t.horasFinales)}</td>
                                    <td className={`py-1 px-2 ${NUM} ${t.filasConDiferencia > 0 ? MARCA + ' font-semibold' : ''}`}>{t.filasConDiferencia}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className={TOTAL_ROW}>
                            <td className={TD}>Total general</td>
                            <td className={`${TD} ${NUM}`}>{totales.dias}</td>
                            <td className={`${TD} ${NUM}`}>{formatHoras(totales.horasRegistro)}</td>
                            <td className={`${TD} ${NUM}`}>{formatHoras(totales.horasExtra)}</td>
                            <td className={`${TD} ${NUM}`}>{formatHoras(totales.horasGps)}</td>
                            <td className={`${TD} ${NUM}`}>{formatDiferencia(totales.diferenciaNeta)}</td>
                            <td className={`${TD} ${NUM}`}>{totales.ajustes}</td>
                            <td className={`${TD} ${NUM}`}>{formatHoras(totales.horasFinales)}</td>
                            <td className={`py-1 px-2 ${NUM}`}>{totales.filasConDiferencia}</td>
                        </tr>
                    </tfoot>
                </table>
            </section>

            {/* 3. Detalle por operador */}
            <section className="informe-seccion space-y-2">
                <Titulo>3. Detalle de jornadas</Titulo>
                <TablaDetalle grupos={grupos} totales={totales} />
            </section>

            {/* 4. Diferencias */}
            <section className="informe-seccion informe-salto space-y-2">
                <Titulo>4. Jornadas con diferencias ({conDiferencia.length})</Titulo>
                {conDiferencia.length === 0 ? (
                    <p className="p-3 border border-slate-200 dark:border-slate-700 text-center text-slate-600 dark:text-slate-300">
                        No hay jornadas con diferencias en el período.
                    </p>
                ) : (
                    <>
                        <TablaDetalle grupos={[{ nombre: '', rows: conDiferencia }]} totales={totalesDif} mostrarOperador tituloTotal="Total con diferencias" />
                        <ResumenTotales t={totalesDif} compacto />
                    </>
                )}
            </section>

            {/* Criterios */}
            <section className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1 border-t border-slate-300 dark:border-slate-600 pt-3">
                <p className="font-semibold text-slate-800 dark:text-slate-100">Criterios</p>
                <p>
                    Registro: carga manual de Registro de Tiempos (sin devoluciones); el horario es el primer ingreso y el último egreso del día.
                    Fichada GPS: suma de las fichadas cerradas del día; las fichadas sin cierre no suman horas.
                </p>
                <p>
                    Se marca una jornada cuando las horas GPS y las del registro difieren en más de {formatHoras(TOLERANCIA_HORAS)} h, cuando el ingreso o el egreso
                    difieren en más de {TOLERANCIA_MINUTOS} minutos, o cuando falta una de las dos fuentes. Horas finales: las del ajuste del supervisor si existe; si no, las del registro.
                </p>
            </section>

            {/* Firmas */}
            <section className="grid grid-cols-2 gap-16 pt-10 text-[11px] text-slate-600 dark:text-slate-300">
                <Firma label="Responsable del control" />
                <Firma label="Supervisión / Recursos Humanos" />
            </section>

            <footer className="pt-3 border-t border-slate-300 dark:border-slate-600 text-center text-[11px] text-slate-600 dark:text-slate-300">
                Documento emitido por el Sistema de Gestión Integral (SGI) — HDB Servicios Eléctricos
            </footer>
        </div>
    );
}

function TablaDetalle({
    grupos,
    totales,
    mostrarOperador = false,
    tituloTotal = 'Total general',
}: {
    grupos: { nombre: string; rows: ControlHorarioRow[] }[];
    totales: TotalesControl;
    mostrarOperador?: boolean;
    tituloTotal?: string;
}) {
    const columnas = mostrarOperador ? 11 : 10;
    return (
        <table className={TABLE}>
            <thead>
                <tr className={THEAD_ROW}>
                    {mostrarOperador && <th className={TH}>Operador</th>}
                    <th className={TH}>Fecha</th>
                    <th className={TH}>Horario registro</th>
                    <th className={`${TH} ${NUM}`}>H. reg.</th>
                    <th className={TH}>Fichada GPS</th>
                    <th className={`${TH} ${NUM}`}>H. GPS</th>
                    <th className={`${TH} ${NUM}`}>Dif.</th>
                    <th className={TH}>Ajuste</th>
                    <th className={`${TH} ${NUM}`}>H. ajuste</th>
                    <th className={`${TH} ${NUM}`}>H. finales</th>
                    <th className="py-1.5 px-2 font-semibold">Estado / observación</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {grupos.map(g => {
                    const sub = calcularTotales(g.rows);
                    return (
                        <React.Fragment key={g.nombre || 'todos'}>
                            {!mostrarOperador && (
                                <tr className="bg-slate-50 dark:bg-slate-800/60">
                                    <td colSpan={columnas} className="py-1 px-2 font-semibold text-slate-900 dark:text-slate-50">{g.nombre}</td>
                                </tr>
                            )}
                            {g.rows.map(r => <FilaDetalle key={r.key} row={r} mostrarOperador={mostrarOperador} />)}
                            {!mostrarOperador && (
                                <tr className="border-t border-slate-300 dark:border-slate-600 font-semibold">
                                    <td className={`${TD} text-right`} colSpan={2}>Subtotal</td>
                                    <td className={`${TD} ${NUM}`}>{formatHoras(sub.horasRegistro)}</td>
                                    <td className={TD} />
                                    <td className={`${TD} ${NUM}`}>{formatHoras(sub.horasGps)}</td>
                                    <td className={`${TD} ${NUM}`}>{formatDiferencia(sub.diferenciaNeta)}</td>
                                    <td className={TD} />
                                    <td className={`${TD} ${NUM}`}>{sub.ajustes ? formatHoras(sub.horasAjustadas) : '—'}</td>
                                    <td className={`${TD} ${NUM}`}>{formatHoras(sub.horasFinales)}</td>
                                    <td className="py-1 px-2">{sub.filasConDiferencia ? `${sub.filasConDiferencia} con diferencia` : ''}</td>
                                </tr>
                            )}
                        </React.Fragment>
                    );
                })}
            </tbody>
            <tfoot>
                <tr className={TOTAL_ROW}>
                    <td className={`${TD} text-right`} colSpan={mostrarOperador ? 3 : 2}>{tituloTotal}</td>
                    <td className={`${TD} ${NUM}`}>{formatHoras(totales.horasRegistro)}</td>
                    <td className={TD} />
                    <td className={`${TD} ${NUM}`}>{formatHoras(totales.horasGps)}</td>
                    <td className={`${TD} ${NUM}`}>{formatDiferencia(totales.diferenciaNeta)}</td>
                    <td className={TD} />
                    <td className={`${TD} ${NUM}`}>{totales.ajustes ? formatHoras(totales.horasAjustadas) : '—'}</td>
                    <td className={`${TD} ${NUM}`}>{formatHoras(totales.horasFinales)}</td>
                    <td className="py-1 px-2">{totales.dias} jornadas</td>
                </tr>
            </tfoot>
        </table>
    );
}

function FilaDetalle({ row, mostrarOperador }: { row: ControlHorarioRow; mostrarOperador: boolean }) {
    const ev = evaluarFila(row);
    const { registro, gps, ajuste } = row;
    const marcaHoras = ev.estado !== 'ok' && ev.estado !== 'gps_abierta' ? MARCA : '';
    const estado = [
        ev.estado !== 'ok' ? ESTADO_LABEL[ev.estado] : null,
        registro?.causas.length ? registro.causas.join(', ') : null,
        ajuste?.observacion || null,
    ].filter(Boolean).join(' · ');
    return (
        <tr>
            {mostrarOperador && <td className={TD}>{row.operatorName}</td>}
            <td className={TD}>{formatDate(row.fecha)}</td>
            <td className={`${TD} tabular-nums ${ev.ingresoDifiere || ev.egresoDifiere ? MARCA : ''}`}>{registro ? formatRango(registro.ingreso, registro.egreso) : '—'}</td>
            <td className={`${TD} ${NUM}`}>{registro ? formatHoras(registro.horas) : '—'}</td>
            <td className={`${TD} tabular-nums ${ev.ingresoDifiere || ev.egresoDifiere || ev.estado === 'sin_gps' || ev.estado === 'gps_abierta' ? MARCA : ''}`}>
                {gps ? formatRango(gps.ingreso, gps.egreso, gps.abierta) : '—'}
            </td>
            <td className={`${TD} ${NUM} ${marcaHoras}`}>{gps ? formatHoras(gps.horas) : '—'}</td>
            <td className={`${TD} ${NUM} ${marcaHoras} ${ev.conDiferencia ? 'font-semibold' : ''}`}>{formatDiferencia(ev.diferencia)}</td>
            <td className={`${TD} tabular-nums`}>{ajuste ? formatRango(ajuste.horaIngreso, ajuste.horaEgreso) : '—'}</td>
            <td className={`${TD} ${NUM}`}>{ajuste ? formatHoras(ajuste.horas) : '—'}</td>
            <td className={`${TD} ${NUM} font-semibold`}>{formatHoras(ev.horasFinales)}</td>
            <td className="py-1 px-2 whitespace-normal min-w-[140px]">{estado}</td>
        </tr>
    );
}

function ResumenTotales({ t, compacto = false }: { t: TotalesControl; compacto?: boolean }) {
    const items: { label: string; valor: string; destacado?: boolean }[] = [
        { label: 'Horas registro', valor: formatHoras(t.horasRegistro) },
        { label: 'De ellas, extra', valor: formatHoras(t.horasExtra) },
        { label: 'Horas fichada GPS', valor: formatHoras(t.horasGps) },
        { label: 'Diferencia neta (GPS − registro)', valor: formatDiferencia(t.diferenciaNeta), destacado: Math.abs(t.diferenciaNeta) > TOLERANCIA_HORAS },
        { label: `Horas ajustadas (${t.ajustes} ${t.ajustes === 1 ? 'ajuste' : 'ajustes'})`, valor: formatHoras(t.horasAjustadas) },
        { label: 'Horas finales', valor: formatHoras(t.horasFinales) },
    ];
    const conteos = `Con diferencia: ${t.filasConDiferencia} · Sin fichada: ${t.sinGps} · Sin registro: ${t.sinRegistro} · Fichada sin cierre: ${t.gpsAbiertas}`;
    return (
        <div className="space-y-1.5">
            <div className={`grid ${compacto ? 'grid-cols-6' : 'grid-cols-3 sm:grid-cols-6'} border border-slate-300 dark:border-slate-600 divide-x divide-slate-300 dark:divide-slate-600`}>
                {items.map(i => (
                    <div key={i.label} className={`px-2.5 py-2 ${i.destacado ? MARCA : ''}`}>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-tight">{i.label}</p>
                        <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-50 mt-0.5">{i.valor}</p>
                    </div>
                ))}
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-300">{conteos}</p>
        </div>
    );
}

function Titulo({ children }: { children: React.ReactNode }) {
    return <h3 className="text-xs font-semibold uppercase text-slate-900 dark:text-slate-50">{children}</h3>;
}

function Dato({ label, valor }: { label: string; valor: string }) {
    return (
        <div className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2">
            <p className="text-[11px] text-slate-600 dark:text-slate-300">{label}</p>
            <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-50 truncate">{valor}</p>
        </div>
    );
}

function Firma({ label }: { label: string }) {
    return (
        <div className="text-center">
            <div className="border-t border-slate-500 pt-1.5">{label}</div>
            <div className="mt-0.5">Firma y aclaración</div>
        </div>
    );
}
