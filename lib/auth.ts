import { SignJWT, jwtVerify } from 'jose';
import { jwtKey } from './jwtSecret';

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
    .sign(jwtKey('interno'));
}

export async function decrypt(session: string | undefined = '') {
  try {
    const { payload } = await jwtVerify(session, jwtKey('interno'), {
      algorithms: ['HS256'],
    });
    // Una sesión interna siempre tiene el id del operador.
    if (typeof payload.id !== 'string' || !payload.id) return null;
    return payload as unknown as SessionPayload;
  } catch (error) {
    return null;
  }
}
