import { SignJWT, jwtVerify } from 'jose';

// En producción JWT_SECRET es obligatorio: con una clave conocida cualquiera podría firmar sesiones.
const DEV_FALLBACK_SECRET = 'super-secret-fallback-key-for-sgi-development';
const JWT_SECRET = process.env.JWT_SECRET
  || (process.env.NODE_ENV === 'production' ? null : DEV_FALLBACK_SECRET);
const encodedSecret = JWT_SECRET ? new TextEncoder().encode(JWT_SECRET) : null;

function getSecret() {
  if (!encodedSecret) {
    throw new Error('JWT_SECRET no está configurado');
  }
  return encodedSecret;
}

export interface SessionPayload {
  id: string;
  role: string | null;
  nombreCompleto: string;
}

export async function encrypt(payload: SessionPayload) {
  return new SignJWT(payload as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getSecret());
}

export async function decrypt(session: string | undefined = '') {
  try {
    const { payload } = await jwtVerify(session, getSecret(), {
      algorithms: ['HS256'],
    });
    return payload as unknown as SessionPayload;
  } catch (error) {
    if (!encodedSecret) console.error('[auth] JWT_SECRET no está configurado: no se pueden validar sesiones');
    return null;
  }
}

/** Lee y valida la cookie de sesión. Para rutas que el middleware deja pasar sin sesión. */
export async function getSessionFromRequest(req: Request) {
  const cookieHeader = req.headers.get('cookie') || '';
  const match = cookieHeader.match(/(?:^|;\s*)sgi_session=([^;]+)/);
  if (!match) return null;
  return decrypt(decodeURIComponent(match[1]));
}
