import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt, encrypt } from './lib/auth';

const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/sugerencias',
  '/api/cron',
  '/api/public',
];

const PUBLIC_DYNAMIC_ROUTES = [
  /^\/api\/ordenes-servicio\/[^\/]+$/, // GET or PUT (firma) by publicToken
  /^\/api\/ordenes-servicio\/[^\/]+\/pdf$/, // PDF generation
  /^\/api\/encuesta-servicio$/, // POST
  /^\/api\/encuesta-servicio\/[^\/]+$/, // GET
  /^\/api\/centro-ayuda\/articulo\/[^\/]+$/, // GET ayuda contextual
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

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Implement rolling session (refresh token)
  const sessionPayload = {
      id: payload.id as string,
      role: payload.role as string | null,
      nombreCompleto: payload.nombreCompleto as string
  };
  const refreshedToken = await encrypt(sessionPayload);
  response.cookies.set('sgi_session', refreshedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return response;
}

export const config = {
  matcher: ['/api/:path*'],
};
