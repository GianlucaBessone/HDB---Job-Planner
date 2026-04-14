import { NextResponse } from 'next/server';
import { prisma } from '@/lib/dataLayer';

// Each VIEW_ACCESS ConfigOption stores a JSON value:
// { key: string, label: string, roles: string[], access: 'sidebar' | 'home' | 'ambos' }

export async function GET() {
    try {
        const options = await prisma.configOption.findMany({
            where: { category: 'VIEW_ACCESS' },
            orderBy: { order: 'asc' }
        });

        const views = options.map(o => {
            try {
                return { id: o.id, ...JSON.parse(o.value) };
            } catch {
                return null;
            }
        }).filter(Boolean);

        return NextResponse.json(views);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch views' }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const body = await req.json();
        // body is an array of { key, label, roles, access }
        const views: Array<{ key: string; label: string; roles: string[]; access: string }> = body;

        // Delete all existing VIEW_ACCESS entries
        await prisma.configOption.deleteMany({
            where: { category: 'VIEW_ACCESS' }
        });

        // Create new entries
        for (let i = 0; i < views.length; i++) {
            const v = views[i];
            await prisma.configOption.create({
                data: {
                    category: 'VIEW_ACCESS',
                    value: JSON.stringify({ key: v.key, label: v.label, roles: v.roles, access: v.access }),
                    active: true,
                    order: i
                }
            });
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to save views' }, { status: 500 });
    }
}
