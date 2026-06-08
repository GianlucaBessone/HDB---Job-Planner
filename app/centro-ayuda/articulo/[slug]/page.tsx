import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Info, HelpCircle, FileText, CheckCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { renderIcon } from '@/lib/iconRegistry';

export default async function ArticuloPage({ params }: { params: { slug: string } }) {
  const article = await prisma.helpArticle.findUnique({
    where: { slug: params.slug },
    include: {
      category: true,
      faqs: { orderBy: { order: 'asc' } },
      tags: true
    }
  });

  if (!article) {
    notFound();
  }

  // Aumentar contador de vistas en background (opcional)
  await prisma.helpArticle.update({
    where: { id: article.id },
    data: { viewsCount: { increment: 1 } }
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Navegación Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm font-bold text-slate-500">
        <Link href="/centro-ayuda" className="hover:text-blue-600 transition-colors">
          Centro de Ayuda
        </Link>
        <span className="text-slate-300">/</span>
        <Link href={`/centro-ayuda/categoria/${article.category.slug}`} className="hover:text-blue-600 transition-colors">
          {article.category.title}
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-800 dark:text-slate-200 truncate">{article.title}</span>
      </nav>

      {/* Encabezado del Artículo */}
      <div className="space-y-4">
        <h1 className="text-4xl font-black text-slate-800 dark:text-slate-100">
          {article.title}
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-300">
          {article.description}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
        {/* Contenido Principal */}
        <div className="md:col-span-2 space-y-8">
          
          {/* Cómo Acceder */}
          {article.comoAcceder && (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-2xl border border-blue-100 dark:border-blue-800">
              <h3 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                <Info className="w-4 h-4" /> Cómo acceder
              </h3>
              <p className="text-sm text-slate-700 dark:text-slate-200">{article.comoAcceder}</p>
            </div>
          )}

          {/* Objetivo */}
          {article.objetivo && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-800">
              <h3 className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> Objetivo del Módulo
              </h3>
              <p className="text-sm text-slate-700 dark:text-slate-200">{article.objetivo}</p>
            </div>
          )}

          {/* Contenido Markdown */}
          <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-black prose-a:text-blue-600">
            <ReactMarkdown>
              {article.content}
            </ReactMarkdown>
          </div>

          {/* Buenas Prácticas */}
          {article.buenasPracticas && (
            <div className="bg-amber-50 dark:bg-amber-900/20 p-5 rounded-2xl border border-amber-100 dark:border-amber-800 mt-8">
              <h3 className="text-xs font-black text-amber-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                Buenas Prácticas
              </h3>
              <div className="prose prose-sm prose-slate dark:prose-invert">
                <ReactMarkdown>{article.buenasPracticas}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* FAQs */}
          {article.faqs.length > 0 && (
            <div className="pt-8 border-t border-slate-200 dark:border-slate-700">
              <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-6">
                <HelpCircle className="w-6 h-6 text-slate-400" />
                Preguntas Frecuentes
              </h2>
              <div className="space-y-4">
                {article.faqs.map(faq => (
                  <div key={faq.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-2">
                      {faq.question}
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                      {faq.answer}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Sidebar Info */}
        <div className="space-y-6 md:sticky md:top-6">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">
              Detalles del Artículo
            </h3>
            
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-xs font-bold text-slate-400 mb-1">Categoría</p>
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  {renderIcon(article.category.iconName, 'w-4 h-4 text-blue-500')}
                  {article.category.title}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-400 mb-1">Última actualización</p>
                <p className="text-slate-700 dark:text-slate-300">
                  {new Date(article.updatedAt).toLocaleDateString('es-AR', {
                    day: 'numeric', month: 'short', year: 'numeric'
                  })}
                </p>
              </div>

              {article.tags.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-400 mb-2">Etiquetas</p>
                  <div className="flex flex-wrap gap-2">
                    {article.tags.map(tag => (
                      <span key={tag.id} className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full text-xs font-medium">
                        {tag.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-3">
              ¿Te fue útil este artículo?
            </p>
            <div className="flex justify-center gap-2">
              <button className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-600 transition-colors text-sm font-bold shadow-sm">
                👍 Sí
              </button>
              <button className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 transition-colors text-sm font-bold shadow-sm">
                👎 No
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
