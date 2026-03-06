import { PrismaClient } from '@prisma/client';


const getPrisma = () => {
    const g = global as any;
    if (!g.prisma_v2) {
        g.prisma_v2 = new PrismaClient();
    }
    return g.prisma_v2;
};

export const prisma = getPrisma();

export const dataLayer = {
    // Projects
    async getProjects() {
        return await prisma.project.findMany({
            include: {
                client: true,
                responsableUser: { select: { id: true, nombreCompleto: true, role: true } },
                _count: {
                    select: { clientDelays: true, checklistItems: true }
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
    }) {
        const sanitizedData = { ...data };
        if (sanitizedData.clientId === "") delete sanitizedData.clientId;
        if (sanitizedData.responsableId === "") delete sanitizedData.responsableId;

        // Generate publicToken if not provided
        if (!sanitizedData.publicToken) {
            sanitizedData.publicToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        }

        return await prisma.project.create({ data: sanitizedData as any });
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
    }) {
        const sanitizedData = { ...data };
        if (sanitizedData.clientId === "") sanitizedData.clientId = null as any;
        if (sanitizedData.responsableId === "") sanitizedData.responsableId = null as any;
        return await prisma.project.update({ where: { id }, data: sanitizedData as any });
    },

    async deleteProject(id: string) {
        return await prisma.project.delete({ where: { id } });
    },

    // Operators
    async getOperators() {
        return await prisma.operator.findMany({
            orderBy: { createdAt: 'desc' }
        });
    },
    async createOperator(data: { nombreCompleto: string; activo?: boolean; etiquetas: string[]; pin?: string; role?: string }) {
        return await prisma.operator.create({
            data: { ...data, etiquetas: data.etiquetas as any }
        });
    },
    async updateOperator(id: string, data: { nombreCompleto?: string; activo?: boolean; etiquetas?: string[]; pin?: string; role?: string }) {
        const updateData: any = { ...data };
        if (data.etiquetas) updateData.etiquetas = data.etiquetas as any;
        return await prisma.operator.update({ where: { id }, data: updateData });
    },
    async deleteOperator(id: string) {
        return await prisma.operator.delete({ where: { id } });
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
    async getClientDelays() {
        return await prisma.clientDelay.findMany({
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
    async updateChecklistItem(id: string, data: { completed?: boolean; confirmedBySupervisor?: boolean; pendingChange?: boolean; justification?: string }) {
        return await prisma.checklistItem.update({ where: { id }, data });
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
    async createProjectLog(data: { projectId: string; fecha: string; responsable: string; observacion: string }) {
        return await prisma.projectLog.create({ data });
    },
    async deleteProjectLog(id: string) {
        return await prisma.projectLog.delete({ where: { id } });
    }
};

