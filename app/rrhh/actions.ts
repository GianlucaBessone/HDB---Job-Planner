'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

// --- VACANCIES ---

export async function getVacancies() {
    try {
        const vacancies = await prisma.recruitmentVacancy.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { candidates: true }
                }
            }
        });
        return { success: true, data: vacancies };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getVacancy(id: string) {
    try {
        const vacancy = await prisma.recruitmentVacancy.findUnique({
            where: { id },
        });
        return { success: true, data: vacancy };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function createVacancy(data: any) {
    try {
        const vacancy = await prisma.recruitmentVacancy.create({
            data: {
                title: data.title,
                status: data.status || 'ABIERTA',
                priority: data.priority || 'MEDIA',
                branch: data.branch,
                positionsCount: Number(data.positionsCount) || 1,
                description: data.description || '',
                requirements: data.requirements || '',
                keywords: data.keywords || [],
            }
        });
        revalidatePath('/rrhh/reclutamiento/vacantes');
        return { success: true, data: vacancy };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// --- CANDIDATES ---

export async function getCandidates() {
    try {
        const candidates = await prisma.candidate.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                tags: true,
                skills: true,
            }
        });
        return { success: true, data: candidates };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getCandidate(id: string) {
    try {
        const candidate = await prisma.candidate.findUnique({
            where: { id },
            include: {
                tags: true,
                skills: true,
                experience: true,
                education: true,
                aiAnalyses: true,
                stageHistory: {
                    orderBy: { createdAt: 'desc' }
                }
            }
        });
        return { success: true, data: candidate };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function createCandidate(data: any) {
    try {
        const candidate = await prisma.candidate.create({
            data: {
                firstName: data.firstName,
                lastName: data.lastName,
                email: data.email,
                phone: data.phone,
                city: data.city,
                linkedin: data.linkedin,
                status: 'ACTIVO',
                stageHistory: {
                    create: {
                        stage: 'POSTULADO',
                        vacancyId: data.vacancyId,
                        notes: 'Postulación inicial manual',
                    }
                }
            }
        });
        
        // If there's a vacancyId, we link them implicitly through stageHistory
        // You could also create tags or skills here if provided
        
        revalidatePath('/rrhh/reclutamiento/postulantes');
        if (data.vacancyId) {
            revalidatePath(`/rrhh/reclutamiento/vacantes/${data.vacancyId}/pipeline`);
        }
        
        return { success: true, data: candidate };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getPipelineCandidates(vacancyId: string) {
    try {
        // Find all candidates that have a stage history for this vacancy
        const candidates = await prisma.candidate.findMany({
            where: {
                stageHistory: {
                    some: { vacancyId }
                }
            },
            include: {
                stageHistory: {
                    where: { vacancyId },
                    orderBy: { createdAt: 'desc' },
                    take: 1
                },
                tags: true
            }
        });
        
        return { success: true, data: candidates };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateCandidateStage(candidateId: string, vacancyId: string, newStage: string) {
    try {
        const stageRecord = await prisma.candidateStageHistory.create({
            data: {
                candidateId,
                vacancyId,
                stage: newStage,
                notes: 'Movido a través del Kanban'
            }
        });
        
        // If stage is CONTRATADO or RECHAZADO, update the candidate status globally
        if (newStage === 'CONTRATADO') {
            await prisma.candidate.update({
                where: { id: candidateId },
                data: { status: 'CONTRATADO' }
            });
        } else if (newStage === 'RECHAZADO') {
            await prisma.candidate.update({
                where: { id: candidateId },
                data: { status: 'RECHAZADO' }
            });
        }
        
        revalidatePath(`/rrhh/reclutamiento/vacantes/${vacancyId}/pipeline`);
        return { success: true, data: stageRecord };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
