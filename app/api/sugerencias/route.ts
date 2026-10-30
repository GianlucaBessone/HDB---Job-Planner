import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { detectarTipoArchivo } from '@/lib/tipoArchivo';
import { verifyPin } from '@/lib/pinAuth';

export const dynamic = 'force-dynamic';

// Memory store for rate limits (brute force and anti-spam)
// Note: In serverless environments, this memory store will be local to the instance.
const failedAttempts = new Map<string, { count: number; lockUntil: number }>();
const ipSubmissions = new Map<string, number[]>();

// Configuration limits
// Vercel corta los cuerpos de más de 4,5 MB: el formulario viaja entero en un request.
const FILE_SIZE_LIMIT = 3 * 1024 * 1024; // 3MB por archivo
const TOTAL_FILES_LIMIT = 4 * 1024 * 1024; // 4MB entre todos
const MAX_FILES = 5;
const TIPOS_PERMITIDOS = ['png', 'jpeg', 'gif', 'webp', 'pdf', 'docx', 'xlsx', 'doc', 'xls', 'txt'];

// Helper to sanitize inputs
function sanitizeInput(str: string): string {
    if (!str) return '';
    return str.trim();
}

// Helper to generate custom ID: XXX-XXX-XXX
function generateSugerenciaId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const group = () => Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${group()}-${group()}-${group()}`;
}

export async function POST(req: Request) {
    try {
        const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
        
        // 1. Anti-spam check (Max 5 submissions per 10 minutes per IP)
        const now = Date.now();
        const tenMinutesAgo = now - 10 * 60 * 1000;
        const ipTimes = ipSubmissions.get(ip) || [];
        const recentSubmissions = ipTimes.filter(t => t > tenMinutesAgo);
        
        if (recentSubmissions.length >= 5) {
            return NextResponse.json({ 
                error: 'Límite de envíos excedido. Por favor, intente nuevamente más tarde.' 
            }, { status: 429 });
        }
        
        recentSubmissions.push(now);
        ipSubmissions.set(ip, recentSubmissions);

        const formData = await req.formData();

        const presentacion = formData.get('presentacion') as string;
        let usuarioId: string | null = null;

        // 2. Validate Authentication for Identified submissions
        if (presentacion === 'identificada') {
            const operatorId = formData.get('usuario_id') as string;
            const pin = formData.get('pin') as string;

            if (!operatorId || !pin) {
                return NextResponse.json({ error: 'Usuario y PIN son requeridos para la presentación identificada.' }, { status: 400 });
            }

            // Brute force check (Lock for 15 mins after 5 failed attempts)
            const attempts = failedAttempts.get(operatorId);
            if (attempts && attempts.count >= 5 && attempts.lockUntil > now) {
                const remainingMinutes = Math.ceil((attempts.lockUntil - now) / 60000);
                return NextResponse.json({ 
                    error: `Cuenta temporalmente bloqueada por demasiados intentos de PIN fallidos. Intente de nuevo en ${remainingMinutes} minutos.` 
                }, { status: 429 });
            }

            const operator = await prisma.operator.findUnique({
                where: { id: operatorId }
            });

            if (!operator || !verifyPin(pin, operator.pin) || !operator.activo) {
                const currentAttempts = attempts ? (attempts.lockUntil > now ? attempts.count : 0) : 0;
                const newCount = currentAttempts + 1;
                const lockUntil = newCount >= 5 ? now + 15 * 60 * 1000 : 0; // 15 mins lock
                
                failedAttempts.set(operatorId, { count: newCount, lockUntil });

                if (newCount >= 5) {
                    return NextResponse.json({ 
                        error: 'Demasiados intentos fallidos. PIN bloqueado por 15 minutos.' 
                    }, { status: 401 });
                }
                return NextResponse.json({ 
                    error: 'Clave de acceso (PIN) incorrecta.' 
                }, { status: 401 });
            }

            // Reset failed attempts on success
            failedAttempts.delete(operatorId);
            usuarioId = operatorId;
        }

        // 3. Retrieve and sanitize other fields
        const tipo_registro = sanitizeInput(formData.get('tipo_registro') as string);
        const titulo = sanitizeInput(formData.get('titulo') as string);
        const descripcion = sanitizeInput(formData.get('descripcion') as string);
        const area_involucrada = sanitizeInput(formData.get('area_involucrada') as string);
        
        let beneficios: string[] = [];
        try {
            const beneficiosRaw = formData.get('beneficios') as string;
            if (beneficiosRaw) {
                beneficios = JSON.parse(beneficiosRaw);
            }
            beneficios = beneficios.map(b => sanitizeInput(b));
        } catch (e) {
            beneficios = [];
        }

        const impacto_estimado = sanitizeInput(formData.get('impacto_estimado') as string);
        const propuesta_solucion = sanitizeInput(formData.get('propuesta_solucion') as string) || null;
        const frecuencia_problema = sanitizeInput(formData.get('frecuencia_problema') as string) || null;

        // Basic validations
        if (!tipo_registro || !titulo || !descripcion || !area_involucrada || !impacto_estimado) {
            return NextResponse.json({ error: 'Faltan campos obligatorios.' }, { status: 400 });
        }

        if (titulo.length > 150) {
            return NextResponse.json({ error: 'El título no puede superar los 150 caracteres.' }, { status: 400 });
        }

        // 4. File validation (se guardan en la base junto con la sugerencia)
        const files = formData.getAll('files').filter((f): f is File => f instanceof File && !!f.name && f.size > 0);
        const archivosValidados: Array<{ nombre: string; mime: string; datos: Buffer }> = [];

        if (files.length > MAX_FILES) {
            return NextResponse.json({ error: `Puedes adjuntar hasta ${MAX_FILES} archivos.` }, { status: 400 });
        }
        if (files.reduce((acc, f) => acc + f.size, 0) > TOTAL_FILES_LIMIT) {
            return NextResponse.json({ error: 'Los adjuntos superan los 4MB en total.' }, { status: 400 });
        }

        for (const file of files) {
            if (file.size > FILE_SIZE_LIMIT) {
                return NextResponse.json({
                    error: `El archivo ${file.name} supera el límite de tamaño permitido (${(FILE_SIZE_LIMIT / (1024 * 1024)).toFixed(0)}MB).`
                }, { status: 400 });
            }

            const datos = Buffer.from(await file.arrayBuffer());
            // El tipo se decide por el contenido y la extensión, no por lo que declara el navegador.
            const tipo = detectarTipoArchivo(datos, file.name, TIPOS_PERMITIDOS);
            if (!tipo) {
                return NextResponse.json({
                    error: `El tipo de archivo de ${file.name} no está permitido. Solo se permiten imágenes, PDF, Word, Excel o texto.`
                }, { status: 400 });
            }

            archivosValidados.push({ nombre: file.name.slice(0, 200), mime: tipo.mime, datos });
        }

        // 5. Create the database record
        let customId = generateSugerenciaId();
        // Ensure uniqueness (simple retry mechanism)
        for (let i = 0; i < 3; i++) {
            const existing = await prisma.sugerencia.findUnique({ where: { id: customId } });
            if (!existing) break;
            customId = generateSugerenciaId();
        }

        const sugerencia = await prisma.$transaction(async (tx) => {
          const creada = await tx.sugerencia.create({
            data: {
                id: customId,
                tipo_registro,
                titulo,
                descripcion,
                area_involucrada,
                beneficios: beneficios as any,
                impacto_estimado,
                propuesta_solucion,
                frecuencia_problema,
                presentacion,
                usuario_id: usuarioId,
                estado: 'Pendiente',
            }
          });

          const archivos = [];
          for (const a of archivosValidados) {
              const adj = await tx.sugerenciaAdjunto.create({
                  data: { sugerenciaId: creada.id, nombre: a.nombre, mime: a.mime, size: a.datos.length, datos: a.datos },
                  select: { id: true, nombre: true, size: true },
              });
              archivos.push({ ...adj, url: `/api/sugerencias/adjuntos/${adj.id}` });
          }

          return archivos.length > 0
              ? tx.sugerencia.update({ where: { id: creada.id }, data: { archivos_adjuntos: archivos as any } })
              : creada;
        });

        // 6. Write initial state change to audit history
        await prisma.sugerenciaHistorial.create({
            data: {
                sugerenciaId: sugerencia.id,
                estadoAnterior: '-',
                estadoNuevo: 'Pendiente',
                usuario: presentacion === 'identificada' ? 'Usuario Identificado' : 'Anónimo',
            }
        });

        return NextResponse.json(sugerencia);
    } catch (error: any) {
        console.error('Error al registrar idea/sugerencia/reclamo:', error);
        return NextResponse.json({ error: 'Error del servidor al registrar la propuesta.' }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const presentacion = url.searchParams.get('presentacion');
        const estado = url.searchParams.get('estado');

        const where: any = {};
        if (presentacion) where.presentacion = presentacion;
        if (estado) where.estado = estado;

        // Fetch suggestions and include related fields
        // Sensitivity: do not expose private operator fields such as PIN
        const sugerencias = await prisma.sugerencia.findMany({
            where,
            include: {
                usuario: {
                    select: {
                        id: true,
                        nombreCompleto: true,
                        role: true,
                        posicion: true
                    }
                },
                responsable: {
                    select: {
                        id: true,
                        nombreCompleto: true,
                        role: true,
                        posicion: true
                    }
                },
                comentarios: {
                    orderBy: { fecha: 'asc' }
                },
                historial: {
                    orderBy: { fecha: 'asc' }
                },
                acciones: {
                    include: {
                        responsable: {
                            select: { id: true, nombreCompleto: true }
                        }
                    },
                    orderBy: { createdAt: 'asc' }
                }
            },
            orderBy: { fecha_creacion: 'desc' }
        });

        return NextResponse.json(sugerencias);
    } catch (error) {
        console.error('Error fetching sugerencias:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}
