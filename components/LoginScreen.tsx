'use client';
import { useState, useEffect } from 'react';
import { ClipboardList, Lock, LogIn, User as UserIcon } from 'lucide-react';

export default function LoginScreen({ onLoginSuccess }: { onLoginSuccess: (user: any) => void }) {
    const [operators, setOperators] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [selectedOperatorId, setSelectedOperatorId] = useState('');
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        // Load operators
        fetch('/api/operators')
            .then(res => res.json())
            .then(data => {
                setOperators(data);
                // check cache for last user
                const lastUser = localStorage.getItem('lastActiveUserId');
                if (lastUser && data.find((o: any) => o.id === lastUser)) {
                    setSelectedOperatorId(lastUser);
                }
                setIsLoading(false);
            })
            .catch(err => {
                console.error(err);
                setIsLoading(false);
            });
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ operatorId: selectedOperatorId, pin })
            });

            if (!res.ok) {
                const errData = await res.json();
                setError(errData.error || 'Autenticación fallida');
                setIsSubmitting(false);
                return;
            }

            const userData = await res.json();
            // Cache last used user simply by ID
            localStorage.setItem('lastActiveUserId', userData.id);
            // Save current session
            localStorage.setItem('currentUser', JSON.stringify(userData));

            onLoginSuccess(userData);
        } catch (err) {
            setError('Error de conexión');
            setIsSubmitting(false);
        }
    };

    const filteredOperators = operators.filter(o => o.nombreCompleto.toLowerCase().includes(searchTerm.toLowerCase()));

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl border border-slate-100">
                <div className="flex flex-col items-center justify-center mb-10">
                    <div className="bg-indigo-500 p-3 rounded-2xl shadow-lg shadow-indigo-500/30 mb-4">
                        <ClipboardList className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tighter">HDB<span className="text-indigo-500">Planner</span></h1>
                    <p className="text-sm font-bold text-slate-400 mt-2 uppercase tracking-widest text-center">Acceso al Sistema Operativo</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Select User with basic search visually integrated */}
                    <div className="space-y-2 relative">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
                            <UserIcon className="w-3 h-3" /> Operador / Usuario
                        </label>
                        <select
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-4 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-bold text-slate-700 transition-all appearance-none"
                            required
                            value={selectedOperatorId}
                            onChange={e => setSelectedOperatorId(e.target.value)}
                        >
                            <option value="">— Seleccionar Identidad —</option>
                            {operators.map(op => (
                                <option key={op.id} value={op.id}>{op.nombreCompleto}</option>
                            ))}
                        </select>
                    </div>

                    {/* PIN */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
                            <Lock className="w-3 h-3" /> Clave de Acceso (PIN)
                        </label>
                        <input
                            type="password"
                            required
                            placeholder="••••••"
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-4 text-center tracking-widest text-2xl font-black outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                            value={pin}
                            onChange={e => setPin(e.target.value)}
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-center">
                            <p className="text-xs font-bold text-rose-500 uppercase tracking-widest">{error}</p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting || !selectedOperatorId || !pin}
                        className="w-full bg-indigo-500 disabled:opacity-50 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 hover:bg-indigo-600 shadow-xl shadow-indigo-500/20 active:scale-95 transition-all"
                    >
                        <LogIn className="w-5 h-5" />
                        Ingresar
                    </button>
                </form>
            </div>
        </div>
    );
}
