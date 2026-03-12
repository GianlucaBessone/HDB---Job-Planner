import { NextResponse } from 'next/server';
import { prisma } from '@/lib/dataLayer';

export async function GET() {
    try {
        let setting = await prisma.systemSetting.findUnique({
            where: { id: 'default' }
        });

        if (!setting) {
            setting = await prisma.systemSetting.create({
                data: { id: 'default', dailyReminderEnabled: false, dailyReminderTime: '16:45' }
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
        
        const setting = await prisma.systemSetting.upsert({
            where: { id: 'default' },
            create: {
                id: 'default',
                dailyReminderEnabled: body.dailyReminderEnabled,
                dailyReminderTime: body.dailyReminderTime
            },
            update: {
                dailyReminderEnabled: body.dailyReminderEnabled,
                dailyReminderTime: body.dailyReminderTime
            }
        });

        return NextResponse.json(setting);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }
}
