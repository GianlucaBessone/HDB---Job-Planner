import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DEFAULT_PROMPTS } from '@/lib/ai/prompts';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// GET: Obtener todos los prompts (combinando defaults de código y overrides de DB)
export async function GET(req: Request) {
    try {
        const dbPrompts = await prisma.aiPrompt.findMany();
        
        const mergedPrompts = Object.keys(DEFAULT_PROMPTS).map(key => {
            const defaultPrompt = DEFAULT_PROMPTS[key];
            const override = dbPrompts.find(p => p.key === key);
            
            return {
                key,
                name: defaultPrompt.name,
                description: defaultPrompt.description,
                defaultTemplate: defaultPrompt.template,
                defaultSystemInstruction: defaultPrompt.systemInstruction,
                activeTemplate: override ? override.template : defaultPrompt.template,
                activeSystemInstruction: override ? override.description : defaultPrompt.systemInstruction,
                version: override ? override.version : defaultPrompt.version,
                isOverridden: !!override,
                isActive: override ? override.isActive : true,
                updatedAt: override ? override.updatedAt : null
            };
        });

        return NextResponse.json(mergedPrompts);
    } catch (e: any) {
        return NextResponse.json({ error: 'Error al obtener prompts.', details: e.message }, { status: 500 });
    }
}

// POST: Crear o actualizar un prompt en la base de datos (con control de versiones)
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { key, template, systemInstruction, userId, userName, userRole } = body;

        if (!key || !template) {
            return NextResponse.json({ error: 'Faltan parámetros obligatorios: key y template.' }, { status: 400 });
        }

        // Validación de permisos
        if (userRole && userRole !== 'admin') {
            return NextResponse.json({ error: 'Permisos insuficientes. Solo administradores pueden modificar plantillas de prompts.' }, { status: 403 });
        }

        const defaultPrompt = DEFAULT_PROMPTS[key];
        if (!defaultPrompt) {
            return NextResponse.json({ error: 'La clave de prompt ingresada no es válida.' }, { status: 400 });
        }

        // Buscar si existe override previo
        const existing = await prisma.aiPrompt.findUnique({
            where: { key }
        });

        let result;
        if (existing) {
            // Incrementar versión e instalar el nuevo template
            result = await prisma.aiPrompt.update({
                where: { key },
                data: {
                    template,
                    description: systemInstruction || defaultPrompt.systemInstruction,
                    version: existing.version + 1
                }
            });

            await logAudit({
                userId,
                userName,
                action: 'UPDATE',
                entity: 'AI_PROMPT',
                entityId: result.id,
                oldValue: existing,
                newValue: result
            });
        } else {
            // Crear el primer override
            result = await prisma.aiPrompt.create({
                data: {
                    key,
                    name: defaultPrompt.name,
                    template,
                    description: systemInstruction || defaultPrompt.systemInstruction,
                    version: 2 // v1 es el hardcoded en el código
                }
            });

            await logAudit({
                userId,
                userName,
                action: 'CREATE',
                entity: 'AI_PROMPT',
                entityId: result.id,
                newValue: result
            });
        }

        return NextResponse.json({
            success: true,
            prompt: result
        });

    } catch (e: any) {
        console.error('[Api][Prompts] Failed:', e);
        return NextResponse.json({ error: 'Error interno al actualizar el prompt.', details: e.message }, { status: 500 });
    }
}
