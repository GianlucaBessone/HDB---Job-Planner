'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { IdCard } from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';
import { Badge, EmptyState, ErrorState, LoadingState, Panel, SegmentedControl } from '@/components/ui';
import { api } from '@/components/presupuestosServicio/cliente';
import { antiguedad, type ResumenLegajo } from '@/lib/legajoTipos';

/**
 * Legajo del personal (auditoría, faltante): cada persona con su ingreso, contacto de emergencia y documentos con
 * vencimiento (apto médico, licencia, ART, habilitaciones).
 */
type Estado = 'activos' | 'inactivos' | 'todos';
type Filtro = 'todos' | 'atencion' | 'incompletos';

const fechaCorta = (f: string | null) => (f ? new Date(`${f}T12:00:00`).toLocaleDateString('es-AR') : '—');

export default function LegajosPage() {
    const [estado, setEstado] = useState<Estado>('activos');
    const [filtro, setFiltro] = useState<Filtro>('todos');
    const [q, setQ] = useState('');
    const [personas, setPersonas] = useState<ResumenLegajo[] | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        setPersonas(null);
        setError(false);
        api<{ personas: ResumenLegajo[] }>(`/api/rrhh/legajos?estado=${estado}`)
            .then((r) => setPersonas(r.personas))
            .catch(() => setError(true));
    }, [estado]);

    const conteo = useMemo(() => {
        const l = personas || [];
        return {
            atencion: l.filter((p) => p.vencidos + p.porVencer > 0).length,
            incompletos: l.filter((p) => !p.fechaIngreso || !p.contactoEmergencia).length,
        };
    }, [personas]);

    const lista = useMemo(() => {
        const t = q.trim().toLowerCase();
        return (personas || []).filter(
            (p) =>
                (!t || p.nombreCompleto.toLowerCase().includes(t) || (p.legajo || '').toLowerCase().includes(t) || (p.posicion || '').toLowerCase().includes(t)) &&
                (filtro === 'todos' || (filtro === 'atencion' ? p.vencidos + p.porVencer > 0 : !p.fechaIngreso || !p.contactoEmergencia))
        );
    }, [personas, q, filtro]);

    return (
        <div className="w-full space-y-5">
            <ModuleHeader
                title="Legajo del personal"
                description="Ingreso, contacto de emergencia y documentos que vencen de cada persona"
                icon={<IdCard className="w-5 h-5" />}
                tabs={[
                    { id: 'activos', label: 'Activos' },
                    { id: 'inactivos', label: 'Inactivos' },
                    { id: 'todos', label: 'Todos' },
                ]}
                activeTabId={estado}
                onTabChange={(id) => setEstado(id as Estado)}
                searchValue={q}
                onSearchChange={setQ}
                searchPlaceholder="Buscar por nombre, legajo o puesto…"
            />

            {error ? (
                <ErrorState title="No se pudo cargar el personal" description="Probá de nuevo en un momento." />
            ) : !personas ? (
                <LoadingState label="Cargando legajos…" />
            ) : (
                <>
                    <SegmentedControl<Filtro>
                        label="Filtrar legajos"
                        options={[
                            { value: 'todos', label: `Todos (${personas.length})` },
                            { value: 'atencion', label: `Con vencimientos (${conteo.atencion})` },
                            { value: 'incompletos', label: `Datos incompletos (${conteo.incompletos})` },
                        ]}
                        value={filtro}
                        onChange={setFiltro}
                    />
                    {lista.length === 0 ? (
                        <EmptyState icon={<IdCard />} title="Nadie coincide con el filtro" description="Probá con otra búsqueda o con otro filtro." />
                    ) : (
                        <Panel padded={false}>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-surface-sunken text-xs text-muted-foreground">
                                        <tr>
                                            <th className="text-left font-medium px-4 py-2">Persona</th>
                                            <th className="text-left font-medium px-4 py-2">Legajo</th>
                                            <th className="text-left font-medium px-4 py-2">Ingreso</th>
                                            <th className="text-left font-medium px-4 py-2">Contacto de emergencia</th>
                                            <th className="text-left font-medium px-4 py-2">Documentos</th>
                                            <th className="text-left font-medium px-4 py-2">Próximo vencimiento</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {lista.map((p) => (
                                            <tr key={p.id} className="hover:bg-surface-sunken transition-colors">
                                                <td className="px-4 py-2.5">
                                                    <Link href={`/rrhh/legajo/${p.id}`} className="font-medium text-foreground hover:underline">
                                                        {p.nombreCompleto}
                                                    </Link>
                                                    <span className="block text-xs text-muted-foreground">
                                                        {p.posicion || 'Sin puesto'}
                                                        {!p.activo && ' · inactivo'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5 tabular-nums">{p.legajo || '—'}</td>
                                                <td className="px-4 py-2.5">
                                                    {p.fechaIngreso ? (
                                                        <>
                                                            <span className="tabular-nums">{fechaCorta(p.fechaIngreso)}</span>
                                                            <span className="block text-xs text-muted-foreground">{antiguedad(p.fechaIngreso)}</span>
                                                        </>
                                                    ) : (
                                                        <Badge tone="neutral">Sin cargar</Badge>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2.5">{p.contactoEmergencia ? <Badge tone="success">Cargado</Badge> : <Badge tone="warning">Falta</Badge>}</td>
                                                <td className="px-4 py-2.5">
                                                    <span className="flex flex-wrap items-center gap-1.5">
                                                        <span className="tabular-nums">{p.documentos}</span>
                                                        {p.vencidos > 0 && <Badge tone="danger">{p.vencidos} vencido{p.vencidos === 1 ? '' : 's'}</Badge>}
                                                        {p.porVencer > 0 && <Badge tone="warning">{p.porVencer} por vencer</Badge>}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5 tabular-nums">{fechaCorta(p.proximoVencimiento)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Panel>
                    )}
                </>
            )}
        </div>
    );
}
