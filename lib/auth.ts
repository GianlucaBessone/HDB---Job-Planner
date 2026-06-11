import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-fallback-key-for-sgi-development';
const encodedSecret = new TextEncoder().encode(JWT_SECRET);

export interface SessionPayload {
  id: string;
  role: string | null;
  nombreCompleto: string;
}

export async function encrypt(payload: SessionPayload) {
  return new SignJWT(payload as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encodedSecret);
}

export async function decrypt(session: string | undefined = '') {
  try {
    const { payload } = await jwtVerify(session, encodedSecret, {
      algorithms: ['HS256'],
    });
    return payload as unknown as SessionPayload;
  } catch (error) {
    return null;
  }
}
