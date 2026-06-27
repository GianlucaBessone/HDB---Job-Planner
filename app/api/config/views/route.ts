import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Each VIEW_ACCESS ConfigOption stores a JSON value:
// { key, label, description, roles, access, section, iconName, color }

export async function GET() {
    try {
        const options = await prisma.configOption.findMany({
            where: { category: 'VIEW_ACCESS' },
            orderBy: { order: 'asc' }
        });
        // Parse saved configs
        const saved = options.map(o => {
            try {
                return JSON.parse(o.value) as any;
            } catch {
                return null;
            }
        }).filter(Boolean);
        // Merge with defaults to include any new views and enrich missing fields
        const { getViewConfig } = await import('@/lib/viewAccess');
        const merged = getViewConfig(saved);
        return NextResponse.json(merged);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch views' }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const body = await req.json();
        // body is an array of ViewConfig objects
        const views: Array<{
            key: string;
            label: string;
            description: string;
            roles: string[];
            access: string;
            section: string;
            iconName: string;
            color: string;
        }> = body;

        // Delete all existing VIEW_ACCESS entries
        await prisma.configOption.deleteMany({
            where: { category: 'VIEW_ACCESS' }
        });

        // Create new entries with all fields
        for (let i = 0; i < views.length; i++) {
            const v = views[i];
            await prisma.configOption.create({
                data: {
                    category: 'VIEW_ACCESS',
                    value: JSON.stringify({
                        key: v.key,
                        label: v.label,
                        description: v.description || '',
                        roles: v.roles,
                        access: v.access,
                        section: v.section || 'administracion',
                        iconName: v.iconName || 'ClipboardList',
                        color: v.color || 'bg-slate-500',
                    }),
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
