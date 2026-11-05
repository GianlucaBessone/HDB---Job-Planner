// Esquemas Zod de la API de viajes.
import { z } from 'zod';
import { BASE_VALUES, CATEGORIA_VALUES, MEDIO_VALUES, MODALIDADES_FONDOS, VIAJE_COMPROBANTES_MAX } from '@/lib/viajes';

export const fechaISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD).');
const monto = z.coerce.number().finite('Monto inválido.').min(0, 'El monto no puede ser negativo.').max(1_000_000_000, 'Monto demasiado alto.');
const textoOpcional = (max: number) => z.string().trim().max(max).optional().nullable().transform(v => (v ? v : null));

export const participanteSchema = z.object({
    id: z.string().max(60).optional(),
    operatorId: z.string().max(60).optional().nullable(),
    nombre: z.string().trim().min(2, 'Nombre de participante muy corto.').max(120),
});

export const costoSchema = z.object({
    categoria: z.enum(CATEGORIA_VALUES),
    descripcion: textoOpcional(200),
    base: z.enum(BASE_VALUES),
    monto,
});

export const viajeConfigSchema = z.object({
    motivo: z.string().trim().min(3, 'Indicá el motivo del viaje.').max(200),
    descripcion: textoOpcional(4000),
    origen: z.string().trim().min(2, 'Indicá el origen.').max(160),
    destino: z.string().trim().min(2, 'Indicá el destino.').max(160),
    fechaInicio: fechaISO,
    fechaFin: fechaISO,
    modalidadFondos: z.enum(MODALIDADES_FONDOS),
    montoAnticipo: monto.default(0),
    responsableId: z.string().min(1, 'Elegí un responsable.').max(60),
    projectId: z.string().max(60).optional().nullable().transform(v => v || null),
    participantes: z.array(participanteSchema).min(1, 'Agregá al menos un participante.').max(60),
    costos: z.array(costoSchema).max(60).default([]),
    medioTransporte: z.enum(MEDIO_VALUES).optional().nullable().transform(v => v || null),
    kmIda: z.coerce.number().finite().min(0, 'Los km no pueden ser negativos.').max(20000, 'Revisá los km.').optional().nullable()
        .transform(v => (v ? Math.round(v * 10) / 10 : null)),
    idaYVuelta: z.boolean().default(true),
    tarifaId: z.string().max(60).optional().nullable().transform(v => v || null),
}).refine(d => d.fechaFin >= d.fechaInicio, { message: 'La fecha de fin no puede ser anterior al inicio.', path: ['fechaFin'] });

export const gastoSchema = z.object({
    fecha: fechaISO,
    categoria: z.enum(CATEGORIA_VALUES),
    monto: monto.refine(n => n > 0, 'El monto tiene que ser mayor a cero.'),
    descripcion: textoOpcional(300),
    comercio: textoOpcional(160),
    numeroComprobante: textoOpcional(60),
    alcance: z.enum(['global', 'individual']),
    medioPago: z.enum(['fondos', 'propio']),
    afectados: z.array(z.string().max(60)).max(60).default([]),
    comprobantes: z.array(z.string().max(60)).max(VIAJE_COMPROBANTES_MAX, `Máximo ${VIAJE_COMPROBANTES_MAX} comprobantes por gasto.`).default([]),
}).refine(d => d.alcance === 'global' || d.afectados.length > 0, {
    message: 'Elegí a quiénes afecta el gasto individual.',
    path: ['afectados'],
});

export const extensionSchema = z.object({
    fechaFinNueva: fechaISO,
    motivo: z.string().trim().min(5, 'Contá brevemente por qué se extiende.').max(1000),
});

export const estadoSchema = z.object({
    accion: z.enum(['iniciar', 'concluir', 'devolver', 'cerrar', 'cancelar']),
    nota: z.string().trim().max(2000).optional().nullable(),
});

export const verificacionSchema = z.object({
    items: z.array(z.object({
        gastoId: z.string().min(1).max(60),
        estado: z.enum(['pendiente', 'aprobado', 'observado', 'rechazado']),
        montoAprobado: monto.optional().nullable(),
        observacion: z.string().trim().max(1000).optional().nullable(),
    })).min(1).max(500),
});

const valorTarifa = z.coerce.number().finite('Valor inválido.').min(0, 'Los valores no pueden ser negativos.').max(100_000_000);

export const tarifaSchema = z.object({
    vigenciaDesde: fechaISO,
    valores: z.object({
        desayuno: valorTarifa,
        comidaResidencia: valorTarifa,
        comidaViaje: valorTarifa,
        hoteleria: valorTarifa,
        autoPropioKm: valorTarifa,
        gasKm: valorTarifa,
        naftaKm: valorTarifa,
    }),
});
