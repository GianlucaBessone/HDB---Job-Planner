"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSignatureId = generateSignatureId;
exports.buildSignaturePayload = buildSignaturePayload;
exports.calculateHMAC = calculateHMAC;
exports.generateSignatureHash = generateSignatureHash;
var crypto_1 = __importDefault(require("crypto"));
/**
 * Generates a unique signature ID based on the required format:
 * SIGN-YYYYMMDD-HHMMSS-XXXXXX
 */
function generateSignatureId() {
    var now = new Date();
    // Format YYYYMMDD
    var yyyy = now.getUTCFullYear();
    var mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    var dd = String(now.getUTCDate()).padStart(2, '0');
    var datePart = "".concat(yyyy).concat(mm).concat(dd);
    // Format HHMMSS
    var hh = String(now.getUTCHours()).padStart(2, '0');
    var min = String(now.getUTCMinutes()).padStart(2, '0');
    var ss = String(now.getUTCSeconds()).padStart(2, '0');
    var timePart = "".concat(hh).concat(min).concat(ss);
    // Format XXXXXX (Random 6 digits)
    var randomPart = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    return "SIGN-".concat(datePart, "-").concat(timePart, "-").concat(randomPart);
}
/**
 * Generates the payload string for the HMAC hash.
 * Fields are separated by '|'.
 */
function buildSignaturePayload(documentId, documentVersion, userId, userName, dni, deviceId, signedAtUTC) {
    var dateStr = signedAtUTC instanceof Date ? signedAtUTC.toISOString() : signedAtUTC;
    return "".concat(documentId, "|").concat(documentVersion, "|").concat(userId, "|").concat(userName, "|").concat(dni, "|").concat(deviceId, "|").concat(dateStr);
}
/**
 * Calculates the HMAC-SHA256 hash for the given payload using the secret key.
 */
function calculateHMAC(payload) {
    var secret = process.env.SIGNATURE_SECRET_KEY;
    if (!secret) {
        throw new Error('SIGNATURE_SECRET_KEY no está configurado en las variables de entorno');
    }
    return crypto_1.default
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
}
/**
 * Helper to construct the payload and calculate the hash in one step.
 */
function generateSignatureHash(documentId, documentVersion, userId, userName, dni, deviceId, signedAtUTC) {
    var payload = buildSignaturePayload(documentId, documentVersion, userId, userName, dni, deviceId, signedAtUTC);
    return calculateHMAC(payload);
}
