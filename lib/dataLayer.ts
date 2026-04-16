import { prisma } from './prisma';
import { generateCodigoProyecto } from '@/lib/codeGenerator';
import { logAudit } from '@/lib/audit';

export { prisma };


export const dataLayer = {
    // Projects
    async getProjectById(id: string) {
        return await prisma.project.findUnique({
            where: { id },
            include: {
                client: true,
                responsableUser: { select: { id: true, nombreCompleto: true, role: true } },
                checklistItems: {
                    select: { id: true, completed: true, excluded: true, tag: true, description: true },
                    orderBy: { createdAt: 'asc' }
                },
                materialesProyecto: {
                    include: { usos: true, devolucion: true }
                },
            }
        });
    },
    async getProjects() {
        return await prisma.project.findMany({
            include: {
                client: true,
                responsableUser: { select: { id: true, nombreCompleto: true, role: true } },
                checklistItems: {
                    select: { id: true, completed: true, excluded: true, tag: true },
                    orderBy: { createdAt: 'asc' }
                },
                _count: {
                    select: { clientDelays: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    },
    async createProject(data: {
        nombre: string;
        activo?: boolean;
        noEnMetricas?: boolean;
        observaciones?: string;
        horasEstimadas?: number;
        horasConsumidas?: number;
        cliente?: string;
        clientId?: string;
        responsable?: string;
        responsableId?: string;
        tags?: string[];
        estado?: string;
        fechaInicio?: string;
        fechaFin?: string;
        publicToken?: string;
        categoria?: string;
        tipoActividad?: string;
        generarOS?: boolean;
        geofenceLat?: number;
        geofenceLng?: number;
        geofenceRadius?: number;
        qrToken?: string;
    }) {
        const sanitizedData = { ...data };
        if (sanitizedData.clientId === "") delete sanitizedData.clientId;
        if (sanitizedData.responsableId === "") delete sanitizedData.responsableId;

        // Generate publicToken if not provided
        if (!sanitizedData.publicToken) {
            sanitizedData.publicToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        }

        // Auto-generate unique project code
        const codigoProyecto = await generateCodigoProyecto();

        const project = await prisma.project.create({ data: { ...sanitizedData, codigoProyecto } as any });

        // Automated checklist based on tags — merge static templates + DB templates
        if (data.tags && data.tags.length > 0) {
            // Import static templates
            const { CHECKLIST_TEMPLATES } = require('@/lib/checklistTemplates');

            // Get DB-defined templates
            const tagTemplates = await prisma.projectTag.findMany({
                where: { name: { in: data.tags } },
                include: { checklists: { where: { active: true } } }
            });

            for (const tagName of data.tags) {
                // Merge: static + DB (deduplicate)
                const staticItems: string[] = CHECKLIST_TEMPLATES[tagName] || [];
                const dbTag = tagTemplates.find(t => t.name === tagName);
                const dbItems: string[] = dbTag ? dbTag.checklists.map((c: any) => c.description) : [];
                const allDescriptions = Array.from(new Set([...staticItems, ...dbItems]));

                for (const desc of allDescriptions) {
                    await prisma.checklistItem.create({
                        data: {
                            projectId: project.id,
                            tag: tagName,
                            description: desc,
                            completed: false
                        }
                    });
                }
            }
        }

        await logAudit({
            action: 'CREATE',
            entity: 'PROJECT',
            entityId: project.id,
            newValue: project
        });

        return project;
    },
    async updateProject(id: string, data: {
        nombre?: string;
        activo?: boolean;
        noEnMetricas?: boolean;
        observaciones?: string;
        horasEstimadas?: number;
        horasConsumidas?: number;
        cliente?: string;
        clientId?: string;
        responsable?: string;
        responsableId?: string;
        tags?: string[];
        estado?: string;
        fechaInicio?: string;
        fechaFin?: string;
        finalizadoConPendientes?: boolean;
        pendientesSnapshot?: any;
        categoria?: string;
        tipoActividad?: string;
        generarOS?: boolean;
        geofenceLat?: number;
        geofenceLng?: number;
        geofenceRadius?: number;
        qrToken?: string;
    }) {
        const sanitizedData = { ...data };
        if (sanitizedData.clientId === "") sanitizedData.clientId = null as any;
        if (sanitizedData.responsableId === "") sanitizedData.responsableId = null as any;
        const oldProject = await prisma.project.findUnique({ where: { id } });

        // LOG QR HISTORY if changed
        if (data.qrToken !== undefined && oldProject?.qrToken && data.qrToken !== oldProject.qrToken) {
            await prisma.qrTokenHistory.upsert({
                where: { token: oldProject.qrToken },
                update: { projectId: id, replacedAt: new Date() },
                create: { token: oldProject.qrToken, projectId: id, replacedAt: new Date() }
            });
        }

        const project = await prisma.project.update({ where: { id }, data: sanitizedData as any });

        await logAudit({
            action: 'UPDATE',
            entity: 'PROJECT',
            entityId: project.id,
            oldValue: oldProject,
            newValue: project
        });

        // Sync checklists if tags changed
        if (data.tags) {
            const oldTags = (oldProject?.tags as string[]) || [];
            const newTags = data.tags;

            // Tags to add
            const tagsToAdd = newTags.filter(t => !oldTags.includes(t));
            const tagsToRemove = oldTags.filter(t => !newTags.includes(t));

            // Add new items
            if (tagsToAdd.length > 0) {
                const { CHECKLIST_TEMPLATES } = require('@/lib/checklistTemplates');
                const existingItems = await prisma.checklistItem.findMany({
                    where: { projectId: id },
                    select: { tag: true, description: true }
                });

                const tagTemplates = await prisma.projectTag.findMany({
                    where: { name: { in: tagsToAdd } },
                    include: { checklists: { where: { active: true } } }
                });

                for (const tagName of tagsToAdd) {
                    const staticItems: string[] = CHECKLIST_TEMPLATES[tagName] || [];
                    const dbTag = tagTemplates.find(t => t.name === tagName);
                    const dbItems: string[] = dbTag ? dbTag.checklists.map((c: any) => c.description) : [];
                    const allDescriptions = Array.from(new Set([...staticItems, ...dbItems]));

                    for (const desc of allDescriptions) {
                        const already = existingItems.find(i => i.tag === tagName && i.description === desc);
                        if (!already) {
                            await prisma.checklistItem.create({
                                data: {
                                    projectId: id,
                                    tag: tagName,
                                    description: desc,
                                    completed: false
                                }
                            });
                        }
                    }
                }
            }

            // Remove removed items (only those that are NOT completed to preserve history if desired?)
            // Usually, if a tag is removed, its items should disappear from the list.
            if (tagsToRemove.length > 0) {
                await prisma.checklistItem.deleteMany({
                    where: {
                        projectId: id,
                        tag: { in: tagsToRemove }
                    }
                });
            }

            // Re-evaluate pending items if project is finalized and flagged
            if (project.estado === 'finalizado' && project.finalizadoConPendientes) {
                const projCheck = await prisma.project.findUnique({
                    where: { id },
                    include: { checklistItems: true }
                });
                if (projCheck) {
                    const activeTags = (projCheck.tags as string[]) || [];
                    const activeChecklist = projCheck.checklistItems.filter(i => activeTags.includes(i.tag) && !i.excluded);
                    const pendingItems = activeChecklist.filter(i => !i.completed);

                    if (pendingItems.length === 0) {
                        await prisma.project.update({
                            where: { id },
                            data: { finalizadoConPendientes: false, pendientesSnapshot: null }
                        });
                        project.finalizadoConPendientes = false;
                        project.pendientesSnapshot = null;
                    }
                }
            }
        }

        return project;
    },

    async deleteProject(id: string) {
        const oldProject = await prisma.project.findUnique({ where: { id } });
        const res = await prisma.project.delete({ where: { id } });
        
        await logAudit({
            action: 'DELETE',
            entity: 'PROJECT',
            entityId: id,
            oldValue: oldProject
        });

        return res;
    },

    // Operators
    async getOperators() {
        return await prisma.operator.findMany({
            orderBy: { nombreCompleto: 'asc' }
        });
    },
    async createOperator(data: { nombreCompleto: string; activo?: boolean; enVacaciones?: boolean; etiquetas: string[]; pin?: string; role?: string }) {
        const operator = await prisma.operator.create({
            data: { ...data, etiquetas: data.etiquetas as any }
        });

        await logAudit({
            action: 'CREATE',
            entity: 'OPERATOR',
            entityId: operator.id,
            newValue: operator
        });

        return operator;
    },
    async updateOperator(id: string, data: { nombreCompleto?: string; activo?: boolean; enVacaciones?: boolean; etiquetas?: string[]; pin?: string; role?: string }) {
        const updateData: any = { ...data };
        if (data.etiquetas) updateData.etiquetas = data.etiquetas as any;
        
        const oldOperator = await prisma.operator.findUnique({ where: { id } });
        const operator = await prisma.operator.update({ where: { id }, data: updateData });

        await logAudit({
            action: 'UPDATE',
            entity: 'OPERATOR',
            entityId: operator.id,
            oldValue: oldOperator,
            newValue: operator
        });

        return operator;
    },
    async deleteOperator(id: string) {
        const oldOperator = await prisma.operator.findUnique({ where: { id } });
        const res = await prisma.operator.delete({ where: { id } });

        await logAudit({
            action: 'DELETE',
            entity: 'OPERATOR',
            entityId: id,
            oldValue: oldOperator
        });

        return res;
    },

    // Planning
    async getPlanningByDate(fecha: string) {
        return await prisma.planning.findUnique({ where: { fecha } });
    },
    async getFavorites() {
        return await prisma.favoriteBlock.findMany();
    },
    async createFavorite(data: any) {
        return await prisma.favoriteBlock.create({
            data: {
                name: data.name,
                projectId: data.projectId || null,
                projectName: data.projectName || null,
                startTime: data.startTime || null,
                endTime: data.endTime || null,
                note: data.note || null,
                operatorIds: data.operatorIds || [],
                operatorNames: data.operatorNames || [],
                isNoteOnly: data.isNoteOnly || false,
            }
        });
    },
    async deleteFavorite(id: string) {
        return await prisma.favoriteBlock.delete({ where: { id } });
    },
    async savePlanning(fecha: string, blocks: any[]) {
        return await prisma.planning.upsert({
            where: { fecha },
            update: { blocks: blocks as any },
            create: { fecha, blocks: blocks as any }
        });
    },

    // Clients
    async getClients() {
        return await prisma.hdbClient.findMany({
            orderBy: { nombre: 'asc' }
        });
    },
    async createClient(data: { nombre: string; email?: string; telefono?: string; direccion?: string; activo?: boolean }) {
        return await prisma.hdbClient.create({ data });
    },
    async updateClient(id: string, data: { nombre?: string; email?: string; telefono?: string; direccion?: string; activo?: boolean }) {
        return await prisma.hdbClient.update({ where: { id }, data });
    },
    async deleteClient(id: string) {
        return await prisma.hdbClient.delete({ where: { id } });
    },

    // Client Delays
    async getClientDelays(projectId?: string) {
        return await prisma.clientDelay.findMany({
            where: projectId ? { projectId } : undefined,
            include: { project: true },
            orderBy: { fecha: 'desc' }
        });
    },
    async createClientDelay(data: { projectId: string; fecha: string; hora: string; operador: string; area: string; responsableArea?: string; motivo: string; duracion: number }) {
        return await prisma.clientDelay.create({ data });
    },
    async deleteClientDelay(id: string) {
        return await prisma.clientDelay.delete({ where: { id } });
    },
    async updateClientDelay(id: string, data: { projectId?: string; fecha?: string; hora?: string; operador?: string; area?: string; responsableArea?: string; motivo?: string; duracion?: number }) {
        return await prisma.clientDelay.update({ where: { id }, data });
    },

    // Checklist
    async getChecklist(projectId: string) {
        return await prisma.checklistItem.findMany({
            where: { projectId },
            orderBy: { createdAt: 'asc' }
        });
    },
    async createChecklistItem(data: { projectId: string; tag: string; description: string }) {
        return await prisma.checklistItem.create({ data });
    },
    async updateChecklistItem(id: string, data: { completed?: boolean; excluded?: boolean; confirmedBySupervisor?: boolean; pendingChange?: boolean; justification?: string }) {
        const oldItem = await prisma.checklistItem.findUnique({ where: { id } });
        const item = await prisma.checklistItem.update({ where: { id }, data });

        await logAudit({
            action: 'UPDATE',
            entity: 'CHECKLIST',
            entityId: id,
            oldValue: oldItem,
            newValue: item
        });

        return item;
    },
    async deleteChecklistItem(id: string) {
        return await prisma.checklistItem.delete({ where: { id } });
    },

    // Project Logs (Follow-up comments)
    async getProjectLogs(projectId: string) {
        return await prisma.projectLog.findMany({
            where: { projectId },
            orderBy: { fecha: 'desc' }
        });
    },
    async createProjectLog(data: { projectId: string; fecha: string; responsable: string; observacion: string; categoria?: string }) {
        return await prisma.projectLog.create({ data });
    },
    async deleteProjectLog(id: string) {
        return await prisma.projectLog.delete({ where: { id } });
    }
};

