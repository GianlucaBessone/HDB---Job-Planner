'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, Search, Filter, Fingerprint, RefreshCcw, Eye, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import SignatureDetailModal from '@/components/SignatureDetailModal';
import HelpContextual from '@/components/HelpContextual';
import { safeApiRequest } from '@/lib/offline';
import { showToast } from '@/components/Toast';
import { useViewState } from '@/lib/hooks/useViewState';
import { useCommandStore } from '@/lib/store/useCommandStore';
import { useRef } from 'react';

export default function VerificacionFirmasPage() {
    const [signatures, setSignatures] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const [filters, setFilters] = useViewState('verificacion-firmas-filters', {
        searchTerm: '',
        statusFilter: 'ALL'
    });
    const { searchTerm, statusFilter } = filters;
    const setSearchTerm = (val: string) => setFilters({ searchTerm: val });
    const setStatusFilter = (val: typeof statusFilter) => setFilters({ statusFilter: val });

    const [selectedSignature, setSelectedSignature] = useState<any | null>(null);
    const [isVerifying, setIsVerifying] = useState<string | null>(null);
    const [currentUser, setCurrentUser] = useState<any>(null);

    useEffect(() => {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            try {
                setCurrentUser(JSON.parse(stored));
            } catch (e) { }
        }
        loadSignatures();
    }, []);

    const loadSignatures = async () => {
        setIsLoading(true);
        try {
            const res = await safeApiRequest('/api/signatures/verify');
            if (res.ok) {
                const data = await res.json();
                setSignatures(data);
            }
        } catch (e) {
            console.error('Failed to load signatures', e);
        } finally {
            setIsLoading(false);
        }
    };

    const registerCommand = useCommandStore((state) => state.registerCommand);
    const unregisterCommand = useCommandStore((state) => state.unregisterCommand);
    const latestActions = useRef({ loadSignatures });
    
    useEffect(() => {
        latestActions.current = { loadSignatures };
    });

    useEffect(() => {
        registerCommand({
            id: 'firmas-refresh',
            label: 'Actualizar Firmas',
            category: 'Contextual',
            keys: ['r'],
            action: () => latestActions.current.loadSignatures()
        });
        return () => unregisterCommand('firmas-refresh');
    }, [registerCommand, unregisterCommand]);

    const verifyIntegrity = async (id: string) => {
        setIsVerifying(id);
        try {
            const res = await safeApiRequest(`/api/signatures/verify/${id}`, {
                method: 'POST',
                body: JSON.stringify({ verifiedBy: currentUser?.id })
            });

            if (res.ok) {
                const data = await res.json();
                // Update in state
                setSignatures(prev => prev.map(sig => sig.SignatureID === id ? data : sig));
                
                if (data.ValidationResult === 'VALIDA') {
                    showToast('Firma válida e íntegra', 'success');
                } else {
                    showToast('Alerta: Datos modificados o firma inválida', 'error');
                }
                
                // Show modal with recalculation details
                setSelectedSignature(data);
            } else {
                showToast('Error al verificar firma', 'error');
            }
        } catch (e) {
            showToast('Error de red al verificar firma', 'error');
        } finally {
            setIsVerifying(null);
        }
    };

    const getStatusBadge = (status: string) => {
        if (status === 'VALIDA') {
            return (
                <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg text-xs font-bold uppercase tracking-wider border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Firma Íntegra
                </span>
            );
        }
        if (status === 'DATOS MODIFICADOS') {
            return (
                <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-lg text-xs font-bold uppercase tracking-wider border border-amber-200 dark:border-amber-800">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Datos Modificados
                </span>
            );
        }
        return (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 rounded-lg text-xs font-bold uppercase tracking-wider border border-rose-200 dark:border-rose-800">
                <XCircle className="w-3.5 h-3.5" />
                Posible Alteración
            </span>
        );
    };

    const normalize = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

    const filteredSignatures = signatures.filter(sig => {
        const matchesSearch = normalize(sig.DocumentCode || '').includes(normalize(searchTerm)) ||
                              normalize(sig.DocumentID).includes(normalize(searchTerm)) || 
                              normalize(sig.UserName).includes(normalize(searchTerm)) ||
                              normalize(sig.DNI).includes(normalize(searchTerm)) ||
                              normalize(sig.SignatureID).includes(normalize(searchTerm));
        const matchesStatus = statusFilter === 'ALL' || sig.VerificationStatus === statusFilter;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div className="space-y-1">
                    <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight flex items-center gap-2 md:gap-3">
                        <Fingerprint className="w-6 h-6 md:w-8 md:h-8 text-blue-600" />
                        Verificación de Firmas
                        <HelpContextual slug="verificacion-firmas" />
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium hidden md:block">
                        Trazabilidad, integridad y auditabilidad (ISO 9001)
                    </p>
                </div>
            </div>

            <div className="bg-card text-card-foreground p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col lg:flex-row gap-4 relative z-20">
                <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Buscar por Doc, Usuario, DNI o ID..."
                        className="w-full h-[42px] bg-background text-foreground/50 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-slate-700 dark:text-slate-200 text-sm"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="flex bg-muted text-muted-foreground/50 p-1.5 rounded-2xl shrink-0 overflow-x-auto custom-scrollbar">
                        <button
                            onClick={() => setStatusFilter('ALL')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${statusFilter === 'ALL' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
                        >
                            Todas
                        </button>
                        <button
                            onClick={() => setStatusFilter('VALIDA')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${statusFilter === 'VALIDA' ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
                        >
                            Válidas
                        </button>
                        <button
                            onClick={() => setStatusFilter('INVALIDA')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${statusFilter === 'INVALIDA' ? 'bg-white dark:bg-slate-700 shadow-sm text-rose-600 dark:text-rose-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
                        >
                            Inválidas
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-card text-card-foreground rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden relative z-10">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                <th className="px-6 py-4 font-black">FirmaID / Fecha</th>
                                <th className="px-6 py-4 font-black">Documento</th>
                                <th className="px-6 py-4 font-black">Usuario / DNI</th>
                                <th className="px-6 py-4 font-black">Dispositivo</th>
                                <th className="px-6 py-4 font-black">Estado</th>
                                <th className="px-6 py-4 font-black text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-sm">
                            {isLoading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="px-6 py-4"><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24 mb-2"></div><div className="h-3 bg-muted text-muted-foreground rounded w-32"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-20"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-32 mb-2"></div><div className="h-3 bg-muted text-muted-foreground rounded w-20"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24"></div></td>
                                        <td className="px-6 py-4"><div className="h-6 bg-slate-200 dark:bg-slate-700 rounded-full w-24"></div></td>
                                        <td className="px-6 py-4 text-right"><div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-24 inline-block"></div></td>
                                    </tr>
                                ))
                            ) : filteredSignatures.length > 0 ? (
                                filteredSignatures.map((sig) => (
                                    <tr key={sig.SignatureID} className="group hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300 bg-muted text-muted-foreground inline-block px-2 py-0.5 rounded-md mb-1 border border-slate-200 dark:border-slate-700">
                                                {sig.SignatureID.split('-')[1]}-{sig.SignatureID.split('-')[2]}...
                                            </div>
                                            <div className="text-xs text-slate-500 font-medium">
                                                {new Date(sig.SignedAtUTC).toLocaleString()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-800 dark:text-slate-200">
                                                {sig.DocumentCode || sig.DocumentID} {sig.DocumentVersion}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-800 dark:text-slate-200">{sig.UserName}</div>
                                            <div className="text-xs text-slate-500">DNI: {sig.DNI}</div>
                                        </td>
                                        <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-400">
                                            {sig.DeviceID}
                                        </td>
                                        <td className="px-6 py-4">
                                            {getStatusBadge(sig.VerificationStatus)}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => setSelectedSignature(sig)}
                                                    className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl transition-colors"
                                                    title="Ver Detalle"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => verifyIntegrity(sig.SignatureID)}
                                                    disabled={isVerifying === sig.SignatureID}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-card text-card-foreground border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl hover:border-blue-300 hover:text-blue-600 dark:hover:border-blue-700 dark:hover:text-blue-400 transition-all disabled:opacity-50"
                                                >
                                                    <RefreshCcw className={`w-3.5 h-3.5 ${isVerifying === sig.SignatureID ? 'animate-spin' : ''}`} />
                                                    {isVerifying === sig.SignatureID ? 'Verificando...' : 'Verificar'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500">
                                        No se encontraron firmas que coincidan con la búsqueda.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <SignatureDetailModal
                isOpen={!!selectedSignature}
                onClose={() => setSelectedSignature(null)}
                signature={selectedSignature}
            />
        </div>
    );
}
