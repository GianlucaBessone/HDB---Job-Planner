import crypto from 'crypto';

/**
 * Generates a unique signature ID based on the required format:
 * SIGN-YYYYMMDD-HHMMSS-XXXXXX
 */
export function generateSignatureId(): string {
    const now = new Date();
    
    // Format YYYYMMDD
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    const datePart = `${yyyy}${mm}${dd}`;

    // Format HHMMSS
    const hh = String(now.getUTCHours()).padStart(2, '0');
    const min = String(now.getUTCMinutes()).padStart(2, '0');
    const ss = String(now.getUTCSeconds()).padStart(2, '0');
    const timePart = `${hh}${min}${ss}`;

    // Format XXXXXX (Random 6 digits)
    const randomPart = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');

    return `SIGN-${datePart}-${timePart}-${randomPart}`;
}

/**
 * Generates the payload string for the HMAC hash.
 * Fields are separated by '|'.
 */
export function buildSignaturePayload(
    documentId: string,
    documentVersion: string,
    userId: string,
    userName: string,
    dni: string,
    deviceId: string,
    signedAtUTC: string | Date
): string {
    const dateStr = signedAtUTC instanceof Date ? signedAtUTC.toISOString() : signedAtUTC;
    return `${documentId}|${documentVersion}|${userId}|${userName}|${dni}|${deviceId}|${dateStr}`;
}

/**
 * Calculates the HMAC-SHA256 hash for the given payload using the secret key.
 */
export function calculateHMAC(payload: string): string {
    const secret = process.env.SIGNATURE_SECRET_KEY;
    if (!secret) {
        throw new Error('SIGNATURE_SECRET_KEY no está configurado en las variables de entorno');
    }
    
    return crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
}

/**
 * Helper to construct the payload and calculate the hash in one step.
 */
export function generateSignatureHash(
    documentId: string,
    documentVersion: string,
    userId: string,
    userName: string,
    dni: string,
    deviceId: string,
    signedAtUTC: string | Date
): string {
    const payload = buildSignaturePayload(documentId, documentVersion, userId, userName, dni, deviceId, signedAtUTC);
    return calculateHMAC(payload);
}
