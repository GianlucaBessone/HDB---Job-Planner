'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import ModuleHeader from '@/components/ModuleHeader';
import { Mail, MessageCircle, Phone, MapPin, BrainCircuit, Linkedin, FileText, CheckCircle2, AlertTriangle, XCircle, Clock, ChevronRight, Briefcase } from 'lucide-react';

const mockCandidate = {
    id: 'c1',
    firstName: 'Juan',
    lastName: 'Perez',
    phone: '+54 11 1234 5678',
    email: 'juan.perez@example.com',
    city: 'Buenos Aires',
    linkedin: 'linkedin.com/in/juanperez',
    status: 'ACTIVO',
    aiScore: 96,
    tags: ['Buen potencial', 'Backend', 'Senior'],
    experience: [
        { company: 'Tech Corp', position: 'Senior Backend Developer', startDate: '2020', endDate: 'Presente', description: 'Desarrollo de microservicios con Node.js y Python.' },
        { company: 'Startup SA', position: 'Backend Developer', startDate: '2017', endDate: '2020', description: 'Mantenimiento de API RESTful en Express.' }
    ],
    skills: ['Node.js', 'Python', 'AWS', 'Docker', 'PostgreSQL', 'Microservicios', 'Comunicación'],
    aiAnalysis: {
        strengths: ['Amplia experiencia en tecnologías requeridas (Node, Python)', 'Perfil Senior comprobable', 'Conocimientos de infraestructura cloud (AWS)'],
        weaknesses: ['No especifica nivel de inglés en el CV'],
        risks: ['Rotación en sus primeros empleos (menos de 1 año)'],
        explanation: '<p>El candidato cumple con el 96% de los requisitos clave para la vacante. Su experiencia en microservicios y AWS lo hacen ideal para el rol de Sr. Backend.</p>'
    },
    timeline: [
        { id: '1', stage: 'POSTULADO', date: '2023-10-01T10:00:00Z', notes: 'CV recibido vía web.' },
        { id: '2', stage: 'PRESELECCION', date: '2023-10-02T14:30:00Z', notes: 'Aprobado por filtro IA automático.' },
        { id: '3', stage: 'CONTACTADO', date: '2023-10-03T09:15:00Z', notes: 'Mensaje de WhatsApp enviado para coordinar entrevista.' },
    ]
};

