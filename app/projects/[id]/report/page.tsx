import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import ProjectReportView from '@/components/projects/ProjectReportView';

export const dynamic = 'force-dynamic';

export default async function ProjectReportPage({ params, searchParams }: { params: { id: string }, searchParams?: { token?: string } }) {
    const project = await prisma.project.findUnique({
        where: { id: params.id },
        include: {
            client: true,
            timeEntries: {
                where: { estadoConfirmado: true, deviceId: null },
                include: { operator: true },
                orderBy: { fecha: 'asc' }
            },
            clientDelays: {
                orderBy: { fecha: 'asc' }
            },
            checklistItems: {
                orderBy: { createdAt: 'asc' }
            },
            logs: {
                orderBy: { fecha: 'desc' }
            }
        }
    });

    if (!project) return notFound();

    // Security check: If not authenticated or accessing publicly, token must match
    const token = searchParams?.token;
    if (token && project.publicToken && token !== project.publicToken) {
        return notFound();
    }

    // Convert Date objects to JSON-serializable strings for client component
    const serializedProject = JSON.parse(JSON.stringify(project));

    return <ProjectReportView project={serializedProject} />;
}
