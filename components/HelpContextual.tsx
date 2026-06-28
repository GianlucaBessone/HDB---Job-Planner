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
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    if (isOpen && !article && !loading && !fetchError) {
      setLoading(true);
      setFetchError(false);
      fetch(`/api/centro-ayuda/articulo/${slug}`)
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then(data => {
          if (!data.error) {
            setArticle(data);
          } else {
            setFetchError(true);
          }
          setLoading(false);
        })
        .catch(() => {
          setFetchError(true);
          setLoading(false);
        });
    }
  }, [isOpen, slug, article, loading, fetchError]);

  const Icon = iconType === 'help' ? HelpCircle : Info;

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="inline-flex items-center justify-center p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-blue-500 transition-colors" title="Obtener ayuda">
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
          <div
            className="fixed inset-y-0 right-0 z-50 flex flex-col min-h-0 bg-card text-card-foreground shadow-2xl transition-transform duration-300 ease-in-out w-full max-w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl"
            
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <BookOpen className="w-4.5 h-4.5 text-blue-500 shrink-0" />
                Ayuda Contextual
              </h2>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-400 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 break-words" style={{ overflowX: 'auto' }}>
              {loading ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  <p className="text-sm font-medium text-slate-500">Cargando ayuda...</p>
                </div>
              ) : article ? (
                <div style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                  {/* Category & Title */}
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-500">
                    {article.category?.title}
                  </span>
                  <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-2 mb-3 leading-snug">
                    {article.title}
                  </h3>
                  <p className="text-lg text-slate-500 dark:text-slate-400 mt-2 mb-4 leading-relaxed">
                    {article.description}
                  </p>

                  {/* How to access */}
                  {article.comoAcceder && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800 mt-6">
                      <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-1">Cómo utilizarlo</p>
                      <p className="text-base text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                        {article.comoAcceder}
                      </p>
                    </div>
                  )}

                  {/* Markdown content */}
                  <div className="mt-6 prose prose-xl max-w-prose prose-slate dark:prose-invert prose-a:text-blue-500 break-words
                    [&_pre]:overflow-x-auto [&_pre]:max-w-full
                    [&_table]:block [&_table]:overflow-x-auto [&_table]:max-w-full
                    [&_img]:max-w-full [&_img]:h-auto"
                  >
                    <ReactMarkdown>{article.content}</ReactMarkdown>
                  </div>

                  {/* Link to full article */}
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
