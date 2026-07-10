import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const include = {
    template: true,
    project: { select: { nombre: true, codigoProyecto: true } },
    client: { select: { nombre: true } },
    responsable: { select: { nombreCompleto: true } },
    personnel: { include: { operator: { select: { nombreCompleto: true } } } },
    signature: true
};

export async function GET(req: Request, { params }: { params: { signatureId: string } }) {
    try {
        const report = await prisma.technicalReport.findFirst({
            where: { signatureId: params.signatureId },
            include
        });

        if (!report) {
            return NextResponse.json({ error: 'Informe no encontrado' }, { status: 404 });
        }

        return NextResponse.json(report);
    } catch (e) {
        console.error('GET public report error:', e);
        return NextResponse.json({ error: 'Error al obtener informe' }, { status: 500 });
    }
}
