import { NextResponse } from 'next/server';
import { prisma } from '@/lib/dataLayer';
import { getDistanceInMeters } from '@/lib/geo';
import { format } from 'date-fns';

function calculateHours(start: string, end: string): number {
    if (!start || !end) return 0;
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);

    const startMinsTotal = h1 * 60 + m1;
    const roundedStartMins = Math.ceil(startMinsTotal / 30) * 30;

    let endMinsTotal = h2 * 60 + m2;
    if (endMinsTotal < startMinsTotal) endMinsTotal += 24 * 60;
    const roundedEndMins = Math.floor(endMinsTotal / 30) * 30;

    const diffHours = (roundedEndMins - roundedStartMins) / 60;
    return Math.max(0, Math.round(diffHours * 100) / 100);
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { operatorId, action, projectId, deviceId, latitude, longitude, qrToken, isOfflinePending, timestamp } = body;

        if (!operatorId || !action || !deviceId) {
            return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
        }

        const operator = await prisma.operator.findUnique({ where: { id: operatorId } });
        if (!operator) return NextResponse.json({ error: 'Operador no encontrado' }, { status: 404 });

        let validationFlags: string[] = [];
        let isSuspicious = false;

        if (isOfflinePending) {
            validationFlags.push('OFFLINE_PENDING');
        }

        // 1. Device Validation
        if (operator.primaryDeviceId) {
            if (operator.primaryDeviceId !== deviceId) {
                validationFlags.push('DEVICE_MISMATCH');
                isSuspicious = true;
            }
        } else {
            await prisma.operator.update({
                where: { id: operatorId },
                data: { primaryDeviceId: deviceId }
            });
        }

        const shared = await prisma.operator.findFirst({
            where: { primaryDeviceId: deviceId, id: { not: operatorId } }
        });
        if (shared) {
            validationFlags.push('DEVICE_SHARED');
            isSuspicious = true;
        }

        let qrValidated = false;

        // 2. Geofence & QR Logic
        if (projectId) {
            const project = await prisma.project.findUnique({ where: { id: projectId }});
            if (!project) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });

            if (qrToken && project.qrToken === qrToken) {
                qrValidated = true;
            } else if (qrToken) {
                validationFlags.push('QR_INVALID');
                isSuspicious = true;
            }

            if (latitude !== undefined && longitude !== undefined) {
                if (project.geofenceLat !== null && project.geofenceLng !== null && project.geofenceRadius !== null) {
                    const distance = getDistanceInMeters(latitude, longitude, project.geofenceLat, project.geofenceLng);
                    if (distance > project.geofenceRadius) {
                        validationFlags.push('OUT_OF_GEOFENCE');
                        isSuspicious = true;
                    }
                } else {
                    const sys = await prisma.systemSetting.findUnique({ where: { id: 'default' }});
                    if (sys?.companyGeofenceLat !== null && sys?.companyGeofenceLng !== null && sys?.companyGeofenceRadius !== null && sys?.companyGeofenceLat !== undefined) {
                        const distance = getDistanceInMeters(latitude, longitude, sys.companyGeofenceLat, sys.companyGeofenceLng);
                        if (distance > sys.companyGeofenceRadius) {
                            validationFlags.push('OUT_OF_GEOFENCE');
                            isSuspicious = true;
                        }
                    }
                }
            }
        } else {
            const sys = await prisma.systemSetting.findUnique({ where: { id: 'default' }});
            if (latitude !== undefined && longitude !== undefined && sys?.companyGeofenceLat !== null && sys?.companyGeofenceLng !== null && sys?.companyGeofenceRadius !== null && sys?.companyGeofenceLat !== undefined) {
                const distance = getDistanceInMeters(latitude, longitude, sys.companyGeofenceLat, sys.companyGeofenceLng);
                if (distance > sys.companyGeofenceRadius) {
                    validationFlags.push('OUT_OF_GEOFENCE');
                    isSuspicious = true;
                }
            }
        }

        if (latitude === undefined || longitude === undefined) {
            validationFlags.push('NO_LOCATION');
            isSuspicious = true;
        }

        const now = timestamp ? new Date(timestamp) : new Date();
        const dateStr = format(now, 'yyyy-MM-dd');
        const timeStr = format(now, 'HH:mm');

        // Allow entering without a specific active project if it's generic hours
        const targetProjectId = projectId || 'generic_project_id_if_any'; // Actually, in this system, projectId is required for TimeEntry.

        if (!projectId && !validationFlags.includes('DEVICE_SHARED')) {
            // Need to verify if TimeEntry allows empty projectId. It does not: `projectId String`
            // If the user hasn't selected a project, we can't create a time entry unless we have a dummy project or they are required to select one.
            // Wait, "Permitir fichado SIN proyecto asignado cuando el usuario esté dentro de esta geovalla."
            // But Prisma schema has `projectId String` without `?`. We might need a generic internal project or we need to change projectId to optional.
        }

        // Finding existing entry for today and project
        let existing;
        if (targetProjectId !== 'generic_project_id_if_any') {
             existing = await prisma.timeEntry.findFirst({
                where: { 
                    operatorId, 
                    projectId: targetProjectId, 
                    fecha: dateStr, 
                    horaEgreso: null 
                },
                orderBy: { createdAt: 'desc' }
            });
        } else {
            // Find an entry with NO project id if empty
             existing = await prisma.timeEntry.findFirst({
                where: { 
                    operatorId, 
                    projectId: null, 
                    fecha: dateStr, 
                    horaEgreso: null 
                },
                orderBy: { createdAt: 'desc' }
            });
        }

        let entry;
        if (action === 'IN') {
            if (existing) {
                return NextResponse.json({ error: 'Ya tienes una jornada iniciada para hoy con este proyecto o base.' }, { status: 400 });
            }
            // Allow generic now since we made it optional
            // if (targetProjectId === 'generic_project_id_if_any') {
            //    return NextResponse.json({ error: 'Debes seleccionar un proyecto.' }, { status: 400 });
            // }
            
            entry = await prisma.timeEntry.create({
                data: {
                    operatorId,
                    projectId: targetProjectId !== 'generic_project_id_if_any' ? targetProjectId : null,
                    fecha: dateStr,
                    horaIngreso: timeStr,
                    deviceId,
                    latitude: latitude || null,
                    longitude: longitude || null,
                    qrValidated,
                    validationFlags: JSON.stringify(validationFlags),
                    isSuspicious,
                    isOfflinePending: isOfflinePending || false
                }
            });
        } else if (action === 'OUT') {
            if (!existing) {
                return NextResponse.json({ error: 'No se encontró una jornada activa para finalizar.' }, { status: 404 });
            }

            const horasTrabajadas = calculateHours(existing.horaIngreso || '00:00', timeStr);

            const existingFlagsRaw = (existing.validationFlags as string) || '[]';
            let parsedExistingFlags: string[] = [];
            try {
                 const parsed = JSON.parse(existingFlagsRaw);
                 parsedExistingFlags = Array.isArray(parsed) ? parsed : [];
            } catch (e) { }
            
            const merged = parsedExistingFlags.concat(validationFlags);
            const uniqueFlags = merged.filter((item, pos) => merged.indexOf(item) === pos);

            entry = await prisma.timeEntry.update({
                where: { id: existing.id },
                data: {
                    horaEgreso: timeStr,
                    horasTrabajadas,
                    deviceId,
                    latitude: latitude || existing.latitude,
                    longitude: longitude || existing.longitude,
                    qrValidated: existing.qrValidated || qrValidated,
                    validationFlags: JSON.stringify(uniqueFlags),
                    isSuspicious: existing.isSuspicious || isSuspicious
                }
            });

            if (horasTrabajadas > 0 && existing.projectId) {
                const projectHoursImpact = existing.isExtra ? Math.ceil(horasTrabajadas) * 2 : Math.ceil(horasTrabajadas);
                await prisma.project.update({
                    where: { id: existing.projectId },
                    data: { horasConsumidas: { increment: projectHoursImpact } }
                });
            }
        }

        return NextResponse.json(entry, { status: 201 });
    } catch (error: any) {
        console.error("Punch POST Error: ", error);
        return NextResponse.json({ error: error?.message || 'Failed to register punch' }, { status: 500 });
    }
}
