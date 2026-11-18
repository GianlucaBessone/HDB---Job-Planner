/**
 * Validación (Zod) de los datos que llegan a las APIs de presupuestos de servicio.
 * Sin dependencias de servidor: el editor puede reusar los mismos mensajes.
 */
import { z } from 'zod';
import { esFecha } from './calculos';

const textoOpcional = (max: number) =>
    z.string().trim().max(max, `Máximo ${max} caracteres`).optional().nullable().transform((v) => (v ? v : null));

const fechaOpcional = z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || esFecha(v), 'Fecha inválida (usá AAAA-MM-DD)');

const numero = (min: number, max: number, mensaje: string) => z.coerce.number().refine((n) => isFinite(n) && n >= min && n <= max, mensaje);

export const lineaManoObraSchema = z.object({
    categoriaId: z.string().trim().max(64).optional().nullable().transform((v) => v || null),
    categoriaNombre: z.string().trim().min(1, 'Elegí la categoría de mano de obra').max(80),
    modo: z.enum(['manual', 'costo', 'tiempo']).default('costo'),
    horas: numero(0, 100000, 'Las horas no pueden ser negativas'),
    valorHora: numero(0, 1e9, 'El valor hora no puede ser negativo'),
    importe: numero(0, 1e12, 'El importe no puede ser negativo'),
    ivaPorcentaje: numero(0, 100, 'IVA inválido').default(21),
});

export const tareaSchema = z.object({
    descripcion: z.string().trim().min(1, 'Cada tarea necesita una descripción').max(300),
    etiqueta: textoOpcional(80),
    manoObra: z.array(lineaManoObraSchema).max(30, 'Demasiadas líneas de mano de obra en una tarea').default([]),
});

export const materialSchema = z.object({
    productoId: z.string().trim().max(64).optional().nullable().transform((v) => v || null),
    sku: textoOpcional(64),
    descripcion: z.string().trim().min(1, 'Cada material necesita una descripción').max(300),
    unidad: textoOpcional(20),
    cantidad: numero(0.0001, 1e9, 'La cantidad de cada material tiene que ser mayor a 0'),
    precioUnitario: numero(0, 1e12, 'El precio no puede ser negativo'),
    precioModificado: z.boolean().default(false),
    ivaPorcentaje: numero(0, 100, 'IVA inválido').default(21),
});

export const contenidoPresupuestoSchema = z
    .object({
        clienteId: z.string().trim().max(64).optional().nullable().transform((v) => v || null),
        clienteNombre: textoOpcional(200),
        titulo: z.string().trim().min(3, 'Escribí un título de al menos 3 caracteres').max(200),
        alcance: textoOpcional(5000),
        condiciones: textoOpcional(3000),
        fechaInicioTentativa: fechaOpcional,
        fechaFinTentativa: fechaOpcional,
        operariosSimultaneos: z.coerce.number().int('Operarios: número entero').min(1, 'Al menos 1 operario').max(100).default(1),
        horasDia: numero(1, 24, 'Horas por día: entre 1 y 24').default(8),
        validezDias: z.coerce.number().int('Validez: número entero de días').min(1, 'La validez mínima es 1 día').max(365).default(15),
        listaPrecioId: z.string().trim().max(64).optional().nullable().transform((v) => v || null),
        descuentoPorcentaje: numero(0, 100, 'El descuento va de 0 a 100 %').default(0),
        notaRevision: textoOpcional(500),
        tareas: z.array(tareaSchema).max(200).default([]),
        materiales: z.array(materialSchema).max(500).default([]),
    })
    .refine((d) => Boolean(d.clienteId || d.clienteNombre), { message: 'Elegí el cliente', path: ['clienteId'] })
    .refine((d) => !(d.fechaInicioTentativa && d.fechaFinTentativa) || d.fechaFinTentativa >= d.fechaInicioTentativa, {
        message: 'La fecha de fin no puede ser anterior a la de inicio',
        path: ['fechaFinTentativa'],
    });

export type ContenidoPresupuestoInput = z.infer<typeof contenidoPresupuestoSchema>;

export const opcionesDocumentoSchema = z.object({
    nivel: z.coerce.number().int().min(1).max(4),
    cantidades: z.boolean(),
    horas: z.boolean(),
    tareas: z.boolean(),
    plazo: z.boolean(),
    condiciones: z.boolean(),
});

export const accionEstadoSchema = z.discriminatedUnion('accion', [
    z.object({ accion: z.literal('enviar'), opcionesDocumento: opcionesDocumentoSchema.optional() }),
    z.object({
        accion: z.literal('aceptar'),
        fechaAceptacion: z.string().trim().refine(esFecha, 'Fecha de aceptación inválida'),
        referenciaCliente: textoOpcional(200),
        comentario: textoOpcional(1000),
    }),
    z.object({ accion: z.literal('rechazar'), motivo: z.string().trim().min(3, 'Contá brevemente el motivo del rechazo').max(1000) }),
]);

export const manoObraCategoriaSchema = z.object({
    nombre: z.string().trim().min(2, 'Escribí el nombre de la categoría').max(80),
    valorHora: numero(0, 1e9, 'El valor hora no puede ser negativo'),
    ivaPorcentaje: numero(0, 100, 'IVA inválido').default(21),
    orden: z.coerce.number().int().min(0).max(1000).default(0),
    activo: z.boolean().default(true),
});
