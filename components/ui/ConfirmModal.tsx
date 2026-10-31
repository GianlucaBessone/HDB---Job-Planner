'use client';

import { ReactNode } from 'react';
import { ConfirmDialogBase } from './Dialog';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  submessage?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  loading?: boolean;
  icon?: ReactNode;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  submessage,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger',
  loading = false,
  icon,
}: ConfirmModalProps) {
  return (
    <ConfirmDialogBase
      open={isOpen}
      onCancel={onClose}
      onConfirm={() => { void onConfirm(); }}
      title={title}
      message={message}
      detail={submessage}
      confirmLabel={confirmText}
      cancelLabel={cancelText}
      tone={variant}
      loading={loading}
      icon={icon}
    />
  );
}
