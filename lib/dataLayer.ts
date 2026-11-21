import { prisma } from './prisma';
import type { ClienteInput } from './clientes';
import { generateCodigoProyecto } from '@/lib/codeGenerator';
import { logAudit } from '@/lib/audit';
import { hashPin, isPinHashed } from '@/lib/pinAuth';
import { crearChecklistsPorEtiqueta } from '@/lib/proyectos/checklistsPorEtiqueta';

export { prisma };

// El PIN se guarda siempre hasheado y nunca se copia a la auditoría.
function withHashedPin<T extends { pin?: string }>(data: T): T {
    if (data.pin && !isPinHashed(data.pin)) return { ...data, pin: hashPin(data.pin) };
    return data;
}

/** Usuario de la sesión que hace el cambio, para la auditoría. */
export interface ActorAuditoria {
    userId: string;
    nombre: string;
}

function autor(actor?: ActorAuditoria) {
    return actor ? { userId: actor.userId, userName: actor.nombre } : {};
}

function withoutPin<T extends { pin?: string } | null>(operator: T) {
    if (!operator) return operator;
    const { pin: _pin, ...rest } = operator as any;
    return rest;
}


// ── Borrado seguro ────────────────────────────────────────────────
// Personas, clientes y proyectos con historial no se borran: se desactivan.
// Borrarlos eliminaba en cascada horas, fichadas y órdenes firmadas (auditoría, X14).

export interface ResultadoBaja {
    modo: 'eliminado' | 'desactivado';
    /** Qué historial impidió el borrado, con cantidades. */
    historial: Record<string, number>;
}

function conHistorial(conteos: Record<string, number> | undefined | null): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(conteos || {})) if (v > 0) out[k] = v;
    return out;
}

/** Texto para mostrar qué historial tiene un registro ("12 registros de horas, 3 órdenes…"). */
export function describirHistorial(historial: Record<string, number>, etiquetas: Record<string, string>): string {
    return Object.entries(historial)
        .map(([k, n]) => `${n} ${etiquetas[k] || k}`)
        .join(', ');
}

