"use client";

import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';

export function RiesgosTab({ currentUser }: { currentUser: any }) {
    const [riesgos, setRiesgos] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchRiesgos();
    }, []);

    const fetchRiesgos = async () => {
        try {
            const res = await fetch('/api/sgi/riesgos');
            if (res.ok) {
                const data = await res.json();
                setRiesgos(data);
            }
        } catch (error) {
            console.error('Error fetching riesgos:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-muted-foreground">Cargando riesgos...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-semibold tracking-tight">Matriz de Riesgos</h2>
                    <p className="text-muted-foreground">Gestión de riesgos organizacionales (ISO 9001 Cl. 6.1)</p>
                </div>
                <button className="btn-primary flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Nuevo Riesgo
                </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {riesgos.length === 0 ? (
                    <div className="col-span-full p-8 text-center bg-muted/20 rounded-lg border border-dashed">
                        No hay riesgos registrados.
                    </div>
                ) : (
                    riesgos.map((riesgo: any) => (
                        <div key={riesgo.id} className="bg-card rounded-xl border shadow-sm cursor-pointer hover:shadow-md transition-shadow flex flex-col">
                            <div className="p-4 pb-2 flex-1">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-xs font-semibold px-2 py-1 bg-muted rounded-full">{riesgo.codigo}</span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${riesgo.estado === 'Cerrado' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                                        {riesgo.estado}
                                    </span>
                                </div>
                                <h3 className="text-lg font-bold mb-1">{riesgo.titulo}</h3>
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                    {riesgo.descripcion}
                                </p>
                            </div>
                            <div className="p-4 pt-0 mt-auto">
                                <div className="flex justify-between items-center text-xs text-muted-foreground mt-4">
                                    <span className="font-medium bg-red-100 text-red-800 px-2 py-1 rounded dark:bg-red-900/30 dark:text-red-400">
                                        Nivel: {riesgo.nivelRiesgo}
                                    </span>
                                    <span>{new Date(riesgo.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
