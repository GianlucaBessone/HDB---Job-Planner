import { redirect } from 'next/navigation';

/** El legajo se ve en la ficha de la persona (P16). */
export default async function LegajoRedirect({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    redirect(`/personas/${id}?tab=legajo`);
}
