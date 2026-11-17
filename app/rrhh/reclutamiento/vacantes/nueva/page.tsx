import { redirect } from 'next/navigation';

/** La vacante se crea en un diálogo de la lista; esta ruta queda por compatibilidad de enlaces. */
export default function NuevaVacantePage() {
    redirect('/rrhh/reclutamiento/vacantes?nueva=1');
}
