/**
 * Siembra las etiquetas de proyecto base (lib/proyectos/etiquetasBase.ts) que falten.
 *
 * Solo crea las que no existen, con su checklist. No borra ni modifica ninguna etiqueta
 * existente, ni las creadas por usuarios ni sus checklists o plantillas vinculadas.
 * Si una etiqueta base se renombró en Configuración, se vuelve a crear con el nombre original:
 * revisá la lista antes de aplicar.
 *
 * Uso:
 *   1) Ver qué falta (no escribe nada):
 *        DATABASE_URL=<base> npx tsx scripts/seed-etiquetas-base.ts
 *   2) Crear las que faltan:
 *        DATABASE_URL=<base> npx tsx scripts/seed-etiquetas-base.ts --aplicar
 */
import { prisma } from '../lib/prisma';
import { ETIQUETAS_BASE, etiquetasBaseFaltantes, sembrarEtiquetasBase } from '../lib/proyectos/etiquetasBase';

async function main() {
    const args = process.argv.slice(2);
    const desconocidos = args.filter(a => a !== '--aplicar');
    if (desconocidos.length > 0) {
        throw new Error(`Argumento desconocido: ${desconocidos.join(' ')}. Opción: --aplicar`);
    }
    const aplicar = args.includes('--aplicar');

    const faltantes = await etiquetasBaseFaltantes(prisma);
    for (const nombre of ETIQUETAS_BASE) {
        console.log(`${faltantes.includes(nombre) ? 'falta  ' : 'existe '} ${nombre}`);
    }

    if (faltantes.length === 0) {
        console.log('\nNo falta ninguna etiqueta base.');
        return;
    }
    if (!aplicar) {
        console.log(`\nFaltan ${faltantes.length}. Para crearlas, volvé a correrlo con --aplicar.`);
        return;
    }

    const { creadas } = await sembrarEtiquetasBase(prisma);
    console.log(`\nCreadas: ${creadas.length > 0 ? creadas.join(', ') : 'ninguna (ya existían)'}.`);
}

main()
    .catch((e) => {
        console.error(e instanceof Error ? e.message : e);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