export const dataLayer = {
    // Projects
    async autoUpdateProjectStatuses() {
        const today = new Date().toISOString().split('T')[0];
        try {
            await prisma.project.updateMany({
                where: {
                    estado: { notIn: ['finalizado', 'atrasado', 'cancelado'] },
                    fechaFin: {
                        not: '',
                        lt: today
                    }
                },
                data: {
                    estado: 'atrasado'
                }
            });
        } catch (error) {
            console.error('Error auto-updating project statuses:', error);
        }
    },
    async getProjectById(id: string) {
        await this.autoUpdateProjectStatuses();
        return await prisma.project.findUnique({
            where: { id },
            include: {
                client: true,
                listaPrecio: { select: { id: true, codigo: true, nombre: true } },
                responsableUser: { select: { id: true, nombreCompleto: true, role: true } },
                checklistItems: {
                    select: { id: true, completed: true, excluded: true, tag: true, description: true },
                    orderBy: { createdAt: 'asc' }
                },
                materialesProyecto: {
                    include: { usos: true, devoluciones: true }
                },
            }
        });
    },
    async getProjects() {
        await this.autoUpdateProjectStatuses();
        return await prisma.project.findMany({
            include: {
                client: true,
                listaPrecio: { select: { id: true, codigo: true, nombre: true } },
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
        aprovisionamiento?: boolean;
        listaPrecioId?: string | null;
        geofenceLat?: number;
        geofenceLng?: number;
        geofenceRadius?: number;
        qrToken?: string;
        fichajeHabilitado?: boolean;
        proyectoFijo?: boolean;
    }, actor?: ActorAuditoria) {
        const sanitizedData = { ...data };
        // Project.horasConsumidas se calcula solo desde el registro de tiempos
        // (app/api/time-entries/route.ts): se ignora si viene en el body.
        delete (sanitizedData as { horasConsumidas?: unknown }).horasConsumidas;
        if (sanitizedData.clientId === "") delete sanitizedData.clientId;
        if (sanitizedData.responsableId === "") delete sanitizedData.responsableId;
        if (sanitizedData.listaPrecioId === "") sanitizedData.listaPrecioId = null;

        // Generate publicToken if not provided
        if (!sanitizedData.publicToken) {
            sanitizedData.publicToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        }

        // Auto-generate unique project code
        const codigoProyecto = await generateCodigoProyecto();

        const project = await prisma.project.create({ data: { ...sanitizedData, codigoProyecto } as any });

        // Automated checklist based on tags — merge static templates + DB templates
        if (data.tags && data.tags.length > 0) {
            await crearChecklistsPorEtiqueta(prisma, project.id, data.tags);
        }

        await logAudit({
            ...autor(actor),
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
        aprovisionamiento?: boolean;
        listaPrecioId?: string | null;
        geofenceLat?: number;
        geofenceLng?: number;
        geofenceRadius?: number;
        qrToken?: string;
        fichajeHabilitado?: boolean;
        proyectoFijo?: boolean;
    }, actor?: ActorAuditoria) {
        const sanitizedData = { ...data };
        // Project.horasConsumidas no se edita a mano: lo mantiene el registro de tiempos.
        delete (sanitizedData as { horasConsumidas?: unknown }).horasConsumidas;
        if (sanitizedData.clientId === "") sanitizedData.clientId = null as any;
        if (sanitizedData.responsableId === "") sanitizedData.responsableId = null as any;
        if (sanitizedData.listaPrecioId === "") sanitizedData.listaPrecioId = null as any;
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
            ...autor(actor),
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
                    include: {
                        checklists: { where: { active: true } },
                        templates: {
                            include: {
                                checklistTemplate: true
                            }
                        }
                    }
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

                    // NEW: Create DocumentChecklist snapshots from ChecklistTemplates
                    if (dbTag?.templates) {
                        const count = await prisma.documentChecklist.count({ where: { projectId: id } });
                        let order = count;
                        for (const link of dbTag.templates) {
                            const tmpl = link.checklistTemplate;
                            if (tmpl.status !== 'active') continue;

                            const alreadySnapshot = await prisma.documentChecklist.findFirst({
                                where: { projectId: id, templateId: tmpl.id }
                            });

                            if (!alreadySnapshot) {
                                await prisma.documentChecklist.create({
                                    data: {
                                        projectId: id,
                                        templateId: tmpl.id,
                                        templateVersion: tmpl.version,
                                        templateName: tmpl.name,
                                        snapshotData: {
                                            requiresEvidence: tmpl.requiresEvidence,
                                            requiresPhotos: tmpl.requiresPhotos,
                                            requiresSignature: tmpl.requiresSignature,
                                            riskLevel: tmpl.riskLevel,
                                            items: tmpl.checklistItems
                                        } as any,
                                        editable: false,
                                        mandatory: true,
                                        order: order++,
                                        status: 'pending'
                                    }
                                });
                            }
                        }
                    }
                }
            }

            // Remove removed items
            if (tagsToRemove.length > 0) {
                await prisma.checklistItem.deleteMany({
                    where: {
                        projectId: id,
                        tag: { in: tagsToRemove }
                    }
                });

                // Also remove DocumentChecklist snapshots of templates linked to removed tags if still pending
                const tagsWithTemplates = await prisma.projectTag.findMany({
                    where: { name: { in: tagsToRemove } },
                    include: {
                        templates: true
                    }
                });

                const templateIdsToRemove = tagsWithTemplates.flatMap(t => t.templates.map(l => l.checklistTemplateId));
                if (templateIdsToRemove.length > 0) {
                    await prisma.documentChecklist.deleteMany({
                        where: {
                            projectId: id,
                            templateId: { in: templateIdsToRemove },
                            status: 'pending'
                        }
                    });
                }
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

            // Create automatic material returns if finalized
            if (project.estado === 'finalizado' && oldProject?.estado !== 'finalizado') {
                const materiales = await prisma.materialProyecto.findMany({
                    where: { proyectoId: id, estado: { notIn: ['cerrado_ok', 'cerrado_con_reserva'] } },
                    include: { usos: true }
                });
                for (const mat of materiales) {
                    const cantidadUsada = mat.usos.reduce((acc: number, u: any) => acc + u.cantidadUtilizada, 0);
                    const sobrante = mat.cantidadEntregada - cantidadUsada;
                    
                    if (sobrante > 0) {
                        await prisma.materialDevolucion.create({
                            data: {
                                materialId: mat.id,
                                cantidadADevolver: sobrante,
                                estado: 'pendiente'
                            }
                        });
                        await prisma.materialProyecto.update({
                            where: { id: mat.id },
                            data: { estado: 'pendiente_devolucion' }
                        });
                    } else if (mat.estado !== 'cerrado_ok' && mat.estado !== 'cerrado_con_reserva') {
                        // All used, close it
                        await prisma.materialProyecto.update({
                            where: { id: mat.id },
                            data: { estado: 'cerrado_ok' }
                        });
                    }
                }
            }
        }

        return project;
    },

    async deleteProject(id: string, actor?: ActorAuditoria): Promise<ResultadoBaja> {
        const oldProject = await prisma.project.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        timeEntries: true, fichadas: true, ordenesServicio: true, ordenesTrabajo: true,
                        materialesProyecto: true, technicalReports: true, logs: true, clientDelays: true,
                        encuestas: true, viajes: true, tareas: true,
                    },
                },
            },
        });
        if (!oldProject) throw new Error('Proyecto no encontrado');
        const { _count, ...datos } = oldProject;
        const historial = conHistorial(_count);

        if (Object.keys(historial).length > 0) {
            await prisma.project.update({ where: { id }, data: { activo: false } });
            await logAudit({
                ...autor(actor),
                action: 'UPDATE',
                entity: 'PROJECT',
                entityId: id,
                oldValue: { activo: datos.activo },
                newValue: { activo: false },
                metadata: { message: 'Desactivado en lugar de eliminado: tiene historial', historial },
            });
            return { modo: 'desactivado', historial };
        }

        await prisma.project.delete({ where: { id } });
        await logAudit({
            ...autor(actor),
            action: 'DELETE',
            entity: 'PROJECT',
            entityId: id,
            oldValue: datos
        });
        return { modo: 'eliminado', historial };
    },

    // Operators
    async getOperators() {
        return await prisma.operator.findMany({
            orderBy: { nombreCompleto: 'asc' }
        });
    },
    async createOperator(data: { nombreCompleto: string; activo?: boolean; enVacaciones?: boolean; etiquetas: string[]; pin?: string; role?: string; dni?: string; posicion?: string; manoObraCategoriaId?: string | null }, actor?: ActorAuditoria) {
        const operator = await prisma.operator.create({
            data: { ...withHashedPin({ ...data, pin: data.pin || '1234' }), etiquetas: data.etiquetas as any }
        });

        await logAudit({
            ...autor(actor),
            action: 'CREATE',
            entity: 'OPERATOR',
            entityId: operator.id,
            newValue: withoutPin(operator)
        });

        // Trigger dynamic QMS training sync
        try {
            const { syncOperatorTrainings } = require('@/app/api/qms/compliance-engine');
            await syncOperatorTrainings(operator.id);
        } catch (err) {
            console.error('Failed to sync operator QMS trainings on create:', err);
        }

        return operator;
    },
    async updateOperator(id: string, data: { nombreCompleto?: string; activo?: boolean; enVacaciones?: boolean; etiquetas?: string[]; pin?: string; role?: string; dni?: string; posicion?: string; primaryDeviceId?: string | null; manoObraCategoriaId?: string | null }, actor?: ActorAuditoria) {
        const updateData: any = withHashedPin({ ...data });
        if (data.etiquetas) updateData.etiquetas = data.etiquetas as any;
        
        const oldOperator = await prisma.operator.findUnique({ where: { id } });
        const operator = await prisma.operator.update({ where: { id }, data: updateData });

        await logAudit({
            ...autor(actor),
            action: 'UPDATE',
            entity: 'OPERATOR',
            entityId: operator.id,
            oldValue: withoutPin(oldOperator),
            newValue: withoutPin(operator),
            ...(data.pin ? { metadata: { pinCambiado: true } } : {})
        });

        // Trigger dynamic QMS training sync
        try {
            const { syncOperatorTrainings } = require('@/app/api/qms/compliance-engine');
            await syncOperatorTrainings(operator.id);
        } catch (err) {
            console.error('Failed to sync operator QMS trainings on update:', err);
        }

        return operator;
    },
    async deleteOperator(id: string, actor?: ActorAuditoria): Promise<ResultadoBaja> {
        const oldOperator = await prisma.operator.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        timeEntries: true, fichadas: true, ordenesServicio: true, otCicloOperadores: true,
                        ordenesTrabajoCreadas: true, ordenesTrabajoResponsable: true, eppDeliveries: true,
                        toolMovements: true, ventasRealizadas: true, cotizacionesRealizadas: true,
                        viajesResponsable: true, technicalReports: true, projectLogs: true, responsibleProjects: true,
                    },
                },
            },
        });
        if (!oldOperator) throw new Error('Usuario no encontrado');
        const { _count, ...datos } = oldOperator;
        const historial = conHistorial(_count);

        if (Object.keys(historial).length > 0) {
            await prisma.operator.update({ where: { id }, data: { activo: false } });
            await logAudit({
                ...autor(actor),
                action: 'UPDATE',
                entity: 'OPERATOR',
                entityId: id,
                oldValue: { activo: datos.activo },
                newValue: { activo: false },
                metadata: { message: 'Desactivado en lugar de eliminado: tiene historial', historial },
            });
            return { modo: 'desactivado', historial };
        }

        await prisma.operator.delete({ where: { id } });
        await logAudit({
            ...autor(actor),
            action: 'DELETE',
            entity: 'OPERATOR',
            entityId: id,
            oldValue: withoutPin(datos)
        });
        return { modo: 'eliminado', historial };
    },
    async resetAllDevices(actor?: ActorAuditoria) {
        const res = await prisma.operator.updateMany({
            data: { primaryDeviceId: null }
        });
        
        await logAudit({
            ...autor(actor),
            action: 'UPDATE',
            entity: 'OPERATOR',
            entityId: 'ALL',
            newValue: { primaryDeviceId: null },
            metadata: { message: 'Reset all devices' }
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
            select: {
                id: true,
                nombre: true,
                razonSocial: true,
                cuit: true,
                condicionIva: true,
                email: true,
                telefono: true,
                direccion: true,
                activo: true,
                listaPrecioId: true,
                listaPrecio: {
                    select: {
                        id: true,
                        nombre: true,
                        tipoAjuste: true,
                        valorAjuste: true,
                        ivaDiscriminado: true,
                    }
                }
            },
            orderBy: { nombre: 'asc' }
        });
    },
    // Los datos llegan validados por clienteSchema (lib/clientes.ts).
    async createClient(data: ClienteInput) {
        return await prisma.hdbClient.create({ data });
    },
    async updateClient(id: string, data: Partial<ClienteInput>) {
        return await prisma.hdbClient.update({ where: { id }, data });
    },
    async deleteClient(id: string, actor?: ActorAuditoria): Promise<ResultadoBaja> {
        const oldClient = await prisma.hdbClient.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        projects: true, ordenesTrabajo: true, ventas: true, cotizaciones: true,
                        cuentaCorrienteMovs: true, presupuestosServicio: true, pliegos: true, technicalReports: true,
                    },
                },
            },
        });
        if (!oldClient) throw new Error('Cliente no encontrado');
        const { _count, ...datos } = oldClient;
        const historial = conHistorial(_count);

        if (Object.keys(historial).length > 0) {
            await prisma.hdbClient.update({ where: { id }, data: { activo: false } });
            await logAudit({
                ...autor(actor),
                action: 'UPDATE',
                entity: 'CLIENT',
                entityId: id,
                oldValue: { activo: datos.activo },
                newValue: { activo: false },
                metadata: { message: 'Desactivado en lugar de eliminado: tiene historial', historial },
            });
            return { modo: 'desactivado', historial };
        }

        await prisma.hdbClient.delete({ where: { id } });
        await logAudit({
            ...autor(actor),
            action: 'DELETE',
            entity: 'CLIENT',
            entityId: id,
            oldValue: datos
        });
        return { modo: 'eliminado', historial };
    },

    // Client Delays
    async getClientDelays(projectId?: string) {
        return await prisma.clientDelay.findMany({
            where: projectId ? { projectId } : undefined,
            include: { project: true },
            orderBy: { fecha: 'desc' }
        });
    },
    async createClientDelay(data: { projectId: string; fecha: string; hora: string; operador: string; operadorId?: string; area: string; responsableArea?: string; motivo: string; duracion: number }) {
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
    async createProjectLog(data: { projectId: string; fecha: string; responsable: string; responsableId?: string; observacion: string; categoria?: string }) {
        return await prisma.projectLog.create({ data });
    },
    async deleteProjectLog(id: string) {
        return await prisma.projectLog.delete({ where: { id } });
    }
};

