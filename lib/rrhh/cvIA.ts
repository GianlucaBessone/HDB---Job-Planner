// Reclutamiento: llamadas a la IA (lectura de CV y compatibilidad con vacantes). Solo servidor.
// performOCR / generateObject ya registran cada llamada en AiRequestLog (Auditoría de IA).
import { generateObject, performOCR } from '@/lib/ai';
import type { AiRequestOptions } from '@/lib/ai';
import { analisisCvSchema, matchSchema, type AnalisisCv, type MatchIA } from '@/lib/rrhh/reclutamiento';

const TIMEOUT_MS = 90_000;

const S = { type: 'STRING' };
const SN = { type: 'STRING', nullable: true };
const N = { type: 'NUMBER' };
const B = { type: 'BOOLEAN' };
const arr = (items: object) => ({ type: 'ARRAY', items });
const obj = (properties: Record<string, object>, required: string[], extra: object = {}) =>
    ({ type: 'OBJECT', properties, required, propertyOrdering: Object.keys(properties), ...extra });

/** Esquema de respuesta para Gemini (subconjunto OpenAPI). Refleja analisisCvSchema. */
const CV_RESPONSE_SCHEMA = obj(
    {
        esCv: B,
        legible: B,
        datosPersonales: obj({ nombre: S, apellido: S, email: SN, telefono: SN, ciudad: SN, linkedin: SN }, ['nombre', 'apellido']),
        titular: S,
        resumen: S,
        seniority: { type: 'STRING', enum: ['trainee', 'junior', 'semi_senior', 'senior', 'experto'], nullable: true },
        aniosExperiencia: { type: 'NUMBER', nullable: true },
        habilidades: arr(obj({ nombre: S, tipo: { type: 'STRING', enum: ['HARD', 'SOFT'] }, nivel: { type: 'STRING', enum: ['Básico', 'Intermedio', 'Avanzado'], nullable: true } }, ['nombre', 'tipo'])),
        idiomas: arr(obj({ idioma: S, nivel: SN }, ['idioma'])),
        certificaciones: arr(S),
        experiencia: arr(obj({ empresa: S, puesto: S, desde: SN, hasta: SN, descripcion: SN }, ['empresa', 'puesto'])),
        educacion: arr(obj({ institucion: S, titulo: S, desde: SN, hasta: SN }, ['institucion', 'titulo'])),
        veracidad: obj({
            puntaje: N,
            resumen: S,
            senales: arr(obj({ tipo: { type: 'STRING', enum: ['positiva', 'alerta'] }, descripcion: S }, ['tipo', 'descripcion'])),
        }, ['puntaje', 'resumen', 'senales']),
        evaluacion: obj({ fortalezas: arr(S), debilidades: arr(S), riesgos: arr(S) }, ['fortalezas', 'debilidades', 'riesgos']),
        match: obj({
            puntaje: N, explicacion: S, cumple: arr(S), noCumple: arr(S),
            recomendacion: { type: 'STRING', enum: ['avanzar', 'evaluar', 'descartar'] },
        }, ['puntaje', 'explicacion', 'cumple', 'noCumple', 'recomendacion'], { nullable: true }),
        etiquetas: arr(S),
    },
    ['esCv', 'legible', 'datosPersonales', 'titular', 'resumen', 'habilidades', 'experiencia', 'educacion', 'veracidad', 'evaluacion', 'etiquetas'],
);

export interface VacanteParaIA {
    title: string;
    branch?: string | null;
    description?: string | null;
    requirements?: string | null;
    keywords?: unknown;
}

export class ErrorAnalisisCv extends Error {}

type Opciones = Pick<AiRequestOptions, 'userId' | 'userName' | 'userRole' | 'entityId'>;

const palabrasClave = (k: unknown) => (Array.isArray(k) && k.length ? k.join(', ') : 'No especificadas');

