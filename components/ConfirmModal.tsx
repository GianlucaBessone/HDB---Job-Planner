import { X, AlertTriangle } from 'lucide-react';
import { useModalScroll } from '@/lib/useModalScroll';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
}

export default function ConfirmModal({ 
    isOpen, 
    onClose, 
    onConfirm, 
    title, 
    message, 
    confirmText = 'Confirmar', 
    cancelText = 'Cancelar', 
    isDestructive = false 
}: ConfirmModalProps) {
    useModalScroll(isOpen);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-card w-full max-w-sm rounded-xl shadow-xl flex flex-col overflow-hidden">
                <div className="flex items-start justify-between p-4 border-b bg-muted/30">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${isDestructive ? 'bg-red-100 text-red-600' : 'bg-primary/10 text-primary'}`}>
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <h2 className="text-lg font-semibold leading-tight">{title}</h2>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-muted rounded-full transition-colors text-muted-foreground shrink-0">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="p-5">
                    <p className="text-sm text-muted-foreground">{message}</p>
                </div>

                <div className="flex items-center justify-end gap-3 p-4 border-t bg-muted/20">
                    <button 
                        onClick={onClose} 
                        className="px-4 py-2 border rounded-md hover:bg-muted text-sm transition-colors font-medium"
                    >
                        {cancelText}
                    </button>
                    <button 
                        onClick={() => { onConfirm(); onClose(); }} 
                        className={`px-4 py-2 rounded-md text-sm transition-colors font-medium ${
                            isDestructive 
                            ? 'bg-red-600 text-white hover:bg-red-700' 
                            : 'bg-primary text-primary-foreground hover:bg-primary/90'
                        }`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
