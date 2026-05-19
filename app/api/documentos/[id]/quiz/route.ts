import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
    try {
        const data = await req.json();
        const { cuestionario, userId, userName } = data;

        if (!Array.isArray(cuestionario)) {
            return NextResponse.json({ error: 'El cuestionario debe ser un array de preguntas' }, { status: 400 });
        }

        const doc = await prisma.controlledDocument.findUnique({
            where: { id: params.id }
        });

        if (!doc) {
            return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
        }

        let workflow: any = doc.workflowState || {};
        if (!workflow || typeof workflow !== 'object') {
            workflow = {};
        }

        workflow.cuestionario = cuestionario;

        const updatedDoc = await prisma.controlledDocument.update({
            where: { id: params.id },
            data: {
                workflowState: workflow as any
            }
        });

        await logAudit({
            userId,
            userName,
            action: 'UPDATE',
            entity: 'CONTROLLED_DOCUMENT',
            entityId: doc.id,
            newValue: { hasQuiz: true, questionCount: cuestionario.length }
        });

        return NextResponse.json(updatedDoc);
    } catch (e: any) {
        return NextResponse.json({ error: 'Error al guardar la evaluación', details: e.message }, { status: 500 });
    }
}
