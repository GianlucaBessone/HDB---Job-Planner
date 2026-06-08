import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  try {
    const article = await prisma.helpArticle.findUnique({
      where: { slug: params.slug },
      include: {
        category: true,
        faqs: true
      }
    });

    if (!article) {
      return NextResponse.json({ error: 'Artículo no encontrado' }, { status: 404 });
    }

    return NextResponse.json(article);
  } catch (error) {
    return NextResponse.json({ error: 'Error al buscar el artículo' }, { status: 500 });
  }
}
