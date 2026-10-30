'use client';

import { useState } from 'react';
import { Bot, Copy, ExternalLink, GitBranch, Loader2, ShieldOff, Terminal } from 'lucide-react';
import { showToast } from '@/components/Toast';

const ESTADOS_FINALES = ['resuelto', 'cerrado', 'rechazado', 'duplicado'];

// Delegar el ticket a un agente externo (Claude Code, OpenCode, Cursor, etc.):
// genera un token solo para este ticket y arma el texto para pegarle al agente.
export default function AgentePanel({ ticket, canManage }: { ticket: any; canManage: boolean }) {
    const [generando, setGenerando] = useState(false);
    const [prompt, setPrompt] = useState<string | null>(null);

    const copiar = async (texto: string) => {
        try {
            await navigator.clipboard.writeText(texto);
            showToast('Copiado. Pegalo en el agente que tenga acceso al repositorio.', 'success');
        } catch {
            showToast('No se pudo copiar automáticamente: copialo desde el recuadro.', 'info');
        }
    };

    const generar = async () => {
        setGenerando(true);
        try {
            const res = await fetch(`/api/tickets/${ticket.id}/agente-token`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'No se pudo generar el acceso.');
            setPrompt(data.prompt);
            await copiar(data.prompt);
        } catch (err: any) {
            showToast(err.message || 'No se pudo generar el acceso.', 'error');
        } finally {
            setGenerando(false);
        }
    };

    const revocar = async () => {
        try {
            const res = await fetch(`/api/tickets/${ticket.id}/agente-token`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'No se pudo revocar.');
            setPrompt(null);
            showToast(data.revocados ? 'Acceso del agente revocado.' : 'No había accesos activos.', 'success');
        } catch (err: any) {
            showToast(err.message || 'No se pudo revocar.', 'error');
        }
    };

    const tieneTrabajo = ticket.rama || ticket.commitHash || ticket.prUrl;
    if (!canManage && !tieneTrabajo) return null;

    return (
        <section className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5" /> Corrección con agente
            </h3>

            {tieneTrabajo && (
                <div className="flex flex-wrap gap-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {ticket.prUrl && (
                        <a href={ticket.prUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline">
                            <ExternalLink className="w-3.5 h-3.5" /> Ver PR
                        </a>
                    )}
                    {ticket.rama && <span className="inline-flex items-center gap-1"><GitBranch className="w-3.5 h-3.5" /> {ticket.rama}</span>}
                    {ticket.commitHash && <span className="inline-flex items-center gap-1"><Terminal className="w-3.5 h-3.5" /> {ticket.commitHash}</span>}
                </div>
            )}

            {canManage && !ESTADOS_FINALES.includes(ticket.estado) && (
                <>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        Genera un acceso de 48 h solo para este ticket y copia las instrucciones para pegarlas en cualquier agente con acceso al repositorio.
                        El agente propone la solución en una rama y deja el ticket en revisión; resolverlo sigue siendo tuyo.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={generar}
                            disabled={generando}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                        >
                            {generando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
                            {prompt ? 'Generar acceso nuevo' : 'Copiar para agente'}
                        </button>
                        <button
                            onClick={revocar}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            <ShieldOff className="w-3.5 h-3.5" /> Revocar acceso
                        </button>
                    </div>

                    {prompt && (
                        <div className="relative">
                            <pre className="text-[11px] font-mono text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-all bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3 pr-10">
                                {prompt}
                            </pre>
                            <button
                                onClick={() => copiar(prompt)}
                                className="absolute top-2 right-2 p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400"
                                title="Copiar"
                            >
                                <Copy className="w-3.5 h-3.5" />
                            </button>
                            <p className="mt-1 text-[10px] text-slate-400 font-medium">
                                El token se muestra una sola vez. Generar uno nuevo invalida el anterior.
                            </p>
                        </div>
                    )}
                </>
            )}
        </section>
    );
}
