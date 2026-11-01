'use client';

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, Dialog, Input, Select } from '@/components/ui';

export interface ItemManualOutput {
    codigo: string;
    nombre: string;
    unidad: string;
    cantidad: number;
    precioUnitario: number;
    alicuotaIva: number;
    descuentoPct: number;
    observacion: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (item: ItemManualOutput) => void;
}

const UNIDADES = [
    { value: 'u', label: 'Unidad' },
    { value: 'm', label: 'Metro' },
    { value: 'hs', label: 'Hora' },
    { value: 'gl', label: 'Global' },
    { value: 'kit', label: 'Kit / tablero' },
];

const ALICUOTAS = [
    { value: '21', label: '21 %' },
    { value: '10.5', label: '10,5 %' },
    { value: '27', label: '27 %' },
    { value: '0', label: 'Exento' },
];

const FORM_ID = 'form-item-libre';

export default function AgregarItemManualModal({ isOpen, onClose, onAdd }: Props) {
    const [codigo, setCodigo] = useState('MAN-01');
    const [nombre, setNombre] = useState('');
    const [unidad, setUnidad] = useState('u');
    const [cantidad, setCantidad] = useState('1');
    const [precioUnitario, setPrecioUnitario] = useState('');
    const [alicuotaIva, setAlicuotaIva] = useState('21');
    const [descuentoPct, setDescuentoPct] = useState('0');
    const [observacion, setObservacion] = useState('');

    const cant = parseFloat(cantidad) || 0;
    const precio = parseFloat(precioUnitario) || 0;
    const desc = Math.min(100, Math.max(0, parseFloat(descuentoPct) || 0));
    const subtotal = Math.round(cant * precio * (1 - desc / 100) * 100) / 100;
    const valido = nombre.trim().length > 0 && cant > 0;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!valido) return;

        onAdd({
            codigo: codigo.trim() || 'ITEM-ESP',
            nombre: nombre.trim(),
            unidad: unidad.trim() || 'u',
            cantidad: cant,
            precioUnitario: precio,
            alicuotaIva: parseFloat(alicuotaIva) || 0,
            descuentoPct: desc,
            observacion: observacion.trim(),
        });

        setNombre('');
        setCantidad('1');
        setPrecioUnitario('');
        setDescuentoPct('0');
        setObservacion('');
        onClose();
    };

    return (
        <Dialog
            open={isOpen}
            onClose={onClose}
            size="md"
            title="Agregar ítem libre"
            description="Servicios, mano de obra o materiales que no están en el catálogo."
            footer={
                <>
                    <span className="sm:mr-auto text-[13px] text-slate-500 tabular-nums">
                        Subtotal: <strong className="text-slate-900 dark:text-slate-100">
                            $ {subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </strong>
                    </span>
                    <Button variant="secondary" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button type="submit" form={FORM_ID} icon={<Plus />} disabled={!valido}>
                        Agregar
                    </Button>
                </>
            }
        >
            <form id={FORM_ID} onSubmit={handleSubmit} className="grid grid-cols-6 gap-3">
                <div className="col-span-6">
                    <Input
                        label="Descripción"
                        required
                        data-autofocus
                        placeholder="Ej.: armado y cableado de tablero seccional"
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                    />
                </div>
                <div className="col-span-2">
                    <Input label="Código" value={codigo} onChange={(e) => setCodigo(e.target.value)} className="font-mono" />
                </div>
                <div className="col-span-2">
                    <Select label="Unidad" value={unidad} onChange={(e) => setUnidad(e.target.value)}>
                        {UNIDADES.map((u) => (
                            <option key={u.value} value={u.value}>{u.label}</option>
                        ))}
                    </Select>
                </div>
                <div className="col-span-2">
                    <Input
                        label="Cantidad"
                        required
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={cantidad}
                        onChange={(e) => setCantidad(e.target.value)}
                        className="text-right tabular-nums"
                    />
                </div>
                <div className="col-span-2">
                    <Input
                        label="Precio unitario"
                        required
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0,00"
                        value={precioUnitario}
                        onChange={(e) => setPrecioUnitario(e.target.value)}
                        className="text-right tabular-nums"
                    />
                </div>
                <div className="col-span-2">
                    <Input
                        label="Bonificación %"
                        type="number"
                        step="0.5"
                        min="0"
                        max="100"
                        value={descuentoPct}
                        onChange={(e) => setDescuentoPct(e.target.value)}
                        className="text-right tabular-nums"
                    />
                </div>
                <div className="col-span-2">
                    <Select label="IVA" value={alicuotaIva} onChange={(e) => setAlicuotaIva(e.target.value)}>
                        {ALICUOTAS.map((a) => (
                            <option key={a.value} value={a.value}>{a.label}</option>
                        ))}
                    </Select>
                </div>
                <div className="col-span-6">
                    <Input
                        label="Nota"
                        placeholder="Ej.: marca Schneider o equivalente"
                        value={observacion}
                        onChange={(e) => setObservacion(e.target.value)}
                    />
                </div>
            </form>
        </Dialog>
    );
}
