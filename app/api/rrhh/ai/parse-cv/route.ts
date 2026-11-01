import { NextResponse } from 'next/server';
import { resolveRoute } from '@/lib/ai/router';
import { getRateLimiter } from '@/lib/ai/rate-limiter';

export async function POST(req: Request) {
    try {
        const { text, vacancyDescription } = await req.json();

        if (!text) {
            return NextResponse.json({ error: 'Falta el texto del CV' }, { status: 400 });
        }

        if (!process.env.ANTHROPIC_API_KEY) {
            console.warn("ANTHROPIC_API_KEY is not set. Returning mock data.");
            return NextResponse.json({
                score: 85,
                skills: ["Liderazgo", "Resolución de problemas"],
                experience: [{ company: "Empresa X", position: "Posición Y" }],
                strengths: ["Buena experiencia general"],
                weaknesses: ["Falta detalle técnico"],
                risks: ["Ninguno evidente"],
                explanation: "<p>Mock explanation because API Key is missing.</p>"
            });
        }

        const prompt = `
            Actúa como un experto reclutador (Headhunter y ATS IA).

            CV DEL CANDIDATO:
            """
            ${text}
            """

            DESCRIPCIÓN DE LA VACANTE:
            """
            ${vacancyDescription || 'No especificada. Extrae la información general del perfil.'}
            """

            Tareas:
            1. Analiza el CV y extrae: habilidades (skills), experiencias laborales y educación.
            2. Si hay descripción de la vacante, compara el perfil del candidato con la vacante y asigna un puntaje de "Match" de 0 a 100.
            3. Detecta fortalezas, debilidades y posibles riesgos de contratación (ej. mucha rotación, lejanía geográfica, sobrecalificación).
            4. Genera una breve explicación en formato HTML (con párrafos <p> y negritas <b>) de por qué se asignó ese puntaje y si lo recomiendas.

            Devuelve ÚNICAMENTE un objeto JSON con el siguiente formato exacto (sin bloques de código markdown, solo el texto JSON válido):
            {
                "score": number,
                "skills": string[],
                "experience": [{ "company": string, "position": string, "description": string }],
                "education": [{ "institution": string, "degree": string }],
                "strengths": string[],
                "weaknesses": string[],
                "risks": string[],
                "explanation": string
            }
        `;

        const { provider, model, providerName, effort } = resolveRoute('CV_PARSE');
        await getRateLimiter(providerName).waitIfLimitReached();

        // The provider strips Markdown fences from JSON responses
        const response = await provider.generate({
            prompt,
            model,
            effort,
            responseMimeType: 'application/json',
            timeoutMs: 45000,
        });

        const parsedResult = JSON.parse(response.text || "{}");

        return NextResponse.json(parsedResult);
    } catch (error: any) {
        console.error('Error in AI parsing:', error);
        return NextResponse.json({ error: 'Error procesando el CV con Inteligencia Artificial.' }, { status: 500 });
    }
}
