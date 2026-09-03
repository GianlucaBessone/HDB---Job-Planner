'use client';

import React, { useState, useEffect } from 'react';
import { 
    Share2, 
    Link as LinkIcon, 
    Check, 
    Copy, 
    ExternalLink, 
    QrCode, 
    Building2, 
    Users, 
    Trash2, 
    Loader2, 
    X,
    Clock,
    Eye,
    ShieldCheck
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { showToast } from '@/components/Toast';
import ConfirmModal from '@/components/ConfirmModal';
import { 
    getClientsForEppShare, 
    createEppPublicShare, 
    getEppPublicShares, 
    deleteEppPublicShare 
} from '@/app/rrhh/personal/epp/actions';

interface EppShareModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function EppShareModal({ isOpen, onClose }: EppShareModalProps) {
    const [clients, setClients] = useState<any[]>([]);
    const [shares, setShares] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);

    // Formulario de nuevo enlace
    const [shareType, setShareType] = useState<'GENERAL' | 'CLIENTE'>('GENERAL');
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [customTitle, setCustomTitle] = useState<string>('');

    // Enlace recién creado / seleccionado para mostrar QR y copiar
    const [activeShare, setActiveShare] = useState<any | null>(null);
    const [copied, setCopied] = useState(false);

    // Diálogo nativo de confirmación para revocar enlace
    const [shareToDeleteId, setShareToDeleteId] = useState<string | null>(null);

    const [origin, setOrigin] = useState('');

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setOrigin(window.location.origin);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            loadInitialData();
        }
    }, [isOpen]);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            const [clientsRes, sharesRes] = await Promise.all([
                getClientsForEppShare(),
                getEppPublicShares()
            ]);

            if (clientsRes.success) setClients(clientsRes.data || []);
            if (sharesRes.success) {
                const list = sharesRes.data || [];
                setShares(list);
                if (list.length > 0 && !activeShare) {
                    setActiveShare(list[0]);
                }
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCreateShare = async (e: React.FormEvent) => {
        e.preventDefault();

        if (shareType === 'CLIENTE' && !selectedClientId) {
            showToast('Seleccione un cliente para filtrar la matriz', 'error');
            return;
        }

        let supervisorName = 'Administrador de RRHH';
        try {
            const stored = localStorage.getItem('currentUser');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.nombreCompleto) supervisorName = parsed.nombreCompleto;
            }
        } catch (_) {}

        setCreating(true);
        try {
            const res = await createEppPublicShare({
                tipo: shareType,
                clientId: shareType === 'CLIENTE' ? selectedClientId : undefined,
                titulo: customTitle.trim() || undefined,
                creadoPor: supervisorName
            });

            if (res.success && res.data) {
                showToast('Enlace de matriz generado con éxito', 'success');
                setActiveShare(res.data);
                setCustomTitle('');
                // Recargar lista
                const updated = await getEppPublicShares();
                if (updated.success) setShares(updated.data || []);
            } else {
                showToast(res.error || 'Error al generar enlace', 'error');
            }
        } catch (err: any) {
            showToast(err.message || 'Error de conexión', 'error');
        } finally {
            setCreating(false);
        }
    };

    const confirmDeleteShare = async (id: string) => {
        try {
            const res = await deleteEppPublicShare(id);
            if (res.success) {
                showToast('Enlace revocado y eliminado con éxito', 'info');
                const updated = shares.filter(s => s.id !== id);
                setShares(updated);
                if (activeShare?.id === id) {
                    setActiveShare(updated[0] || null);
                }
            } else {
                showToast(res.error || 'Error al eliminar', 'error');
            }
        } catch (e: any) {
            showToast(e.message, 'error');
        } finally {
            setShareToDeleteId(null);
        }
    };

    const getShareUrl = (token: string) => {
        return `${origin}/public/epp-matriz/${token}`;
    };

    const handleCopy = (url: string) => {
        navigator.clipboard.writeText(url);
        setCopied(true);
        showToast('Enlace copiado al portapapeles', 'success');
        setTimeout(() => setCopied(false), 2500);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl my-8">
                {/* Cabecera */}
                <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/75 dark:bg-slate-950/40">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 rounded-2xl">
                            <Share2 className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-black text-slate-900 dark:text-slate-100 text-base">
                                Compartir Matriz de Asignación de EPP
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Genera enlaces públicos seguros y actualizados en tiempo real para clientes o auditorías
                            </p>
                        </div>
                    </div>

                    <button 
                        onClick={onClose} 
                        className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 sm:p-6 space-y-6 max-h-[80vh] overflow-y-auto text-xs">
                    {/* Formulario de creación de enlace */}
                    <form onSubmit={handleCreateShare} className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 space-y-4">
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <LinkIcon className="w-4 h-4 text-indigo-500" />
                            Configurar Nuevo Enlace Compartido
                        </h4>

                        {/* Tipo de enlace */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div
                                onClick={() => setShareType('GENERAL')}
                                className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 select-none ${
                                    shareType === 'GENERAL'
                                        ? 'bg-white dark:bg-slate-900 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                                        : 'bg-slate-100/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 opacity-70'
                                }`}
                            >
                                <Users className={`w-5 h-5 mt-0.5 ${shareType === 'GENERAL' ? 'text-indigo-600' : 'text-slate-400'}`} />
                                <div>
                                    <span className="font-bold text-slate-900 dark:text-slate-100 block">
                                        Matriz Completa
                                    </span>
                                    <span className="text-[11px] text-slate-500 block leading-tight mt-0.5">
                                        Muestra a todos los operadores activos de la empresa.
                                    </span>
                                </div>
                            </div>

                            <div
                                onClick={() => setShareType('CLIENTE')}
                                className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 select-none ${
                                    shareType === 'CLIENTE'
                                        ? 'bg-white dark:bg-slate-900 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                                        : 'bg-slate-100/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 opacity-70'
                                }`}
                            >
                                <Building2 className={`w-5 h-5 mt-0.5 ${shareType === 'CLIENTE' ? 'text-indigo-600' : 'text-slate-400'}`} />
                                <div>
                                    <span className="font-bold text-slate-900 dark:text-slate-100 block">
                                        Filtrar por Cliente
                                    </span>
                                    <span className="text-[11px] text-slate-500 block leading-tight mt-0.5">
                                        Solo operarios con horas en proyectos de este cliente los últimos 3 meses.
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Selección de cliente si corresponde */}
                        {shareType === 'CLIENTE' && (
                            <div className="space-y-1.5 animate-in fade-in">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                                    Cliente a Compartir *
                                </label>
                                <select
                                    required
                                    value={selectedClientId}
                                    onChange={(e) => setSelectedClientId(e.target.value)}
                                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100"
                                >
                                    <option value="">-- Seleccionar cliente activo --</option>
                                    {clients.map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.nombre}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-[11px] text-indigo-600 dark:text-indigo-400">
                                    ✓ Al abrir el enlace, el sistema calculará en tiempo real qué operarios activos trabajaron con este cliente en los últimos 90 días y sus vigencias de EPP.
                                </p>
                            </div>
                        )}

                        <div>
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                                Título del Enlace (Opcional)
                            </label>
                            <input
                                type="text"
                                value={customTitle}
                                onChange={(e) => setCustomTitle(e.target.value)}
                                placeholder={shareType === 'CLIENTE' ? 'Ej: Matriz EPP - Auditoría YPF Q3' : 'Ej: Matriz EPP General Operativa'}
                                className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100"
                            />
                        </div>

                        <div className="flex justify-end pt-1">
                            <button
                                type="submit"
                                disabled={creating}
                                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all"
                            >
                                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
                                Generar Enlace Compartido
                            </button>
                        </div>
                    </form>

                    {/* Vista de Enlace Activo Seleccionado */}
                    {activeShare && (
                        <div className="p-5 bg-gradient-to-br from-indigo-50/70 via-white to-emerald-50/50 dark:from-slate-800/80 dark:via-slate-900 dark:to-emerald-950/20 rounded-2xl border-2 border-indigo-400/40 space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 inline-block mb-1">
                                        {activeShare.tipo === 'CLIENTE' ? `Cliente: ${activeShare.clientNombre}` : 'Matriz Completa'}
                                    </span>
                                    <h4 className="font-black text-sm text-slate-900 dark:text-slate-100">
                                        {activeShare.titulo}
                                    </h4>
                                </div>

                                <div className="flex items-center gap-3 text-slate-500 text-[11px]">
                                    <span className="flex items-center gap-1">
                                        <Eye className="w-3.5 h-3.5" />
                                        {activeShare.visitas || 0} visitas
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5" />
                                        {new Date(activeShare.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>

                            {/* Campo de URL y botones */}
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">
                                    Enlace Público Directo:
                                </label>
                                <div className="flex flex-col sm:flex-row items-stretch gap-2">
                                    <input
                                        type="text"
                                        readOnly
                                        value={getShareUrl(activeShare.token)}
                                        className="flex-1 px-3.5 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-xs text-slate-700 dark:text-slate-300 select-all"
                                    />

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleCopy(getShareUrl(activeShare.token))}
                                            className="flex-1 sm:flex-none px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all"
                                        >
                                            {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                                            {copied ? '¡Copiado!' : 'Copiar'}
                                        </button>

                                        <a
                                            href={getShareUrl(activeShare.token)}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-300"
                                            title="Abrir en pestaña nueva"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                    </div>
                                </div>
                            </div>

                            {/* Código QR */}
                            <div className="p-4 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-4">
                                <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-xs flex-shrink-0">
                                    <QRCodeSVG 
                                        value={getShareUrl(activeShare.token)} 
                                        size={96}
                                        level="M"
                                    />
                                </div>
                                <div className="space-y-1 text-center sm:text-left">
                                    <span className="font-bold text-slate-900 dark:text-slate-100 block">
                                        Acceso Móvil Instantáneo con QR
                                    </span>
                                    <p className="text-[11px] text-slate-500">
                                        Puedes proyectar o imprimir este código para que inspectores de seguridad o el cliente accedan al legajo en tiempo real sin requerir contraseña.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Historial de Enlaces Activos */}
                    <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                        <h4 className="font-bold text-slate-800 dark:text-slate-200">
                            Enlaces Públicos Generados ({shares.length})
                        </h4>

                        {shares.length === 0 ? (
                            <p className="text-slate-400 py-4 text-center">
                                No has generado ningún enlace público de matriz todavía.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {shares.map(sh => {
                                    const isSelected = activeShare?.id === sh.id;
                                    return (
                                        <div
                                            key={sh.id}
                                            onClick={() => setActiveShare(sh)}
                                            className={`p-3 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                                                isSelected
                                                    ? 'bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-400/60'
                                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-xl ${
                                                    sh.tipo === 'CLIENTE' 
                                                        ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300' 
                                                        : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                                                }`}>
                                                    {sh.tipo === 'CLIENTE' ? <Building2 className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                                                </div>

                                                <div>
                                                    <span className="font-bold text-slate-900 dark:text-slate-100 block">
                                                        {sh.titulo}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400">
                                                        {sh.tipo === 'CLIENTE' ? `Cliente: ${sh.clientNombre}` : 'Todos los operadores'} · Creado el {new Date(sh.createdAt).toLocaleDateString()} · {sh.visitas || 0} visitas
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    onClick={() => handleCopy(getShareUrl(sh.token))}
                                                    title="Copiar enlace"
                                                    className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white rounded-lg text-slate-600 dark:text-slate-300 transition-all"
                                                >
                                                    <Copy className="w-3.5 h-3.5" />
                                                </button>

                                                <button
                                                    onClick={() => setShareToDeleteId(sh.id)}
                                                    title="Revocar enlace"
                                                    className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-rose-600 hover:text-white rounded-lg text-rose-500 transition-all"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-300 rounded-xl font-bold"
                    >
                        Cerrar
                    </button>
                </div>
            </div>

            {/* Ventana Nativa de Confirmación de la App */}
            <ConfirmModal
                isOpen={Boolean(shareToDeleteId)}
                onClose={() => setShareToDeleteId(null)}
                onConfirm={() => {
                    if (shareToDeleteId) confirmDeleteShare(shareToDeleteId);
                }}
                title="Revocar Enlace Público"
                message="¿Deseas revocar y eliminar este enlace público? Quienes tengan la URL o el código QR ya no podrán acceder a la matriz."
                confirmText="Revocar Enlace"
                cancelText="Cancelar"
                isDestructive={true}
            />
        </div>
    );
}
