import { PrismaClient } from '../prisma/generated/client';
// Triggering reload to pick up new Prisma Client generation

const getPrisma = () => {
    const g = global as any;
    if (!g.prisma) {
        g.prisma = new PrismaClient();
    }
    return g.prisma;
};

export const prisma = getPrisma();

export const dataLayer = {
    // Projects
    async getProjects() {
        return await prisma.project.findMany({
            include: {
                client: true,
                _count: {
                    select: { clientDelays: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    },
    async createProject(data: { nombre: string; activo?: boolean; observaciones?: string; horasEstimadas?: number; horasConsumidas?: number; cliente?: string; clientId?: string; responsable?: string; estado?: string; fechaInicio?: string; fechaFin?: string }) {
        const sanitizedData = { ...data };
        if (sanitizedData.clientId === "") delete sanitizedData.clientId;
        return await prisma.project.create({ data: sanitizedData });
    },
    async updateProject(id: string, data: { nombre?: string; activo?: boolean; observaciones?: string; horasEstimadas?: number; horasConsumidas?: number; cliente?: string; clientId?: string; responsable?: string; estado?: string; fechaInicio?: string; fechaFin?: string }) {
        const sanitizedData = { ...data };
        if (sanitizedData.clientId === "") sanitizedData.clientId = null as any; // Allow unlinking client
        return await prisma.project.update({ where: { id }, data: sanitizedData });
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
    async createClientDelay(data: { projectId: string; fecha: string; hora: string; operador: string; area: string; motivo: string; duracion: number }) {
        return await prisma.clientDelay.create({ data });
    },
    async deleteClientDelay(id: string) {
        return await prisma.clientDelay.delete({ where: { id } });
    }


};
