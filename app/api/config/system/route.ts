import { NextResponse } from 'next/server';
import { prisma } from '@/lib/dataLayer';
import { logAudit } from '@/lib/audit';

export async function GET() {
    try {
        let setting = await prisma.systemSetting.findUnique({
            where: { id: 'default' }
        });

        if (!setting) {
            setting = await prisma.systemSetting.create({
                data: { id: 'default', dailyReminderEnabled: false, dailyReminderTime: '16:45', valorManoObra: 0, companyQrToken: '' }
            });
        }

        return NextResponse.json(setting);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const body = await req.json();

        // Audit: get old value
        const oldValue = await prisma.systemSetting.findUnique({ where: { id: 'default' } });

        const setting = await prisma.systemSetting.upsert({
            where: { id: 'default' },
            create: {
                id: 'default',
                dailyReminderEnabled: body.dailyReminderEnabled || false,
                dailyReminderTime: body.dailyReminderTime || '16:45',
                valorManoObra: body.valorManoObra !== undefined ? parseFloat(body.valorManoObra) : 0,
                companyGeofenceLat: body.companyGeofenceLat !== undefined ? parseFloat(body.companyGeofenceLat) : null,
                companyGeofenceLng: body.companyGeofenceLng !== undefined ? parseFloat(body.companyGeofenceLng) : null,
                companyGeofenceRadius: body.companyGeofenceRadius !== undefined ? parseFloat(body.companyGeofenceRadius) : null,
                companyQrToken: body.companyQrToken || '',
                daysWithoutHoursThreshold: body.daysWithoutHoursThreshold !== undefined ? parseInt(body.daysWithoutHoursThreshold) : 5,
            },
            update: {
                dailyReminderEnabled: body.dailyReminderEnabled,
                dailyReminderTime: body.dailyReminderTime !== undefined ? body.dailyReminderTime : undefined,
                valorManoObra: body.valorManoObra !== undefined ? parseFloat(body.valorManoObra) : undefined,
                companyGeofenceLat: body.companyGeofenceLat !== undefined ? parseFloat(body.companyGeofenceLat) : undefined,
                companyGeofenceLng: body.companyGeofenceLng !== undefined ? parseFloat(body.companyGeofenceLng) : undefined,
                companyGeofenceRadius: body.companyGeofenceRadius !== undefined ? parseFloat(body.companyGeofenceRadius) : undefined,
                companyQrToken: body.companyQrToken !== undefined ? body.companyQrToken : undefined,
                daysWithoutHoursThreshold: body.daysWithoutHoursThreshold !== undefined ? parseInt(body.daysWithoutHoursThreshold) : undefined,
            }
        });

        await logAudit({
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
