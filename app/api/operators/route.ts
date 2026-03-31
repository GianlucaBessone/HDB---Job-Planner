import { NextResponse } from 'next/server';
import { dataLayer } from '@/lib/dataLayer';

export async function GET() {
    try {
        const operators = await dataLayer.getOperators();
        
        // Operators change incredibly rarely but are queried everywhere.
        // Cache them strongly!
        return NextResponse.json(operators, {
            headers: {
                'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
            },
        });
    } catch (e) {
        return NextResponse.json({ error: 'Failed to fetch operators' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const data = await req.json();
    const operator = await dataLayer.createOperator(data);
    return NextResponse.json(operator);
}

export async function PATCH(req: Request) {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const data = await req.json();
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    const operator = await dataLayer.updateOperator(id, data);
    return NextResponse.json(operator);
}

export async function DELETE(req: Request) {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    await dataLayer.deleteOperator(id);
    return NextResponse.json({ success: true });
}
