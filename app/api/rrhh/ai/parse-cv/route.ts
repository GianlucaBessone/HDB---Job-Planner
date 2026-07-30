import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Initialize Gemini SDK
// Assumes GEMINI_API_KEY is available in the environment variables
const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

export async function POST(req: Request) {
    try {
        const { text, vacancyDescription } = await req.json();

        if (!text) {
            return NextResponse.json({ error: 'Falta el texto del CV' }, { status: 400 });
        }

        if (!ai) {
            console.warn("GEMINI_API_KEY is not set. Returning mock data.");
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

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                temperature: 0.2, // Low temperature for more deterministic/structured output
            }
        });

        let jsonText = response.text || "{}";
        // Clean up markdown block if the model included it
        if (jsonText.startsWith('```json')) {
            jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '');
        }

        const parsedResult = JSON.parse(jsonText);

        return NextResponse.json(parsedResult);
    } catch (error: any) {
        console.error('Error in AI parsing:', error);
        return NextResponse.json({ error: 'Error procesando el CV con Inteligencia Artificial.' }, { status: 500 });
    }
}
