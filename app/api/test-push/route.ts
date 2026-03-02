import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    const { userId, title, message } = await req.json();

    const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "180b43cd-8aef-4131-b844-482457816ecd";
    const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

    if (!ONESIGNAL_REST_API_KEY) {
        return NextResponse.json({ error: 'Falta ONESIGNAL_REST_API_KEY en las variables de entorno' }, { status: 500 });
    }

    try {
        const response = await fetch('https://onesignal.com/api/v1/notifications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
            },
            body: JSON.stringify({
                app_id: ONESIGNAL_APP_ID,
                include_external_user_ids: [userId],
                headings: { en: title, es: title },
                contents: { en: message, es: message },
                url: process.env.NEXT_PUBLIC_APP_URL || 'https://hdb-job-planner.vercel.app',
            }),
        });

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
