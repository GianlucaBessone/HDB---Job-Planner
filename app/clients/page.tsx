'use client';

import { useState, useEffect, useMemo } from 'react';
import {
    Plus,
    Search,
    Trash2,
    Edit3,
    CheckCircle2,
    XCircle,
    UserCircle2,
    Mail,
    Phone,
    MapPin,
    X,
    AlertCircle,
} from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';

interface Client {
    id: string;
    nombre: string;
    email?: string;
    telefono?: string;
    direccion?: string;
    activo: boolean;
}

const EMPTY_FORM = {
    nombre: '',
    email: '',
    telefono: '',
    direccion: '',
    activo: true,
};

const normalize = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function ClientsPage() {
    const [clients, setClients] = useState<Client[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const [formData, setFormData] = useState(EMPTY_FORM);

    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [clientToDelete, setClientToDelete] = useState<string | null>(null);

    useEffect(() => {
        loadClients();
    }, []);

    const loadClients = async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const data = await fetch('/api/clients').then(res => res.json());
            if (Array.isArray(data)) {
                setClients(data);
            } else {
                console.error('API returned non-array data:', data);
                setClients([]);
            }
        } catch (e) {
            console.error(e);
            setClients([]);
        } finally {
            if (!silent) setIsLoading(false);
        }
    };

    const openCreate = () => {
        setEditingClient(null);
        setFormData(EMPTY_FORM);
        setIsModalOpen(true);
    };

    const openEdit = (client: Client) => {
        setEditingClient(client);
        setFormData({
            nombre: client.nombre,
            email: client.email || '',
            telefono: client.telefono || '',
            direccion: client.direccion || '',
            activo: client.activo,
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.nombre.trim()) return;
        const method = editingClient ? 'PATCH' : 'POST';
        const url = editingClient ? `/api/clients?id=${editingClient.id}` : '/api/clients';
        await fetch(url, { method, body: JSON.stringify(formData) });
        setIsModalOpen(false);
        loadClients(true);
    };

    const handleDeleteClick = (id: string) => {
        setClientToDelete(id);
        setIsConfirmOpen(true);
    };

    const confirmDelete = async () => {
        if (!clientToDelete) return;
        const id = clientToDelete;
        setClients(prev => prev.filter(c => c.id !== id));
        await fetch(`/api/clients?id=${id}`, { method: 'DELETE' });
        setIsConfirmOpen(false);
        setClientToDelete(null);
    };

    const toggleStatus = async (id: string, currentStatus: boolean) => {
        setClients(prev => prev.map(c => c.id === id ? { ...c, activo: !currentStatus } : c));
        await fetch(`/api/clients?id=${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ activo: !currentStatus })
        });
    };

    const filteredClients = useMemo(() => {
        return clients.filter(c => {
            const search = normalize(searchTerm);
            return (
                normalize(c.nombre).includes(search) ||
                normalize(c.email || '').includes(search) ||
                normalize(c.telefono || '').includes(search)
            );
        });
    }, [clients, searchTerm]);

    return (
        <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div className="space-y-1">
                    <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Gestión de Clientes</h2>
                    <p className="text-slate-500 font-medium">Administra la base de datos de tus clientes</p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64 group">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar clientes..."
                            className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium shadow-sm"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={openCreate}
                        className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-primary/90 shadow-lg shadow-primary/20 active:scale-95 transition-all shrink-0"
                    >
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">Nuevo Cliente</span>
                        <span className="sm:hidden">Nuevo</span>
                    </button>
                </div>
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {Array(6).fill(0).map((_, i) => (
                        <div key={i} className="bg-slate-100/60 rounded-2xl animate-pulse h-48" />
                    ))}
                </div>
            ) : filteredClients.length === 0 ? (
                <div className="py-24 flex flex-col items-center justify-center bg-white border border-slate-200 rounded-2xl text-slate-400">
                    <AlertCircle className="w-12 h-12 mb-4 opacity-20" />
                    <p className="font-semibold text-slate-600">No se encontraron clientes</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredClients.map(client => (
                        <ClientCard
                            key={client.id}
                            client={client}
                            onEdit={openEdit}
                            onDelete={handleDeleteClick}
                            onToggleStatus={toggleStatus}
                        />
                    ))}
                </div>
            )}

            {/* Modals */}
            {isModalOpen && (
                <ClientModal
                    formData={formData}
                    setFormData={setFormData}
                    editingClient={editingClient}
                    onSubmit={handleSubmit}
                    onClose={() => setIsModalOpen(false)}
                />
            )}

            <ConfirmDialog
                isOpen={isConfirmOpen}
                title="Eliminar Cliente"
                message="¿Estás seguro de que deseas eliminar este cliente? Esta acción no se puede deshacer."
                onConfirm={confirmDelete}
                onCancel={() => setIsConfirmOpen(false)}
            />
        </div>
    );
}

function ClientCard({ client, onEdit, onDelete, onToggleStatus }: {
    client: Client;
    onEdit: (c: Client) => void;
    onDelete: (id: string) => void;
    onToggleStatus: (id: string, current: boolean) => void;
}) {
    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-slate-300 transition-all duration-300 p-5 flex flex-col gap-4 group">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${client.activo ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-400'}`}>
                        <UserCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-800 leading-tight line-clamp-1 group-hover:text-primary transition-colors">
                            {client.nombre}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`w-2 h-2 rounded-full ${client.activo ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                {client.activo ? 'Activo' : 'Inactivo'}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={() => onEdit(client)}
                        className="p-2 rounded-xl text-slate-400 hover:text-primary hover:bg-primary/5 transition-all"
                    >
                        <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => onDelete(client.id)}
                        className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="space-y-2.5 mt-2">
                {client.email && (
                    <div className="flex items-center gap-2.5 text-slate-600">
                        <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="text-sm truncate">{client.email}</span>
                    </div>
                )}
                {client.telefono && (
                    <div className="flex items-center gap-2.5 text-slate-600">
                        <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="text-sm">{client.telefono}</span>
                    </div>
                )}
                {client.direccion && (
                    <div className="flex items-center gap-2.5 text-slate-600">
                        <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="text-sm line-clamp-1">{client.direccion}</span>
                    </div>
                )}
            </div>

            <div className="pt-4 mt-auto border-t border-slate-50 flex items-center justify-between">
                <button
                    onClick={() => onToggleStatus(client.id, client.activo)}
                    className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all ${client.activo
                        ? 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                        : 'text-primary hover:bg-primary/5'
                        }`}
                >
                    {client.activo ? 'Desactivar' : 'Reactivar'}
                </button>
                <button
                    onClick={() => onEdit(client)}
                    className="text-[10px] font-bold text-primary uppercase tracking-wider hover:underline"
                >
                    Ver detalles
                </button>
            </div>
        </div>
    );
}

