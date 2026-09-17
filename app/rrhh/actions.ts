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

export async function deleteVacancy(id: string) {
    try {
        await prisma.$transaction([
            prisma.candidateStageHistory.deleteMany({ where: { vacancyId: id } }),
            prisma.interview.deleteMany({ where: { vacancyId: id } }),
            prisma.technicalEvaluation.deleteMany({ where: { vacancyId: id } }),
            prisma.candidateAIAnalysis.updateMany({
                where: { vacancyId: id },
                data: { vacancyId: null }
            }),
            prisma.recruitmentVacancy.delete({ where: { id } })
        ]);
        revalidatePath('/rrhh/reclutamiento/vacantes');
        revalidatePath('/rrhh/reclutamiento');
        revalidatePath('/rrhh');
        return { success: true };
    } catch (error: any) {
        console.error('Error deleting vacancy:', error);
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

export async function getAvailableCandidatesForVacancy(vacancyId: string) {
    try {
        const candidates = await prisma.candidate.findMany({
            where: {
                stageHistory: {
                    none: { vacancyId }
                }
            },
            orderBy: { createdAt: 'desc' },
            include: {
                tags: true,
                skills: true,
            }
        });
        return { success: true, data: candidates };
    } catch (error: any) {
        console.error('Error fetching available candidates:', error);
        return { success: false, error: error.message };
    }
}

export async function assignCandidateToVacancy(candidateId: string, vacancyId: string, stage: string = 'POSTULADO', notes?: string) {
    try {
        const existing = await prisma.candidateStageHistory.findFirst({
            where: { candidateId, vacancyId }
        });
        if (existing) {
            return { success: false, error: 'El postulante ya está asignado a esta vacante.' };
        }

        const stageRecord = await prisma.candidateStageHistory.create({
            data: {
                candidateId,
                vacancyId,
                stage,
                notes: notes || 'Asignado desde la Base de Talentos'
            }
        });

        revalidatePath(`/rrhh/reclutamiento/vacantes/${vacancyId}/pipeline`);
        revalidatePath('/rrhh/reclutamiento/vacantes');
        return { success: true, data: stageRecord };
    } catch (error: any) {
        console.error('Error assigning candidate:', error);
        return { success: false, error: error.message };
    }
}

export async function createCandidate(data: any) {
    try {
        const hasVacancy = Boolean(data.vacancyId && typeof data.vacancyId === 'string' && data.vacancyId.trim() !== '');

        const candidateData: any = {
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email || null,
            phone: data.phone || null,
            city: data.city || null,
            linkedin: data.linkedin || null,
            status: 'ACTIVO',
        };

        if (hasVacancy) {
            candidateData.stageHistory = {
                create: {
                    stage: data.stage || 'POSTULADO',
                    vacancyId: data.vacancyId.trim(),
                    notes: data.notes || 'Postulación inicial manual',
                }
            };
        }

        const candidate = await prisma.candidate.create({
            data: candidateData
        });
        
        revalidatePath('/rrhh/reclutamiento/postulantes');
        if (hasVacancy) {
            revalidatePath(`/rrhh/reclutamiento/vacantes/${data.vacancyId.trim()}/pipeline`);
            revalidatePath('/rrhh/reclutamiento/vacantes');
        }
        
        return { success: true, data: candidate };
    } catch (error: any) {
        console.error('Error creating candidate:', error);
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
