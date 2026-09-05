'use client';

import React, { useState } from 'react';
import { ShieldCheck, Search, Loader2, CheckCircle2, XCircle, FileText, Calendar, User, Fingerprint } from 'lucide-react';

export default function VerifySignaturePage() {
    const [signatureCode, setSignatureCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const code = signatureCode.trim();
        if (!code) return;

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const res = await fetch(`/api/signatures/verify/${code}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ verifiedBy: 'Portal Público' })
            });

            const data = await res.json();

            if (res.ok) {
                setResult(data);
            } else {
                setError(data.error || 'No se pudo verificar la firma');
            }
        } catch (err: any) {
            setError('Error de conexión al verificar la firma');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans">
            {/* Header Corporativo */}
            <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img 
                            src="/logo-hdb.jpg" 
                            alt="HDB Servicios Eléctricos" 
                            className="h-8 sm:h-10 object-contain"
                            onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                        <div className="border-l-2 border-slate-200 dark:border-slate-700 pl-3 hidden sm:block">
                            <h1 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                HDB Servicios Eléctricos
                            </h1>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                Portal de Verificación
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <div className="bg-indigo-50 dark:bg-indigo-950/50 p-2 rounded-xl">
                            <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div className="text-right hidden sm:block">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                Sistema de Gestión Integrado
                            </span>
                            <span className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                SGI - Confianza Digital
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 flex flex-col">
                
                {/* Hero / Bienvenida */}
                <div className="text-center space-y-4 mb-10">
                    <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-3xl mx-auto flex items-center justify-center shadow-sm">
                        <Fingerprint className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                        Verificación de Firmas Digitales
                    </h2>
                    <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
                        Bienvenido al portal público del SGI. Aquí puede validar la autenticidad, integridad y vigencia de cualquier firma digital emitida dentro de la plataforma de HDB Servicios Eléctricos (actas de EPP, permisos de trabajo, etc).
                    </p>
                </div>

                {/* Buscador */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 dark:shadow-none max-w-2xl mx-auto w-full relative z-10">
                    <form onSubmit={handleVerify} className="space-y-4">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                            Ingrese el Código de Firma (Ej: SIGN-20260904-...)
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Search className="h-5 w-5 text-slate-400" />
                            </div>
                            <input
                                type="text"
                                value={signatureCode}
                                onChange={(e) => setSignatureCode(e.target.value.toUpperCase())}
                                placeholder="SIGN-XXXXX-XXXXX-XXXXX"
                                className="block w-full pl-11 pr-4 py-4 bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 rounded-2xl text-base sm:text-lg font-mono font-bold text-slate-900 dark:text-white placeholder:text-slate-400 placeholder:font-sans focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all uppercase"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading || !signatureCode.trim()}
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 dark:disabled:bg-indigo-900 text-white rounded-2xl font-black text-sm sm:text-base transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Validando Certificado...
                                </>
                            ) : (
                                <>
                                    <ShieldCheck className="w-5 h-5" />
                                    Verificar Autenticidad
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Resultados */}
                {error && (
                    <div className="mt-8 max-w-2xl mx-auto w-full animate-in slide-in-from-bottom-4 fade-in duration-300">
                        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-2xl p-5 flex items-start gap-4">
                            <div className="p-2 bg-white dark:bg-rose-900/50 rounded-xl shadow-sm shrink-0">
                                <XCircle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
                            </div>
                            <div>
                                <h4 className="font-black text-rose-900 dark:text-rose-300 text-base">Firma Inválida o No Encontrada</h4>
                                <p className="text-sm text-rose-700/80 dark:text-rose-400/80 mt-1 leading-relaxed">
                                    {error}. Verifique que el código ingresado sea exactamente igual al impreso en el documento.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {result && (
                    <div className="mt-8 max-w-2xl mx-auto w-full animate-in slide-in-from-bottom-4 fade-in duration-500 space-y-4">
                        <div className={`border-2 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row gap-6 relative overflow-hidden ${
                            result.ValidationResult === 'VALIDA'
                                ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500 shadow-[0_0_40px_-10px_rgba(16,185,129,0.2)]'
                                : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-500 shadow-[0_0_40px_-10px_rgba(244,63,94,0.2)]'
                        }`}>
                            {/* Decorative background icon */}
                            <div className="absolute -right-8 -bottom-8 opacity-5 pointer-events-none">
                                {result.ValidationResult === 'VALIDA' ? (
                                    <ShieldCheck className="w-64 h-64 text-emerald-900" />
                                ) : (
                                    <XCircle className="w-64 h-64 text-rose-900" />
                                )}
                            </div>

                            <div className="shrink-0 flex justify-center sm:block">
                                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center shadow-lg ${
                                    result.ValidationResult === 'VALIDA'
                                        ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white'
                                        : 'bg-gradient-to-br from-rose-400 to-rose-600 text-white'
                                }`}>
                                    {result.ValidationResult === 'VALIDA' ? (
                                        <CheckCircle2 className="w-10 h-10" />
                                    ) : (
                                        <XCircle className="w-10 h-10" />
                                    )}
                                </div>
                            </div>

                            <div className="flex-1 space-y-5 relative z-10">
                                <div>
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest ${
                                        result.ValidationResult === 'VALIDA'
                                            ? 'bg-emerald-200/50 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300'
                                            : 'bg-rose-200/50 dark:bg-rose-900/50 text-rose-800 dark:text-rose-300'
                                    }`}>
                                        {result.ValidationResult === 'VALIDA' ? 'Certificado Válido' : 'Certificado Inválido'}
                                    </span>
                                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-3">
                                        {result.ValidationResult === 'VALIDA' ? 'Identidad Confirmada' : 'Firma Inválida o Alterada'}
                                    </h3>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                        {result.ValidationResult === 'VALIDA' 
                                            ? 'El documento ha sido firmado electrónicamente y su integridad criptográfica se mantiene intacta.'
                                            : 'El documento o la firma han sufrido alteraciones. La integridad criptográfica no coincide y la firma carece de validez.'}
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200/60 dark:border-slate-700/60">
                                    <div className="space-y-1">
                                        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-500">
                                            <User className="w-3.5 h-3.5" /> Firmante
                                        </span>
                                        <div className="font-bold text-slate-900 dark:text-white">
                                            {result.UserName}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            DNI: {result.DNI}
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-500">
                                            <Calendar className="w-3.5 h-3.5" /> Fecha y Hora (UTC)
                                        </span>
                                        <div className="font-bold text-slate-900 dark:text-white">
                                            {new Date(result.SignedAtUTC).toLocaleDateString()}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            {new Date(result.SignedAtUTC).toLocaleTimeString()}
                                        </div>
                                    </div>

                                    <div className="space-y-1 sm:col-span-2">
                                        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-500">
                                            <FileText className="w-3.5 h-3.5" /> Referencia Documental
                                        </span>
                                        <div className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300 bg-white/50 dark:bg-slate-950/50 px-3 py-2 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
                                            Doc: {result.DocumentCode || result.DocumentID} (v{result.DocumentVersion})
                                        </div>
                                    </div>

                                    <div className="space-y-1 sm:col-span-2">
                                        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-500">
                                            <Fingerprint className="w-3.5 h-3.5" /> Hash SHA-256 Registrado
                                        </span>
                                        <div className="font-mono text-[10px] sm:text-xs text-slate-500 break-all bg-white/50 dark:bg-slate-950/50 px-3 py-2 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
                                            {result.HashSignature}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-6">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-2">
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">
                        HDB Servicios Eléctricos
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 max-w-xl mx-auto leading-relaxed">
                        Este sistema garantiza la inalterabilidad de los documentos firmados digitalmente mediante algoritmos de hashing seguro (SHA-256). Cualquier modificación posterior al documento original invalidará automáticamente esta firma.
                    </p>
                </div>
            </footer>
        </div>
    );
}
