import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exigirAcceso } from '@/lib/permisosServer';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const acceso = await exigirAcceso(req);
        if (acceso instanceof NextResponse) return acceso;

        const { dataLayer } = require('@/lib/dataLayer');
        await dataLayer.autoUpdateProjectStatuses();

        const { searchParams } = new URL(req.url);
        const all = searchParams.get('all') === 'true';
        // "Mis proyectos" son los del usuario de la sesión (se ignoran ?responsableId y ?nombre).
        const responsableId = acceso.userId;
        const nombreCompleto = acceso.nombre;

        let where: any = {
            estado: { notIn: ['finalizado'] }
        };

        if (!all) {
            if (!responsableId) {
                return NextResponse.json({ error: 'Falta responsableId' }, { status: 400 });
            }

            // Match by ID (new relational field) OR by legacy name field
            const orConditions: any[] = [
                { responsableId: responsableId }
            ];

            if (nombreCompleto) {
                orConditions.push({ responsable: nombreCompleto });
            }

            where.OR = orConditions;
        }

        const projects = await prisma.project.findMany({
            where,
            include: {
                client: true,
                responsableUser: {
                    select: { nombreCompleto: true }
                },
                _count: {
                    select: { checklistItems: true }
                },
                checklistItems: {
                    select: { completed: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(projects);
    } catch (error) {
        console.error('Error fetching my projects:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}
