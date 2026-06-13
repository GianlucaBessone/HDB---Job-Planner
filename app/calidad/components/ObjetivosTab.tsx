"use client";

import React, { useEffect, useState } from 'react';
import { Plus, Target } from 'lucide-react';

export function ObjetivosTab({ currentUser }: { currentUser: any }) {
    const [objetivos, setObjetivos] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchObjetivos();
    }, []);

    const fetchObjetivos = async () => {
        try {
            const res = await fetch('/api/sgi/objetivos');
            if (res.ok) {
                const data = await res.json();
                setObjetivos(data);
            }
        } catch (error) {
            console.error('Error fetching objetivos:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-muted-foreground">Cargando objetivos...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-semibold tracking-tight">Objetivos de Calidad</h2>
                    <p className="text-muted-foreground">Gestión de objetivos de calidad (ISO 9001 Cl. 6.2)</p>
                </div>
                <button className="btn-primary flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Nuevo Objetivo
                </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {objetivos.length === 0 ? (
                    <div className="col-span-full p-8 text-center bg-muted/20 rounded-lg border border-dashed">
                        No hay objetivos registrados.
                    </div>
                ) : (
                    objetivos.map((obj: any) => (
                        <div key={obj.id} className="bg-card rounded-xl border shadow-sm cursor-pointer hover:shadow-md transition-shadow flex flex-col">
                            <div className="p-4 pb-2 flex-1">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-xs font-semibold px-2 py-1 bg-muted rounded-full">{obj.codigo}</span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${obj.estado === 'Cumplido' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                                        {obj.estado}
                                    </span>
                                </div>
                                <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
                                    <Target className="h-4 w-4 text-blue-500" />
                                    {obj.titulo}
                                </h3>
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                    {obj.descripcion}
                                </p>
                            </div>
                            <div className="p-4 pt-0 mt-auto">
                                <div className="bg-muted p-2 rounded text-sm mt-4">
                                    <div className="flex justify-between mb-1">
                                        <span className="text-muted-foreground">Meta:</span>
                                        <span className="font-medium">{obj.meta} {obj.unidad}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Actual:</span>
                                        <span className="font-medium">{obj.resultadoActual || 'Sin medir'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
