import { prisma } from '@/lib/prisma';
import { LifeBuoy } from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';
import HelpDashboardClient from './HelpDashboardClient';

export default async function CentroAyudaPage() {
  const categories = await prisma.helpCategory.findMany({
    where: { active: true },
    orderBy: { order: 'asc' },
    include: {
      articles: {
        where: { isPublished: true },
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          viewsCount: true
        }
      },
      _count: {
        select: { articles: { where: { isPublished: true } } }
      }
    }
  });

  const popularArticles = await prisma.helpArticle.findMany({
    where: { isPublished: true },
    orderBy: { viewsCount: 'desc' },
    take: 5,
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      viewsCount: true
    }
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-8">
      <ModuleHeader
        title="Centro de Ayuda y Formación"
        description="Base de conocimiento, guías y resolución de problemas"
        icon={<LifeBuoy className="w-5 h-5" />}
      />

      <HelpDashboardClient categories={categories} popularArticles={popularArticles} />
    </div>
  );
}

