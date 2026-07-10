import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request, { params }: { params: { id: string } }) {
    try {
        const body = await req.json();
        const { nombre, dni, firmaImagen } = body;

        if (!nombre || !dni || !firmaImagen) {
            return NextResponse.json({ error: 'Nombre, DNI y firma son requeridos' }, { status: 400 });
        }

        const informe = await prisma.technicalReport.findUnique({
            where: { id: params.id }
        });

        if (!informe) return NextResponse.json({ error: 'Informe no encontrado' }, { status: 404 });
        if (informe.status !== 'finalizado') return NextResponse.json({ error: 'El informe debe estar finalizado para firmarlo' }, { status: 400 });

        const signature = await prisma.technicalReportSignature.create({
            data: {
                reportId: params.id,
                nombre,
                dni,
                firmaImagen
            }
        });

        // Audit log
        const reqHeaders = new Headers(req.headers);
        const userHeader = reqHeaders.get('x-user') ? JSON.parse(reqHeaders.get('x-user') as string) : null;
        
        await prisma.auditLog.create({
            data: {
                userId: userHeader?.id,
                userEmail: userHeader?.email,
                userName: userHeader?.nombreCompleto || 'Sistema',
                action: 'SIGN',
                entity: 'TECHNICAL_REPORT',
                entityId: params.id,
                newValue: { signatureId: signature.id }
            }
        });

        return NextResponse.json(signature);
    } catch (e) {
        console.error('Error signing technical report:', e);
        return NextResponse.json({ error: 'Error al firmar informe técnico' }, { status: 500 });
    }
}
