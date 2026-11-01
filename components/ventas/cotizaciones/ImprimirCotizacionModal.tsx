'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Download, Printer, ShoppingCart, FilePlus2, Loader2 } from 'lucide-react';
import { Dialog, Button, Badge } from '@/components/ui';
import { estadoCotizacion } from './estadoCotizacion';

interface Props {
    isOpen: boolean;
    cotizacion: any;
    onClose: () => void;
    onNuevaCotizacion?: () => void;
    onEnviarAPdv?: (cotizacion: any) => void;
}

/**
 * Visor del documento oficial de la cotización. Muestra el PDF que genera el
 * servidor (el mismo que se descarga), así lo impreso es siempre el documento.
 */
export default function ImprimirCotizacionModal({
    isOpen,
    cotizacion,
    onClose,
    onNuevaCotizacion,
    onEnviarAPdv,
}: Props) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [cargando, setCargando] = useState(true);
    // Cambia al guardar de nuevo la misma cotización: obliga a regenerar el PDF.
    const pdfVersion = cotizacion ? `${cotizacion.id}-${cotizacion.updatedAt || ''}` : '';

    useEffect(() => {
        setCargando(true);
    }, [pdfVersion]);

    if (!isOpen || !cotizacion) return null;

    const pdfBase = `/api/ventas/cotizaciones/${cotizacion.id}/pdf`;
    // El hash le pide al visor del navegador ajustar al ancho y ocultar las miniaturas
    const pdfUrl = `${pdfBase}?v=${encodeURIComponent(String(cotizacion.updatedAt || ''))}#navpanes=0&view=FitH`;
    const estado = estadoCotizacion(cotizacion);
    const puedeFacturar = cotizacion.estado !== 'CONVERTIDA' && cotizacion.estado !== 'ANULADA';

    const handleImprimir = () => {
        try {
            const win = iframeRef.current?.contentWindow;
            if (!win) throw new Error('Visor no disponible');
            win.focus();
            win.print();
        } catch {
            window.open(pdfUrl, '_blank', 'noopener');
        }
    };

    return (
        <Dialog
            open={isOpen}
            onClose={onClose}
            size="full"
            title={
                <span className="inline-flex items-center gap-2">
                    Cotización {cotizacion.numero}
                    <Badge tone={estado.tone}>{estado.label}</Badge>
                </span>
            }
            description={`${cotizacion.clienteNombre || 'Consumidor Final'} · ${(cotizacion.items || []).length} ítems`}
            className="h-[92dvh]"
            bodyClassName="flex-1 min-h-0 flex flex-col pb-4"
            footer={
                <>
                    {onNuevaCotizacion && (
                        <Button variant="ghost" icon={<FilePlus2 />} onClick={onNuevaCotizacion} className="sm:mr-auto">
                            Nueva cotización
                        </Button>
                    )}
                    {onEnviarAPdv && puedeFacturar && (
                        <Button variant="secondary" icon={<ShoppingCart />} onClick={() => onEnviarAPdv(cotizacion)}>
                            Facturar en PDV
                        </Button>
                    )}
                    <a
                        href={`${pdfBase}?download=true`}
                        download={`Cotizacion_${cotizacion.numero || 'HDB'}.pdf`}
                        className="btn btn-secondary"
                    >
                        <Download aria-hidden="true" />
                        Descargar
                    </a>
                    <Button icon={<Printer />} onClick={handleImprimir} disabled={cargando}>
                        Imprimir
                    </Button>
                </>
            }
        >
            <div className="relative flex-1 min-h-[240px] rounded-xl border border-border bg-surface-sunken overflow-hidden">
                <iframe
                    ref={iframeRef}
                    key={pdfVersion}
                    src={pdfUrl}
                    title={`Cotización ${cotizacion.numero}`}
                    onLoad={() => setCargando(false)}
                    className="absolute inset-0 w-full h-full"
                />
                {cargando && (
                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-surface-sunken text-[13px] text-slate-500">
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                        Generando documento…
                    </div>
                )}
            </div>
        </Dialog>
    );
}
