'use client';

import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { MoreVertical, Calendar, Mail, MessageCircle, Star, BrainCircuit, UserPlus, Trash2, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import ModuleHeader from '@/components/ModuleHeader';
import AddCandidateModal from '@/components/rrhh/AddCandidateModal';
import ConfirmModal from '@/components/ConfirmModal';

const initialStages = [
    { id: 'POSTULADO', title: 'Postulados' },
    { id: 'PRESELECCION', title: 'Preselección' },
    { id: 'CONTACTADO', title: 'Contactados' },
    { id: 'ENTREVISTA_RRHH', title: 'Entrevista RRHH' },
    { id: 'ENTREVISTA_TEC', title: 'Entrevista Técnica' },
    { id: 'FINALISTAS', title: 'Finalistas' },
    { id: 'CONTRATADO', title: 'Contratado' },
];

import { getPipelineCandidates, updateCandidateStage, getVacancy, deleteVacancy } from '@/app/rrhh/actions';

export default function PipelinePage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const [columns, setColumns] = useState<{ [key: string]: any[] }>({});
    const [isClient, setIsClient] = useState(false);
    const [vacancy, setVacancy] = useState<any>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [addModalInitialStage, setAddModalInitialStage] = useState('POSTULADO');
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        setIsClient(true);
        loadVacancy();
        loadCandidates();
    }, [params.id]);

    const loadVacancy = async () => {
        try {
            const res = await getVacancy(params.id);
            if (res.success && res.data) {
                setVacancy(res.data);
            }
        } catch (error) {
            console.error("Error loading vacancy:", error);
        }
    };

    const loadCandidates = async () => {
        const res = await getPipelineCandidates(params.id);
        if (res.success && res.data) {
            const initialCols: { [key: string]: any[] } = {};
            initialStages.forEach(s => initialCols[s.id] = []);
            
            res.data.forEach((c: any) => {
                const stage = c.stageHistory?.[0]?.stage || 'POSTULADO';
                if (!initialCols[stage]) initialCols[stage] = [];
                initialCols[stage].push({
                    id: c.id,
                    name: `${c.firstName} ${c.lastName}`,
                    score: c.aiScore || 0,
                    role: c.email || '--', // Using email as role placeholder for now
                    tags: c.tags?.map((t: any) => t.name) || [],
                    stageId: stage
                });
            });
            setColumns(initialCols);
        }
    };

    const handleDeleteVacancy = async () => {
        setIsDeleting(true);
        try {
            const res = await deleteVacancy(params.id);
            if (res.success) {
                router.push('/rrhh/reclutamiento/vacantes');
            } else {
                alert('Error al eliminar vacante: ' + res.error);
            }
        } catch (err: any) {
            alert('Error al eliminar: ' + err.message);
        } finally {
            setIsDeleting(false);
        }
    };

    const onDragEnd = (result: DropResult) => {
        const { source, destination } = result;

        if (!destination) return;
        if (source.droppableId === destination.droppableId && source.index === destination.index) return;

        const sourceCol = columns[source.droppableId];
        const destCol = columns[destination.droppableId];
        const sourceClone = Array.from(sourceCol);
        const destClone = Array.from(destCol);
        const [removed] = sourceClone.splice(source.index, 1);

        if (source.droppableId === destination.droppableId) {
            sourceClone.splice(destination.index, 0, removed);
            setColumns({
                ...columns,
                [source.droppableId]: sourceClone
            });
        } else {
            removed.stageId = destination.droppableId; // Update local state stage
            destClone.splice(destination.index, 0, removed);
            setColumns({
                ...columns,
                [source.droppableId]: sourceClone,
                [destination.droppableId]: destClone
            });
            
            // Update in DB
            updateCandidateStage(removed.id, params.id, destination.droppableId).catch(err => {
                console.error("Error updating stage:", err);
            });
        }
    };

    if (!isClient) return null; // Avoid SSR hydration mismatch

    const totalCandidatesCount = Object.values(columns).reduce((acc, col) => acc + (col?.length || 0), 0);

    return (
        <div className="w-full max-w-[1600px] mx-auto p-4 md:p-6 flex flex-col h-screen animate-in fade-in">
            <ModuleHeader
                title={vacancy ? `Pipeline: ${vacancy.title}` : "Pipeline de Reclutamiento"}
                description={
                    vacancy
                        ? `${vacancy.branch ? `${vacancy.branch} • ` : ''}${totalCandidatesCount} postulante(s) en proceso`
                        : "Arrastra los candidatos entre las diferentes etapas"
                }
                actions={[
                    {
                        id: 'add-candidate',
                        label: 'Cargar Postulante',
                        icon: <UserPlus className="w-4 h-4" />,
                        onClick: () => {
                            setAddModalInitialStage('POSTULADO');
                            setIsAddModalOpen(true);
                        },
                        variant: 'primary'
                    },
                    {
                        id: 'delete-vacancy',
                        label: 'Eliminar Vacante',
                        icon: <Trash2 className="w-4 h-4" />,
                        onClick: () => setIsDeleteModalOpen(true),
                        variant: 'danger'
                    },
                    {
                        id: 'back',
                        label: 'Volver',
                        onClick: () => router.push('/rrhh/reclutamiento/vacantes'),
                        variant: 'outline'
                    }
                ]}
            />

            <div className="flex-1 overflow-auto pb-4">
                <DragDropContext onDragEnd={onDragEnd}>
                    <div className="flex gap-4 min-h-full items-start">
                        {initialStages.map(stage => (
                            <div key={stage.id} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 min-w-[300px] w-[300px] flex flex-col border border-slate-200 dark:border-slate-700 shadow-sm flex-shrink-0">
                                <div className="flex items-center justify-between mb-3 px-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200 uppercase tracking-wider">{stage.title}</h3>
                                        <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold px-2 py-0.5 rounded-full">
                                            {columns[stage.id]?.length || 0}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setAddModalInitialStage(stage.id);
                                            setIsAddModalOpen(true);
                                        }}
                                        className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                        title={`Cargar postulante en ${stage.title}`}
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>

                                <Droppable droppableId={stage.id}>
                                    {(provided, snapshot) => (
                                        <div
                                            {...provided.droppableProps}
                                            ref={provided.innerRef}
                                            className={`min-h-[150px] space-y-3 p-1 rounded-lg transition-colors ${
                                                snapshot.isDraggingOver ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''
                                            }`}
                                        >
                                            {columns[stage.id]?.map((candidate, index) => (
                                                <Draggable key={candidate.id} draggableId={candidate.id} index={index}>
                                                    {(provided, snapshot) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            {...provided.dragHandleProps}
                                                            className={`bg-white dark:bg-slate-900 border ${
                                                                snapshot.isDragging ? 'border-indigo-400 shadow-lg scale-[1.02]' : 'border-slate-200 dark:border-slate-700 shadow-sm'
                                                            } rounded-xl p-4 transition-all group`}
                                                        >
                                                            <div className="flex justify-between items-start mb-2">
                                                                <h4 className="font-bold text-slate-800 dark:text-slate-100">{candidate.name}</h4>
                                                                <div className="flex items-center gap-1 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 px-1.5 py-0.5 rounded text-xs font-bold border border-indigo-100 dark:border-indigo-800">
                                                                    <BrainCircuit className="w-3 h-3" />
                                                                    {candidate.score}%
                                                                </div>
                                                            </div>
                                                            
                                                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">{candidate.role}</p>
                                                            
                                                            <div className="flex flex-wrap gap-1 mb-3">
                                                                {candidate.tags.map((tag: string) => (
                                                                    <span key={tag} className="text-[10px] uppercase font-bold px-1.5 py-0.5 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700">
                                                                        {tag}
                                                                    </span>
                                                                ))}
                                                            </div>

                                                            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between gap-2">
                                                                <button 
                                                                    onClick={() => router.push(`/rrhh/reclutamiento/postulantes/${candidate.id}`)}
                                                                    className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition-colors flex-1 text-center"
                                                                >
                                                                    Ver Perfil
                                                                </button>
                                                                <div className="flex gap-1">
                                                                    <button className="p-1 text-slate-400 hover:text-emerald-500 transition-colors" title="WhatsApp">
                                                                        <MessageCircle className="w-4 h-4" />
                                                                    </button>
                                                                    <button className="p-1 text-slate-400 hover:text-indigo-500 transition-colors" title="Email">
                                                                        <Mail className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                        </div>
                                    )}
                                </Droppable>
                            </div>
                        ))}
                    </div>
                </DragDropContext>
            </div>

            {/* Modal para Cargar Postulante */}
            <AddCandidateModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                vacancyId={params.id}
                vacancyTitle={vacancy?.title}
                initialStage={addModalInitialStage}
                onCandidateAdded={() => {
                    loadCandidates();
                }}
            />

            {/* Modal de Confirmación para Eliminar Vacante */}
            <ConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDeleteVacancy}
                title="¿Eliminar Vacante?"
                message={`¿Estás seguro de que deseas eliminar la vacante "${vacancy?.title || 'esta vacante'}"? Se eliminarán todas las postulaciones asociadas a esta vacante en el pipeline. Los postulantes permanecerán en la Base de Talentos general.`}
                confirmText={isDeleting ? "Eliminando..." : "Eliminar"}
                cancelText="Cancelar"
                isDestructive={true}
            />
        </div>
    );
}
