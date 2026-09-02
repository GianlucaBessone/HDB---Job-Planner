'use client';

import React, { useState, useEffect } from 'react';
import ModuleHeader from '@/components/ModuleHeader';
import { 
    ShieldCheck, 
    Clock, 
    AlertTriangle, 
    CheckCircle2, 
    Plus, 
    Fingerprint, 
    RefreshCw, 
    Package, 
    Calendar,
    Send,
    Loader2,
    CheckSquare,
    Square
} from 'lucide-react';
import { showToast } from '@/components/Toast';
import { safeApiRequest } from '@/lib/offline';
import { getMyEppData, signEppDelivery } from './actions';
import EppRequestModal from '@/components/epp/EppRequestModal';
import SignatureDetailModal from '@/components/SignatureDetailModal';

export default function MisEppPage() {
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [deviceId, setDeviceId] = useState<string>('UNKNOWN_DEVICE');
    const [loading, setLoading] = useState(true);

    const [pendingDeliveries, setPendingDeliveries] = useState<any[]>([]);
    const [assignedItems, setAssignedItems] = useState<any[]>([]);
    const [signedDeliveries, setSignedDeliveries] = useState<any[]>([]);
    const [requests, setRequests] = useState<any[]>([]);
    const [catalog, setCatalog] = useState<any[]>([]);

    // Items seleccionados para cada entrega pendiente: { [deliveryId]: string[] }
    const [selectedItemsByDelivery, setSelectedItemsByDelivery] = useState<Record<string, string[]>>({});
    const [signingDeliveryId, setSigningDeliveryId] = useState<string | null>(null);

    // Modal de solicitud
    const [requestModalOpen, setRequestModalOpen] = useState(false);
    const [preselectedEppId, setPreselectedEppId] = useState<string | undefined>(undefined);

    // Modal de firma
    const [selectedSignatureId, setSelectedSignatureId] = useState<string | null>(null);

    // Lista de operadores para cambio rápido si se está probando como admin
    const [availableOperators, setAvailableOperators] = useState<any[]>([]);

    useEffect(() => {
        // Cargar dispositivo y usuario de sesión
        const storedDevice = localStorage.getItem('deviceId');
        if (storedDevice) {
            setDeviceId(storedDevice);
        } else {
            const newDev = 'DEV-' + Math.random().toString(36).substring(2, 10).toUpperCase();
            localStorage.setItem('deviceId', newDev);
            setDeviceId(newDev);
        }

        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            try {
                const parsed = JSON.parse(storedUser);
                setCurrentUser(parsed);
                loadData(parsed.id);
            } catch (e) {
                setLoading(false);
            }
        } else {
            // Cargar lista de operadores para que el usuario pueda seleccionar su perfil si no está logueado
            fetchOperators();
        }
    }, []);

    const fetchOperators = async () => {
        try {
            const res = await fetch('/api/operators');
            const ops = await res.json();
            if (Array.isArray(ops) && ops.length > 0) {
                setAvailableOperators(ops);
                // Si no hay usuario, preseleccionar el primero
                setCurrentUser(ops[0]);
                localStorage.setItem('currentUser', JSON.stringify(ops[0]));
                loadData(ops[0].id);
            }
        } catch (e) {
            setLoading(false);
        }
    };

    const loadData = async (operatorId: string) => {
        setLoading(true);
        try {
            const res = await getMyEppData(operatorId);
            if (res.success && res.data) {
                setPendingDeliveries(res.data.pendingDeliveries || []);
                setAssignedItems(res.data.assignedItems || []);
                setSignedDeliveries(res.data.signedDeliveries || []);
                setRequests(res.data.requests || []);
                setCatalog(res.data.catalog || []);

                // Inicializar todos los items marcados por defecto en entregas pendientes
                const initMap: Record<string, string[]> = {};
                (res.data.pendingDeliveries || []).forEach((del: any) => {
                    initMap[del.id] = (del.items || []).map((it: any) => it.id);
                });
                setSelectedItemsByDelivery(initMap);
            }
        } catch (err) {
            console.error('Error cargando Mis EPP:', err);
        } finally {
            setLoading(false);
        }
    };

    const toggleItemSelection = (deliveryId: string, itemId: string) => {
        setSelectedItemsByDelivery(prev => {
            const current = prev[deliveryId] || [];
            const isSelected = current.includes(itemId);
            const updated = isSelected 
                ? current.filter(id => id !== itemId) 
                : [...current, itemId];
            return { ...prev, [deliveryId]: updated };
        });
    };

    const handleSignDelivery = async (delivery: any) => {
        if (!currentUser) {
            showToast('Debe iniciar sesión para firmar la entrega', 'error');
            return;
        }

        const confirmedItems = selectedItemsByDelivery[delivery.id] || [];
        if (confirmedItems.length === 0) {
            showToast('Debe seleccionar al menos un ítem entregado para firmar', 'error');
            return;
        }

        const userDni = currentUser.dni || '00000000';

        setSigningDeliveryId(delivery.id);
        try {
            // 1. Invocar el endpoint estándar de firma digital con checksum
            const signRes = await safeApiRequest('/api/signatures/sign', {
                method: 'POST',
                body: JSON.stringify({
                    documentId: delivery.id,
                    documentVersion: '1.0',
                    userId: currentUser.id,
                    userName: currentUser.nombreCompleto,
                    dni: userDni,
                    deviceId: deviceId
                })
            });

            if (!signRes.ok) {
                const errData = await signRes.json();
                throw new Error(errData.error || 'Error al generar firma criptográfica');
            }

            const signatureAudit = await signRes.json();

            // 2. Confirmar entrega y actualizar items
            const result = await signEppDelivery({
                deliveryId: delivery.id,
                operatorId: currentUser.id,
                itemIdsConfirmed: confirmedItems,
                signatureId: signatureAudit.SignatureID,
                signatureHash: signatureAudit.HashSignature
            });

            if (result.success) {
                showToast('¡Entrega firmada electrónicamente con checksum oficial!', 'success');
                loadData(currentUser.id);
            } else {
                showToast(result.error || 'Error al actualizar acta de entrega', 'error');
            }
        } catch (err: any) {
            showToast(err.message || 'Error durante la firma', 'error');
        } finally {
            setSigningDeliveryId(null);
        }
    };

    const handleSwitchOperator = (opId: string) => {
        const found = availableOperators.find(o => o.id === opId);
        if (found) {
            setCurrentUser(found);
            localStorage.setItem('currentUser', JSON.stringify(found));
            loadData(found.id);
            showToast(`Viendo como: ${found.nombreCompleto}`, 'info');
        }
    };

    return (
        <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 animate-in fade-in duration-300">
            {/* Header del Módulo */}
            <ModuleHeader
                title="Mis Elementos de Protección Personal"
                description="Listado de tus EPP asignados, firmas de entregas pendientes y solicitudes de recambio"
                icon={<ShieldCheck className="w-6 h-6 text-emerald-600" />}
                actions={[
                    {
                        id: 'refresh',
                        label: 'Actualizar',
                        icon: <RefreshCw className="w-4 h-4" />,
                        variant: 'outline',
                        onClick: () => currentUser && loadData(currentUser.id)
                    },
                    {
                        id: 'request',
                        label: 'Solicitar EPP',
                        icon: <Plus className="w-4 h-4" />,
                        variant: 'primary',
                        onClick: () => {
                            setPreselectedEppId(undefined);
                            setRequestModalOpen(true);
                        }
                    }
                ]}
            />

            {/* Selector de perfil si hay varios operadores (útil en dev / pruebas) */}
            {availableOperators.length > 1 && (
                <div className="p-3 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                    <span className="text-slate-500 font-medium">
                        Operador activo: <strong className="text-slate-800 dark:text-slate-200">{currentUser?.nombreCompleto}</strong> (DNI: {currentUser?.dni || 'S/D'})
                    </span>

                    <select
                        value={currentUser?.id || ''}
                        onChange={(e) => handleSwitchOperator(e.target.value)}
                        className="w-full sm:w-auto px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200"
                    >
                        {availableOperators.map(op => (
                            <option key={op.id} value={op.id}>
                                {op.nombreCompleto}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {/* SECCIÓN 1: ENTREGAS PENDIENTES DE FIRMA (ATENCIÓN INMEDIATA) */}
            {pendingDeliveries.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-sm font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Entregas Pendientes de Firma ({pendingDeliveries.length})
                    </h2>

                    <div className="space-y-4">
                        {pendingDeliveries.map(del => {
                            const selectedItems = selectedItemsByDelivery[del.id] || [];
                            const isSigningThis = signingDeliveryId === del.id;

                            return (
                                <div
                                    key={del.id}
                                    className="bg-gradient-to-br from-amber-500/10 via-white to-emerald-500/10 dark:from-amber-950/30 dark:via-slate-900 dark:to-emerald-950/20 border-2 border-amber-500/40 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-md space-y-4"
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-500/20 pb-3">
                                        <div>
                                            <span className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 text-xs font-black uppercase tracking-wider inline-block mb-1">
                                                Acta de Entrega: {del.codigoActa}
                                            </span>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                Despachado por: <strong className="text-slate-700 dark:text-slate-300">{del.entregadoPor || 'Supervisor'}</strong> · Fecha: {new Date(del.fechaEntrega).toLocaleDateString()}
                                            </p>
                                        </div>

                                        <div className="text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-3 py-1 rounded-xl w-fit">
                                            {selectedItems.length} de {del.items?.length} confirmados
                                        </div>
                                    </div>

                                    {/* Lista de Items con Checkboxes */}
                                    <div className="space-y-2">
                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                            Marca con el check cada elemento que efectivamente recibiste físicamente:
                                        </p>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                            {del.items?.map((item: any) => {
                                                const isChecked = selectedItems.includes(item.id);

                                                return (
                                                    <div
                                                        key={item.id}
                                                        onClick={() => toggleItemSelection(del.id, item.id)}
                                                        className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between active:scale-[0.99] select-none ${
                                                            isChecked
                                                                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/60 ring-2 ring-emerald-500/20'
                                                                : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 opacity-70'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="text-emerald-600 flex-shrink-0">
                                                                {isChecked ? (
                                                                    <CheckSquare className="w-5 h-5" />
                                                                ) : (
                                                                    <Square className="w-5 h-5 text-slate-400" />
                                                                )}
                                                            </div>
                                                            <div>
                                                                <span className="font-black text-xs text-slate-900 dark:text-slate-100 block">
                                                                    {item.cantidad}x {item.eppItem?.nombre}
                                                                </span>
                                                                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                                                                    {item.eppItem?.categoria} {item.talle ? `· Talle ${item.talle}` : ''} · Vigencia: {item.diasValidez || 365} días
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 ml-2 flex-shrink-0">
                                                            {isChecked ? 'Recibido' : 'No marcado'}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Declaración y Botón de Firma Estándar */}
                                    <div className="pt-3 border-t border-amber-500/20 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                                        <div className="flex items-start sm:items-center gap-2 text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 max-w-lg">
                                            <Fingerprint className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5 sm:mt-0" />
                                            <span>
                                                Al firmar, se generará un <strong>checksum criptográfico (HMAC-SHA256)</strong> con tu usuario ({currentUser?.nombreCompleto}), fecha UTC y dispositivo, con valor legal y de auditoría ISO.
                                            </span>
                                        </div>

                                        <button
                                            onClick={() => handleSignDelivery(del)}
                                            disabled={isSigningThis || selectedItems.length === 0}
                                            className="w-full sm:w-auto px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-2xl text-xs sm:text-sm font-black transition-all shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 min-h-[46px]"
                                        >
                                            {isSigningThis ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    <span>Firmando electrónicamente...</span>
                                                </>
                                            ) : (
                                                <span>
                                                    Firmar Entrega ({selectedItems.length} {selectedItems.length === 1 ? 'ítem' : 'ítems'})
                                                </span>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* SECCIÓN 2: MIS EPP ASIGNADOS */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-emerald-600" />
                            Mis Elementos de Protección Activos ({assignedItems.length})
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Equipamiento entregado y estado de vigencia actual
                        </p>
                    </div>

                    <button
                        onClick={() => {
                            setPreselectedEppId(undefined);
                            setRequestModalOpen(true);
                        }}
                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-bold flex items-center gap-1"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Pedir nuevo elemento
                    </button>
                </div>

                {loading ? (
                    <div className="py-16 text-center text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                        <span className="text-xs">Cargando tus elementos de EPP...</span>
                    </div>
                ) : assignedItems.length === 0 ? (
                    <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-slate-400 space-y-3">
                        <Package className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700" />
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                            Aún no tienes elementos de EPP asignados
                        </h3>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto">
                            Cuando Recursos Humanos o Pañol registre una entrega para ti, podrás verla aquí y firmarla con tu usuario.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {assignedItems.map(item => {
                            const isVigente = item.estadoVigencia === 'VIGENTE';
                            const isPorVencer = item.estadoVigencia === 'POR_VENCER';
                            const isVencido = item.estadoVigencia === 'VENCIDO';

                            return (
                                <div
                                    key={item.id}
                                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs flex flex-col justify-between space-y-4 relative overflow-hidden"
                                >
                                    <div className="space-y-3">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-2.5">
                                                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 rounded-xl">
                                                    <ShieldCheck className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-sm text-slate-900 dark:text-slate-100">
                                                        {item.eppItem?.nombre}
                                                    </h4>
                                                    <span className="text-[11px] text-slate-400">
                                                        {item.eppItem?.categoria} {item.talle ? `· Talle ${item.talle}` : ''}
                                                    </span>
                                                </div>
                                            </div>

                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                                                isVigente
                                                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                                    : isPorVencer
                                                    ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                                                    : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                                            }`}>
                                                {isVigente ? 'Vigente' : isPorVencer ? 'Por Vencer' : 'Vencido'}
                                            </span>
                                        </div>

                                        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl space-y-1.5 text-xs">
                                            <div className="flex items-center justify-between text-slate-500">
                                                <span>Fecha de Entrega:</span>
                                                <strong className="text-slate-800 dark:text-slate-200">
                                                    {new Date(item.fechaEntrega).toLocaleDateString()}
                                                </strong>
                                            </div>

                                            <div className="flex items-center justify-between text-slate-500">
                                                <span>Fecha de Vencimiento:</span>
                                                <strong className={`${isVencido ? 'text-rose-600 font-black' : 'text-slate-800 dark:text-slate-200'}`}>
                                                    {new Date(item.fechaVencimiento).toLocaleDateString()}
                                                </strong>
                                            </div>

                                            <div className="flex items-center justify-between text-slate-500 pt-1 border-t border-slate-200/60 dark:border-slate-700">
                                                <span>Días Restantes:</span>
                                                <span className={`font-black ${
                                                    isVigente ? 'text-emerald-600' : isPorVencer ? 'text-amber-600' : 'text-rose-600'
                                                }`}>
                                                    {isVencido ? `Venció hace ${Math.abs(item.diasRestantes)}d` : `${item.diasRestantes} días`}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                                        {item.signatureId ? (
                                            <button
                                                onClick={() => setSelectedSignatureId(item.signatureId)}
                                                className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold flex items-center gap-1"
                                            >
                                                <Fingerprint className="w-3.5 h-3.5" />
                                                Ver Firma (Checksum)
                                            </button>
                                        ) : (
                                            <span className="text-[11px] text-slate-400">Acta: {item.deliveryCode}</span>
                                        )}

                                        {(isPorVencer || isVencido) && (
                                            <button
                                                onClick={() => {
                                                    setPreselectedEppId(item.eppItemId);
                                                    setRequestModalOpen(true);
                                                }}
                                                className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 hover:bg-amber-100 rounded-lg font-bold text-[11px] transition-all"
                                            >
                                                Pedir Recambio
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* SECCIÓN 3: SOLICITUDES EN CURSO */}
            {requests.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-2">
                        <Package className="w-4 h-4 text-indigo-500" />
                        Tus Solicitudes de EPP ({requests.length})
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {requests.map(req => (
                            <div
                                key={req.id}
                                className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between text-xs shadow-xs"
                            >
                                <div>
                                    <span className="font-bold text-slate-900 dark:text-slate-100 block">
                                        {req.eppItem?.nombre}
                                    </span>
                                    <span className="text-slate-400 text-[11px] block mt-0.5">
                                        Motivo: {req.motivo} {req.comentario ? `· "${req.comentario}"` : ''}
                                    </span>
                                </div>

                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                                    req.estado === 'PENDIENTE'
                                        ? 'bg-amber-100 text-amber-700'
                                        : req.estado === 'APROBADA'
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-rose-100 text-rose-700'
                                }`}>
                                    {req.estado}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Modal de Solicitud de EPP */}
            {currentUser && (
                <EppRequestModal
                    isOpen={requestModalOpen}
                    onClose={() => setRequestModalOpen(false)}
                    operatorId={currentUser.id}
                    catalog={catalog}
                    preselectedEppId={preselectedEppId}
                    onRequestCreated={() => loadData(currentUser.id)}
                />
            )}

            {/* Modal de Detalle de Firma con Checksum */}
            {selectedSignatureId && (
                <SignatureDetailModal
                    isOpen={Boolean(selectedSignatureId)}
                    onClose={() => setSelectedSignatureId(null)}
                    signatureId={selectedSignatureId}
                />
            )}
        </div>
    );
}
