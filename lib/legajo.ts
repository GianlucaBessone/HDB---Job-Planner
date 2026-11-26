import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { borrarObjeto, storageConfigurado, subirObjeto } from '@/lib/objectStorage';
import {
    ARCHIVO_LEGAJO_MAX_BYTES,
    ARCHIVO_LEGAJO_TIPOS,
    estadoDocumento,
    type DatosLegajo,
    type DocumentoLegajo,
    type FichaLegajo,
    type ResumenLegajo,
    type TipoDocumento,
} from '@/lib/legajoTipos';

/**
 * Legajo del personal (auditoría, faltante). Junta los datos de la persona como empleado y sus documentos con
 * vencimiento. Los archivos van al almacenamiento de archivos (`rrhh/legajo/…`) y se abren con URL prefirmada.
 */

export class ErrorLegajo extends Error {
    constructor(mensaje: string, public status = 400) {
        super(mensaje);
    }
}

const dia = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const hoyIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });

export async function listarLegajos(estado: 'activos' | 'inactivos' | 'todos'): Promise<ResumenLegajo[]> {
    const hoy = hoyIso();
    const personas = await prisma.operator.findMany({
        where: estado === 'todos' ? {} : { activo: estado === 'activos' },
        select: {
            id: true,
            nombreCompleto: true,
            posicion: true,
            activo: true,
            legajo: { select: { legajo: true, fechaIngreso: true, contactoEmergenciaNombre: true, contactoEmergenciaTelefono: true } },
            documentosLegajo: { select: { fechaVencimiento: true } },
        },
        orderBy: { nombreCompleto: 'asc' },
    });
    return personas.map((p) => {
        const venc = p.documentosLegajo.map((d) => dia(d.fechaVencimiento)).filter((v): v is string => !!v);
        const estados = venc.map((v) => estadoDocumento(v, hoy));
        const futuros = venc.filter((v) => v >= hoy).sort();
        return {
            id: p.id,
            nombreCompleto: p.nombreCompleto,
            posicion: p.posicion,
            activo: p.activo,
            legajo: p.legajo?.legajo ?? null,
            fechaIngreso: dia(p.legajo?.fechaIngreso),
            contactoEmergencia: !!(p.legajo?.contactoEmergenciaNombre && p.legajo?.contactoEmergenciaTelefono),
            documentos: p.documentosLegajo.length,
            vencidos: estados.filter((e) => e === 'vencido').length,
            porVencer: estados.filter((e) => e === 'por_vencer').length,
            proximoVencimiento: futuros[0] ?? null,
        };
    });
}

const SELECT_DOCUMENTO = {
    id: true,
    tipo: true,
    nombre: true,
    numero: true,
    fechaEmision: true,
    fechaVencimiento: true,
    archivoKey: true,
    archivoNombre: true,
    observaciones: true,
    creadoPorNombre: true,
    updatedAt: true,
} satisfies Prisma.DocumentoPersonalSelect;

function comoDocumento(d: Prisma.DocumentoPersonalGetPayload<{ select: typeof SELECT_DOCUMENTO }>): DocumentoLegajo {
    return {
        id: d.id,
        tipo: d.tipo as TipoDocumento,
        nombre: d.nombre,
        numero: d.numero,
        fechaEmision: dia(d.fechaEmision),
        fechaVencimiento: dia(d.fechaVencimiento),
        archivoNombre: d.archivoNombre,
        tieneArchivo: !!d.archivoKey,
        observaciones: d.observaciones,
        creadoPorNombre: d.creadoPorNombre,
        updatedAt: d.updatedAt.toISOString(),
    };
}

