'use client';

import React from 'react';
import { ConfirmDialogBase } from '@/components/ui/Dialog';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'info';
    isLoading?: boolean;
    loadingLabel?: string;
}

export default function ConfirmDialog({
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
    confirmLabel = 'Eliminar',
    cancelLabel = 'Cancelar',
    variant = 'danger',
    isLoading = false,
    loadingLabel = 'Procesando...'
}: ConfirmDialogProps) {
    return (
        <ConfirmDialogBase
            open={isOpen}
            onCancel={onCancel}
            onConfirm={onConfirm}
            title={title}
            message={message}
            confirmLabel={confirmLabel}
            cancelLabel={cancelLabel}
            tone={variant === 'info' ? 'primary' : variant}
            loading={isLoading}
            loadingLabel={loadingLabel}
        />
    );
}
