"use client";
import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { useModalScroll } from '@/lib/useModalScroll';
import { showToast } from '@/components/Toast';

interface VerificacionEficaciaModalProps {
    isOpen: boolean;
    onClose: () => void;
    ncId?: string;
    accionMejoraId?: string;
    onSuccess: () => void;
    currentUserId: string;
}

export function VerificacionEficaciaModal({ isOpen, onClose, ncId, accionMejoraId, onSuccess, currentUserId }: VerificacionEficaciaModalProps) {
    useModalScroll(isOpen);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        resultado: '',
        observaciones: '',
        eficaz: false,
        fechaVerificacion: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch('/api/sgi/verificacion-eficacia', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    ncId,
                    accionMejoraId,
                    responsableVerificacionId: currentUserId
                })
            });

            if (!res.ok) throw new Error('Error al registrar verificación');
            
            showToast('Verificación de eficacia registrada exitosamente', 'success');
            onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            showToast('Error al registrar verificación', 'error');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 animate-in fade-in"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="verif-eficacia-title"
        >
            <div className="bg-card w-full max-w-xl rounded-xl shadow-xl flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-4 border-b">
                    <div>
                        <h2 id="verif-eficacia-title" className="text-lg font-bold">Registrar Verificación de Eficacia</h2>
                        <p className="text-sm text-muted-foreground">Evalúe si las acciones tomadas han sido eficaces para resolver la causa raíz.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-full" aria-label="Cerrar modal">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 overflow-y-auto">
                    <form id="verificacion-form" onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold">Fecha de Verificación *</label>
                            <input 
                                type="date" 
                                required
                                className="w-full bg-card border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
                                value={formData.fechaVerificacion}
                                onChange={(e) => setFormData({...formData, fechaVerificacion: e.target.value})}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold">Resultado de la Verificación *</label>
                            <textarea 
                                required
                                className="w-full bg-card border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none resize-none"
                                placeholder="Describa cómo se verificó y qué se encontró..."
                                value={formData.resultado}
                                onChange={(e) => setFormData({...formData, resultado: e.target.value})}
                                rows={4}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold">Observaciones</label>
                            <textarea 
                                className="w-full bg-card border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none resize-none"
                                placeholder="Observaciones adicionales (opcional)..."
                                value={formData.observaciones}
                                onChange={(e) => setFormData({...formData, observaciones: e.target.value})}
                                rows={2}
                            />
                        </div>

                        <div className="flex items-center space-x-2 pt-2 pb-4">
                            <input 
                                type="checkbox"
                                id="eficaz" 
                                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                checked={formData.eficaz}
                                onChange={(e) => setFormData({...formData, eficaz: e.target.checked})}
                            />
                            <label htmlFor="eficaz" className="font-semibold text-base cursor-pointer">
                                {formData.eficaz ? 'Es Eficaz' : 'No es Eficaz'}
                            </label>
                        </div>
                    </form>
                </div>

                <div className="p-4 border-t flex justify-end gap-3 bg-muted/20">
                    <button type="button" onClick={onClose} className="btn-secondary" disabled={loading}>
                        Cancelar
                    </button>
                    <button type="submit" form="verificacion-form" className="btn-primary flex items-center gap-2" disabled={loading}>
                        <Save className="w-4 h-4" />
                        {loading ? 'Guardando...' : 'Registrar Verificación'}
                    </button>
                </div>
            </div>
        </div>
    );
}
