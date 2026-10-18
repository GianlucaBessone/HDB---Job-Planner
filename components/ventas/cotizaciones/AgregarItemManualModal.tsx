'use client';

import React, { useState } from 'react';
import { X, PlusCircle, Wrench } from 'lucide-react';

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

export default function AgregarItemManualModal({ isOpen, onClose, onAdd }: Props) {
    const [codigo, setCodigo] = useState('MAN-01');
    const [nombre, setNombre] = useState('');
    const [unidad, setUnidad] = useState('u');
    const [cantidad, setCantidad] = useState('1');
    const [precioUnitario, setPrecioUnitario] = useState('');
    const [alicuotaIva, setAlicuotaIva] = useState('21');
    const [descuentoPct, setDescuentoPct] = useState('0');
    const [observacion, setObservacion] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const cant = parseFloat(cantidad) || 0;
        const precio = parseFloat(precioUnitario) || 0;
        if (!nombre.trim() || cant <= 0) return;

        onAdd({
            codigo: codigo.trim() || 'ITEM-ESP',
            nombre: nombre.trim(),
            unidad: unidad.trim() || 'u',
            cantidad: cant,
            precioUnitario: precio,
            alicuotaIva: parseFloat(alicuotaIva) || 21,
            descuentoPct: Math.min(100, Math.max(0, parseFloat(descuentoPct) || 0)),
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <Wrench className="w-5 h-5 text-indigo-400" />
                        <div>
                            <h3 className="font-black text-sm">Agregar Ítem Libre / Servicio / Mano de Obra</h3>
                            <p className="text-[11px] text-slate-400">Permite cotizar conceptos especiales fuera de catálogo</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
                    <div className="grid grid-cols-3 gap-2.5">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">Código / Ref.</label>
                            <input
                                type="text"
                                value={codigo}
                                onChange={(e) => setCodigo(e.target.value)}
                                className="w-full px-2.5 py-2 text-xs font-mono rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">Unidad de Medida</label>
                            <select
                                value={unidad}
                                onChange={(e) => setUnidad(e.target.value)}
                                className="w-full px-2.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="u">Unidad (u)</option>
                                <option value="m">Metros (m)</option>
                                <option value="hs">Horas de Ingeniería / M.O. (hs)</option>
                                <option value="gl">Global (gl)</option>
                                <option value="kit">Kit / Tablero (kit)</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Descripción del Material o Servicio *
                        </label>
                        <input
                            type="text"
                            required
                            autoFocus
                            placeholder="Ej: Armado y cableado de tablero seccional s/plano"
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-2.5">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">Cantidad *</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                required
                                value={cantidad}
                                onChange={(e) => setCantidad(e.target.value)}
                                className="w-full px-2.5 py-2 text-xs font-mono font-bold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">Precio Unit. ($) *</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                required
                                placeholder="0.00"
                                value={precioUnitario}
                                onChange={(e) => setPrecioUnitario(e.target.value)}
                                className="w-full px-2.5 py-2 text-xs font-mono font-bold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">Bonif. (%)</label>
                            <input
                                type="number"
                                step="0.5"
                                min="0"
                                max="100"
                                value={descuentoPct}
                                onChange={(e) => setDescuentoPct(e.target.value)}
                                className="w-full px-2.5 py-2 text-xs font-mono rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">Alícuota IVA</label>
                            <select
                                value={alicuotaIva}
                                onChange={(e) => setAlicuotaIva(e.target.value)}
                                className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200"
                            >
                                <option value="21">21%</option>
                                <option value="10.5">10.5%</option>
                                <option value="27">27%</option>
                                <option value="0">0% / Exento</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">Nota técnica de línea</label>
                            <input
                                type="text"
                                placeholder="Ej: Marca Schneider o eq."
                                value={observacion}
                                onChange={(e) => setObservacion(e.target.value)}
                                className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200"
                            />
                        </div>
                    </div>

                    <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                        >
                            <PlusCircle className="w-4 h-4" />
                            Agregar a la Cotización
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
