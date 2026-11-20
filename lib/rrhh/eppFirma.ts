// Firma manuscrita de EPP. Se importa desde cliente y servidor (sin Prisma ni APIs de Node).
import { z } from 'zod';

/**
 * Firma dibujada en pantalla: solo una imagen en base64. Se inserta como
 * <img src> en la planilla de la Res. 299/11 (también desde la matriz pública),
 * así que cualquier otro texto se rechaza al guardar y se ignora al mostrar.
 */
export const FIRMA_IMAGEN_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

export const firmaImagenSchema = z
    .string()
    .max(5_000_000, 'La imagen de la firma es demasiado grande')
    .regex(FIRMA_IMAGEN_RE, 'La firma no es una imagen válida');
