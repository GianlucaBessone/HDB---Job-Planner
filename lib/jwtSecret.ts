// Clave para firmar sesiones. Sin respaldo en producción: si falta JWT_SECRET,
// firmar y verificar fallan (nadie entra) en vez de usar una clave pública.
// Se usa también desde el middleware (edge): solo process.env y TextEncoder.

const SOLO_DESARROLLO = 'clave-solo-para-desarrollo-local-no-usar-en-produccion';

/**
 * @param uso Separa las claves de cada tipo de sesión, para que un token del
 *            portal de clientes no sirva como sesión interna y viceversa.
 */
export function jwtKey(uso: 'interno' | 'portal'): Uint8Array {
    let secreto = process.env.JWT_SECRET;
    if (!secreto) {
        if (process.env.NODE_ENV === 'production') {
            console.error('[AUTH] JWT_SECRET no está configurado: se rechazan todas las sesiones.');
            throw new Error('JWT_SECRET no está configurado.');
        }
        secreto = SOLO_DESARROLLO;
    }
    return new TextEncoder().encode(uso === 'interno' ? secreto : `${secreto}:${uso}`);
}
