import { NextResponse } from 'next/server';
import { prisma } from '@/lib/dataLayer';
import { getDistanceInMeters } from '@/lib/geo';
import { format, differenceInMinutes, parseISO } from 'date-fns';
import { sendPushNotification } from '@/lib/onesignal';
import { logAudit } from '@/lib/audit';

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
        const { operatorId, action, projectId, deviceId, latitude, longitude, qrToken, isOfflinePending, timestamp, forceConfirmed } = body;

        if (!operatorId || !action || !deviceId) {
            return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
        }

        const operator = await prisma.operator.findUnique({ where: { id: operatorId } });
        if (!operator) return NextResponse.json({ error: 'Operador no encontrado' }, { status: 404 });

        let validationFlags: string[] = [];
        let isSuspicious = false;
        let score = 0;

        if (isOfflinePending) {
            validationFlags.push('OFFLINE_PENDING');
            score += 2;
        }

        // 1. Device Validation
        if (operator.primaryDeviceId) {
            if (operator.primaryDeviceId !== deviceId) {
                validationFlags.push('DEVICE_MISMATCH');
                isSuspicious = true;
                score += 2;
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
            score += 2;
        }

        let qrValidated = false;
        if (qrToken) score += 1;

        // 2. Geofence & QR Logic
        let outOfGeofence = false;
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
                        outOfGeofence = true;
                    }
                } else {
                    const sys = await prisma.systemSetting.findUnique({ where: { id: 'default' }});
                    if (sys?.companyGeofenceLat !== null && sys?.companyGeofenceLng !== null && sys?.companyGeofenceRadius !== null && sys?.companyGeofenceLat !== undefined) {
                        const distance = getDistanceInMeters(latitude, longitude, sys.companyGeofenceLat, sys.companyGeofenceLng);
                        if (distance > sys.companyGeofenceRadius) {
                            outOfGeofence = true;
                        }
                    }
                }
            }
        } else {
            const sys = await prisma.systemSetting.findUnique({ where: { id: 'default' }});
            if (latitude !== undefined && longitude !== undefined && sys?.companyGeofenceLat !== null && sys?.companyGeofenceLng !== null && sys?.companyGeofenceRadius !== null && sys?.companyGeofenceLat !== undefined) {
                const distance = getDistanceInMeters(latitude, longitude, sys.companyGeofenceLat, sys.companyGeofenceLng);
                if (distance > sys.companyGeofenceRadius) {
                    outOfGeofence = true;
                }
            }
        }

        if (outOfGeofence) {
            validationFlags.push('OUT_OF_GEOFENCE');
            isSuspicious = true;
            score += 2;
        }

        if (latitude === undefined || longitude === undefined) {
            validationFlags.push('NO_LOCATION');
            isSuspicious = true;
        }

        // 3. Planning validation — check if operator is assigned to this project today
        const now = timestamp ? new Date(timestamp) : new Date();
        const argentinaNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
        const dateStr = format(argentinaNow, 'yyyy-MM-dd');
        const timeStr = format(argentinaNow, 'HH:mm');

        let isUnassignedProject = false;
        if (projectId && action === 'IN') {
            try {
                const planning = await prisma.planning.findUnique({ where: { fecha: dateStr } });
                if (planning) {
                    const blocks = planning.blocks as any[];
                    const isAssigned = blocks.some((block: any) => {
                        const opIds = Array.isArray(block.operatorIds) ? block.operatorIds : (block.operatorIds ? JSON.parse(block.operatorIds) : []);
                        return block.projectId === projectId && opIds.includes(operatorId);
                    });
                    if (!isAssigned) {
                        if (!forceConfirmed) {
                            return NextResponse.json({ 
                                error: 'UNASSIGNED_PROJECT', 
                                code: 'CONFIRM_REQUIRED', 
                                message: 'No estás asignado a este proyecto hoy.' 
                            }, { status: 403 });
                        }
                        validationFlags.push('UNASSIGNED_PROJECT');
                        isUnassignedProject = true;
                        score += 1;
                    }
                }
            } catch (e) { /* No planning for today — allow */ }
        }

        // Check Overlaps
        const overlaps = await prisma.fichada.findFirst({
            where: {
                operatorId,
                fecha: dateStr,
                horaEgreso: null,
            }
        });
        if (overlaps && action === 'IN') {
            validationFlags.push('OVERLAP_DETECTED');
            isSuspicious = true;
            score += 3;
        }

        // Retro-charge (>48h)
        const diffHours = (new Date().getTime() - now.getTime()) / (1000 * 60 * 60);
        if (diffHours > 48) {
            validationFlags.push('RETROACTIVE_CHARGE');
            isSuspicious = true;
        }

        // Scoring Risk Level
        let riskLevel = 'OK';
        if (score >= 5) riskLevel = 'HIGH_RISK';
        else if (score >= 3) riskLevel = 'SOSPECHOSO';
        else if (score >= 1) riskLevel = 'REVISAR';

        // Approval Status logic
        let status = 'AUTO_APPROVED';
        if (action === 'IN') {
            if (outOfGeofence || validationFlags.includes('DEVICE_MISMATCH') || validationFlags.includes('OFFLINE_PENDING') || qrToken) {
                status = 'PENDING_APPROVAL';
            }
        } else {
            // OUT status logic: if out of geofence, mark as pending
            if (outOfGeofence) {
                status = 'PENDING_APPROVAL';
            }
        }

        const targetProjectId = projectId || null;
        let existing = await prisma.fichada.findFirst({
            where: { 
                operatorId, 
                projectId: targetProjectId, 
                fecha: dateStr, 
                horaEgreso: null 
            },
            orderBy: { createdAt: 'desc' }
        });

        let entry;
        if (action === 'IN') {
            if (existing) {
                return NextResponse.json({ error: 'Ya tienes una jornada iniciada hoy.' }, { status: 400 });
            }
            entry = await prisma.fichada.create({
                data: {
                    operatorId,
                    projectId: targetProjectId,
                    fecha: dateStr,
                    horaIngreso: timeStr,
                    deviceId,
                    latitude: latitude || null,
                    longitude: longitude || null,
                    qrValidated,
                    validationFlags: JSON.stringify(validationFlags),
                    isSuspicious,
                    isOfflinePending: isOfflinePending || false,
                    status,
                    score,
                    riskLevel
                }
            });
        } else {
            if (!existing) return NextResponse.json({ error: 'No se encontró una jornada activa.' }, { status: 404 });
            const horasTrabajadas = calculateHours(existing.horaIngreso || '00:00', timeStr);
            
            // Duration checks
            if (horasTrabajadas < 0.16) validationFlags.push('VERY_SHORT_SHIFT'); // < 10min
            if (horasTrabajadas > 12) validationFlags.push('EXCESSIVE_SHIFT'); // > 12h

            const existingFlagsRaw = (existing.validationFlags as string) || '[]';
            let parsedExistingFlags: string[] = [];
            try { parsedExistingFlags = JSON.parse(existingFlagsRaw); } catch (e) { }
            const uniqueFlags = Array.from(new Set([...parsedExistingFlags, ...validationFlags]));

            entry = await prisma.fichada.update({
                where: { id: existing.id },
                data: {
                    horaEgreso: timeStr,
                    horasTrabajadas,
                    deviceId,
                    // Keep entry location, store exit location separately
                    latitudeEgreso: latitude || null,
                    longitudeEgreso: longitude || null,
                    qrValidated: existing.qrValidated || qrValidated,
                    validationFlags: JSON.stringify(uniqueFlags),
                    isSuspicious: existing.isSuspicious || isSuspicious,
                    status: (existing.status === 'PENDING_APPROVAL' || status === 'PENDING_APPROVAL') ? 'PENDING_APPROVAL' : 'AUTO_APPROVED',
                    score: existing.score + score,
                    riskLevel: (existing.score + score >= 5) ? 'HIGH_RISK' : riskLevel
                }
            });

            // Notice: We intentionally DO NOT update project.horasConsumidas here.
            // "Fichado GPS/QR" presence tracking is completely decoupled from "Registro de Tiempo".
        }

        // Notification if Pending
        if (entry.status === 'PENDING_APPROVAL') {
            await sendPushNotification({
                forSupervisors: true,
                title: "Fichada Pendiente de Aprobación",
                message: `${operator.nombreCompleto} ha fichado en ${projectId ? 'Proyecto' : 'Base'} con avisos: ${validationFlags.join(', ')}`,
                data: { type: 'approval_required', entryId: entry.id }
            });
        }

        // Audit Log
        await logAudit({
            userName: operator.nombreCompleto,
            action: 'CREATE',
            entity: 'FICHADA',
            entityId: entry.id,
            newValue: entry,
            metadata: { deviceId, action, latitude, longitude }
        });

        return NextResponse.json({ ...entry, _flags: validationFlags, _isUnassignedProject: isUnassignedProject || false, _outOfGeofence: outOfGeofence }, { status: 201 });
    } catch (error: any) {
        console.error("Punch POST Error: ", error);
        return NextResponse.json({ error: error?.message || 'Failed to register punch' }, { status: 500 });
    }
}
