import { NextResponse } from 'next/server';
import { generateObject } from '@/lib/ai';
import { prisma } from '@/lib/prisma';

const GESTORES = ['admin', 'qa', 'supervisor'];

export async function POST(request: Request) {
    try {
        // Consume cuota de Gemini y pisa el análisis guardado: solo quienes gestionan sugerencias.
        const userId = request.headers.get('x-user-id');
        const role = (request.headers.get('x-user-role') || '').toLowerCase();
        if (!userId || !GESTORES.includes(role)) {
            return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
        }

        const body = await request.json();
        const { sugerenciaId, titulo, descripcion, area, propuestaAutor } = body;

        if (!titulo || !descripcion) {
            return NextResponse.json({ error: 'Faltan datos obligatorios (titulo, descripcion)' }, { status: 400 });
        }

        // Llamada al servicio AI usando la key del prompt recién creada
        const aiResponse = await generateObject('SUGGESTION_ANALYSIS', {
            titulo,
            descripcion,
            area: area || 'No especificada',
            propuestaAutor: propuestaAutor || 'Ninguna proporcionada'
        }, {
            userId,
            userName: 'API AI Analizar',
            userRole: role,
        });

        if (!aiResponse.success || !aiResponse.data) {
            return NextResponse.json({ error: aiResponse.error || 'Fallo el análisis de IA' }, { status: 500 });
        }

        // Persist the AI analysis to the database if sugerenciaId is provided
        if (sugerenciaId) {
            await prisma.sugerencia.update({
                where: { id: sugerenciaId },
                data: { analisis_ia: aiResponse.data }
            }).catch(err => console.error('[AI_ANALISIS] Error persisting analysis:', err));
        }

        return NextResponse.json(aiResponse.data);
    } catch (error: any) {
        console.error('[AI_ANALISIS_ERROR]', error);
        return NextResponse.json({ error: 'Error interno del servidor al procesar la solicitud de IA.' }, { status: 500 });
    }
}