export default function CandidateProfilePage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('cv');

    return (
        <div className="w-full max-w-7xl mx-auto p-4 md:p-6 animate-in fade-in">
            <ModuleHeader
                title={`${mockCandidate.firstName} ${mockCandidate.lastName}`}
                description="Ficha del candidato"
                actions={[
                    {
                        id: 'back',
                        label: 'Volver',
                        onClick: () => router.back(),
                        variant: 'outline'
                    },
                    {
                        id: 'hire',
                        label: 'Contratar',
                        onClick: () => {},
                        variant: 'primary'
                    }
                ]}
            />

            {/* Profile Header Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm mb-6 flex flex-col md:flex-row gap-6 items-start">
                <div className="w-20 h-20 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-3xl font-black shrink-0">
                    {mockCandidate.firstName[0]}{mockCandidate.lastName[0]}
                </div>
                
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                        <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100">{mockCandidate.firstName} {mockCandidate.lastName}</h2>
                        <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800 px-2.5 py-0.5 rounded-full text-xs font-bold">
                            {mockCandidate.status}
                        </span>
                        <div className="flex items-center gap-1.5 bg-indigo-50 text-indigo-600 border border-indigo-200 dark:bg-indigo-900/30 dark:border-indigo-800 px-2.5 py-0.5 rounded-full text-xs font-bold">
                            <BrainCircuit className="w-3.5 h-3.5" />
                            Match IA: {mockCandidate.aiScore}%
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600 dark:text-slate-400 mb-4">
                        <div className="flex items-center gap-1.5">
                            <Mail className="w-4 h-4" /> {mockCandidate.email}
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Phone className="w-4 h-4" /> {mockCandidate.phone}
                        </div>
                        <div className="flex items-center gap-1.5">
                            <MapPin className="w-4 h-4" /> {mockCandidate.city}
                        </div>
                        <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                            <Linkedin className="w-4 h-4" /> {mockCandidate.linkedin}
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <a 
                            href={`https://wa.me/${mockCandidate.phone?.replace(/[^0-9]/g, '')}?text=Hola%20${mockCandidate.firstName},%20te%20contacto%20de%20HDB.`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 dark:text-emerald-400 rounded-lg text-sm font-bold transition-colors border border-emerald-200 dark:border-emerald-800/50"
                        >
                            <MessageCircle className="w-4 h-4" /> WhatsApp
                        </a>
                        <a 
                            href={`mailto:${mockCandidate.email}?subject=Búsqueda Laboral HDB`} 
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded-lg text-sm font-bold transition-colors border border-slate-200 dark:border-slate-700"
                        >
                            <Mail className="w-4 h-4" /> Enviar Email
                        </a>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800 mb-6 overflow-x-auto">
                {[
                    { id: 'cv', label: 'CV & Análisis IA', icon: <FileText className="w-4 h-4" /> },
                    { id: 'timeline', label: 'Historial', icon: <Clock className="w-4 h-4" /> },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
                            activeTab === tab.id 
                            ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' 
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            {activeTab === 'cv' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* CV Column */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
                            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">Experiencia Laboral</h3>
                            <div className="space-y-4">
                                {mockCandidate.experience.map((exp, i) => (
                                    <div key={i} className="flex gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                            <Briefcase className="w-5 h-5 text-slate-400" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 dark:text-slate-200">{exp.position}</h4>
                                            <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">{exp.company}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">{exp.startDate} - {exp.endDate}</p>
                                            <p className="text-sm text-slate-600 dark:text-slate-300">{exp.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
                            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">Habilidades (Extraídas por IA)</h3>
                            <div className="flex flex-wrap gap-2">
                                {mockCandidate.skills.map(skill => (
                                    <span key={skill} className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700">
                                        {skill}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* AI Analysis Column */}
                    <div className="space-y-6">
                        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-100 dark:border-indigo-800/50 rounded-xl p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-4 text-indigo-700 dark:text-indigo-400">
                                <BrainCircuit className="w-5 h-5" />
                                <h3 className="font-bold text-lg">Resumen de Inteligencia Artificial</h3>
                            </div>
                            
                            <div className="prose prose-sm dark:prose-invert text-slate-700 dark:text-slate-300 mb-6" dangerouslySetInnerHTML={{ __html: mockCandidate.aiAnalysis.explanation }} />

                            <div className="space-y-4">
                                <div>
                                    <h4 className="flex items-center gap-1.5 text-sm font-bold text-emerald-700 dark:text-emerald-400 mb-2">
                                        <CheckCircle2 className="w-4 h-4" /> Fortalezas
                                    </h4>
                                    <ul className="space-y-1.5">
                                        {mockCandidate.aiAnalysis.strengths.map((item, i) => (
                                            <li key={i} className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" /> {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                
                                <div>
                                    <h4 className="flex items-center gap-1.5 text-sm font-bold text-amber-700 dark:text-amber-400 mb-2">
                                        <AlertTriangle className="w-4 h-4" /> Debilidades
                                    </h4>
                                    <ul className="space-y-1.5">
                                        {mockCandidate.aiAnalysis.weaknesses.map((item, i) => (
                                            <li key={i} className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" /> {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div>
                                    <h4 className="flex items-center gap-1.5 text-sm font-bold text-rose-700 dark:text-rose-400 mb-2">
                                        <XCircle className="w-4 h-4" /> Riesgos Detectados
                                    </h4>
                                    <ul className="space-y-1.5">
                                        {mockCandidate.aiAnalysis.risks.map((item, i) => (
                                            <li key={i} className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" /> {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'timeline' && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
                    <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 mb-6">Historial del Candidato</h3>
                    <div className="relative border-l-2 border-slate-100 dark:border-slate-800 ml-3 space-y-8">
                        {mockCandidate.timeline.map((event, i) => (
                            <div key={event.id} className="relative pl-6">
                                <span className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-indigo-50 border-2 border-indigo-600 dark:bg-indigo-900 dark:border-indigo-400" />
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-1 gap-2">
                                    <h4 className="font-bold text-slate-800 dark:text-slate-200">{event.stage}</h4>
                                    <span className="text-xs font-medium text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-md">
                                        {new Date(event.date).toLocaleString()}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-600 dark:text-slate-400">{event.notes}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
