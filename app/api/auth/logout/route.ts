import { NextResponse } from 'next/server';

/**
 * Cierra la sesión: borra la cookie sgi_session (httpOnly, el navegador no puede borrarla solo).
 * Es pública en el middleware para que la renovación de sesión no vuelva a escribir la cookie
 * en la misma respuesta, y para poder cerrar sesión aunque el token ya haya vencido.
 */
export async function POST() {
    const response = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
    response.cookies.set('sgi_session', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 0,
    });
    return response;
}
