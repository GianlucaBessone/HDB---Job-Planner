import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'hdb-sgi-super-secret-jwt-key-production-2026';
const encodedSecret = new TextEncoder().encode(JWT_SECRET);

export const PORTAL_COOKIE_NAME = 'portal_client_session';

export interface PortalSessionPayload {
  responsibleId: string;
  clientId: string;
  clientNombre: string;
  nombre: string;
  mustChangePassword?: boolean;
}

/**
 * Hash a plain password using bcrypt
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

/**
 * Verify a plain password against a bcrypt hash
 */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!plain || !hash) return false;
  return bcrypt.compare(plain, hash);
}

/**
 * Generates an 8-character secure initial alphanumeric password.
 * Uses easily distinguishable characters.
 */
export function generateInitialPassword(length = 8): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Creates a signed JWT for the portal session.
 */
export async function createPortalSession(payload: PortalSessionPayload): Promise<string> {
  return new SignJWT(payload as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encodedSecret);
}

/**
 * Verifies and decodes a portal session JWT.
 */
export async function verifyPortalSession(token?: string): Promise<PortalSessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, encodedSecret, {
      algorithms: ['HS256'],
    });
    return payload as unknown as PortalSessionPayload;
  } catch {
    return null;
  }
}

/**
 * Extracts and verifies the portal session from cookies or Authorization header.
 */
export async function getAuthenticatedResponsible(request?: Request): Promise<PortalSessionPayload | null> {
  let token: string | undefined;

  if (request) {
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
  }

  if (!token) {
    try {
      const cookieStore = cookies();
      token = cookieStore.get(PORTAL_COOKIE_NAME)?.value;
    } catch {
      // Ignore if not in Next.js request context
    }
  }

  if (!token) return null;
  return verifyPortalSession(token);
}

/**
 * Returns an array of project IDs that the given responsible is authorized to access.
 */
export async function getAuthorizedProjectIds(responsibleId: string): Promise<string[]> {
  const assignments = await prisma.clientResponsableProyecto.findMany({
    where: { responsableId: responsibleId },
    select: { proyectoId: true },
  });
  return assignments.map((a) => a.proyectoId);
}

/**
 * Strictly verifies whether the responsible has access to a specific project.
 */
export async function checkResponsibleProjectAccess(responsibleId: string, projectId: string): Promise<boolean> {
  const count = await prisma.clientResponsableProyecto.count({
    where: {
      responsableId: responsibleId,
      proyectoId: projectId,
    },
  });
  return count > 0;
}
