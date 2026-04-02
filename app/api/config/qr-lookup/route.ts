import { NextResponse } from 'next/server';
import { prisma } from '@/lib/dataLayer';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const token = searchParams.get('token');

        if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 400 });

        // 1. Check if it's the CURRENT company token
        const system = await prisma.systemSetting.findUnique({ where: { id: 'default' } });
        if (system?.companyQrToken === token) {
            return NextResponse.json({
                type: 'BASE',
                status: 'ACTIVE',
                name: 'BASE / EMPRESA'
            });
        }

        // 2. Check if it's a CURRENT project token
        const project = await prisma.project.findFirst({
            where: { qrToken: token },
            select: { id: true, nombre: true, estado: true }
        });

        if (project) {
            return NextResponse.json({
                type: 'PROJECT',
                status: project.estado === 'finalizado' ? 'EXPIRED' : 'ACTIVE',
                projectId: project.id,
                name: project.nombre
            });
        }

        // 3. Check HISTORY
        const history = await prisma.qrTokenHistory.findUnique({
            where: { token },
            include: { project: { select: { nombre: true } } }
        });

        if (history) {
            return NextResponse.json({
                type: history.isCompanyToken ? 'BASE' : 'PROJECT',
                status: 'EXPIRED',
                projectId: history.projectId,
                name: history.project?.nombre || (history.isCompanyToken ? 'BASE / EMPRESA' : 'Proyecto Desconocido'),
                replacedAt: history.replacedAt
            });
        }

        // 4. Unknown
        return NextResponse.json({
            type: 'UNKNOWN',
            status: 'NONE',
            message: 'Código QR no reconocido por el sistema.'
        });

    } catch (error) {
        console.error('QR Lookup Error:', error);
        return NextResponse.json({ error: 'Error lookup' }, { status: 500 });
    }
}
