import { useState, useEffect } from 'react';
import { Target, Plus, Search, LayoutDashboard, ListTodo, KanbanSquare } from 'lucide-react';
import NewCapaModal from './NewCapaModal';

export default function CapaTab({ user }: { user: any }) {
    const [search, setSearch] = useState('');
    const [view, setView] = useState<'dashboard' | 'kanban' | 'list'>('dashboard');
    const [acciones, setAcciones] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const fetchAcciones = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/sgi/capa');
            if (res.ok) {
                const data = await res.json();
                setAcciones(data);
            }
        } catch (error) {
            console.error('Error fetching CAPA:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAcciones();
    }, []);

    const abiertas = acciones.filter(a => a.estado !== 'Cerrada' && a.estado !== 'Cancelada');
    const vencidas = abiertas.filter(a => a.fechaCompromiso && new Date(a.fechaCompromiso) < new Date());
    
    // Calculates average closure time
    const cerradas = acciones.filter(a => a.estado === 'Cerrada' && a.fechaCierre && a.fechaCreacion);
    const avgDays = cerradas.length > 0 
        ? Math.round(cerradas.reduce((acc, curr) => {
            const diff = new Date(curr.fechaCierre).getTime() - new Date(curr.fechaCreacion).getTime();
            return acc + diff / (1000 * 3600 * 24);
        }, 0) / cerradas.length) 
        : 0;

    const eficaces = acciones.filter(a => a.eficacia === 'Eficaz').length;
    const evaluadas = acciones.filter(a => a.eficacia === 'Eficaz' || a.eficacia === 'Ineficaz').length;
    const percentEficacia = evaluadas > 0 ? Math.round((eficaces / evaluadas) * 100) : 0;

    // Kanban columns
    const columns = [
        { id: 'Pendiente', title: 'Pendiente' },
        { id: 'En Progreso', title: 'En Progreso' },
        { id: 'Completada', title: 'Completada (Pendiente Eficacia)' },
        { id: 'Cerrada', title: 'Cerrada' }
    ];

    const filtered = acciones.filter(a => 
        (a.codigoAccion?.toLowerCase() || '').includes(search.toLowerCase()) || 
        (a.descripcion?.toLowerCase() || '').includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Target className="w-5 h-5 text-blue-500" />
                        Sistema CAPA (Acciones Correctivas y Preventivas)
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Gestión unificada de acciones de mejora continua, preventivas y mitigación de riesgos.
                    </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2" onClick={() => setIsModalOpen(true)}>
                        <Plus className="w-4 h-4" />
                        Nueva Acción
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
                        placeholder="Buscar acción CAPA..."
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
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-card p-4 rounded-lg border flex flex-col items-center justify-center">
                                    <span className="text-sm text-muted-foreground">Acciones Abiertas</span>
                                    <span className="text-3xl font-bold mt-2">{abiertas.length}</span>
                                </div>
                                <div className="bg-card p-4 rounded-lg border flex flex-col items-center justify-center">
                                    <span className="text-sm text-muted-foreground">Acciones Vencidas</span>
                                    <span className={`text-3xl font-bold mt-2 ${vencidas.length > 0 ? 'text-red-500' : 'text-foreground'}`}>{vencidas.length}</span>
                                </div>
                                <div className="bg-card p-4 rounded-lg border flex flex-col items-center justify-center">
                                    <span className="text-sm text-muted-foreground">Tiempo Promedio Cierre</span>
                                    <span className="text-3xl font-bold mt-2">{avgDays > 0 ? `${avgDays}d` : '--'}</span>
                                </div>
                                <div className="bg-card p-4 rounded-lg border flex flex-col items-center justify-center">
                                    <span className="text-sm text-muted-foreground">Eficacia Global</span>
                                    <span className={`text-3xl font-bold mt-2 ${percentEficacia >= 80 ? 'text-green-500' : percentEficacia > 0 ? 'text-orange-500' : 'text-foreground'}`}>
                                        {evaluadas > 0 ? `${percentEficacia}%` : '--'}
                                    </span>
                                </div>
                            </div>
                            
                            <div className="bg-card border rounded-lg p-6 flex flex-col items-center justify-center text-center text-muted-foreground min-h-[300px]">
                                <Target className="w-12 h-12 mb-4 opacity-20" />
                                <h3 className="font-medium text-foreground mb-1">Análisis por Tipo y Origen</h3>
                                <p className="text-sm max-w-md">Gráficos detallados de Acciones Preventivas vs Correctivas en desarrollo.</p>
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
                                            {filtered.filter(a => a.estado === col.id).length}
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        {filtered.filter(a => a.estado === col.id).map(accion => (
                                            <div key={accion.id} className="bg-card p-3 rounded shadow-sm border text-sm cursor-pointer hover:border-primary transition-colors">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="font-semibold text-primary">{accion.codigoAccion}</span>
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                                                        {accion.tipoAccion}
                                                    </span>
                                                </div>
                                                <p className="line-clamp-2 text-muted-foreground text-xs mb-3">{accion.descripcion}</p>
                                                
                                                {/* Progress bar */}
                                                <div className="w-full bg-muted rounded-full h-1.5 mb-2">
                                                    <div className="bg-primary h-1.5 rounded-full" style={{ width: `${accion.porcentajeAvance}%` }}></div>
                                                </div>
                                                
                                                <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                                                    <span>Res: {accion.responsable?.nombreCompleto?.split(' ')[0] || 'Sin asig.'}</span>
                                                    {accion.fechaCompromiso && (
                                                        <span className={new Date(accion.fechaCompromiso) < new Date() && accion.estado !== 'Cerrada' ? 'text-red-500 font-bold' : ''}>
                                                            Vto: {new Date(accion.fechaCompromiso).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        {filtered.filter(a => a.estado === col.id).length === 0 && (
                                            <div className="text-center p-4 border border-dashed rounded text-muted-foreground text-xs">
                                                Sin acciones en este estado
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
                                            <th className="px-4 py-3">Tipo / Origen</th>
                                            <th className="px-4 py-3">Prioridad</th>
                                            <th className="px-4 py-3">Estado</th>
                                            <th className="px-4 py-3">Avance</th>
                                            <th className="px-4 py-3">Responsable</th>
                                            <th className="px-4 py-3">Vencimiento</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                                                    No se encontraron Acciones CAPA.
                                                </td>
                                            </tr>
                                        ) : (
                                            filtered.map(accion => (
                                                <tr key={accion.id} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer">
                                                    <td className="px-4 py-3 font-medium text-primary">{accion.codigoAccion}</td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-col">
                                                            <span>{accion.tipoAccion}</span>
                                                            <span className="text-xs text-muted-foreground">{accion.origen}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-1 rounded-full text-[10px] whitespace-nowrap ${accion.prioridad === 'Alta' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                            {accion.prioridad}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="px-2 py-1 bg-muted rounded-full text-[10px] whitespace-nowrap">
                                                            {accion.estado}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-16 bg-muted rounded-full h-1.5">
                                                                <div className="bg-primary h-1.5 rounded-full" style={{ width: `${accion.porcentajeAvance}%` }}></div>
                                                            </div>
                                                            <span className="text-xs text-muted-foreground">{accion.porcentajeAvance}%</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">{accion.responsable?.nombreCompleto || '-'}</td>
                                                    <td className="px-4 py-3 text-xs">
                                                        {accion.fechaCompromiso ? new Date(accion.fechaCompromiso).toLocaleDateString() : '-'}
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

            <NewCapaModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                onSuccess={() => { setIsModalOpen(false); fetchAcciones(); }} 
                user={user} 
            />
        </div>
    );
}
