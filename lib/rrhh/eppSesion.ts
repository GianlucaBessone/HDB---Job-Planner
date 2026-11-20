// EPP: sesión, lectura del cuerpo y respuestas comunes de las API routes.
// Solo servidor. Cada ruta pide su función de lib/permisos.ts con sesionEpp().
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import type { ZodType } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAcceso } from '@/lib/permisosServer';
import type { FuncionId } from '@/lib/permisos';

/** Error con estado HTTP: lo lanzan la sesión, la validación y las reglas de negocio. */
export class ErrorEpp extends Error {
    constructor(message: string, public status = 400) {
        super(message);
        this.name = 'ErrorEpp';
    }
}

export interface ActorEpp {
    id: string;
    nombre: string;
    rol: string;
}

/**
 * Usuario de la sesión, si tiene la función pedida.
 * Lanza 401 sin sesión y 403 sin la función.
 */
export async function sesionEpp(req: Request, funcion: FuncionId): Promise<ActorEpp> {
    const acceso = await getAcceso(req);
    if (!acceso.userId) throw new ErrorEpp('No autorizado', 401);
    if (!acceso.puede(funcion)) throw new ErrorEpp('No tenés permiso para esta acción.', 403);
    const op = await prisma.operator.findUnique({ where: { id: acceso.userId }, select: { nombreCompleto: true } });
    return { id: acceso.userId, nombre: op?.nombreCompleto || 'Usuario', rol: acceso.role };
}

/** Cuerpo JSON validado con el esquema. Lanza 400 con el primer error. */
export async function leerBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
    const json = await req.json().catch(() => null);
    const parsed = schema.safeParse(json);
    if (!parsed.success) throw new ErrorEpp(parsed.error.issues[0]?.message || 'Datos inválidos', 400);
    return parsed.data;
}

/**
 * Ejecuta el handler y arma la respuesta: `{ data }` si sale bien,
 * `{ error }` con el estado que corresponda si no.
 */
export async function responder(contexto: string, handler: () => Promise<unknown>, status = 200) {
    try {
        const data = await handler();
        return NextResponse.json({ data: data ?? null }, { status });
    } catch (error) {
        if (error instanceof ErrorEpp) return NextResponse.json({ error: error.message }, { status: error.status });
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2025') return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });
            if (error.code === 'P2002') return NextResponse.json({ error: 'Ya existe un registro con esos datos.' }, { status: 409 });
        }
        console.error(`[EPP ${contexto}]`, error);
        return NextResponse.json({ error: 'No se pudo completar la operación de EPP.' }, { status: 500 });
    }
}
