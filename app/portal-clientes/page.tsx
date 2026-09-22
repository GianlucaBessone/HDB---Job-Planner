'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FolderGit2,
  FileText,
  Clock,
  FileSignature,
  CheckCircle2,
  ArrowRight,
  Loader2,
  ShieldCheck,
} from 'lucide-react';

export default function PortalProyectosPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/portal-clientes/proyectos');
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider mb-1">
          <ShieldCheck className="w-4 h-4" />
          <span>Área Segura de Cliente</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
          Mis Proyectos Autorizados
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Visualice las órdenes de trabajo activas, firme y cierre ciclos de los proyectos a su cargo.
        </p>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-xs font-bold">Cargando proyectos autorizados...</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="py-16 text-center text-slate-400 text-xs border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl p-6">
          No tiene proyectos autorizados asignados actualmente. Contacte al administrador de HDB.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((p) => (
            <div
              key={p.id}
              className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-sm">
                      <FolderGit2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-primary transition-colors">
                        {p.nombre}
                      </h3>
                      {p.codigoProyecto && (
                        <span className="text-[10px] font-mono uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded font-bold">
                          {p.codigoProyecto}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {p.observaciones && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 my-2">
                    {p.observaciones}
                  </p>
                )}

                {/* Counters strip */}
                <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-100 dark:border-slate-800/80 my-3">
                  <div className="text-center p-2 rounded-xl bg-blue-50/60 dark:bg-blue-950/30">
                    <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 block mb-0.5">
                      Abiertas
                    </span>
                    <span className="text-base font-black text-blue-700 dark:text-blue-300">
                      {p.conteo?.abiertas || 0}
                    </span>
                  </div>

                  <div className="text-center p-2 rounded-xl bg-amber-50/60 dark:bg-amber-950/30">
                    <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 block mb-0.5">
                      Ptes. Firma
                    </span>
                    <span className="text-base font-black text-amber-700 dark:text-amber-300">
                      {p.conteo?.pendientesFirma || 0}
                    </span>
                  </div>

                  <div className="text-center p-2 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30">
                    <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block mb-0.5">
                      Cerradas
                    </span>
                    <span className="text-base font-black text-emerald-700 dark:text-emerald-300">
                      {p.conteo?.cerradas || 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Action */}
              <div className="pt-2 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Total: <strong>{p.conteo?.totalOts || 0} OTs</strong>
                </span>

                <Link
                  href={`/portal-clientes/ordenes-trabajo?proyectoId=${p.id}`}
                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  Ver OTs
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
