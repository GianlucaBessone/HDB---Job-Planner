#!/usr/bin/env node
/**
 * MCP local (stdio) del sistema de tickets de HDB SGI.
 *
 * Expone los tickets a OpenCode y aplica la política de auto-fix de bajo riesgo.
 * No usa dependencias extra: habla JSON-RPC 2.0 por stdin/stdout y usa el
 * Prisma Client ya generado por la aplicación Next.js.
 *
 * Arranque manual:
 *   node mcp/sgi-tickets/server.mjs
 *
 * Logs: siempre por stderr. stdout está reservado al protocolo MCP.
 */

import { createInterface } from 'node:readline';
import { existsSync, mkdirSync, copyFileSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OVERRIDE_ROOT = process.env.SGI_PROJECT_ROOT;
const PROJECT_ROOT = OVERRIDE_ROOT && isAbsolute(OVERRIDE_ROOT)
    ? resolve(OVERRIDE_ROOT)
    : resolve(join(__dirname, '..', '..'));
const POLICY_PATH = join(__dirname, 'policy.json');

// ── Entorno ────────────────────────────────────────────────────────
function loadDotEnv() {
    const envPath = join(PROJECT_ROOT, '.env');
    if (!existsSync(envPath)) return;
    const content = readFileSync(envPath, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (!match) continue;
        const [, key, rawValue] = match;
        if (process.env[key] !== undefined) continue;
        let value = rawValue.trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        process.env[key] = value.replace(/\\n/g, '\n');
    }
}

function log(...args) {
    process.stderr.write(`[sgi-mcp] ${args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}\n`);
}

// ── Política ───────────────────────────────────────────────────────
let POLICY;
try {
    POLICY = JSON.parse(readFileSync(POLICY_PATH, 'utf8'));
} catch (error) {
    log('No se pudo leer policy.json:', error.message);
    POLICY = { version: '0.0.0', autoFix: { enabled: false }, transiciones: {} };
}

// ── Prisma ─────────────────────────────────────────────────────────
let prismaClient = null;

async function getPrisma() {
    if (prismaClient) return prismaClient;
    loadDotEnv();

    let PrismaClient;
    try {
        const mod = await import('@prisma/client');
        PrismaClient = mod.PrismaClient || mod.default?.PrismaClient;
    } catch (error) {
        throw new Error(
            'No se pudo cargar @prisma/client. Ejecutá "npm install" y "npx prisma generate" en la raíz del proyecto.'
        );
    }

    if (!PrismaClient) throw new Error('@prisma/client no expone PrismaClient.');
    if (!process.env.DATABASE_URL) {
        throw new Error('Falta DATABASE_URL. Configurá el archivo .env del proyecto.');
    }

    prismaClient = new PrismaClient();
    return prismaClient;
}

// ── Guardrails ─────────────────────────────────────────────────────
function normalizarRuta(value) {
    const partes = String(value || '')
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .split('/');

    // Colapsa "." y ".." para que "lib/../prisma/schema.prisma" no pase como "lib/**".
    const resueltas = [];
    for (const parte of partes) {
        if (!parte || parte === '.') continue;
        if (parte === '..') {
            if (resueltas.length > 0) resueltas.pop();
            else resueltas.push('..');
            continue;
        }
        resueltas.push(parte);
    }

    return resueltas.join('/');
}

function globToRegex(glob) {
    let out = '';
    for (let i = 0; i < glob.length; i++) {
        const char = glob[i];
        if (char === '*') {
            if (glob[i + 1] === '*') {
                out += '.*';
                i++;
            } else {
                out += '[^/]*';
            }
        } else if (char === '?') {
            out += '.';
        } else {
            out += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
        }
    }
    return new RegExp(`^${out}$`);
}

function coincideRuta(ruta, patrones) {
    const normalizada = normalizarRuta(ruta);
    return patrones.some(patron => {
        const p = normalizarRuta(patron);
        if (globToRegex(p).test(normalizada)) return true;
        // Permite que ".env.*" también bloquee subcarpetas.
        if (!p.includes('/') && globToRegex(`**/${p}`).test(normalizada)) return true;
        return false;
    });
}

function evaluarCambio(args = {}) {
    const cfg = POLICY.autoFix || {};
    const archivos = Array.isArray(args.archivos) ? args.archivos.map(normalizarRuta) : [];
    const aNumero = value => {
        const numero = Number(value);
        return Number.isFinite(numero) && numero > 0 ? numero : 0;
    };
    const lineasAgregadas = aNumero(args.lineasAgregadas);
    const lineasEliminadas = aNumero(args.lineasEliminadas);
    const lineasTotales = lineasAgregadas + lineasEliminadas;
    const categorias = Array.isArray(args.categorias) ? args.categorias : [];
    const migraciones = args.migraciones === true || categorias.includes('migracion_esquema');
    const dependencias = args.dependencias === true || categorias.includes('nueva_dependencia');

    const bloqueos = [];
    const motivosAprobacion = [];

    for (const archivo of archivos) {
        if (!archivo || archivo === '.' || archivo.startsWith('..')) {
            bloqueos.push(`Ruta inválida o fuera del proyecto: ${archivo || '(vacía)'}`);
            continue;
        }
        if (coincideRuta(archivo, cfg.deniedPaths || [])) {
            bloqueos.push(`Ruta prohibida por la política: ${archivo}`);
            continue;
        }
        if (!coincideRuta(archivo, cfg.allowedPaths || [])) {
            bloqueos.push(`Ruta fuera del alcance del auto-fix: ${archivo}`);
        }
    }

    if (archivos.length === 0) {
        bloqueos.push('No se declararon archivos para el cambio.');
    }

    if (archivos.length > (cfg.maxFiles || 4)) {
        motivosAprobacion.push(`El cambio toca ${archivos.length} archivos (máximo ${cfg.maxFiles} para auto-fix).`);
    }

    if (lineasTotales > (cfg.maxLinesChanged || 150)) {
        motivosAprobacion.push(`El cambio modifica ${lineasTotales} líneas (máximo ${cfg.maxLinesChanged} para auto-fix).`);
    }

    if (migraciones) motivosAprobacion.push('Incluye una migración o cambio de esquema.');
    if (dependencias) motivosAprobacion.push('Incluye una dependencia nueva o actualizada.');

    const sensibles = categorias.filter(c => (cfg.requiresApprovalCategories || []).includes(c));
    if (sensibles.length > 0) {
        motivosAprobacion.push(`Categorías sensibles: ${sensibles.join(', ')}.`);
    }

    const patronesProhibidos = [];
    const diff = typeof args.diff === 'string' ? args.diff : '';
    if (diff) {
        for (const patron of cfg.deniedPatterns || []) {
            try {
                if (new RegExp(patron, 'i').test(diff)) patronesProhibidos.push(patron);
            } catch {
                // Patrón inválido en la política: se ignora.
            }
        }
        if (patronesProhibidos.length > 0) {
            bloqueos.push(`El diff contiene patrones prohibidos: ${patronesProhibidos.join(', ')}`);
        }
    }

    let riesgo = 'bajo';
    if (motivosAprobacion.length > 0) riesgo = 'medio';
    if (sensibles.length > 0 || migraciones || dependencias) riesgo = 'alto';
    if (bloqueos.length > 0) riesgo = 'critico';

    return {
        permitido: bloqueos.length === 0,
        requiereAprobacion: bloqueos.length > 0 || motivosAprobacion.length > 0,
        riesgoSugerido: riesgo,
        archivos: archivos.length,
        lineasTotales,
        bloqueos,
        motivosAprobacion,
        patronesProhibidos,
        verificacionesRequeridas: cfg.requiredChecks || [],
        politicaVersion: POLICY.version,
    };
}

function crearRespaldo(ticketId, archivos) {
    const cfg = POLICY.autoFix || {};
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const base = join(PROJECT_ROOT, cfg.backupDir || '.sgi-backups', ticketId, stamp);
    const respaldados = [];

    for (const relativo of archivos) {
        const absoluto = resolve(PROJECT_ROOT, relativo);
        if (!absoluto.startsWith(PROJECT_ROOT + sep)) {
            throw new Error(`Ruta fuera del proyecto: ${relativo}`);
        }
        if (!existsSync(absoluto)) continue;

        const destino = join(base, relativo);
        mkdirSync(dirname(destino), { recursive: true });
        copyFileSync(absoluto, destino);
        respaldados.push(relativo);
    }

    mkdirSync(base, { recursive: true });
    return { directorio: relative(PROJECT_ROOT, base).replace(/\\/g, '/'), archivos: respaldados };
}

// ── Estados ────────────────────────────────────────────────────────
// Solo una persona, desde /tickets, pasa un ticket a estos estados o lo saca de ellos.
// Pasar a "resuelto" dispara la respuesta automática al usuario.
// Va fijo acá y no en policy.json para que no se pueda aflojar editando la política.
const ESTADOS_SOLO_HUMANOS = ['resuelto', 'cerrado'];

function transicionesDe(estado) {
    return POLICY.transiciones?.[estado] || [];
}

function rutaDeTransicion(desde, hasta) {
    if (desde === hasta) return [desde];
    if (transicionesDe(desde).includes(hasta)) return [desde, hasta];
    for (const intermedio of transicionesDe(desde)) {
        if (transicionesDe(intermedio).includes(hasta)) return [desde, intermedio, hasta];
    }
    return null;
}

async function cambiarEstado(tx, ticket, nuevoEstado, usuario, comentario, extra = {}) {
    if (ESTADOS_SOLO_HUMANOS.includes(nuevoEstado) || ESTADOS_SOLO_HUMANOS.includes(ticket.estado)) {
        throw new Error(`El agente no puede pasar un ticket de "${ticket.estado}" a "${nuevoEstado}": resolver, cerrar y reabrir se hace desde /tickets. Dejalo en "en_revision".`);
    }
    if (ticket.estado !== nuevoEstado && !rutaDeTransicion(ticket.estado, nuevoEstado)) {
        throw new Error(`Transición inválida: ${ticket.estado} → ${nuevoEstado}.`);
    }

    const data = { ...extra, estado: nuevoEstado };

    data.fechaResolucion = null;
    data.fechaCierre = null;

    const actualizado = await tx.ticket.update({ where: { id: ticket.id }, data });

    await tx.ticketHistorial.create({
        data: {
            ticketId: ticket.id,
            estadoAnterior: ticket.estado,
            estadoNuevo: nuevoEstado,
            usuario,
            comentario: comentario || null,
        },
    });

    return actualizado;
}

async function registrarEvento(tx, ticketId, tipo, payload) {
    await tx.ticketEventoAgente.create({
        data: {
            ticketId,
            agente: 'opencode',
            tipo,
            payload: payload || {},
        },
    });
}

// ── Herramientas ───────────────────────────────────────────────────
const TOOLS = [
    {
        name: 'tickets_policy',
        description: 'Devuelve la política vigente: reglas de auto-fix, rutas permitidas/prohibidas, categorías que requieren aprobación, verificaciones obligatorias y transiciones de estado. Llamala siempre antes de analizar o corregir un ticket.',
        inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
        name: 'tickets_list',
        description: 'Lista tickets de soporte con filtros. Devuelve una vista compacta ordenada por prioridad y fecha.',
        inputSchema: {
            type: 'object',
            properties: {
                estado: { type: 'string', description: 'Filtrar por estado exacto (nuevo, triaje, en_analisis, pendiente_aprobacion, listo_para_fix, en_progreso, en_revision, resuelto, cerrado, rechazado, duplicado).' },
                tipo: { type: 'string', description: 'Filtrar por tipo: error, funcionalidad, sugerencia, consulta.' },
                urgencia: { type: 'string', description: 'Filtrar por urgencia: critica, alta, media, baja.' },
                limit: { type: 'number', description: 'Máximo de tickets a devolver (por defecto 25, máximo 100).' },
            },
            required: [],
        },
    },
    {
        name: 'tickets_get',
        description: 'Devuelve el detalle completo de un ticket: descripción, contexto, análisis previo, historial, comentarios y eventos del agente.',
        inputSchema: {
            type: 'object',
            properties: {
                id: { type: 'string', description: 'ID o código del ticket (ej: TCK-2026-0001).' },
            },
            required: ['id'],
        },
    },
    {
        name: 'tickets_start_analysis',
        description: 'Marca el ticket como "en_analisis" y registra el inicio de la evaluación del agente.',
        inputSchema: {
            type: 'object',
            properties: {
                id: { type: 'string', description: 'ID o código del ticket.' },
            },
            required: ['id'],
        },
    },
    {
        name: 'tickets_record_analysis',
        description: 'Guarda el diagnóstico, el alcance estimado y el nivel de riesgo. Si el riesgo es bajo y el ticket lo permite, lo deja "listo_para_fix"; si no, lo pasa a "pendiente_aprobacion".',
        inputSchema: {
            type: 'object',
            properties: {
                id: { type: 'string', description: 'ID o código del ticket.' },
                resumen: { type: 'string', description: 'Diagnóstico breve en lenguaje claro.' },
                causaRaiz: { type: 'string', description: 'Causa raíz probable o confirmada.' },
                alcance: { type: 'string', description: 'Qué incluye y qué no incluye la solución.' },
                plan: { type: 'string', description: 'Pasos concretos de implementación.' },
                archivosProbables: { type: 'array', items: { type: 'string' }, description: 'Rutas relativas que probablemente haya que tocar.' },
                esfuerzo: { type: 'string', description: 'XS, S, M, L o XL.' },
                horas: { type: 'number', description: 'Estimación en horas.' },
                confianza: { type: 'string', description: 'alta, media o baja.' },
                riesgo: { type: 'string', description: 'bajo, medio, alto o critico.' },
                requiereAprobacion: { type: 'boolean', description: 'True si el cambio necesita decisión humana.' },
                categorias: { type: 'array', items: { type: 'string' }, description: 'Categorías de riesgo (migracion_esquema, permisos, facturacion, etc.).' },
            },
            required: ['id', 'resumen', 'riesgo', 'requiereAprobacion'],
        },
    },
    {
        name: 'tickets_check_change',
        description: 'Valida un cambio propuesto contra la política antes de editar. Devuelve si está permitido, si requiere aprobación y qué verificaciones ejecutar.',
        inputSchema: {
            type: 'object',
            properties: {
                archivos: { type: 'array', items: { type: 'string' }, description: 'Rutas relativas que se van a modificar.' },
                lineasAgregadas: { type: 'number', description: 'Cantidad estimada de líneas agregadas.' },
                lineasEliminadas: { type: 'number', description: 'Cantidad estimada de líneas eliminadas.' },
                categorias: { type: 'array', items: { type: 'string' }, description: 'Categorías de riesgo detectadas.' },
                migraciones: { type: 'boolean', description: 'True si incluye migración de base de datos.' },
                dependencias: { type: 'boolean', description: 'True si agrega o actualiza dependencias.' },
                diff: { type: 'string', description: 'Diff unificado opcional para escanear patrones prohibidos.' },
            },
            required: ['archivos'],
        },
    },
    {
        name: 'tickets_begin_fix',
        description: 'Inicia la corrección: valida guardrails, crea un respaldo de los archivos y pasa el ticket a "en_progreso". Si el cambio no es de riesgo bajo, lo escala a "pendiente_aprobacion" y no permite editar.',
        inputSchema: {
            type: 'object',
            properties: {
                id: { type: 'string', description: 'ID o código del ticket.' },
                archivos: { type: 'array', items: { type: 'string' }, description: 'Rutas relativas que se van a modificar.' },
                lineasAgregadas: { type: 'number', description: 'Cantidad estimada de líneas agregadas.' },
                lineasEliminadas: { type: 'number', description: 'Cantidad estimada de líneas eliminadas.' },
                categorias: { type: 'array', items: { type: 'string' }, description: 'Categorías de riesgo detectadas.' },
                migraciones: { type: 'boolean', description: 'True si incluye migración.' },
                dependencias: { type: 'boolean', description: 'True si incluye dependencias.' },
            },
            required: ['id', 'archivos'],
        },
    },
    {
        name: 'tickets_record_fix',
        description: 'Registra el cambio aplicado y las verificaciones ejecutadas. Pasa el ticket a "en_revision". No cierra el ticket.',
        inputSchema: {
            type: 'object',
            properties: {
                id: { type: 'string', description: 'ID o código del ticket.' },
                resumen: { type: 'string', description: 'Qué se cambió y por qué.' },
                archivos: { type: 'array', items: { type: 'string' }, description: 'Rutas modificadas.' },
                verificaciones: { type: 'array', items: { type: 'string' }, description: 'Comandos ejecutados y su resultado.' },
                commitHash: { type: 'string', description: 'Hash del commit local, si existe.' },
                rama: { type: 'string', description: 'Rama local, si existe.' },
            },
            required: ['id', 'resumen'],
        },
    },
    {
        name: 'tickets_add_comment',
        description: 'Agrega un comentario o nota interna al ticket.',
        inputSchema: {
            type: 'object',
            properties: {
                id: { type: 'string', description: 'ID o código del ticket.' },
                texto: { type: 'string', description: 'Contenido del comentario.' },
                autor: { type: 'string', description: 'Nombre visible del autor.' },
                interno: { type: 'boolean', description: 'True para nota interna del equipo.' },
            },
            required: ['id', 'texto'],
        },
    },
    {
        name: 'tickets_update_status',
        description: 'Cambia el estado de un ticket respetando la máquina de estados. No permite "resuelto" ni "cerrado": eso lo hace una persona desde /tickets.',
        inputSchema: {
            type: 'object',
            properties: {
                id: { type: 'string', description: 'ID o código del ticket.' },
                estado: { type: 'string', description: 'Nuevo estado.' },
                autor: { type: 'string', description: 'Quién realiza el cambio.' },
                comentario: { type: 'string', description: 'Motivo del cambio.' },
            },
            required: ['id', 'estado'],
        },
    },
    {
        name: 'tickets_escalate',
        description: 'Escala el ticket a "pendiente_aprobacion" con el motivo. Usalo cuando el riesgo sea medio/alto, falte información o el cambio sea grande.',
        inputSchema: {
            type: 'object',
            properties: {
                id: { type: 'string', description: 'ID o código del ticket.' },
                motivo: { type: 'string', description: 'Por qué se escala.' },
                riesgo: { type: 'string', description: 'bajo, medio, alto o critico.' },
                autor: { type: 'string', description: 'Quién escala.' },
            },
            required: ['id', 'motivo'],
        },
    },
];

// ── Utilidades de datos ────────────────────────────────────────────
async function buscarTicket(prisma, idOCodigo) {
    const ticket = await prisma.ticket.findFirst({
        where: {
            OR: [
                { id: String(idOCodigo) },
                { codigo: String(idOCodigo) },
            ],
        },
        include: {
            reportadoPor: { select: { id: true, nombreCompleto: true, role: true } },
            asignadoA: { select: { id: true, nombreCompleto: true, role: true } },
            historial: { orderBy: { createdAt: 'asc' } },
            comentarios: { orderBy: { createdAt: 'asc' } },
            eventosAgente: { orderBy: { createdAt: 'asc' } },
        },
    });

    if (!ticket) throw new Error(`No existe el ticket ${idOCodigo}.`);
    return ticket;
}

function ticketCompacto(t) {
    return {
        id: t.id,
        codigo: t.codigo,
        tipo: t.tipo,
        titulo: t.titulo,
        estado: t.estado,
        urgencia: t.urgencia,
        impacto: t.impacto,
        prioridad: t.prioridad,
        riesgo: t.riesgo,
        autoFixPermitido: t.autoFixPermitido,
        reportadoPor: t.reportadoPorNombre || t.reportadoPor?.nombreCompleto || null,
        asignadoA: t.asignadoANombre || t.asignadoA?.nombreCompleto || null,
        createdAt: t.createdAt,
        fechaResolucion: t.fechaResolucion,
        comentarios: t._count?.comentarios ?? undefined,
    };
}

// ── Handlers ───────────────────────────────────────────────────────
async function ejecutarTool(nombre, args) {
    // La política es estática: no debe exigir base de datos ni DATABASE_URL.
    if (nombre === 'tickets_policy') {
        return {
            version: POLICY.version,
            proyecto: POLICY.proyecto,
            autoFix: POLICY.autoFix,
            agente: POLICY.agente,
            transiciones: POLICY.transiciones,
            slaHoras: POLICY.slaHoras,
        };
    }

    const prisma = await getPrisma();

    if (nombre === 'tickets_list') {
        const where = {};
        if (args.estado) where.estado = args.estado;
        if (args.tipo) where.tipo = args.tipo;
        if (args.urgencia) where.urgencia = args.urgencia;

        const limite = Math.min(Number(args.limit || 25), 100);
        const tickets = await prisma.ticket.findMany({
            where,
            orderBy: [{ prioridad: 'asc' }, { createdAt: 'desc' }],
            take: limite,
            include: { _count: { select: { comentarios: true } } },
        });

        return { total: tickets.length, tickets: tickets.map(ticketCompacto) };
    }

    if (nombre === 'tickets_get') {
        return await buscarTicket(prisma, args.id);
    }

    if (nombre === 'tickets_start_analysis') {
        const ticket = await buscarTicket(prisma, args.id);
        if (ticket.estado === 'en_analisis') {
            return { ticket: ticketCompacto(ticket), mensaje: 'El ticket ya estaba en análisis.' };
        }
        if (!['nuevo', 'triaje'].includes(ticket.estado)) {
            return {
                ticket: ticketCompacto(ticket),
                mensaje: `El ticket ya está en "${ticket.estado}". No hace falta reiniciar el análisis.`,
            };
        }

        const actualizado = await prisma.$transaction(async tx => {
            await registrarEvento(tx, ticket.id, 'analisis', { inicio: true });
            return cambiarEstado(tx, ticket, 'en_analisis', 'opencode', 'Inicio de análisis automático.');
        });

        return { ticket: ticketCompacto(actualizado), mensaje: 'Análisis iniciado. Completalo con tickets_record_analysis.' };
    }

    if (nombre === 'tickets_record_analysis') {
        const ticket = await buscarTicket(prisma, args.id);
        const riesgo = String(args.riesgo || 'desconocido');
        const categorias = Array.isArray(args.categorias) ? args.categorias : [];
        const requiereAprobacion = args.requiereAprobacion === true;

        const analisis = {
            resumen: args.resumen || '',
            causaRaiz: args.causaRaiz || '',
            alcance: args.alcance || '',
            plan: args.plan || '',
            archivosProbables: Array.isArray(args.archivosProbables) ? args.archivosProbables : [],
            esfuerzo: args.esfuerzo || '',
            horas: Number(args.horas || 0),
            confianza: args.confianza || 'media',
            riesgo,
            requiereAprobacion,
            categorias,
            agente: 'opencode',
            fecha: new Date().toISOString(),
        };

        const puedeAutoFix =
            POLICY.autoFix?.enabled === true &&
            riesgo === 'bajo' &&
            !requiereAprobacion &&
            ticket.tipo === 'error' &&
            ticket.autoFixPermitido === true &&
            ['nuevo', 'triaje', 'en_analisis'].includes(ticket.estado);

        const destino = puedeAutoFix ? 'listo_para_fix' : 'pendiente_aprobacion';

        const actualizado = await prisma.$transaction(async tx => {
            await registrarEvento(tx, ticket.id, 'analisis', analisis);
            return cambiarEstado(
                tx,
                ticket,
                destino,
                'opencode',
                puedeAutoFix
                    ? 'Análisis completado. Riesgo bajo: habilitado para corrección automática.'
                    : 'Análisis completado. Requiere aprobación humana.',
                {
                    analisisAgente: analisis,
                    estimacion: {
                        esfuerzo: analisis.esfuerzo,
                        horas: analisis.horas,
                        confianza: analisis.confianza,
                        riesgo,
                    },
                    riesgo,
                }
            );
        });

        return {
            ticket: ticketCompacto(actualizado),
            analisis,
            decision: puedeAutoFix ? 'listo_para_fix' : 'pendiente_aprobacion',
            mensaje: puedeAutoFix
                ? 'Riesgo bajo aprobado. Llamá tickets_check_change y luego tickets_begin_fix.'
                : 'El ticket queda pendiente de aprobación humana. No edites código.',
        };
    }

    if (nombre === 'tickets_check_change') {
        return evaluarCambio(args);
    }

    if (nombre === 'tickets_begin_fix') {
        const ticket = await buscarTicket(prisma, args.id);

        if (!['listo_para_fix', 'en_progreso'].includes(ticket.estado)) {
            throw new Error(`El ticket está en "${ticket.estado}". Primero registrá el análisis y obtené aprobación (listo_para_fix).`);
        }

        if (ticket.estado !== 'en_progreso') {
            if (ticket.tipo !== 'error') {
                throw new Error('El auto-fix solo aplica a tickets de tipo "error".');
            }
            if (ticket.autoFixPermitido !== true) {
                throw new Error('El reportante no habilitó la corrección automática de este ticket.');
            }
            if (ticket.riesgo !== 'bajo') {
                throw new Error(`El riesgo registrado es "${ticket.riesgo}". El auto-fix solo aplica a riesgo bajo.`);
            }
        }

        const intentosMaximos = POLICY.autoFix?.maxAttempts || 2;
        if (ticket.intentosAgente >= intentosMaximos) {
            const actualizado = await prisma.$transaction(async tx => {
                await registrarEvento(tx, ticket.id, 'escalamiento', { motivo: 'max_intentos', intentos: ticket.intentosAgente });
                return cambiarEstado(tx, ticket, 'pendiente_aprobacion', 'opencode', 'Se alcanzó el máximo de intentos automáticos.', { riesgo: 'medio' });
            });
            return {
                permitido: false,
                ticket: ticketCompacto(actualizado),
                mensaje: `Se alcanzó el máximo de ${intentosMaximos} intentos automáticos. Se escaló a aprobación humana.`,
            };
        }

        const evaluacion = evaluarCambio(args);
        if (evaluacion.bloqueos.length > 0) {
            const actualizado = await prisma.$transaction(async tx => {
                await registrarEvento(tx, ticket.id, 'escalamiento', evaluacion);
                return cambiarEstado(tx, ticket, 'pendiente_aprobacion', 'opencode', 'Guardrails bloquearon el cambio automático.', { riesgo: evaluacion.riesgoSugerido });
            });
            return {
                permitido: false,
                evaluacion,
                ticket: ticketCompacto(actualizado),
                mensaje: 'Cambio bloqueado por la política. Se escaló a aprobación humana.',
            };
        }

        if (evaluacion.requiereAprobacion) {
            const actualizado = await prisma.$transaction(async tx => {
                await registrarEvento(tx, ticket.id, 'escalamiento', evaluacion);
                return cambiarEstado(tx, ticket, 'pendiente_aprobacion', 'opencode', 'El cambio excede el alcance del auto-fix.', { riesgo: evaluacion.riesgoSugerido });
            });
            return {
                permitido: false,
                evaluacion,
                ticket: ticketCompacto(actualizado),
                mensaje: 'El cambio requiere aprobación humana. No edites código hasta que se apruebe.',
            };
        }

        const respaldo = crearRespaldo(ticket.id, args.archivos || []);

        const actualizado = await prisma.$transaction(async tx => {
            await registrarEvento(tx, ticket.id, 'cambio', { fase: 'inicio', evaluacion, respaldo });
            return cambiarEstado(
                tx,
                ticket,
                'en_progreso',
                'opencode',
                'Corrección automática iniciada.',
                { riesgo: 'bajo', intentosAgente: { increment: 1 } }
            );
        });

        return {
            permitido: true,
            evaluacion,
            respaldo,
            ticket: ticketCompacto(actualizado),
            verificacionesRequeridas: POLICY.autoFix?.requiredChecks || [],
            mensaje: 'Corrección habilitada. Editá solo los archivos declarados y después llamá tickets_record_fix.',
        };
    }

    if (nombre === 'tickets_record_fix') {
        const ticket = await buscarTicket(prisma, args.id);
        if (ticket.estado !== 'en_progreso') {
            throw new Error(`El ticket está en "${ticket.estado}". Solo se registra un fix desde "en_progreso".`);
        }

        const verificaciones = Array.isArray(args.verificaciones) ? args.verificaciones : [];
        const requeridas = POLICY.autoFix?.requiredChecks || [];
        const faltantes = requeridas.filter(cmd => !verificaciones.some(v => String(v).includes(cmd)));

        const actualizado = await prisma.$transaction(async tx => {
            await registrarEvento(tx, ticket.id, 'validacion', {
                resumen: args.resumen,
                archivos: args.archivos || [],
                verificaciones,
                faltantes,
                commitHash: args.commitHash || null,
                rama: args.rama || null,
            });

            return cambiarEstado(tx, ticket, 'en_revision', 'opencode', 'Corrección aplicada, pendiente de revisión.', {
                resolucion: args.resumen || ticket.resolucion,
                commitHash: args.commitHash || null,
                rama: args.rama || null,
                verificado: faltantes.length === 0,
            });
        });

        return {
            ticket: ticketCompacto(actualizado),
            verificacionesFaltantes: faltantes,
            mensaje: faltantes.length === 0
                ? 'Fix registrado y verificaciones completas. El ticket queda en revisión.'
                : 'Fix registrado, pero faltan verificaciones obligatorias. El ticket queda en revisión sin verificar.',
        };
    }

    if (nombre === 'tickets_add_comment') {
        const ticket = await buscarTicket(prisma, args.id);
        const comentario = await prisma.ticketComentario.create({
            data: {
                ticketId: ticket.id,
                autor: args.autor || 'opencode',
                texto: String(args.texto || ''),
                interno: args.interno === true,
            },
        });
        return { comentario, mensaje: 'Comentario agregado.' };
    }

    if (nombre === 'tickets_update_status') {
        const ticket = await buscarTicket(prisma, args.id);
        const actualizado = await prisma.$transaction(async tx => {
            await registrarEvento(tx, ticket.id, 'nota', { estadoNuevo: args.estado, autor: args.autor || 'opencode' });
            return cambiarEstado(tx, ticket, args.estado, args.autor || 'opencode', args.comentario || null);
        });

        return { ticket: ticketCompacto(actualizado), mensaje: `Estado actualizado a ${args.estado}.` };
    }

    if (nombre === 'tickets_escalate') {
        const ticket = await buscarTicket(prisma, args.id);
        const riesgo = args.riesgo || 'medio';

        const actualizado = await prisma.$transaction(async tx => {
            await registrarEvento(tx, ticket.id, 'escalamiento', { motivo: args.motivo, riesgo });
            await tx.ticketComentario.create({
                data: {
                    ticketId: ticket.id,
                    autor: args.autor || 'opencode',
                    texto: `Escalado: ${args.motivo}`,
                    interno: true,
                },
            });
            return cambiarEstado(tx, ticket, 'pendiente_aprobacion', args.autor || 'opencode', args.motivo, { riesgo });
        });

        return { ticket: ticketCompacto(actualizado), mensaje: 'Ticket escalado a aprobación humana.' };
    }

    throw new Error(`Herramienta desconocida: ${nombre}`);
}

// ── Protocolo MCP ──────────────────────────────────────────────────
function enviar(payload) {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function responder(id, result) {
    enviar({ jsonrpc: '2.0', id, result });
}

function responderError(id, code, message, data) {
    enviar({ jsonrpc: '2.0', id, error: { code, message, ...(data ? { data } : {}) } });
}

const INSTRUCTIONS = `Sistema de tickets de soporte de HDB SGI.

Las herramientas de este servidor se llaman tickets_* (OpenCode puede exponerlas
como sgi_tickets_* o como tools.sgi.tickets_* según el modo).

Protocolo obligatorio para trabajar un ticket:
1. Llamá tickets_policy y respetá sus límites.
2. Leé el ticket con tickets_get. Si falta información, escalá con tickets_escalate; no inventes.
3. Marcá el inicio con tickets_start_analysis.
4. Guardá diagnóstico, causa raíz, alcance, esfuerzo, riesgo y plan con tickets_record_analysis.
5. Si el ticket queda en "listo_para_fix", validá los archivos con tickets_check_change y llamá tickets_begin_fix antes de editar.
6. Editá solo los archivos declarados y dentro de las rutas permitidas.
7. Ejecutá las verificaciones obligatorias (npx tsc --noEmit) y registralas con tickets_record_fix.
   Si el proyecto tiene configuración de ESLint, corré también npm run lint.
8. No cierres el ticket: dejalo en "en_revision" para validación humana.

Reglas duras:
- Riesgo bajo únicamente: máximo 4 archivos y 150 líneas.
- Nunca toques .env, prisma/schema.prisma, prisma/migrations, middleware.ts, electron, package.json ni scripts.
- Nunca ejecutes migraciones, db push, instalación de dependencias, commits, push, deploy ni comandos destructivos.
- Ante cualquier duda de seguridad, datos, permisos, facturación o alcance: tickets_escalate.
- Todo cambio debe ser reversible: tickets_begin_fix crea un respaldo en .sgi-backups.`;

async function manejarSolicitud(method, params) {
    switch (method) {
        case 'initialize':
            return {
                protocolVersion: params?.protocolVersion || '2024-11-05',
                capabilities: { tools: {}, resources: {} },
                serverInfo: { name: 'sgi-tickets', version: POLICY.version || '1.0.0' },
                instructions: INSTRUCTIONS,
            };

        case 'ping':
            return {};

        case 'tools/list':
            return { tools: TOOLS };

        case 'prompts/list':
            return { prompts: [] };

        case 'resources/templates/list':
            return { resourceTemplates: [] };

        case 'logging/setLevel':
            return {};

        case 'tools/call': {
            const nombre = params?.name;
            const args = params?.arguments || {};
            try {
                const resultado = await ejecutarTool(nombre, args);
                return {
                    content: [{ type: 'text', text: JSON.stringify(resultado, null, 2) }],
                };
            } catch (error) {
                log(`Error en ${nombre}:`, error.message);
                return {
                    content: [{ type: 'text', text: JSON.stringify({ error: error.message }, null, 2) }],
                    isError: true,
                };
            }
        }

        case 'resources/list':
            return {
                resources: [
                    {
                        uri: 'sgi://policy',
                        name: 'Política de tickets y auto-fix',
                        description: 'Reglas, rutas permitidas/prohibidas y transiciones de estado.',
                        mimeType: 'application/json',
                    },
                    {
                        uri: 'sgi://tickets/open',
                        name: 'Tickets abiertos',
                        description: 'Listado de tickets que todavía requieren trabajo.',
                        mimeType: 'application/json',
                    },
                ],
            };

        case 'resources/read': {
            const uri = params?.uri;
            if (uri === 'sgi://policy') {
                return {
                    contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(POLICY, null, 2) }],
                };
            }
            if (uri === 'sgi://tickets/open') {
                const prisma = await getPrisma();
                const tickets = await prisma.ticket.findMany({
                    where: { estado: { notIn: ['cerrado', 'rechazado', 'duplicado'] } },
                    orderBy: [{ prioridad: 'asc' }, { createdAt: 'desc' }],
                    take: 100,
                    include: { _count: { select: { comentarios: true } } },
                });
                return {
                    contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(tickets.map(ticketCompacto), null, 2) }],
                };
            }
            throw new Error(`Recurso desconocido: ${uri}`);
        }

        default:
            throw Object.assign(new Error(`Método no soportado: ${method}`), { code: -32601 });
    }
}

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });

rl.on('line', async line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let mensaje;
    try {
        mensaje = JSON.parse(trimmed);
    } catch {
        responderError(null, -32700, 'JSON inválido');
        return;
    }

    // Notificaciones (initialized, cancelled, etc.): no llevan respuesta.
    if (mensaje.id === undefined) return;

    try {
        const resultado = await manejarSolicitud(mensaje.method, mensaje.params);
        responder(mensaje.id, resultado);
    } catch (error) {
        responderError(mensaje.id, error.code || -32603, error.message || 'Error interno');
    }
});

rl.on('close', async () => {
    if (prismaClient) {
        try {
            await prismaClient.$disconnect();
        } catch {
            // Ignorado al cerrar.
        }
    }
    process.exit(0);
});

log(`Servidor MCP iniciado. Proyecto: ${PROJECT_ROOT}. Política v${POLICY.version}.`);