function sufijoVacante(v: VacanteParaIA) {
    // Las comillas triples delimitan el texto cargado por el usuario.
    return `

VACANTE CONTRA LA QUE EVALUAR EL "match" (no devuelvas null en "match"):
"""
Puesto: ${v.title}
Ubicación: ${v.branch || 'No especificada'}
Descripción: ${(v.description || 'No especificada').slice(0, 6000)}
Requisitos: ${(v.requirements || 'No especificados').slice(0, 6000)}
Palabras clave: ${palabrasClave(v.keywords)}
"""
Puntaje de match 0 a 100: 85+ cumple todo lo excluyente y suma deseables; 60-84 cumple lo central con brechas salvables; 40-59 brechas importantes; <40 no cumple lo excluyente.`;
}

/**
 * Lee el PDF del CV, valida la respuesta contra el contrato y, si no cumple,
 * reintenta una vez indicándole los errores.
 */
export async function analizarCvPdf(pdf: Buffer, vacante: VacanteParaIA | null, opciones: Opciones): Promise<AnalisisCv> {
    const base64 = pdf.toString('base64');
    const base = vacante ? sufijoVacante(vacante) : '';
    let suffix = base;
    let ultimoError = '';

    for (let intento = 1; intento <= 2; intento++) {
        const res = await performOCR(
            base64,
            'application/pdf',
            'CV_PARSE',
            { ...opciones, entity: 'Candidate', timeoutMs: TIMEOUT_MS },
            { responseSchema: CV_RESPONSE_SCHEMA, promptSuffix: suffix || undefined },
        );
        if (!res.success) {
            ultimoError = res.error || 'La IA no respondió.';
            // Un timeout no se reintenta: el segundo intento no entraría en el tiempo de la función.
            if (/timed out/i.test(ultimoError)) break;
            continue;
        }
        const parsed = analisisCvSchema.safeParse(res.data);
        if (parsed.success) {
            const analisis = parsed.data as AnalisisCv;
            if (!vacante) analisis.match = null;
            return analisis;
        }
        const problemas = parsed.error.issues.slice(0, 8).map(i => `- ${i.path.join('.') || '(raíz)'}: ${i.message}`).join('\n');
        ultimoError = 'La respuesta de la IA no tiene el formato esperado.';
        suffix = `${base}\n\nATENCIÓN: tu respuesta anterior no respetó el formato. Corregí estos problemas y devolvé el JSON completo:\n${problemas}`;
    }

    if (/timed out/i.test(ultimoError)) throw new ErrorAnalisisCv('La IA tardó demasiado en leer el CV. Probá de nuevo en unos minutos.');
    if (/GEMINI_API_KEY|ANTHROPIC_API_KEY/.test(ultimoError)) throw new ErrorAnalisisCv('La IA no está configurada en el servidor (falta la clave de API).');
    throw new ErrorAnalisisCv(ultimoError || 'No se pudo analizar el CV.');
}

/** Compatibilidad de un perfil (texto) con una vacante. */
export async function evaluarCompatibilidad(perfil: string, vacante: VacanteParaIA, opciones: Opciones): Promise<MatchIA> {
    const res = await generateObject('CV_MATCH', {
        puesto: vacante.title,
        ubicacion: vacante.branch || 'No especificada',
        descripcion: (vacante.description || 'No especificada').slice(0, 6000),
        requisitos: (vacante.requirements || 'No especificados').slice(0, 6000),
        palabrasClave: palabrasClave(vacante.keywords),
        perfil,
    }, { ...opciones, entity: 'Candidate', timeoutMs: 60_000 });

    if (!res.success) {
        if (/GEMINI_API_KEY|ANTHROPIC_API_KEY/.test(res.error || '')) throw new ErrorAnalisisCv('La IA no está configurada en el servidor (falta la clave de API).');
        throw new ErrorAnalisisCv(res.error || 'La IA no respondió.');
    }
    const parsed = matchSchema.safeParse(res.data);
    if (!parsed.success) throw new ErrorAnalisisCv('La respuesta de la IA no tiene el formato esperado. Probá de nuevo.');
    return parsed.data as MatchIA;
}
