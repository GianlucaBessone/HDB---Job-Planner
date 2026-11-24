import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { exigirAcceso } from '@/lib/permisosServer';

export async function GET() {
    try {
        let setting = await prisma.systemSetting.findUnique({
            where: { id: 'default' }
        });

        if (!setting) {
            setting = await prisma.systemSetting.create({
                data: { id: 'default', dailyReminderEnabled: false, dailyReminderTime: null, valorManoObra: 0, companyQrToken: '' }
            });
        }

        return NextResponse.json(setting);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const acceso = await exigirAcceso(req, ['config.administrar'], 'No tenés permiso para cambiar la configuración del sistema');
        if (acceso instanceof NextResponse) return acceso;

        const body = await req.json();

        // Hora del recordatorio diario (HH:mm, Argentina): sin valor preseteado. Sin hora no se envía (P38).
        let horaRecordatorio: string | null | undefined = undefined;
        if (body.dailyReminderTime !== undefined) {
            const h = typeof body.dailyReminderTime === 'string' ? body.dailyReminderTime.trim() : '';
            if (h && !/^([01]\d|2[0-3]):[0-5]\d$/.test(h)) {
                return NextResponse.json({ error: 'La hora del recordatorio tiene que tener el formato HH:mm' }, { status: 400 });
            }
            horaRecordatorio = h || null;
        }

        // Audit: get old value
        const oldValue = await prisma.systemSetting.findUnique({ where: { id: 'default' } });

        // LOG QR HISTORY if changed
        if (body.companyQrToken !== undefined && oldValue?.companyQrToken && body.companyQrToken !== oldValue.companyQrToken) {
            await prisma.qrTokenHistory.upsert({
                where: { token: oldValue.companyQrToken },
                update: { isCompanyToken: true, replacedAt: new Date() },
                create: { token: oldValue.companyQrToken, isCompanyToken: true, replacedAt: new Date() }
            });
        }

        const setting = await prisma.systemSetting.upsert({
            where: { id: 'default' },
            create: {
                id: 'default',
                dailyReminderEnabled: body.dailyReminderEnabled || false,
                dailyReminderTime: horaRecordatorio ?? null,
                valorManoObra: body.valorManoObra !== undefined ? parseFloat(body.valorManoObra) : 0,
                companyGeofenceLat: body.companyGeofenceLat !== undefined ? parseFloat(body.companyGeofenceLat) : null,
                companyGeofenceLng: body.companyGeofenceLng !== undefined ? parseFloat(body.companyGeofenceLng) : null,
                companyGeofenceRadius: body.companyGeofenceRadius !== undefined ? parseFloat(body.companyGeofenceRadius) : null,
                companyQrToken: body.companyQrToken || '',
                daysWithoutHoursThreshold: body.daysWithoutHoursThreshold !== undefined ? parseInt(body.daysWithoutHoursThreshold) : 5,
            },
            update: {
                dailyReminderEnabled: body.dailyReminderEnabled,
                dailyReminderTime: horaRecordatorio,
                valorManoObra: body.valorManoObra !== undefined ? parseFloat(body.valorManoObra) : undefined,
                companyGeofenceLat: body.companyGeofenceLat !== undefined ? parseFloat(body.companyGeofenceLat) : undefined,
                companyGeofenceLng: body.companyGeofenceLng !== undefined ? parseFloat(body.companyGeofenceLng) : undefined,
                companyGeofenceRadius: body.companyGeofenceRadius !== undefined ? parseFloat(body.companyGeofenceRadius) : undefined,
                companyQrToken: body.companyQrToken !== undefined ? body.companyQrToken : undefined,
                daysWithoutHoursThreshold: body.daysWithoutHoursThreshold !== undefined ? parseInt(body.daysWithoutHoursThreshold) : undefined,
            }
        });

        await logAudit({
            userId: acceso.userId,
            userName: acceso.nombre,
            action: 'UPDATE',
            entity: 'SETTING',
            entityId: 'default',
            oldValue,
            newValue: setting
        });

        return NextResponse.json(setting);
    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }
}
