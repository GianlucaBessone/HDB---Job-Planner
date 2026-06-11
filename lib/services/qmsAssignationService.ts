import { prisma } from '@/lib/prisma';

export async function autoAssignQMSForOS(os: any) {
    try {
        // Obtener datos del proyecto para evaluar reglas de aplicabilidad
        const proj = await prisma.project.findUnique({
            where: { id: os.projectId },
            select: { tipoActividad: true, categoria: true, clientId: true, tags: true }
        });

        if (!proj) return;

        // Buscar documentos vigentes y sus reglas de aplicabilidad
        const docsVigentes = await prisma.controlledDocument.findMany({
            where: { estado: 'vigente' },
            include: {
                applicabilityRules: true,
                versions: { where: { estado: 'vigente' }, take: 1 }
            }
        });

        for (const doc of docsVigentes) {
            if (doc.versions.length === 0) continue;
            const versionVigente = doc.versions[0];

            let aplica = false;
            let bloqueante = false;
            let generaChecklist = false;

            // Evaluar reglas de aplicabilidad
            for (const rule of doc.applicabilityRules) {
                const matchTipo = !rule.tipoActividad || rule.tipoActividad === proj.tipoActividad;
                const matchCategoria = !rule.categoriaProyecto || rule.categoriaProyecto === proj.categoria;
                const matchCliente = !rule.clienteId || rule.clienteId === proj.clientId;
                
                let matchTags = true;
                if (rule.tagsRequeridos && Array.isArray(rule.tagsRequeridos) && rule.tagsRequeridos.length > 0) {
                    const pTags = (proj.tags as string[]) || [];
                    matchTags = rule.tagsRequeridos.some((t: any) => pTags.includes(t));
                }

                if (matchTipo && matchCategoria && matchCliente && matchTags) {
                    aplica = true;
                    if (rule.bloqueanteDeInicio) bloqueante = true;
                    if (rule.generaChecklist) generaChecklist = true;
                    break; // Si una regla aplica, asignamos
                }
            }

            if (aplica) {
                // Asignar documento a la OS
                await prisma.ordenServicioDocumento.create({
                    data: {
                        ordenServicioId: os.id,
                        documentId: doc.id,
                        versionId: versionVigente.id,
                        versionSnapshot: `${versionVigente.versionMayor}.${versionVigente.versionMenor}`,
                        requerido: true,
                        bloqueante: bloqueante,
                        leido: false
                    }
                });

                // Generar checklist derivado si aplica y tiene template
                if (generaChecklist && versionVigente.checklistTemplate) {
                    const templateItems = versionVigente.checklistTemplate as any[];
                    if (Array.isArray(templateItems) && templateItems.length > 0) {
                        await prisma.oSChecklist.create({
                            data: {
                                ordenServicioId: os.id,
                                documentVersionId: versionVigente.id,
                                titulo: `Checklist: ${doc.titulo}`,
                                estado: 'pendiente',
                                items: {
                                    create: templateItems.map(item => ({
                                        descripcion: item.descripcion || 'Paso',
                                        esObligatorio: !!item.esObligatorio,
                                        requiereEvidencia: !!item.requiereEvidencia,
                                        completado: false
                                    }))
                                }
                            }
                        });
                    }
                }
            }
        }
    } catch (qmsError) {
        console.error('QMS Auto-assignment error on OS creation:', qmsError);
        // Non-blocking error
    }
}
