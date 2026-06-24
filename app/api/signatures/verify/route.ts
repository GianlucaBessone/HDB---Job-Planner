import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const signatures = await prisma.documentSignatureAudit.findMany({
            orderBy: { SignedAtUTC: 'desc' }
        });
        return NextResponse.json(signatures);
    } catch (e: any) {
        return NextResponse.json({ error: 'Failed to fetch signatures', details: e.message }, { status: 500 });
    }
}
