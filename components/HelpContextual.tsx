'use client';

import { useState, useEffect } from 'react';
import { HelpCircle, X, Loader2, BookOpen, ExternalLink, Info } from 'lucide-react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';

interface HelpContextualProps {
  slug: string;
  iconType?: 'help' | 'info';
}

export default function HelpContextual({ slug, iconType = 'help' }: HelpContextualProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [article, setArticle] = useState<any>(null);

  useEffect(() => {
    if (isOpen && !article && !loading) {
      setLoading(true);
      fetch(`/api/centro-ayuda/articulo/${slug}`)
        .then(res => res.json())
        .then(data => {
          if (!data.error) setArticle(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [isOpen, slug]);

  const Icon = iconType === 'help' ? HelpCircle : Info;

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center justify-center p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-blue-500 transition-colors"
        title="Obtener ayuda"
      >
        <Icon className="w-5 h-5" />
      </button>

      {isOpen && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 transition-opacity"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Slide-over Panel */}
          <div className="fixed inset-y-0 right-0 max-w-md w-full bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-500" />
                Ayuda Contextual
              </h2>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  <p className="text-sm font-medium text-slate-500">Cargando ayuda...</p>
                </div>
              ) : article ? (
                <div className="space-y-6">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">
                      {article.category?.title}
                    </span>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">
                      {article.title}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                      {article.description}
                    </p>
                  </div>

                  {article.comoAcceder && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                      <p className="text-xs font-bold text-blue-600 mb-1">Cómo utilizarlo</p>
                      <p className="text-sm text-slate-700 dark:text-slate-300">{article.comoAcceder}</p>
                    </div>
                  )}

                  <div className="prose prose-sm prose-slate dark:prose-invert prose-a:text-blue-500">
                    <ReactMarkdown>{article.content}</ReactMarkdown>
                  </div>

                  <Link 
                    href={`/centro-ayuda/articulo/${article.slug}`}
                    className="flex items-center justify-center gap-2 w-full py-3 mt-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    Ver artículo completo <ExternalLink className="w-4 h-4" />
                  </Link>
                </div>
              ) : (
                <div className="text-center py-10">
                  <HelpCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">No se encontró ayuda específica para este elemento.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