function ClientModal({ formData, setFormData, editingClient, onSubmit, onClose }: any) {
    const setField = (field: string, value: any) => setFormData((prev: any) => ({ ...prev, [field]: value }));

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="p-7 space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                        <h3 className="text-xl font-bold text-slate-800">
                            {editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}
                        </h3>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <form onSubmit={onSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Nombre Completo *</label>
                            <input
                                required
                                type="text"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                placeholder="Ej: Arcor S.A."
                                value={formData.nombre}
                                onChange={e => setField('nombre', e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Email</label>
                                <input
                                    type="email"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                    placeholder="contacto@empresa.com"
                                    value={formData.email}
                                    onChange={e => setField('email', e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Teléfono</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                    placeholder="+54 9 11 ..."
                                    value={formData.telefono}
                                    onChange={e => setField('telefono', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Dirección</label>
                            <input
                                type="text"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                placeholder="Calle, Altura, Ciudad"
                                value={formData.direccion}
                                onChange={e => setField('direccion', e.target.value)}
                            />
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 bg-slate-100 text-slate-600 py-3.5 rounded-2xl font-bold hover:bg-slate-200 transition-all active:scale-95"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="flex-[1.5] bg-primary text-white py-3.5 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95"
                            >
                                {editingClient ? 'Guardar Cambios' : 'Crear Cliente'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
