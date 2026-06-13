"use client";

import React, { useEffect, useState } from 'react';
import { Plus, Lightbulb } from 'lucide-react';

export function OportunidadesTab({ currentUser }: { currentUser: any }) {
    const [oportunidades, setOportunidades] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchOportunidades();
    }, []);

    const fetchOportunidades = async () => {
        try {
            const res = await fetch('/api/sgi/oportunidades');
            if (res.ok) {
                const data = await res.json();
                setOportunidades(data);
            }
        } catch (error) {
            console.error('Error fetching oportunidades:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-muted-foreground">Cargando oportunidades...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-semibold tracking-tight">Oportunidades de Mejora</h2>
                    <p className="text-muted-foreground">Gestión de oportunidades (ISO 9001 Cl. 6.1)</p>
                </div>
                <button className="btn-primary flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Nueva Oportunidad
                </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {oportunidades.length === 0 ? (
                    <div className="col-span-full p-8 text-center bg-muted/20 rounded-lg border border-dashed">
                        No hay oportunidades registradas.
                    </div>
                ) : (
                    oportunidades.map((opt: any) => (
                        <div key={opt.id} className="bg-card rounded-xl border shadow-sm cursor-pointer hover:shadow-md transition-shadow flex flex-col">
                            <div className="p-4 pb-2 flex-1">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-xs font-semibold px-2 py-1 bg-muted rounded-full">{opt.codigo}</span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-blue-100 text-blue-800`}>
                                        {opt.estado}
                                    </span>
                                </div>
                                <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
                                    <Lightbulb className="h-4 w-4 text-yellow-500" />
                                    {opt.titulo}
                                </h3>
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                    {opt.descripcion}
                                </p>
                            </div>
                            <div className="p-4 pt-0 mt-auto">
                                <div className="text-xs text-muted-foreground bg-muted p-2 rounded mt-4">
                                    <strong className="block mb-1">Beneficio Esperado:</strong> 
                                    {opt.beneficioEsperado || 'No definido'}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