export async function fichaLegajo(operatorId: string): Promise<FichaLegajo | null> {
    const p = await prisma.operator.findUnique({
        where: { id: operatorId },
        select: {
            id: true,
            nombreCompleto: true,
            posicion: true,
            role: true,
            activo: true,
            dni: true,
            legajo: true,
            documentosLegajo: { select: SELECT_DOCUMENTO, orderBy: [{ fechaVencimiento: { sort: 'asc', nulls: 'last' } }, { nombre: 'asc' }] },
        },
    });
    if (!p) return null;
    const l = p.legajo;
    return {
        persona: { id: p.id, nombreCompleto: p.nombreCompleto, posicion: p.posicion, role: p.role, activo: p.activo },
        datos: {
            legajo: l?.legajo ?? null,
            dni: p.dni,
            cuil: l?.cuil ?? null,
            fechaIngreso: dia(l?.fechaIngreso),
            fechaEgreso: dia(l?.fechaEgreso),
            fechaNacimiento: dia(l?.fechaNacimiento),
            telefono: l?.telefono ?? null,
            email: l?.email ?? null,
            domicilio: l?.domicilio ?? null,
            localidad: l?.localidad ?? null,
            obraSocial: l?.obraSocial ?? null,
            grupoSanguineo: l?.grupoSanguineo ?? null,
            contactoEmergenciaNombre: l?.contactoEmergenciaNombre ?? null,
            contactoEmergenciaTelefono: l?.contactoEmergenciaTelefono ?? null,
            contactoEmergenciaRelacion: l?.contactoEmergenciaRelacion ?? null,
            observaciones: l?.observaciones ?? null,
        },
        documentos: p.documentosLegajo.map(comoDocumento),
        actualizadoPorNombre: l?.actualizadoPorNombre ?? null,
        actualizado: l?.updatedAt.toISOString() ?? null,
        adjuntos: storageConfigurado(),
    };
}

const fecha = (v: string | null | undefined) => (v === undefined ? undefined : v ? new Date(`${v.slice(0, 10)}T12:00:00Z`) : null);

/** Guarda los datos del legajo (crea el registro si no existía). Solo los campos enviados. */
export async function guardarDatos(operatorId: string, d: Partial<DatosLegajo>, usuario: string) {
    return prisma.$transaction(async (tx) => {
        const persona = await tx.operator.findUnique({ where: { id: operatorId }, select: { id: true } });
        if (!persona) throw new ErrorLegajo('La persona no existe', 404);
        if (d.legajo) {
            const otro = await tx.legajoPersonal.findFirst({ where: { legajo: d.legajo, NOT: { operatorId } }, select: { operator: { select: { nombreCompleto: true } } } });
            if (otro) throw new ErrorLegajo(`El número de legajo ya es de ${otro.operator.nombreCompleto}`, 409);
        }
        const { dni, ...resto } = d;
        if (dni !== undefined) await tx.operator.update({ where: { id: operatorId }, data: { dni: dni || null } });
        const datos: Prisma.LegajoPersonalUncheckedUpdateInput = { actualizadoPorNombre: usuario };
        for (const [k, v] of Object.entries(resto) as [keyof DatosLegajo, string | null | undefined][]) {
            if (v === undefined) continue;
            (datos as any)[k] = k.startsWith('fecha') ? fecha(v) : v || null;
        }
        await tx.legajoPersonal.upsert({
            where: { operatorId },
            create: { ...(datos as Prisma.LegajoPersonalUncheckedCreateInput), operatorId },
            update: datos,
        });
    });
}

// ── Documentos ──────────────────────────────────────────────────────────────────────────────────────

export interface DatosDocumento {
    tipo: TipoDocumento;
    nombre: string;
    numero?: string | null;
    fechaEmision?: string | null;
    fechaVencimiento?: string | null;
    observaciones?: string | null;
}

