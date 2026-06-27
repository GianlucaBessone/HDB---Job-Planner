import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSGIRole } from '@/lib/sgiAuth';
import { logAudit } from '@/lib/audit';
import { generateCodigoDataset } from '@/lib/codeGenerator';
import { validarSQL, calcularProximaEjecucion } from '@/lib/datasetEngine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const auth = requireSGIRole(req, ['supervisor', 'admin', 'qa']);
    if (auth.error) return auth.error;

    try {
        const { searchParams } = new URL(req.url);
        const estado = searchParams.get('estado');
        const habilitado = searchParams.get('habilitado');

        const where: any = {};
        if (estado) where.estado = estado;
        if (habilitado !== null && habilitado !== undefined) {
            where.habilitado = habilitado === 'true';
        }

        const datasets = await prisma.dataset.findMany({
            where,
            include: {
                responsable: { select: { id: true, nombreCompleto: true } },
                _count: { select: { kpisAsociados: true, historico: true, graficosAsociados: true } },
            },
            orderBy: { codigoDataset: 'asc' },
        });

        return NextResponse.json(datasets);
    } catch (error) {
        console.error('Error fetching datasets:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const auth = requireSGIRole(req, ['supervisor', 'admin']);
    if (auth.error) return auth.error;

    try {
        const body = await req.json();

        if (!body.nombre) {
            return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
        }

        // Validar SQL si se proporciona
        if (body.modoConsulta === 'SQL' && body.consultaSQL) {
            const validacion = validarSQL(body.consultaSQL);
            if (!validacion.valido) {
                return NextResponse.json({
                    error: 'SQL inválido',
                    detalles: validacion.errores,
                }, { status: 400 });
            }
        }

        const codigoDataset = await generateCodigoDataset();

        // Calcular próxima ejecución si es programada
        let proximaEjecucion: Date | null = null;
        if (body.tipoEjecucion === 'Programada' && body.frecuencia) {
            proximaEjecucion = calcularProximaEjecucion(body.frecuencia, body.horaEjecucion);
        }

        const dataset = await prisma.dataset.create({
            data: {
                codigoDataset,
                nombre: body.nombre,
                descripcion: body.descripcion || null,
                responsableId: body.responsableId || null,
                habilitado: body.habilitado !== false,
                modoConsulta: body.modoConsulta || 'SQL',
                consultaSQL: body.consultaSQL || null,
                definicionVisual: body.definicionVisual || null,
                variables: body.variables || [],
                tipoEjecucion: body.tipoEjecucion || 'Manual',
                cronExpresion: body.cronExpresion || null,
                frecuencia: body.frecuencia || null,
                horaEjecucion: body.horaEjecucion || null,
                zonaHoraria: body.zonaHoraria || 'America/Argentina/Buenos_Aires',
                proximaEjecucion,
                timeoutSegundos: body.timeoutSegundos || 30,
                limiteRegistros: body.limiteRegistros || 10000,
                usuarioCreacionId: auth.user.id,
            },
            include: {
                responsable: { select: { id: true, nombreCompleto: true } },
            },
        });

        await logAudit({
            userId: auth.user.id,
            action: 'CREATE',
            entity: 'DATASET',
            entityId: dataset.id,
            newValue: dataset,
        });

        return NextResponse.json(dataset, { status: 201 });
    } catch (error) {
        console.error('Error creating dataset:', error);
        return NextResponse.json({ error: 'Error del servidor al crear dataset' }, { status: 500 });
    }
}
