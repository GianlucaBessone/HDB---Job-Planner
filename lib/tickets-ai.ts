/**
 * Triaje online de tickets con Gemini.
 *
 * Este módulo es server-only: usa Prisma y la capa de IA.
 * No aplica cambios de código ni toca el repositorio. Solo clasifica el ticket,
 * estima el riesgo, propone un plan y detecta duplicados.
 *
 * Reglas de seguridad:
 *  - La prioridad siempre se recalcula en código, nunca se confía en la IA.
 *  - El auto-fix solo queda habilitado si el usuario lo autorizó, la IA lo
 *    propone, el tipo es "error", el riesgo es "bajo" y no hay aprobación.
 *  - Si el ticket toca zonas sensibles (auth, permisos, pagos, esquema, etc.)
 *    se sube el riesgo a "alto" y se exige aprobación humana.
 */

import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { generateObject } from '@/lib/ai';
import { getRouteTable } from '@/lib/ai/router';
import type { TicketTriageOutput, TicketResolutionOutput } from '@/lib/ai/types';
import {
    computePrioridad,
    type TicketImpacto,
    type TicketRiesgo,
    type TicketTipo,
    type TicketUrgencia,
} from '@/lib/tickets';

const TIPOS = ['error', 'funcionalidad', 'sugerencia', 'consulta'] as const;
const URGENCIAS = ['critica', 'alta', 'media', 'baja'] as const;
const IMPACTOS = ['organizacion', 'area', 'varios_usuarios', 'usuario_unico'] as const;
const RIESGOS = ['bajo', 'medio', 'alto', 'critico'] as const;
const CONFIANZAS = ['baja', 'media', 'alta'] as const;
const ESFUERZOS = ['bajo', 'medio', 'alto'] as const;

const triageSchema = z.object({
    tipo: z.enum(TIPOS),
    urgencia: z.enum(URGENCIAS),
    impacto: z.enum(IMPACTOS),
    riesgo: z.enum(RIESGOS),
    resumen: z.string().trim().min(1).max(2000),
    causaRaiz: z.string().trim().max(4000).default(''),
    alcance: z.string().trim().max(2000).default(''),
    plan: z.string().trim().max(4000).default(''),
    esfuerzo: z.enum(ESFUERZOS),
    horas: z.number().min(0).max(200),
    confianza: z.enum(CONFIANZAS),
    autoFixPermitido: z.boolean(),
    requiereAprobacion: z.boolean(),
    preguntasAlUsuario: z.array(z.string().trim().min(1).max(300)).max(5).default([]),
    duplicadosProbables: z
        .array(
            z.object({
                codigo: z.string().trim().min(3).max(40),
                motivo: z.string().trim().max(300).default(''),
            })
        )
        .max(5)
        .default([]),
    respuestaSugerida: z.string().trim().max(3000).default(''),
});

/**
 * Temas donde la política exige aprobación humana. Si la descripción los
 * menciona, nunca dejamos que la IA habilite un auto-fix.
 *
 * Se comparan contra el texto sin tildes y por palabra completa, para que
 * "rol" no matchee "control" ni "desarrollo". Las que terminan en "*" son
 * prefijos ("factur*" cubre factura, facturación, facturar).
 * "produccion" no está: en HDB es un área de trabajo, no el entorno.
 */
const ZONAS_SENSIBLES = [
    'login', 'logueo', 'loguear*', 'iniciar sesion', 'inicio de sesion', 'cerrar sesion', 'sesion', 'sesiones',
    'contrasena', 'contrasenas', 'clave', 'claves', 'password',
    'permiso', 'permisos', 'rol', 'roles', 'autentic*', 'autoriz*',
    'factur*', 'pago', 'pagos', 'cobro', 'cobros', 'sueldo', 'sueldos', 'salario', 'salarios',
    'dni', 'cuil', 'cuit', 'cbu', 'datos personales',
    'migracion', 'migraciones', 'esquema', 'prisma', 'base de datos',
    'middleware', 'electron', 'deploy', '.env', 'token', 'tokens',
];

export function normalizarTexto(texto: string): string {
    return texto
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9.]+/g, ' ')
        .trim();
}

export function tocaZonaSensible(texto: string): boolean {
    const normalizado = ` ${normalizarTexto(texto)} `;
    const palabras = normalizado.trim().split(' ');
    return ZONAS_SENSIBLES.some(clave => clave.endsWith('*')
        ? palabras.some(p => p.startsWith(clave.slice(0, -1)))
        : normalizado.includes(` ${clave} `));
}

const RIESGO_RANK: Record<TicketRiesgo, number> = {
    desconocido: 0,
    bajo: 1,
    medio: 2,
    alto: 3,
    critico: 4,
};

const MODELO = getRouteTable()['TICKET_TRIAGE']?.model || 'gemini-2.5-flash';

export interface TriageActor {
    userId?: string | null;
    userName?: string | null;
    userRole?: string | null;
}

