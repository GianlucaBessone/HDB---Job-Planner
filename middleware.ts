import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from './lib/auth';

const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/sugerencias',
  '/api/cron',
];

const PUBLIC_DYNAMIC_ROUTES = [
  /^\/api\/ordenes-servicio\/[^\/]+$/, // GET or PUT (firma) by publicToken
  /^\/api\/ordenes-servicio\/[^\/]+\/pdf$/, // PDF generation
  /^\/api\/encuesta-servicio$/, // POST
  /^\/api\/encuesta-servicio\/[^\/]+$/, // GET
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Solo interceptar peticiones a /api/
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Permitir rutas publicas exactas
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Permitir GET a /api/operators (necesario para el login)
  if (pathname === '/api/operators' && request.method === 'GET') {
    return NextResponse.next();
  }

  // Permitir rutas publicas dinamicas
  if (PUBLIC_DYNAMIC_ROUTES.some(regex => regex.test(pathname))) {
    return NextResponse.next();
  }

  // Validar token JWT
  const sessionCookie = request.cookies.get('sgi_session')?.value;
  if (!sessionCookie) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const payload = await decrypt(sessionCookie);
  if (!payload) {
    return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 });
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', payload.id as string);
  requestHeaders.set('x-user-role', payload.role as string || '');

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ['/api/:path*'],
};
