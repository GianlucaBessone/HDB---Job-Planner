import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt, encrypt } from './lib/auth';

const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/logout', // solo borra la cookie; si pasara por acá, la renovación la volvería a escribir
  '/api/cron',
  '/api/public',
  '/api/portal-clientes',
  '/api/agente', // se autentica con su propio token Bearer (lib/ticketsAgente.ts)
];

// Rutas públicas por patrón, cada una solo con los métodos que necesita sin sesión.
// Cualquier otro método sobre la misma ruta pasa por la validación de sesión.
const PUBLIC_DYNAMIC_ROUTES: { pattern: RegExp; methods: string[] }[] = [
  // OS para el cliente: ver y firmar por su link público. El handler solo acepta el
  // linkPublico cuando no hay sesión; editar y borrar (PUT/DELETE) exigen sesión.
  { pattern: /^\/api\/ordenes-servicio\/[^\/]+$/, methods: ['GET', 'POST'] },
  { pattern: /^\/api\/ordenes-servicio\/[^\/]+\/pdf$/, methods: ['GET'] },
  { pattern: /^\/api\/encuesta-servicio$/, methods: ['POST'] },
  { pattern: /^\/api\/encuesta-servicio\/[^\/]+$/, methods: ['GET'] },
  { pattern: /^\/api\/centro-ayuda\/articulo\/[^\/]+$/, methods: ['GET'] }, // ayuda contextual
  { pattern: /^\/api\/signatures\/verify\/[^\/]+$/, methods: ['POST'] }, // verificación pública
  // Lo llama cron-job.org sin sesión; el handler valida un token firmado por recordatorio.
  { pattern: /^\/api\/tareas\/reminder-webhook$/, methods: ['GET'] },
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

  // Pizarra pública de sugerencias (/ideas-sugerencias-reclamos): listar, enviar
  // y descargar adjuntos. Gestionar (/[id], /analizar) requiere sesión.
  if (pathname === '/api/sugerencias' && (request.method === 'GET' || request.method === 'POST')) {
    return NextResponse.next();
  }
  if (/^\/api\/sugerencias\/adjuntos\/[^\/]+$/.test(pathname) && request.method === 'GET') {
    return NextResponse.next();
  }

  // Permitir rutas publicas dinamicas
  if (PUBLIC_DYNAMIC_ROUTES.some(r => r.methods.includes(request.method) && r.pattern.test(pathname))) {
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

  // x-user-role es el rol guardado en el token. Para decidir permisos, las APIs usan
  // getAcceso (lib/permisosServer.ts), que lee rol y estado desde la base en cada pedido.
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
