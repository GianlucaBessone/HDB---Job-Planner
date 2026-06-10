import { useState, useEffect } from 'react';
import { ShieldAlert, Plus, Search, Filter, LayoutDashboard, ListTodo, KanbanSquare } from 'lucide-react';
import NewNcModal from './NewNcModal';
import NcDetailModal from './NcDetailModal';

export default function NcTab({ user }: { user: any }) {
    const [search, setSearch] = useState('');
    const [view, setView] = useState<'dashboard' | 'kanban' | 'list'>('dashboard');
    const [ncs, setNcs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedNcId, setSelectedNcId] = useState<string | null>(null);

    const fetchNcs = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/sgi/nc');
            if (res.ok) {
                const data = await res.json();
                setNcs(data);
            }
        } catch (error) {
            console.error('Error fetching NCs:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNcs();
    }, []);

    const ncAbiertas = ncs.filter(nc => nc.estado !== 'Cerrada');
    const ncCerradas = ncs.filter(nc => nc.estado === 'Cerrada');
    const ncCriticas = ncs.filter(nc => nc.criticidad === 'Crítica' && nc.estado !== 'Cerrada');

    // Kanban columns
    const columns = [
        { id: 'Abierta', title: 'Abierta' },
        { id: 'En análisis', title: 'En análisis' },
        { id: 'Acción definida', title: 'Acción definida' },
        { id: 'En ejecución', title: 'En ejecución' },
        { id: 'Pendiente de validación', title: 'Pendiente validación' },
        { id: 'Cerrada', title: 'Cerrada' }
    ];

    const filteredNcs = ncs.filter(nc => 
        (nc.codigoNC?.toLowerCase() || '').includes(search.toLowerCase()) || 
        (nc.descripcion?.toLowerCase() || '').includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5 text-red-500" />
                        Gestión de No Conformidades (NC)
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Registro, análisis de causa raíz y seguimiento de desvíos operativos y normativos.
                    </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2" onClick={() => setIsModalOpen(true)}>
                        <Plus className="w-4 h-4" />
                        Nueva NC
                    </button>
                </div>
            </div>

            <div className="flex items-center justify-between bg-card p-2 rounded-lg border gap-4">
                <div className="flex items-center gap-1 bg-muted p-1 rounded-md">
                    <button 
                        onClick={() => setView('dashboard')}
                        className={`p-2 rounded flex items-center gap-2 text-sm font-medium transition-colors ${view === 'dashboard' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:bg-background/50'}`}
                    >
                        <LayoutDashboard className="w-4 h-4" /> <span className="hidden sm:inline">Dashboard</span>
                    </button>
                    <button 
                        onClick={() => setView('kanban')}
                        className={`p-2 rounded flex items-center gap-2 text-sm font-medium transition-colors ${view === 'kanban' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:bg-background/50'}`}
                    >
                        <KanbanSquare className="w-4 h-4" /> <span className="hidden sm:inline">Kanban</span>
                    </button>
                    <button 
                        onClick={() => setView('list')}
                        className={`p-2 rounded flex items-center gap-2 text-sm font-medium transition-colors ${view === 'list' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:bg-background/50'}`}
                    >
                        <ListTodo className="w-4 h-4" /> <span className="hidden sm:inline">Lista</span>
                    </button>
                </div>
                
                <div className="relative flex-1 max-w-md hidden sm:block">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Buscar NC..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 h-10 w-full bg-transparent border rounded-md focus:ring-1 focus:ring-primary text-sm"
                    />
                </div>
            </div>

            {loading ? (
                <div className="h-64 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : (
                <>
                    {view === 'dashboard' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-card border p-4 rounded-lg flex flex-col items-center">
                                    <span className="text-sm text-muted-foreground">NC Abiertas</span>
                                    <span className="text-3xl font-bold text-foreground mt-2">{ncAbiertas.length}</span>
                                </div>
                                <div className="bg-card border p-4 rounded-lg flex flex-col items-center">
                                    <span className="text-sm text-muted-foreground">NC Cerradas</span>
                                    <span className="text-3xl font-bold text-foreground mt-2">{ncCerradas.length}</span>
                                </div>
                                <div className="bg-card border p-4 rounded-lg flex flex-col items-center">
                                    <span className="text-sm text-muted-foreground">NC Críticas Activas</span>
                                    <span className="text-3xl font-bold text-red-500 mt-2">{ncCriticas.length}</span>
                                </div>
                            </div>
                            
                            <div className="bg-card border rounded-lg p-6 flex flex-col items-center justify-center text-center text-muted-foreground min-h-[300px]">
                                <LayoutDashboard className="w-12 h-12 mb-4 opacity-20" />
                                <h3 className="font-medium text-foreground mb-1">Métricas Detalladas</h3>
                                <p className="text-sm max-w-md">Gráficos de NC por proceso, categoría y tiempos promedios de cierre en desarrollo para el Dashboard SGI.</p>
                            </div>
                        </div>
                    )}

                    {view === 'kanban' && (
                        <div className="flex gap-4 overflow-x-auto pb-4 items-start min-h-[500px]">
                            {columns.map(col => (
                                <div key={col.id} className="bg-muted/50 rounded-lg p-3 min-w-[280px] w-[280px] flex-shrink-0 border flex flex-col gap-3">
                                    <div className="flex justify-between items-center px-1">
                                        <h3 className="font-semibold text-sm">{col.title}</h3>
                                        <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">
                                            {filteredNcs.filter(nc => nc.estado === col.id).length}
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        {filteredNcs.filter(nc => nc.estado === col.id).map(nc => (
                                            <div key={nc.id} onClick={() => setSelectedNcId(nc.id)} className="bg-card p-3 rounded shadow-sm border text-sm cursor-pointer hover:border-primary transition-colors">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="font-semibold text-primary">{nc.codigoNC}</span>
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${nc.criticidad === 'Crítica' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                                                        {nc.criticidad}
                                                    </span>
                                                </div>
                                                <p className="line-clamp-2 text-muted-foreground text-xs mb-3">{nc.descripcion}</p>
                                                <div className="flex justify-between items-center text-xs text-muted-foreground">
                                                    <span>{new Date(nc.fechaDeteccion).toLocaleDateString()}</span>
                                                    <span>{nc.categoria}</span>
                                                </div>
                                            </div>
                                        ))}
                                        {filteredNcs.filter(nc => nc.estado === col.id).length === 0 && (
                                            <div className="text-center p-4 border border-dashed rounded text-muted-foreground text-xs">
                                                Sin NCs en este estado
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {view === 'list' && (
                        <div className="border rounded-lg overflow-hidden bg-card">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                                        <tr>
                                            <th className="px-4 py-3">Código</th>
                                            <th className="px-4 py-3">Fecha</th>
                                            <th className="px-4 py-3">Origen</th>
                                            <th className="px-4 py-3">Tipo / Categoría</th>
                                            <th className="px-4 py-3">Estado</th>
                                            <th className="px-4 py-3">Criticidad</th>
                                            <th className="px-4 py-3">Responsable</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredNcs.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                                                    No se encontraron No Conformidades.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredNcs.map(nc => (
                                                <tr key={nc.id} onClick={() => setSelectedNcId(nc.id)} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer">
                                                    <td className="px-4 py-3 font-medium text-primary">{nc.codigoNC}</td>
                                                    <td className="px-4 py-3">{new Date(nc.fechaDeteccion).toLocaleDateString()}</td>
                                                    <td className="px-4 py-3">{nc.origen}</td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-col">
                                                            <span>{nc.tipoNC}</span>
                                                            <span className="text-xs text-muted-foreground">{nc.categoria}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="px-2 py-1 bg-muted rounded-full text-xs whitespace-nowrap">
                                                            {nc.estado}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-1 rounded-full text-xs whitespace-nowrap ${nc.criticidad === 'Crítica' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                                                            {nc.criticidad}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {nc.responsablesTratamiento && nc.responsablesTratamiento.length > 0 
                                                            ? nc.responsablesTratamiento.map((r: any) => r.nombreCompleto).join(', ') 
                                                            : '-'}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}

            <NewNcModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                onSuccess={() => { setIsModalOpen(false); fetchNcs(); }} 
                user={user} 
            />

            <NcDetailModal
                ncId={selectedNcId}
                isOpen={!!selectedNcId}
                onClose={() => setSelectedNcId(null)}
                onUpdate={fetchNcs}
            />
        </div>
    );
}
