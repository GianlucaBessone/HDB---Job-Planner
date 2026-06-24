import React from 'react';
import { X, CheckCircle2, XCircle, AlertTriangle, HelpCircle } from 'lucide-react';

interface Signature {
    SignatureID: string;
    DocumentID: string;
    DocumentVersion: string;
    UserID: string;
    UserName: string;
    DNI: string;
    DeviceID: string;
    IPAddress: string;
    SignedAtUTC: string;
    HashSignature: string;
    VerificationStatus: string;
    VerifiedAtUTC: string;
    VerifiedBy?: string;
    RecalculatedHash?: string;
    DocumentCode?: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    signature?: Signature | null;
    signatureId?: string | null;
}

export default function SignatureDetailModal({ isOpen, onClose, signature: initialSignature, signatureId }: Props) {
    const [signature, setSignature] = React.useState<Signature | null>(initialSignature || null);
    const [loading, setLoading] = React.useState(false);
    const [showHelp, setShowHelp] = React.useState(false);

    React.useEffect(() => {
        setSignature(initialSignature || null);
    }, [initialSignature]);

    React.useEffect(() => {
        if (isOpen && signatureId && !initialSignature) {
            setLoading(true);
            fetch(`/api/signatures/verify/${signatureId}`, { method: 'POST' })
                .then(res => res.json())
                .then(data => {
                    if (data.error) {
                        console.error("Signature verification error:", data.error);
                        alert(data.error);
                        onClose();
                    } else {
                        setSignature(data);
                    }
                })
                .catch(err => console.error("Error fetching signature", err))
                .finally(() => setLoading(false));
        }
    }, [isOpen, signatureId, initialSignature]);
    if (!isOpen) return null;

    if (loading || !signature) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                    <p className="text-sm font-medium text-slate-500">Cargando firma...</p>
                </div>
            </div>
        );
    }

    const getStatusIcon = (status: string) => {
        if (status === 'VALIDA') return <CheckCircle2 className="w-8 h-8 text-emerald-500" />;
        if (status === 'DATOS MODIFICADOS') return <AlertTriangle className="w-8 h-8 text-amber-500" />;
        return <XCircle className="w-8 h-8 text-rose-500" />;
    };

    const getStatusText = (status: string) => {
        if (status === 'VALIDA') return 'Firma íntegra';
        if (status === 'DATOS MODIFICADOS') return 'Datos modificados encontrados';
        return 'Posible alteración de datos';
    };

    const getStatusColor = (status: string) => {
        if (status === 'VALIDA') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        if (status === 'DATOS MODIFICADOS') return 'bg-amber-50 text-amber-700 border-amber-200';
        return 'bg-rose-50 text-rose-700 border-rose-200';
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="p-6 border-b flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        Detalle de Firma Electrónica
                        <button onClick={() => setShowHelp(true)} className="ml-1 p-1.5 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-full transition-colors" title="¿Qué es esto?">
                            <HelpCircle className="w-5 h-5" />
                        </button>
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className={`p-4 rounded-2xl border flex items-center gap-4 ${getStatusColor(signature.VerificationStatus)}`}>
                        {getStatusIcon(signature.VerificationStatus)}
                        <div>
                            <h4 className="font-bold text-lg">{getStatusText(signature.VerificationStatus)}</h4>
                            <p className="text-sm opacity-80">Estado actual de la verificación de integridad.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                            <span className="block text-[10px] font-black uppercase text-slate-400 mb-1">ID de Firma</span>
                            <span className="font-mono text-sm font-bold text-slate-700 dark:text-slate-200">{signature.SignatureID}</span>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                            <span className="block text-[10px] font-black uppercase text-slate-400 mb-1">Fecha y Hora (UTC)</span>
                            <span className="font-medium text-sm text-slate-700 dark:text-slate-200">{new Date(signature.SignedAtUTC).toLocaleString()}</span>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                            <span className="block text-[10px] font-black uppercase text-slate-400 mb-1">Documento / Versión</span>
                            <span className="font-medium text-sm text-slate-700 dark:text-slate-200">{signature.DocumentCode || signature.DocumentID} {signature.DocumentVersion}</span>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                            <span className="block text-[10px] font-black uppercase text-slate-400 mb-1">Firmante</span>
                            <span className="font-medium text-sm text-slate-700 dark:text-slate-200">{signature.UserName} (DNI: {signature.DNI})</span>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                            <span className="block text-[10px] font-black uppercase text-slate-400 mb-1">Dispositivo / IP</span>
                            <span className="font-medium text-sm text-slate-700 dark:text-slate-200">{signature.DeviceID} / {signature.IPAddress}</span>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                            <span className="block text-[10px] font-black uppercase text-slate-400 mb-1">Última Verificación</span>
                            <span className="font-medium text-sm text-slate-700 dark:text-slate-200">{new Date(signature.VerifiedAtUTC).toLocaleString()}</span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <span className="block text-[10px] font-black uppercase text-slate-400 mb-1">Hash Almacenado</span>
                            <div className="bg-slate-100 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto font-mono text-xs text-slate-600 dark:text-slate-400">
                                {signature.HashSignature}
                            </div>
                        </div>

                        {signature.RecalculatedHash && (
                            <div>
                                <span className="block text-[10px] font-black uppercase text-slate-400 mb-1">Hash Recalculado</span>
                                <div className={`p-3 rounded-lg border overflow-x-auto font-mono text-xs ${
                                    signature.HashSignature === signature.RecalculatedHash 
                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400'
                                        : 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-400'
                                }`}>
                                    {signature.RecalculatedHash}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-6 border-t bg-slate-50 dark:bg-slate-900/50 flex justify-end">
                    <button onClick={onClose} className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 font-bold rounded-xl transition-colors">
                        Cerrar Detalle
                    </button>
                </div>
            </div>

            {/* Help Modal */}
            {showHelp && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-6 border-b flex justify-between items-center bg-indigo-50 dark:bg-indigo-900/30">
                            <h3 className="text-xl font-bold text-indigo-900 dark:text-indigo-100 flex items-center gap-2">
                                <HelpCircle className="w-6 h-6" />
                                Acerca de la Verificación de Firmas
                            </h3>
                            <button onClick={() => setShowHelp(false)} className="p-2 hover:bg-indigo-200 dark:hover:bg-indigo-800 rounded-full transition-colors text-indigo-700 dark:text-indigo-300">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto text-slate-700 dark:text-slate-300 text-[14px] leading-relaxed">
                            <div>
                                <strong className="text-slate-900 dark:text-white">¿Para qué sirve esta vista?</strong>
                                <p className="mt-1 opacity-90">Permite auditar matemáticamente que una firma no ha sido alterada desde su emisión. Comprueba en tiempo real si los datos guardados en el sistema coinciden exactamente con la realidad registrada al momento de la firma.</p>
                            </div>
                            
                            <div>
                                <strong className="text-slate-900 dark:text-white">¿Qué es un Hash?</strong>
                                <p className="mt-1 opacity-90">Un Hash es un "sello criptográfico". Es una cadena de texto alfanumérica única (ej: <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded text-xs">a2c4e6...</code>) que se genera a partir de un conjunto de datos específicos. Si cambias una sola letra de esos datos originales, el Hash resultante cambia por completo.</p>
                            </div>

                            <div>
                                <strong className="text-slate-900 dark:text-white">¿Qué algoritmo de seguridad utilizamos?</strong>
                                <p className="mt-1 opacity-90">Utilizamos <strong>HMAC SHA-256</strong>, un estándar de seguridad de nivel bancario. Además de hacer el Hash de tus datos (DNI, documento, fecha), el sistema lo cifra y mezcla con una <strong>Llave Secreta</strong> que solo existe encriptada dentro del servidor. Esto hace imposible que alguien invente o falsifique un Hash válido, incluso si tiene acceso profundo a la base de datos.</p>
                            </div>

                            <div>
                                <strong className="text-slate-900 dark:text-white">¿Cómo asegura la inalterabilidad? (Ejemplo Práctico)</strong>
                                <div className="mt-2 bg-indigo-50 dark:bg-slate-900 p-4 rounded-xl text-sm border border-indigo-100 dark:border-slate-700">
                                    <p className="mb-2">Imagina que firmas la <strong>Versión 1.0</strong> de un documento el <strong>12 de Mayo</strong>. El sistema toma tu DNI, esa versión y esa fecha, y junto a la Llave Secreta genera el Hash <code className="bg-white dark:bg-slate-800 px-1 rounded font-bold text-indigo-600 dark:text-indigo-400">8f1b...</code>.</p>
                                    <p>Si más adelante alguien malintencionado intenta entrar a la base de datos y edita el registro para decir que tú en realidad aprobaste la <strong>Versión 2.0</strong>, el sistema intentará recalcular el Hash con esos nuevos datos falsos. El nuevo cálculo dará <code className="bg-white dark:bg-slate-800 px-1 rounded font-bold text-rose-500">3x9p...</code>. Al no coincidir con <code className="bg-white dark:bg-slate-800 px-1 rounded font-bold text-indigo-600 dark:text-indigo-400">8f1b...</code>, el sistema invalida la firma y muestra la alerta de <strong>DATOS MODIFICADOS</strong>.</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t flex justify-end">
                            <button onClick={() => setShowHelp(false)} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors">
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
