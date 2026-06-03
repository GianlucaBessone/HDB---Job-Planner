import { NextResponse } from 'next/server';
import { generateContent } from '@/lib/ai/gemini';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { titulo, descripcion, area, propuestaAutor } = body;

        if (!titulo || !descripcion) {
            return NextResponse.json({ error: 'Faltan datos obligatorios (titulo, descripcion)' }, { status: 400 });
        }

        // Llamada al servicio AI usando la key del prompt recién creada
        const aiResponse = await generateContent('SUGGESTION_ANALYSIS', {
            titulo,
            descripcion,
            area: area || 'No especificada',
            propuestaAutor: propuestaAutor || 'Ninguna proporcionada'
        }, {
            userId: 'system',
            userName: 'API AI Analizar',
            userRole: 'admin',
        });

        if (!aiResponse.success || !aiResponse.data) {
            return NextResponse.json({ error: aiResponse.error || 'Fallo el análisis de IA' }, { status: 500 });
        }

        return NextResponse.json(aiResponse.data);
    } catch (error: any) {
        console.error('[AI_ANALISIS_ERROR]', error);
        return NextResponse.json({ error: 'Error interno del servidor al procesar la solicitud de IA.' }, { status: 500 });
    }
}
