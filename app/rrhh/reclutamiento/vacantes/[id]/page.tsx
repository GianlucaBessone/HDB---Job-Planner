import { redirect } from 'next/navigation';

/** La vacante se ve en su pipeline (destino de la miga de pan intermedia). */
export default async function VacantePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    redirect(`/rrhh/reclutamiento/vacantes/${encodeURIComponent(id)}/pipeline`);
}
