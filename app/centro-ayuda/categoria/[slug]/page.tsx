import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, LifeBuoy, FileText } from 'lucide-react';
import { renderIcon } from '@/lib/iconRegistry';

export default async function CategoriaPage({ params }: { params: { slug: string } }) {
  const category = await prisma.helpCategory.findUnique({
    where: { slug: params.slug },
    include: {
      articles: {
        where: { isPublished: true },
        orderBy: { order: 'asc' }
      }
    }
  });

  if (!category) {
    notFound();
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <Link 
        href="/centro-ayuda" 
        className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Volver al Centro de Ayuda
      </Link>

      <div className="flex items-center gap-4 border-b border-slate-200 dark:border-slate-700 pb-6">
        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/40 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400">
          {renderIcon(category.iconName, 'w-8 h-8')}
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100">
            {category.title}
          </h1>
          <p className="text-slate-500 mt-1">
            {category.description}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {category.articles.map((article) => (
          <Link href={`/centro-ayuda/articulo/${article.slug}`} key={article.id}>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all flex items-start gap-4 group">
              <div className="mt-1 w-10 h-10 bg-slate-50 dark:bg-slate-700 rounded-xl flex items-center justify-center group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 transition-colors">
                <FileText className="w-5 h-5 text-slate-400 group-hover:text-blue-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {article.title}
                </h3>
                <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                  {article.description}
                </p>
              </div>
            </div>
          </Link>
        ))}

        {category.articles.length === 0 && (
          <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
            <LifeBuoy className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">No hay artículos disponibles en esta categoría.</p>
          </div>
        )}
      </div>
    </div>
  );
}
