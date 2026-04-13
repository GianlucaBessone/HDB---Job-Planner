'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, Search, ArrowLeft, CheckCircle2, AlertTriangle, Plus, ClipboardCheck, Wrench, X, RefreshCw, ScanLine, QrCode as QrCodeIcon } from 'lucide-react';
import { safeApiRequest } from '@/lib/offline';
import { showToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import SearchableSelect from '@/components/SearchableSelect';

interface Operator { id: string; nombreCompleto: string; }
interface Project { id: string; nombre: string; codigoProyecto?: string; }
interface CartItem { id: string; nombre: string; cantidad: number; presentAtOut?: boolean; presentAtIn?: boolean; isAdditional?: boolean; }
interface ToolCart { id: string; nombre: string; estado: string; items: CartItem[]; }
interface CartMovement { id: string; cart: ToolCart; project: Project; items: CartItem[]; fechaSalida: string; }

export default function ToolCartsOperatorPage() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<Operator | null>(null);
    const [activeMovements, setActiveMovements] = useState<CartMovement[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    
    // Scanner
    const [isScanning, setIsScanning] = useState(false);
    const [manualId, setManualId] = useState('');
    const scanHandledRef = useRef(false);

    // Context / Modals
    const [mode, setMode] = useState<'IDLE' | 'SCANNING' | 'CHECKOUT' | 'CHECKIN'>('IDLE');
    const [selectedCart, setSelectedCart] = useState<ToolCart | null>(null);
    const [selectedMovement, setSelectedMovement] = useState<CartMovement | null>(null);
    const [checklist, setChecklist] = useState<CartItem[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const [newToolName, setNewToolName] = useState('');
    const [newToolQty, setNewToolQty] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [isConfirmingCheckout, setIsConfirmingCheckout] = useState(false);
    const [isConfirmingCheckin, setIsConfirmingCheckin] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            const user = JSON.parse(stored);
            setCurrentUser(user);
            loadActiveMovements(user.id);
            loadProjects();
        } else {
            router.replace('/');
        }
    }, [router]);

    const loadActiveMovements = async (operatorId: string) => {
        try {
            const res = await safeApiRequest(`/api/carros/movements/active?operatorId=${operatorId}`);
            if (res.ok) setActiveMovements(await res.json());
        } catch (e) {
            console.error('Failed to load active movements');
        }
    };

    const loadProjects = async () => {
        try {
            const res = await safeApiRequest('/api/projects');
            if (res.ok) setProjects(await res.json());
        } catch (e) {
            console.error('Failed to load projects');
        }
    };

    const handleBack = () => {
        setMode('IDLE');
        setSelectedCart(null);
        setSelectedMovement(null);
        setChecklist([]);
        scanHandledRef.current = false;
    };

    const handleScanSuccess = async (text: string) => {
        if (scanHandledRef.current) return;
        scanHandledRef.current = true;
        
        setIsScanning(false);
        let cartId = text;
        if (text.startsWith('TOOLCART:')) {
            cartId = text.split(':')[1];
        }
        loadCartForCheckout(cartId);
    };

    const handleManualLookup = () => {
        if (!manualId.trim()) return;
        loadCartForCheckout(manualId.trim());
    };

    const loadCartForCheckout = async (id: string) => {
        setIsLoading(true);
        try {
            const res = await safeApiRequest(`/api/carros/${id}`);
            if (!res.ok) {
                showToast('Carro no encontrado o inválido', 'error');
                setMode('IDLE');
                return;
            }
            const cart: ToolCart = await res.json();
            if (cart.estado !== 'DISPONIBLE') {
                showToast(`El carro no está disponible (${cart.estado})`, 'error');
                setMode('IDLE');
                return;
            }
            setSelectedCart(cart);
            // Default: all unchecked
            setChecklist(cart.items.map(i => ({ ...i, presentAtOut: false })));
            setMode('CHECKOUT');
        } catch (e) {
            showToast('Error de conexión', 'error');
            setMode('IDLE');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddNewTool = () => {
        if (!newToolName.trim()) return;
        setChecklist(prev => [
            ...prev, 
            { id: `t_${Date.now()}`, nombre: newToolName.trim(), cantidad: newToolQty, presentAtOut: true, isAdditional: true }
        ]);
        setNewToolName('');
        setNewToolQty(1);
    };

    const toggleToolCheckout = (id: string) => {
        setChecklist(prev => prev.map(c => c.id === id ? { ...c, presentAtOut: !c.presentAtOut } : c));
    };

    const submitCheckout = async () => {
        if (!selectedProjectId) {
            showToast('Debe seleccionar un proyecto', 'error');
            return;
        }
        
        setIsConfirmingCheckout(false);
        setIsLoading(true);
        try {
            const res = await safeApiRequest('/api/carros/movements/out', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cartId: selectedCart!.id,
                    operatorId: currentUser!.id,
                    projectId: selectedProjectId,
                    tools: checklist
                })
            });

            if (!res.ok) {
                const data = await res.json();
                showToast(data.error || 'Fallo la salida', 'error');
                return;
            }
            
            showToast('Salida registrada con éxito', 'success');
            await loadActiveMovements(currentUser!.id);
            handleBack();
        } catch (e) {
            showToast('Error de conexión', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const startCheckin = (mov: CartMovement) => {
        setSelectedMovement(mov);
        setChecklist(mov.items.map(i => ({ ...i, presentAtIn: true })));
        setMode('CHECKIN');
    };

    const toggleToolCheckin = (id: string) => {
        setChecklist(prev => prev.map(c => c.id === id ? { ...c, presentAtIn: !c.presentAtIn } : c));
    };

    const submitCheckin = async () => {
        setIsConfirmingCheckin(false);
        setIsLoading(true);
        try {
            const res = await safeApiRequest('/api/carros/movements/in', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    movementId: selectedMovement!.id,
                    tools: checklist
                })
            });

            if (!res.ok) {
                const data = await res.json();
                showToast(data.error || 'Fallo la devolución', 'error');
                return;
            }
            
            showToast('Devolución registrada con éxito', 'success');
            await loadActiveMovements(currentUser!.id);
            handleBack();
        } catch (e) {
            showToast('Error de conexión', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const missingOut = checklist.filter(c => !c.presentAtOut);
    const missingIn = checklist.filter(c => !c.presentAtIn);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20">
            <div className="bg-primary px-4 py-4 shadow-lg sticky top-0 z-50">
                <div className="flex items-center gap-4 max-w-lg mx-auto w-full">
                    <button type="button" onClick={() => mode === 'IDLE' ? router.push('/') : handleBack()} className="text-white hover:bg-white/20 p-2 rounded-full transition-colors">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <h1 className="text-xl font-black text-white flex-1 tracking-tight">Carros de Herramientas</h1>
                </div>
            </div>

            <div className="max-w-lg mx-auto w-full p-4 space-y-6 mt-4">
                {mode === 'IDLE' && (
                    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                        {/* Escáner Card */}
                        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 text-center">
                            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4">
                                <ScanLine className="w-8 h-8" />
                            </div>
                            <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-2">Retirar un Carro</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 font-medium">Escanea el código QR del carro para registrar su salida.</p>
                            <button type="button" onClick={() => setIsScanning(true)} className="w-full py-3.5 bg-primary text-white rounded-2xl font-black text-sm hover:bg-primary/90 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-md">
                                <Camera className="w-5 h-5" /> Escanear QR
                            </button>
                            
                            <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">O ingresa el ID manual</p>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        placeholder="ID del Carro" 
                                        value={manualId}
                                        onChange={e => setManualId(e.target.value)}
                                        className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                    />
                                    <button type="button" onClick={handleManualLookup} disabled={isLoading || !manualId} className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 rounded-xl flex items-center justify-center disabled:opacity-50">
                                        <Search className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Mis Carros Activos */}
                        {activeMovements.length > 0 && (
                            <div className="space-y-4">
                                <h3 className="font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest text-sm flex items-center gap-2">
                                    <Wrench className="w-4 h-4 text-primary" /> Mis Carros en Uso
                                </h3>
                                {activeMovements.map(mov => (
                                    <div key={mov.id} className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col gap-4">
                                        <div>
                                            <h4 className="font-black text-slate-800 dark:text-slate-100 text-lg">{mov.cart.nombre}</h4>
                                            <p className="text-xs font-bold text-slate-500">Obra: {mov.project.nombre}</p>
                                        </div>
                                        <button type="button" onClick={() => startCheckin(mov)} className="w-full py-3 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-xl font-bold text-sm hover:ring-2 hover:ring-primary/50 transition-all flex items-center justify-center gap-2">
                                            <RefreshCw className="w-4 h-4 text-slate-500" /> Devolver Carro
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {isScanning && (
                    <ToolCartScannerModal 
                        onScan={handleScanSuccess}
                        onClose={() => setIsScanning(false)}
                    />
                )}

                {mode === 'CHECKOUT' && selectedCart && (
                    <div className="space-y-6 animate-in slide-in-from-right-8 duration-300">
                        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">{selectedCart.nombre}</h2>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Checklist de Salida</p>
                                </div>
                                <span className="bg-blue-100 text-blue-700 text-[10px] items-center px-2 py-1 rounded-md font-black uppercase tracking-widest">
                                    Disponible
                                </span>
                            </div>

                            <div className="space-y-2 mb-6">
                                <SearchableSelect 
                                    label="Proyecto de Destino"
                                    options={projects.map(p => ({ id: p.id, label: p.nombre }))}
                                    value={selectedProjectId}
                                    onChange={setSelectedProjectId}
                                />
                            </div>

                            <p className="text-xs text-slate-500 font-medium mb-4">Marca las herramientas que estás retirando. Desmarca las faltantes.</p>

                            <div className="space-y-2 mb-6">
                                {checklist.map(item => (
                                    <button 
                                        type="button"
                                        key={item.id}
                                        onClick={() => toggleToolCheckout(item.id)}
                                        className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                                            item.presentAtOut 
                                                ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800' 
                                                : 'bg-red-50/50 border-red-200 dark:bg-red-900/10 dark:border-red-800'
                                        }`}
                                    >
                                        <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border ${item.presentAtOut ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-red-400 bg-white dark:bg-slate-800'}`}>
                                            {item.presentAtOut && <CheckCircle2 className="w-3.5 h-3.5" />}
                                        </div>
                                        <div className="flex-1">
                                            <span className={`text-sm font-bold block ${item.presentAtOut ? 'text-slate-700 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400 opacity-70 line-through'}`}>{item.nombre}</span>
                                            <div className="flex gap-2 mt-0.5">
                                                <span className="text-[9px] uppercase tracking-widest font-black text-slate-400">×{item.cantidad}</span>
                                                {item.isAdditional && <span className="text-[9px] uppercase tracking-widest font-black text-indigo-500">Adicional</span>}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    placeholder="Herramienta adicional..." 
                                    value={newToolName}
                                    onChange={e => setNewToolName(e.target.value)}
                                    className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold outline-none min-w-0"
                                />
                                <input 
                                    type="number" 
                                    min={1}
                                    value={newToolQty}
                                    onChange={e => setNewToolQty(Math.max(1, parseInt(e.target.value) || 1))}
                                    className="w-14 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-2.5 text-xs font-bold text-center outline-none"
                                />
                                <button type="button" onClick={handleAddNewTool} disabled={!newToolName.trim()} className="bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 px-4 rounded-xl disabled:opacity-50">
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {missingOut.length > 0 && (
                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex gap-3 animate-in fade-in">
                                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                                <p className="text-xs font-bold text-amber-800 dark:text-amber-400 leading-tight">
                                    Se registrarán {missingOut.length} herramientas faltantes.
                                </p>
                            </div>
                        )}

                        <button 
                            type="button"
                            disabled={isLoading || !selectedProjectId} 
                            onClick={() => setIsConfirmingCheckout(true)}
                            className="w-full py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-sm disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl shadow-primary/20"
                        >
                            <ClipboardCheck className="w-5 h-5" /> Registrar Salida
                        </button>
                        <ConfirmDialog 
                            isOpen={isConfirmingCheckout}
                            title="Confirmar Salida"
                            message={`¿Confirmas el retiro de ${selectedCart.nombre}?`}
                            onConfirm={submitCheckout}
                            onCancel={() => setIsConfirmingCheckout(false)}
                            confirmLabel="Registrar"
                            variant="info"
                        />
                    </div>
                )}

                {mode === 'CHECKIN' && selectedMovement && (
                    <div className="space-y-6 animate-in slide-in-from-right-8 duration-300">
                        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                            <div className="mb-6">
                                <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">{selectedMovement.cart.nombre}</h2>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Devolución de Carro</p>
                                <p className="text-xs font-medium text-slate-500 mt-2">Obra: <span className="font-bold text-slate-700 dark:text-slate-300">{selectedMovement.project.nombre}</span></p>
                            </div>

                            <p className="text-xs text-slate-500 font-medium mb-4">Marca las herramientas que estás devolviendo.</p>

                            <div className="space-y-2 mb-6">
                                {checklist.map(item => (
                                    <button 
                                        type="button"
                                        key={item.id}
                                        onClick={() => toggleToolCheckin(item.id)}
                                        className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                                            item.presentAtIn 
                                                ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800' 
                                                : 'bg-red-50/50 border-red-200 dark:bg-red-900/10 dark:border-red-800'
                                        }`}
                                    >
                                        <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border ${item.presentAtIn ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-red-400 bg-white dark:bg-slate-800'}`}>
                                            {item.presentAtIn && <CheckCircle2 className="w-3.5 h-3.5" />}
                                        </div>
                                        <div className="flex-1">
                                            <span className={`text-sm font-bold block ${item.presentAtIn ? 'text-slate-700 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400 opacity-70 line-through'}`}>{item.nombre}</span>
                                            <div className="flex gap-2 mt-0.5">
                                                <span className="text-[9px] uppercase tracking-widest font-black text-slate-400">×{item.cantidad}</span>
                                                {item.isAdditional && <span className="text-[9px] uppercase tracking-widest font-black text-indigo-500">Adicional</span>}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {missingIn.length > 0 && (
                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex gap-3 animate-in fade-in">
                                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                                <p className="text-xs font-bold text-amber-800 dark:text-amber-400 leading-tight">
                                    Reportando {missingIn.length} faltantes.
                                </p>
                            </div>
                        )}

                        <button 
                            type="button"
                            disabled={isLoading} 
                            onClick={() => setIsConfirmingCheckin(true)}
                            className="w-full py-4 bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 rounded-2xl font-black uppercase tracking-widest text-sm disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl shadow-slate-200 dark:shadow-none"
                        >
                            Registrar Devolución
                        </button>
                        <ConfirmDialog 
                            isOpen={isConfirmingCheckin}
                            title="Confirmar Devolución"
                            message={`¿Confirmas la devolución de ${selectedMovement.cart.nombre}?`}
                            onConfirm={submitCheckin}
                            onCancel={() => setIsConfirmingCheckin(false)}
                            confirmLabel="Devolver"
                            variant="info"
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

function ToolCartScannerModal({ onScan, onClose }: { onScan: (text: string) => void, onClose: () => void }) {
    useEffect(() => {
        const html5QrCode = new Html5Qrcode("reader");
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        html5QrCode.start(
            { facingMode: "environment" }, 
            config, 
            (decodedText) => {
                onScan(decodedText);
                html5QrCode.stop().catch(() => {});
            },
            () => {}
        ).catch(err => {
            console.error(err);
            showToast("Error al iniciar cámara. Verifica los permisos.", "error");
            onClose();
        });

        return () => {
            if (html5QrCode.isScanning) {
                html5QrCode.stop().catch(() => {});
            }
        };
    }, [onScan, onClose]);

    return (
        <div className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl space-y-4">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Camera className="w-5 h-5 text-primary" /> Escaneando QR
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400 dark:text-slate-500">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                
                <div className="relative aspect-square bg-slate-900">
                    <div id="reader" className="w-full h-full"></div>
                    <div className="absolute inset-0 border-[40px] border-slate-900/40 pointer-events-none flex items-center justify-center">
                        <div className="w-full h-full border-2 border-primary/50 rounded-2xl shadow-[0_0_0_999px_rgba(15,23,42,0.6)]"></div>
                    </div>
                </div>

                <div className="p-6 text-center">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Apunta la cámara al código QR impreso</p>
                </div>
            </div>
            
            <button 
                onClick={onClose}
                className="mt-8 px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-full font-black uppercase tracking-widest text-[10px] transition-all"
            >
                Cancelar Escaneo
            </button>
        </div>
    );
}
