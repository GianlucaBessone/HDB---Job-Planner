import { NextResponse } from 'next/server';
import { PORTAL_COOKIE_NAME } from '@/lib/portalAuth';

export const dynamic = 'force-dynamic';

export async function POST() {
  const response = NextResponse.json({ success: true, message: 'Sesión cerrada' });
  response.cookies.delete(PORTAL_COOKIE_NAME);
  return response;
}
