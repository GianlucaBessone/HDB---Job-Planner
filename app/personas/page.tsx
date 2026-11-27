import { redirect } from 'next/navigation';

/** /personas sin id (miga de pan) abre la propia ficha. */
export default function PersonasPage() {
    redirect('/personas/yo');
}
