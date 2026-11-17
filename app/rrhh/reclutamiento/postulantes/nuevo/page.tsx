import { redirect } from 'next/navigation';

/** El alta se hace en un diálogo (con CV + IA); esta ruta queda por compatibilidad de enlaces. */
export default async function NuevoPostulantePage({ searchParams }: { searchParams: Promise<{ vacancyId?: string }> }) {
    const { vacancyId } = await searchParams;
    redirect(vacancyId ? `/rrhh/reclutamiento/vacantes/${encodeURIComponent(vacancyId)}/pipeline?cargar=1` : '/rrhh/reclutamiento/postulantes?nuevo=1');
}