/** Valida el archivo (tamaño, tipo y firma) y lo sube. Devuelve los datos para guardar. */
async function subirArchivo(archivo: File) {
    if (!storageConfigurado()) throw new ErrorLegajo('El almacenamiento de archivos no está configurado; guardá el documento sin adjunto');
    if (archivo.size > ARCHIVO_LEGAJO_MAX_BYTES) throw new ErrorLegajo(`El archivo supera los ${ARCHIVO_LEGAJO_MAX_BYTES / (1024 * 1024)} MB`, 413);
    const ext = ARCHIVO_LEGAJO_TIPOS[archivo.type];
    if (!ext) throw new ErrorLegajo('Adjuntá un PDF o una imagen (JPG, PNG o WebP)');
    const datos = Buffer.from(await archivo.arrayBuffer());
    const cabecera = datos.subarray(0, 12);
    const firmaOk =
        (ext === 'pdf' && cabecera.subarray(0, 5).toString('latin1') === '%PDF-') ||
        (ext === 'jpg' && cabecera[0] === 0xff && cabecera[1] === 0xd8) ||
        (ext === 'png' && cabecera.subarray(1, 4).toString('latin1') === 'PNG') ||
        (ext === 'webp' && cabecera.subarray(8, 12).toString('latin1') === 'WEBP');
    if (!firmaOk) throw new ErrorLegajo('El archivo no coincide con su tipo');
    const archivoKey = `rrhh/legajo/${randomUUID()}.${ext}`;
    await subirObjeto(archivoKey, datos, archivo.type);
    return { archivoKey, archivoNombre: (archivo.name || `documento.${ext}`).slice(0, 200), archivoTipo: archivo.type };
}

const datosDocumento = (d: Partial<DatosDocumento>) => ({
    ...(d.tipo !== undefined ? { tipo: d.tipo } : {}),
    ...(d.nombre !== undefined ? { nombre: d.nombre.trim() } : {}),
    ...(d.numero !== undefined ? { numero: d.numero || null } : {}),
    ...(d.fechaEmision !== undefined ? { fechaEmision: fecha(d.fechaEmision) } : {}),
    ...(d.fechaVencimiento !== undefined ? { fechaVencimiento: fecha(d.fechaVencimiento) } : {}),
    ...(d.observaciones !== undefined ? { observaciones: d.observaciones || null } : {}),
});

export async function crearDocumento(operatorId: string, d: DatosDocumento, archivo: File | null, usuario: string) {
    const persona = await prisma.operator.findUnique({ where: { id: operatorId }, select: { id: true } });
    if (!persona) throw new ErrorLegajo('La persona no existe', 404);
    const adjunto: { archivoKey?: string; archivoNombre?: string; archivoTipo?: string } = archivo ? await subirArchivo(archivo) : {};
    try {
        return await prisma.documentoPersonal.create({
            data: { operatorId, ...datosDocumento(d), tipo: d.tipo, nombre: d.nombre.trim(), ...adjunto, creadoPorNombre: usuario },
            select: { id: true, nombre: true },
        });
    } catch (e) {
        if (adjunto.archivoKey) await borrarObjeto(adjunto.archivoKey).catch(() => {});
        throw e;
    }
}

/** Edita un documento. Con archivo nuevo reemplaza el anterior; con `quitarArchivo` lo borra. */
export async function editarDocumento(id: string, d: Partial<DatosDocumento>, archivo: File | null, quitarArchivo: boolean) {
    const actual = await prisma.documentoPersonal.findUnique({ where: { id }, select: { archivoKey: true, operatorId: true, nombre: true } });
    if (!actual) throw new ErrorLegajo('El documento no existe', 404);
    const adjunto = archivo ? await subirArchivo(archivo) : quitarArchivo ? { archivoKey: null, archivoNombre: null, archivoTipo: null } : {};
    await prisma.documentoPersonal.update({ where: { id }, data: { ...datosDocumento(d), ...adjunto } });
    if ((archivo || quitarArchivo) && actual.archivoKey) await borrarObjeto(actual.archivoKey).catch(() => {});
    return actual;
}

export async function borrarDocumento(id: string) {
    const actual = await prisma.documentoPersonal.findUnique({ where: { id }, select: { archivoKey: true, operatorId: true, nombre: true, tipo: true } });
    if (!actual) throw new ErrorLegajo('El documento no existe', 404);
    await prisma.documentoPersonal.delete({ where: { id } });
    if (actual.archivoKey) await borrarObjeto(actual.archivoKey).catch(() => {});
    return actual;
}
