import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { exigirAcceso } from '@/lib/permisosServer';

const SIN_PERMISO = 'No tenés permiso para gestionar documentos';

export const dynamic = 'force-dynamic';

// GET /api/documentos/[id]/reglas — List rules for a document
export async function GET(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
    try {
        const rules = await prisma.documentApplicabilityRule.findMany({
            where: { documentId: params.id },
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json(rules);
    } catch (e: any) {
        return NextResponse.json({ error: 'Error al obtener reglas', details: e.message }, { status: 500 });
    }
}

// POST /api/documentos/[id]/reglas — Create a new rule
export async function POST(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
    try {
        const acceso = await exigirAcceso(req, ['documentos.gestionar'], SIN_PERMISO);
        if (acceso instanceof NextResponse) return acceso;
        // Quien actúa es siempre el usuario de la sesión: se ignoran userId / userName del pedido.
        const userId = acceso.userId;
        const userName = acceso.nombre;

        const data = await req.json();
        const {
            tipoActividad, categoriaProyecto, clienteId, nivelRiesgo, tagsRequeridos,
            bloqueanteDeInicio, requiereLecturaOS, generaChecklist
        } = data;

        const rule = await prisma.documentApplicabilityRule.create({
            data: {
                documentId: params.id,
                tipoActividad: tipoActividad || null,
                categoriaProyecto: categoriaProyecto || null,
                clienteId: clienteId || null,
                nivelRiesgo: nivelRiesgo || null,
                tagsRequeridos: tagsRequeridos || null,
                bloqueanteDeInicio: !!bloqueanteDeInicio,
                requiereLecturaOS: !!requiereLecturaOS,
                generaChecklist: !!generaChecklist,
            }
        });

        await logAudit({
            userId,
            userName,
            action: 'CREATE',
            entity: 'DOCUMENT_RULE',
            entityId: rule.id,
            newValue: rule,
        });

        return NextResponse.json(rule);
    } catch (e: any) {
        return NextResponse.json({ error: 'Error al crear regla', details: e.message }, { status: 500 });
    }
}

// DELETE /api/documentos/[id]/reglas?ruleId=xxx
export async function DELETE(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
    try {
        const acceso = await exigirAcceso(req, ['documentos.gestionar'], SIN_PERMISO);
        if (acceso instanceof NextResponse) return acceso;
        // Quien actúa es siempre el usuario de la sesión: se ignoran userId / userName del pedido.
        const userId = acceso.userId;
        const userName = acceso.nombre;

        const { searchParams } = new URL(req.url);
        const ruleId = searchParams.get('ruleId');

        if (!ruleId) return NextResponse.json({ error: 'Falta ruleId' }, { status: 400 });

        const rule = await prisma.documentApplicabilityRule.findUnique({ where: { id: ruleId } });
        if (!rule) return NextResponse.json({ error: 'Regla no encontrada' }, { status: 404 });

        await prisma.documentApplicabilityRule.delete({ where: { id: ruleId } });

        await logAudit({
            userId: userId || undefined,
            userName: userName || undefined,
            action: 'DELETE',
            entity: 'DOCUMENT_RULE',
            entityId: ruleId,
            oldValue: rule,
        });

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: 'Error al eliminar regla', details: e.message }, { status: 500 });
    }
}
