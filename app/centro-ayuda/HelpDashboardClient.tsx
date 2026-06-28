'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, ChevronRight, LifeBuoy, X } from 'lucide-react';
import { renderIcon } from '@/lib/iconRegistry';

interface Article {
  id: string;
  slug: string;
  title: string;
  description: string;
  viewsCount: number;
}

interface Category {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  iconName: string;
  _count: {
    articles: number;
  };
  articles: Article[];
}

interface HelpDashboardClientProps {
  categories: Category[];
  popularArticles: Article[];
}

export default function HelpDashboardClient({ categories, popularArticles }: HelpDashboardClientProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Extract all articles for client-side search
  const allArticles = categories.flatMap(cat => 
    cat.articles.map(art => ({
      ...art,
      categoryTitle: cat.title,
      categorySlug: cat.slug,
      categoryIcon: cat.iconName
    }))
  );

  // Filter articles based on query
  const normalize = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const filteredArticles = searchQuery.trim().length >= 2
    ? allArticles.filter(art => 
        normalize(art.title).includes(normalize(searchQuery)) ||
        normalize(art.description).includes(normalize(searchQuery)) ||
        (art.categoryTitle && normalize(art.categoryTitle).includes(normalize(searchQuery)))
      )
    : [];

  const handleClear = () => {
    setSearchQuery('');
  };

  return (
    <div className="space-y-8">
      {/* Buscador Global */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-8 sm:p-12 text-center text-white relative overflow-hidden shadow-xl">
        <div className="relative z-10 max-w-2xl mx-auto space-y-6">
          <h2 className="text-3xl font-black">¿En qué podemos ayudarte?</h2>
          <p className="text-blue-100 text-sm font-medium">
            Busca guías, procesos, configuración de módulos o resolución de problemas.
          </p>
          <div className="relative mt-6">
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ej: no conformidad, fichado, herramientas..."
              className="w-full px-6 py-4 pl-14 pr-12 rounded-2xl text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-400/50 transition-all font-medium text-lg placeholder-slate-400"
            />
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" />
            {searchQuery && (
              <button 
                onClick={handleClear}
                className="absolute right-5 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <LifeBuoy className="w-64 h-64" />
        </div>
      </div>

      {searchQuery.trim().length >= 2 ? (
        // Resultados de Búsqueda
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-4">
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
              Resultados de la búsqueda ({filteredArticles.length})
            </h3>
            <button 
              onClick={handleClear}
              className="text-sm font-bold text-blue-600 hover:text-blue-500 transition-colors"
            >
              Mostrar todo
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredArticles.map((article) => (
              <Link href={`/centro-ayuda/articulo/${article.slug}`} key={article.id}>
                <div className="bg-card text-card-foreground p-6 rounded-3xl border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all flex items-start gap-4 group">
                  <div className="mt-1 w-12 h-12 bg-slate-50 dark:bg-slate-700 rounded-2xl flex items-center justify-center flex-shrink-0 text-slate-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 group-hover:text-blue-500 transition-all">
                    {renderIcon(article.categoryIcon, 'w-6 h-6')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">
                      {article.categoryTitle}
                    </span>
                    <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors mt-0.5">
                      {article.title}
                    </h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                      {article.description}
                    </p>
                  </div>
                </div>
              </Link>
            ))}

            {filteredArticles.length === 0 && (
              <div className="text-center py-16 bg-card text-card-foreground rounded-3xl border border-slate-200 dark:border-slate-700">
                <LifeBuoy className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-800 dark:text-slate-200 font-bold text-lg">No se encontraron resultados</p>
                <p className="text-slate-500 text-sm mt-1">
                  Intenta con otras palabras clave o explora las categorías principales.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        // Dashboard Estándar (Categorías + Populares)
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Categorías Principales */}
          <div className="lg:col-span-2 space-y-6">
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              Explorar por Categoría
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {categories.map((cat) => (
                <Link href={`/centro-ayuda/categoria/${cat.slug}`} key={cat.id}>
                  <div className="bg-card text-card-foreground p-6 rounded-3xl border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-lg transition-all group h-full flex flex-col justify-between">
                    <div>
                      <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4 group-hover:scale-110 transition-transform">
                        {renderIcon(cat.iconName, 'w-6 h-6')}
                      </div>
                      <h4 className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-2">
                        {cat.title}
                      </h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">
                        {cat.description}
                      </p>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400">
                        {cat._count.articles} artículos
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                    </div>
                  </div>
                </Link>
              ))}

              {categories.length === 0 && (
                <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl">
                  <p className="text-slate-500 font-medium">Aún no hay categorías de ayuda disponibles.</p>
                </div>
              )}
            </div>
          </div>

          {/* Artículos Populares */}
          <div className="space-y-6">
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
              Artículos Populares
            </h3>
            <div className="bg-card text-card-foreground rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              {popularArticles.map((article, index) => (
                <Link href={`/centro-ayuda/articulo/${article.slug}`} key={article.id}>
                  <div className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors flex items-center gap-3 ${index !== popularArticles.length - 1 ? 'border-b border-slate-100 dark:border-slate-700' : ''}`}>
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0 text-slate-500 font-bold text-xs">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                        {article.title}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                        {article.viewsCount} vistas
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
              {popularArticles.length === 0 && (
                <div className="p-8 text-center">
                  <p className="text-sm text-slate-500">No hay artículos destacados.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
