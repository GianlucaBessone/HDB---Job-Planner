import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export const dataLayer = {
    // Projects
    async getProjects() {
        return await prisma.project.findMany({
            orderBy: { createdAt: 'desc' }
        });
    },
    async createProject(data: { nombre: string; activo?: boolean; observaciones?: string; horasEstimadas?: number; horasConsumidas?: number }) {
        return await prisma.project.create({ data });
    },
    async updateProject(id: string, data: { nombre?: string; activo?: boolean; observaciones?: string; horasEstimadas?: number; horasConsumidas?: number }) {
        return await prisma.project.update({ where: { id }, data });
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
    async createOperator(data: { nombreCompleto: string; activo?: boolean; etiquetas: string[] }) {
        return await prisma.operator.create({
            data: { ...data, etiquetas: data.etiquetas as any }
        });
    },
    async updateOperator(id: string, data: { nombreCompleto?: string; activo?: boolean; etiquetas?: string[] }) {
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
    }


};
