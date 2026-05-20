import { useState, useEffect } from 'react';
import { safeApiRequest } from '@/lib/offline';
import { Search, Plus, FileText, Edit2, ShieldCheck, Eye, Trash2 } from 'lucide-react';
import { showToast } from '@/components/Toast';
import DocumentDetailModal from './DocumentDetailModal';
import NewDocumentModal from './NewDocumentModal';

export default function LibraryTab({ user }: { user: any }) {
    const [docs, setDocs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
    const [isNewModalOpen, setIsNewModalOpen] = useState(false);

    useEffect(() => {
        loadDocs();
    }, [searchQuery]);

    const loadDocs = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            if (searchQuery) params.set('search', searchQuery);
            const res = await safeApiRequest(`/api/documentos?${params}`);
            if (res.ok) setDocs(await res.json());
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-3">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text" placeholder="Buscar documento..."
                        value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold outline-none focus:border-primary"
                    />
                </div>
                <button
                    onClick={() => setIsNewModalOpen(true)}
                    className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-2xl font-black text-sm hover:bg-primary/90 transition-all active:scale-95 shadow-md"
                >
                    <Plus className="w-4 h-4" /> Nuevo
                </button>
            </div>

            {isLoading ? (
                 <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {docs.map(doc => (
                        <div key={doc.id} className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-3">
                                <span className="text-[10px] font-black font-mono bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-600 dark:text-slate-300">
                                    {doc.codigoDocumental}
                                </span>
                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded ${
                                    doc.estado === 'vigente' ? 'bg-emerald-50 text-emerald-600' :
                                    doc.estado === 'borrador' ? 'bg-slate-100 text-slate-600' :
                                    'bg-amber-50 text-amber-600'
                                }`}>
                                    {doc.estado}
                                </span>
                            </div>
                            <h3 className="font-black text-slate-800 dark:text-slate-100 text-base mb-1">{doc.titulo}</h3>
                            <p className="text-xs font-bold text-slate-500 mb-4">{doc.tipoDocumento} • {doc.area}</p>
                            
                            <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100 dark:border-slate-700">
                                <span className="text-xs font-bold text-slate-400">v{doc.versionActual}</span>
                                <div className="flex gap-1">
                                    <button 
                                        onClick={() => setSelectedDocId(doc.id)}
                                        className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                    >
                                        <Eye className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {selectedDocId && (
                <DocumentDetailModal 
                    documentId={selectedDocId} 
                    onClose={() => {
                        setSelectedDocId(null);
                        loadDocs();
                    }} 
                    user={user}
                />
            )}

            {isNewModalOpen && (
                <NewDocumentModal 
                    user={user}
                    onClose={() => setIsNewModalOpen(false)}
                    onSuccess={(id) => {
                        setIsNewModalOpen(false);
                        loadDocs();
                        setSelectedDocId(id);
                    }}
                />
            )}
        </div>
    );
}
