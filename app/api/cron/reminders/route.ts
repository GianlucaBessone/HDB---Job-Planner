import { NextResponse } from 'next/server';
import { prisma } from '@/lib/dataLayer';
import { sendPushNotification } from '@/lib/onesignal';
import { format, subDays } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const isManual = url.searchParams.get('manual') === 'true';

        if (!isManual) {
            const authHeader = req.headers.get('authorization');
            if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
                console.error('Unauthorized cron access attempt');
                return new Response('Unauthorized', { status: 401 });
            }
        }

        console.log(isManual ? "MANUAL CRON RUN" : "CRON RUN", new Date().toISOString());

        const setting = await prisma.systemSetting.findUnique({ where: { id: 'default' } });
        
        if (!setting || !setting.dailyReminderEnabled) {
            return NextResponse.json({ message: 'Recordatorios diarios desactivados' });
        }

        const timeZone = 'America/Argentina/Buenos_Aires';
        const nowZoned = toZonedTime(new Date(), timeZone);
        const currentHHmm = format(nowZoned, 'HH:mm');
        const todayStr = format(nowZoned, 'yyyy-MM-dd'); // YYYY-MM-DD

        const idempotencyKey = `daily-reminder-${todayStr}`;
        const alreadySent = await prisma.idempotencyKey.findUnique({ where: { key: idempotencyKey } });
        
        if (alreadySent && !isManual) {
            return NextResponse.json({ message: 'El recordatorio diario ya se envió hoy' });
        }

        if (!alreadySent) {
            // Lock with idempotency key only if it's the first time
            await prisma.idempotencyKey.create({
                data: { key: idempotencyKey, response: {} }
            });
        }

        // 1. Fetch active operators (operador/supervisor only) not on vacation
        // Admins and implementacion roles are excluded from reminders
        const activeOperators = await prisma.operator.findMany({
            where: {
                activo: true,
                enVacaciones: false,
                role: { in: ['operador', 'supervisor'] }
            }
        });

        const noHoursOperators = [];
        const fiveDaysAbsentOperators = [];

        // Five days ago date string
        const fiveDaysAgoStr = format(subDays(nowZoned, 5), 'yyyy-MM-dd');

        for (const op of activeOperators) {
            // Check if there are time entries today
            const entriesToday = await prisma.timeEntry.findMany({
                where: { operatorId: op.id, fecha: todayStr }
            });

            if (entriesToday.length === 0) {
                // Determine if they haven't logged ANY hours in the last 5 days
                const recentEntries = await prisma.timeEntry.findFirst({
                    where: { 
                        operatorId: op.id, 
                        fecha: { gte: fiveDaysAgoStr } 
                    }
                });

                if (!recentEntries) {
                    fiveDaysAbsentOperators.push(op);
                } else {
                    noHoursOperators.push(op); // Only send daily reminder if they aren't completely absent? Actually let's send both.
                }
            }
        }

        // Send notifications to operators who haven't logged hours today (and are not MIA for 5 days)
        for (const op of noHoursOperators) {
            await prisma.notification.create({
                data: {
                    operatorId: op.id,
                    forSupervisors: false,
                    title: 'Recordatorio Diario de Horas',
                    message: 'Aún no has registrado tus horas de hoy. Por favor no olvides cargarlas en tu Timesheet.',
                    type: 'DAILY_REMINDER'
                }
            });
            await sendPushNotification({
                userIds: [op.id],
                title: 'Recordatorio Diario de Horas',
                message: 'Aún no has registrado tus horas de hoy. Por favor no olvides cargarlas.',
                data: { type: 'DAILY_REMINDER' }
            });
        }

        // Send alerts to supervisors for operators absent >= 5 days
        if (fiveDaysAbsentOperators.length > 0) {
            const opNames = fiveDaysAbsentOperators.map(o => o.nombreCompleto).join(', ');
            await prisma.notification.create({
                data: {
                    forSupervisors: true,
                    title: 'Alerta de Ausentismo Prolongado',
                    message: `Los siguientes operadores no han registrado carga horaria en los últimos 5 días o más: ${opNames}`,
                    type: 'ABSENT_ALERT'
                }
            });
            await sendPushNotification({
                forSupervisors: true,
                title: 'Alerta de Ausentismo',
                message: `Operadores sin registrar horas (> 5 días): ${opNames}`,
                data: { type: 'ABSENT_ALERT' }
            });
        }

        console.log("Reminders found:", noHoursOperators.length);
        console.log("Absent alerts found:", fiveDaysAbsentOperators.length);

        return NextResponse.json({ 
            success: true, 
            reminded: noHoursOperators.length, 
            absentAlerts: fiveDaysAbsentOperators.length,
            timeFired: currentHHmm
        });

    } catch (e: any) {
        console.error('Error executing cron reminders:', e);
        return NextResponse.json({ error: e.message || 'Error occurred' }, { status: 500 });
    }
}
