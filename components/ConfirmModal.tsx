import { AlertTriangle } from 'lucide-react';
import { ConfirmDialogBase } from '@/components/ui/Dialog';

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
    return (
        <ConfirmDialogBase
            open={isOpen}
            onCancel={onClose}
            onConfirm={() => { onConfirm(); onClose(); }}
            title={title}
            message={message}
            confirmLabel={confirmText}
            cancelLabel={cancelText}
            tone={isDestructive ? 'danger' : 'primary'}
            icon={<AlertTriangle className="w-[18px] h-[18px]" />}
        />
    );
}
