// Análisis de Pliegos: llamada a la IA. No toca la base salvo el log de IA que
// ya hace performOCR (AiRequestLog). Solo servidor.
import { performOCR } from '@/lib/ai';
import type { AiRequestOptions, AiServiceResponse } from '@/lib/ai';
import { analisisIASchema, type AnalisisIA } from '@/lib/pliegos';

export const PLIEGO_PROMPT_KEY = 'PLIEGO_ANALISIS';

/** Tiempo por intento. La ruta tiene maxDuration 300 s. */
const TIMEOUT_MS = 120_000;
/** Si el primer intento tardó más que esto no se reintenta (no entraría en maxDuration). */
const MARGEN_REINTENTO_MS = 150_000;

const origen = { type: 'STRING', enum: ['PLIEGO', 'IA'] };
const ref = { type: 'STRING', nullable: true };
const txt = { type: 'STRING' };
const txtNull = { type: 'STRING', nullable: true };
const obj = (properties: Record<string, object>, required: string[]) => ({ type: 'OBJECT', properties, required, propertyOrdering: Object.keys(properties) });
const arr = (items: object) => ({ type: 'ARRAY', items });

const material = obj(
    { descripcion: txt, cantidad: txtNull, unidad: txtNull, evaluacion: { type: 'STRING', enum: ['adecuado', 'revisar', 'error'] }, observacion: txtNull, origen, referencia: ref },
    ['descripcion', 'evaluacion', 'origen'],
);

/** Esquema de respuesta para Gemini (subconjunto OpenAPI). Refleja analisisIASchema. */
export const PLIEGO_RESPONSE_SCHEMA = obj(
    {
        resumen: txt,
        razonamiento: txt,
        tareas: arr(obj({ titulo: txt, descripcion: txt, origen, referencia: ref }, ['titulo', 'descripcion', 'origen'])),
        materiales: obj({ delPliego: arr(material), sugeridos: arr(material) }, ['delPliego', 'sugeridos']),
        herramientas: arr(obj({ descripcion: txt, cantidad: txtNull, observacion: txtNull, origen, referencia: ref }, ['descripcion', 'origen'])),
        personal: arr(obj({ rol: txt, cantidad: txtNull, competencias: txtNull, origen, referencia: ref }, ['rol', 'origen'])),
        higieneSeguridad: arr(obj(
            { categoria: { type: 'STRING', enum: ['epp', 'riesgo', 'procedimiento', 'permiso', 'documentacion', 'capacitacion', 'otro'] }, descripcion: txt, origen, referencia: ref },
            ['categoria', 'descripcion', 'origen'],
        )),
        alertas: arr(obj(
            {
                tipo: { type: 'STRING', enum: ['error', 'omision', 'ambiguedad', 'riesgo'] },
                severidad: { type: 'STRING', enum: ['alta', 'media', 'baja'] },
                titulo: txt, descripcion: txt, recomendacion: txtNull, referencia: ref,
            },
            ['tipo', 'severidad', 'titulo', 'descripcion'],
        )),
    },
    ['resumen', 'razonamiento', 'tareas', 'materiales', 'herramientas', 'personal', 'higieneSeguridad', 'alertas'],
);

export interface ResultadoAnalisisIA {
    analisis: AnalisisIA;
    modelo: string;
    inputTokens: number;
    outputTokens: number;
    costoUsd: number;
    latenciaMs: number;
    intentos: number;
}

type Ejecutor = typeof performOCR;

export class ErrorAnalisisPliego extends Error {}

/**
 * Envía el PDF a la IA, valida la respuesta contra el contrato y, si no cumple,
 * reintenta una vez indicándole los errores. Lanza ErrorAnalisisPliego si no logra
 * un análisis válido.
 */
export async function analizarPliegoIA(
    pdf: Buffer,
    opciones: Pick<AiRequestOptions, 'userId' | 'userName' | 'userRole' | 'entityId'>,
    ejecutar: Ejecutor = performOCR,
): Promise<ResultadoAnalisisIA> {
    const modelo = process.env.PLIEGO_AI_MODEL?.trim() || undefined;
    const base64 = pdf.toString('base64');
    const inicio = Date.now();
    let suffix: string | undefined;
    let ultimoError = '';
    let tokensIn = 0, tokensOut = 0, costo = 0;

    for (let intento = 1; intento <= 2; intento++) {
        const res: AiServiceResponse = await ejecutar(
            base64,
            'application/pdf',
            PLIEGO_PROMPT_KEY,
            { ...opciones, entity: 'Pliego', model: modelo, timeoutMs: TIMEOUT_MS },
            { responseSchema: PLIEGO_RESPONSE_SCHEMA, promptSuffix: suffix },
        );
        tokensIn += res.usage?.inputTokens || 0;
        tokensOut += res.usage?.outputTokens || 0;
        costo += res.usage?.estimatedCost || 0;

        if (res.success) {
            const parsed = analisisIASchema.safeParse(res.data);
            if (parsed.success) {
                return {
                    analisis: parsed.data,
                    modelo: modelo || 'gemini-2.5-flash',
                    inputTokens: tokensIn,
                    outputTokens: tokensOut,
                    costoUsd: costo,
                    latenciaMs: Date.now() - inicio,
                    intentos: intento,
                };
            }
            const problemas = parsed.error.issues.slice(0, 10).map(i => `- ${i.path.join('.') || '(raíz)'}: ${i.message}`).join('\n');
            ultimoError = `La respuesta de la IA no cumple el formato esperado.\n${problemas}`;
            suffix = `\n\nATENCIÓN: tu respuesta anterior no respetó el formato. Corregí estos problemas y devolvé el JSON completo:\n${problemas}`;
        } else {
            ultimoError = res.error || 'La IA no respondió.';
            suffix = undefined;
        }

        if (Date.now() - inicio > MARGEN_REINTENTO_MS) break;
    }

    throw new ErrorAnalisisPliego(ultimoError || 'No se pudo analizar el pliego.');
}