export type TriageResult =
    | {
          ok: true;
          ticket: any;
          analysis: TicketTriageOutput;
          latenciaMs: number;
          costo: number;
      }
    | {
          ok: false;
          status: number;
          error: string;
      };

function textoDelTicket(ticket: {
    titulo: string;
    descripcion: string;
    pasosReproducir?: string | null;
    comportamientoEsperado?: string | null;
}): string {
    return [ticket.titulo, ticket.descripcion, ticket.pasosReproducir, ticket.comportamientoEsperado]
        .filter(Boolean)
        .join(' ');
}

/**
 * Clasifica un ticket existente y persiste el resultado.
 * No lanza excepciones de negocio: devuelve un resultado tipado.
 */
export async function triageTicket(ticketId: string, actor: TriageActor = {}): Promise<TriageResult> {
    if (!process.env.GEMINI_API_KEY) {
        return {
            ok: false,
            status: 503,
            error: 'La IA no está configurada: falta GEMINI_API_KEY en el entorno.',
        };
    }

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
        return { ok: false, status: 404, error: 'Ticket no encontrado.' };
    }

    // Tickets abiertos recientes: contexto para detectar duplicados reales.
    const abiertos = await prisma.ticket.findMany({
        where: {
            id: { not: ticket.id },
            estado: { notIn: ['cerrado', 'rechazado', 'duplicado'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 25,
        select: { codigo: true, titulo: true, tipo: true, estado: true, createdAt: true },
    });

    // En un re-análisis, tipo/urgencia/impacto ya son los del triaje anterior:
    // a la IA le pasamos siempre lo que declaró quien reportó.
    const declarado = (ticket.clasificacionDeclarada as { tipo?: string; urgencia?: string; impacto?: string } | null) || {};

    const aiResponse = await generateObject<unknown>(
        'TICKET_TRIAGE',
        {
            codigo: ticket.codigo,
            tipoDeclarado: declarado.tipo || ticket.tipo,
            titulo: ticket.titulo,
            descripcion: ticket.descripcion,
            pasosReproducir: ticket.pasosReproducir || 'No informados',
            comportamientoEsperado: ticket.comportamientoEsperado || 'No informado',
            urgenciaDeclarada: declarado.urgencia || ticket.urgencia,
            impactoDeclarado: declarado.impacto || ticket.impacto,
            contexto: JSON.stringify(ticket.contexto || {}),
            etiquetas: JSON.stringify(ticket.etiquetas || []),
            autoFixAutorizado: ticket.autoFixAutorizadoPorUsuario ? 'Sí' : 'No',
            ticketsAbiertos: abiertos.map(t => ({
                codigo: t.codigo,
                titulo: t.titulo,
                tipo: t.tipo,
                estado: t.estado,
            })),
        },
        {
            userId: actor.userId || undefined,
            userName: actor.userName || 'Sistema',
            userRole: actor.userRole || 'sistema',
            entity: 'TICKET',
            entityId: ticket.id,
            temperature: 0.2,
            timeoutMs: 30000,
            useDatabasePrompts: true,
        }
    );

    if (!aiResponse.success || !aiResponse.data) {
        return {
            ok: false,
            status: 502,
            error: aiResponse.error || 'La IA no pudo analizar el ticket.',
        };
    }

    // No confiamos en la forma del JSON: validamos y completamos con defaults.
    const parsed = triageSchema.safeParse(aiResponse.data);
    if (!parsed.success) {
        return {
            ok: false,
            status: 502,
            error: 'La IA devolvió un análisis con un formato inválido. Probá de nuevo o revisá el prompt TICKET_TRIAGE.',
        };
    }

    const ai = parsed.data;
    const texto = textoDelTicket(ticket);
    const sensible = tocaZonaSensible(texto);

    const tipo: TicketTipo = ai.tipo;
    const urgencia: TicketUrgencia = ai.urgencia;
    const impacto: TicketImpacto = ai.impacto;

    // Suelo de riesgo: la IA no puede bajar el riesgo de una zona sensible.
    let riesgo: TicketRiesgo = ai.riesgo;
    if (sensible && RIESGO_RANK[riesgo] < RIESGO_RANK.alto) {
        riesgo = 'alto';
    }

    const requiereAprobacion =
        ai.requiereAprobacion || ai.confianza === 'baja' || riesgo !== 'bajo' || sensible;

    // El auto-fix necesita el consentimiento del usuario y pasar todos los filtros.
    // El consentimiento vive en su propio campo: el triaje nunca lo pisa.
    const autoFixPermitido =
        ticket.autoFixAutorizadoPorUsuario &&
        ai.autoFixPermitido &&
        tipo === 'error' &&
        riesgo === 'bajo' &&
        !requiereAprobacion;

    const prioridad = computePrioridad(tipo, urgencia, impacto);

    // Solo aceptamos duplicados que existan de verdad en la lista enviada.
    const codigosValidos = new Set(abiertos.map(t => t.codigo));
    const vistos = new Set<string>();
    const duplicados = ai.duplicadosProbables
        .filter(d => d.codigo !== ticket.codigo && codigosValidos.has(d.codigo) && !vistos.has(d.codigo))
        .filter(d => {
            vistos.add(d.codigo);
            return true;
        })
        .slice(0, 5);

    const analysis: TicketTriageOutput = {
        ...ai,
        tipo,
        urgencia,
        impacto,
        riesgo,
        autoFixPermitido,
        requiereAprobacion,
        duplicadosProbables: duplicados,
    };

    const generadoEn = new Date().toISOString();
    const analisisAgente = {
        resumen: analysis.resumen,
        causaRaiz: analysis.causaRaiz,
        alcance: analysis.alcance,
        plan: analysis.plan,
        archivosProbables: [] as string[],
        requiereAprobacion,
        confianza: analysis.confianza,
        preguntasAlUsuario: analysis.preguntasAlUsuario,
        respuestaSugerida: analysis.respuestaSugerida,
        duplicadosProbables: analysis.duplicadosProbables,
        origen: 'gemini',
        modelo: MODELO,
        generadoEn,
    };
    const estimacion = {
        esfuerzo: analysis.esfuerzo,
        horas: analysis.horas,
        confianza: analysis.confianza,
        riesgo,
    };

    const estadoAnterior = ticket.estado;
    const estadoNuevo = estadoAnterior === 'nuevo' ? 'triaje' : estadoAnterior;

    const actualizado = await prisma.$transaction(async tx => {
        const result = await tx.ticket.update({
            where: { id: ticket.id },
            data: {
                tipo,
                urgencia,
                impacto,
                prioridad,
                riesgo,
                autoFixPermitido,
                analisisAgente: analisisAgente as any,
                estimacion: estimacion as any,
                estado: estadoNuevo,
            },
        });

        if (estadoNuevo !== estadoAnterior) {
            await tx.ticketHistorial.create({
                data: {
                    ticketId: ticket.id,
                    estadoAnterior,
                    estadoNuevo,
                    usuario: 'Triaje IA',
                    comentario: `Clasificación automática con ${MODELO}`,
                },
            });
        }

        await tx.ticketEventoAgente.create({
            data: {
                ticketId: ticket.id,
                agente: 'gemini',
                tipo: 'analisis',
                payload: {
                    analysis,
                    usage: aiResponse.usage || null,
                    latenciaMs: aiResponse.latencyMs || null,
                } as any,
            },
        });

        return result;
    });

    return {
        ok: true,
        ticket: actualizado,
        analysis,
        latenciaMs: aiResponse.latencyMs || 0,
        costo: aiResponse.usage?.estimatedCost || 0,
    };
}

// ─── Respuesta automática de resolución ────────────────────────────────

const resolutionSchema = z.object({
    mensaje: z.string().trim().min(1).max(2000),
});

export type ResolutionResult =
    | { ok: true; mensaje: string; latenciaMs: number; costo: number }
    | { ok: false; status: number; error: string };

/**
 * Redacta la respuesta final que se envía al usuario cuando un ticket
 * pasa a estado `resuelto` y fue verificado. Es texto orientado al usuario,
 * no al equipo técnico.
 */
export async function generateResolutionResponse(ticketId: string, actor: TriageActor = {}): Promise<ResolutionResult> {
    if (!process.env.GEMINI_API_KEY) {
        return {
            ok: false,
            status: 503,
            error: 'La IA no está configurada: falta GEMINI_API_KEY en el entorno.',
        };
    }

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
        return { ok: false, status: 404, error: 'Ticket no encontrado.' };
    }

    const aiResponse = await generateObject<TicketResolutionOutput>(
        'TICKET_RESOLUTION_RESPONSE',
        {
            codigo: ticket.codigo,
            titulo: ticket.titulo,
            tipo: ticket.tipo,
            resumen: (ticket.analisisAgente as any)?.resumen || ticket.descripcion,
            plan: (ticket.analisisAgente as any)?.plan || 'Resolver el error reportado.',
            resolucion: ticket.resolucion || 'No se registró texto de la solución.',
            verificado: ticket.verificado ? 'Sí' : 'No',
        },
        {
            userId: actor.userId || undefined,
            userName: actor.userName || 'Sistema',
            userRole: actor.userRole || 'sistema',
            entity: 'TICKET',
            entityId: ticket.id,
            temperature: 0.3,
            timeoutMs: 30000,
            useDatabasePrompts: true,
        }
    );

    if (!aiResponse.success || !aiResponse.data) {
        return {
            ok: false,
            status: 502,
            error: aiResponse.error || 'La IA no pudo redactar la respuesta de resolución.',
        };
    }

    const parsed = resolutionSchema.safeParse(aiResponse.data);
    if (!parsed.success) {
        return {
            ok: false,
            status: 502,
            error: 'La IA devolvió un formato inválido en la respuesta de resolución.',
        };
    }

    return {
        ok: true,
        mensaje: parsed.data.mensaje,
        latenciaMs: aiResponse.latencyMs || 0,
        costo: aiResponse.usage?.estimatedCost || 0,
    };
}
