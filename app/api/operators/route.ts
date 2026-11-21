import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { dataLayer } from '@/lib/dataLayer';
import { getSessionFromRequest } from '@/lib/auth';
import { exigirAcceso, type AccesoSesion } from '@/lib/permisosServer';
import {
    reglaAltaUsuario,
    reglaEdicionUsuario,
    reglaEliminarUsuario,
    type ActorUsuarios,
    type ErrorRegla,
} from '@/lib/operators/reglasRol';

export const dynamic = 'force-dynamic';

const SIN_PERMISO = 'No tenés permisos para gestionar usuarios';

// Campos que se pueden escribir desde Gestión de Usuarios. Cualquier otro campo
// se descarta: el cuerpo no llega crudo a Prisma (p. ej. relaciones anidadas
// como permisosEspeciales, que se administran solo desde /api/accesos).
const textoOpcional = (max: number) =>
    z.string().trim().max(max).nullish().transform(v => v ?? undefined);

const camposUsuario = {
    nombreCompleto: z.string().trim().min(1, 'El nombre es obligatorio').max(200),
    activo: z.boolean(),
    enVacaciones: z.boolean(),
    etiquetas: z.array(z.string().max(100)).max(100),
    pin: z.string().max(50),
    role: z.string().trim().min(1).max(50),
    dni: textoOpcional(50),
    posicion: textoOpcional(200),
    primaryDeviceId: z.string().max(500).nullable(),
    // Categoría de mano de obra: define su valor hora por defecto (P20). null = sin categoría
    manoObraCategoriaId: z.string().trim().max(64).nullable(),
};

const altaSchema = z.object({
    nombreCompleto: camposUsuario.nombreCompleto,
    activo: camposUsuario.activo.optional(),
    enVacaciones: camposUsuario.enVacaciones.optional(),
    etiquetas: camposUsuario.etiquetas.default([]),
    pin: camposUsuario.pin.optional(),
    role: camposUsuario.role.optional(),
    dni: camposUsuario.dni,
    posicion: camposUsuario.posicion,
    manoObraCategoriaId: camposUsuario.manoObraCategoriaId.optional(),
});

const edicionSchema = z.object({
    nombreCompleto: camposUsuario.nombreCompleto.optional(),
    activo: camposUsuario.activo.optional(),
    enVacaciones: camposUsuario.enVacaciones.optional(),
    etiquetas: camposUsuario.etiquetas.optional(),
    pin: camposUsuario.pin.optional(),
    role: camposUsuario.role.optional(),
    dni: camposUsuario.dni,
    posicion: camposUsuario.posicion,
    primaryDeviceId: camposUsuario.primaryDeviceId.optional(),
    manoObraCategoriaId: camposUsuario.manoObraCategoriaId.optional(),
});

function actorDe(acceso: AccesoSesion): ActorUsuarios {
    return { userId: acceso.userId, role: acceso.role, puedeAsignarRol: acceso.puede('usuarios.asignar_rol') };
}

function responderRegla(e: ErrorRegla) {
    return NextResponse.json({ error: e.error }, { status: e.status });
}

async function leerJson<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T> | NextResponse> {
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'El cuerpo de la solicitud no es JSON válido' }, { status: 400 });
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 });
    }
    return parsed.data;
}

function usuarioActual(id: string) {
    return prisma.operator.findUnique({ where: { id }, select: { id: true, role: true } });
}

export async function GET(req: Request) {
    try {
        const operators = await dataLayer.getOperators();
        const session = await getSessionFromRequest(req);

        // Sin sesión (login, formulario público de sugerencias) solo se exponen los nombres.
        const body = session
            ? operators.map(({ pin: _pin, ...op }) => op)
            : operators.map(op => ({ id: op.id, nombreCompleto: op.nombreCompleto, activo: op.activo }));

        // La respuesta depende de la sesión: no puede quedar en la caché compartida de la CDN.
        return NextResponse.json(body, {
            headers: { 'Cache-Control': 'private, no-store' },
        });
    } catch (e) {
        return NextResponse.json({ error: 'Failed to fetch operators' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const acceso = await exigirAcceso(req, ['usuarios.gestionar'], SIN_PERMISO);
    if (acceso instanceof NextResponse) return acceso;

    const data = await leerJson(req, altaSchema);
    if (data instanceof NextResponse) return data;

    const regla = reglaAltaUsuario(actorDe(acceso), data.role);
    if (regla) return responderRegla(regla);

    const operator = await dataLayer.createOperator(data, acceso);
    const { pin: _pin, ...safe } = operator;
    return NextResponse.json(safe);
}

export async function PATCH(req: Request) {
    const acceso = await exigirAcceso(req, ['usuarios.gestionar'], SIN_PERMISO);
    if (acceso instanceof NextResponse) return acceso;

    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const data = await leerJson(req, edicionSchema);
    if (data instanceof NextResponse) return data;

    const objetivo = await usuarioActual(id);
    if (!objetivo) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

    const regla = reglaEdicionUsuario(actorDe(acceso), objetivo, data.role);
    if (regla) return responderRegla(regla);

    // PIN vacío = mantener el actual
    if (typeof data.pin === 'string' && !data.pin.trim()) delete data.pin;
    const operator = await dataLayer.updateOperator(id, data, acceso);
    const { pin: _pin, ...safe } = operator;
    return NextResponse.json(safe);
}

export async function DELETE(req: Request) {
    const acceso = await exigirAcceso(req, ['usuarios.gestionar'], SIN_PERMISO);
    if (acceso instanceof NextResponse) return acceso;

    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const objetivo = await usuarioActual(id);
    if (!objetivo) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

    const regla = reglaEliminarUsuario(actorDe(acceso), objetivo);
    if (regla) return responderRegla(regla);

    // Con historial (horas, fichadas, órdenes…) se desactiva en lugar de borrarse.
    const resultado = await dataLayer.deleteOperator(id, acceso);
    return NextResponse.json({ success: true, ...resultado });
}
