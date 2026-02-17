import { NextResponse } from 'next/server';
import { dataLayer } from '@/lib/dataLayer';

export async function GET() {
    try {
        const favorites = await dataLayer.getFavorites();
        return NextResponse.json(favorites);
    } catch (e) {
        return NextResponse.json({ error: 'Failed to fetch favorites' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const data = await req.json();
    const favorite = await dataLayer.createFavorite(data);
    return NextResponse.json(favorite);
}

export async function DELETE(req: Request) {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    await dataLayer.deleteFavorite(id);
    return NextResponse.json({ success: true });
}
