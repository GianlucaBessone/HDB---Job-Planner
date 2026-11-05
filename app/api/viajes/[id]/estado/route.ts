import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { calcularResumen, formatFechaCorta } from '@/lib/viajes';
import { estadoSchema } from '@/lib/viajesSchemas';
import {
    cargarViaje, errorValidacion, esResponsable, getActor, noEncontrado, notificarViaje, prohibido, puedeVer, registrarHistorial, serializarViaje,
} from '@/lib/viajesServer';

export const dynamic = 'force-dynamic';

const conflicto = (msg: string) => NextResponse.json({ error: msg }, { status: 409 });

/**
 * Transiciones:
 *   iniciar   planificado → en_curso     responsable o gestor
 *   concluir  en_curso    → finalizado   responsable o gestor
 *   devolver  finalizado  → en_curso     gestor (con motivo)
 *   cerrar    finalizado  → cerrado      gestor (sin gastos pendientes)
 *   cancelar  planificado | en_curso → cancelado   gestor (con motivo)
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const actor = await getActor(req);
        const viaje = await cargarViaje(id);
        if (!viaje || !puedeVer(viaje, actor)) return noEncontrado();

        const parsed = estadoSchema.safeParse(await req.json());
        if (!parsed.success) return errorValidacion(parsed.error);
        const { accion } = parsed.data;
        const nota = parsed.data.nota?.trim() || null;

        const responsable = esResponsable(viaje, actor);
        const puedeOperar = responsable || actor.esGestor;

        let data: Record<string, any> = {};
        let detalle = nota || undefined;

        switch (accion) {
            case 'iniciar':
                if (!puedeOperar) return prohibido('Solo el responsable puede iniciar el viaje.');
                if (viaje.estado !== 'planificado') return conflicto('El viaje ya fue iniciado.');
                data = { estado: 'en_curso', fechaInicioReal: new Date() };
                break;

            case 'concluir':
                if (!puedeOperar) return prohibido('Solo el responsable puede concluir el viaje.');
                if (viaje.estado !== 'en_curso') return conflicto('Solo se concluye un viaje en curso.');
                data = { estado: 'finalizado', fechaConclusion: new Date(), notaConclusion: nota };
                break;

            case 'devolver':
                if (!actor.esGestor) return prohibido();
                if (viaje.estado !== 'finalizado') return conflicto('Solo se devuelve un viaje que está por rendir.');
                if (!nota || nota.length < 5) return NextResponse.json({ error: 'Indicá qué tiene que corregir el responsable.' }, { status: 400 });
                data = { estado: 'en_curso', fechaConclusion: null };
                break;

            case 'cancelar':
                if (!actor.esGestor) return prohibido();
                if (!['planificado', 'en_curso'].includes(viaje.estado)) return conflicto('Este viaje ya no se puede cancelar.');
                if (!nota || nota.length < 5) return NextResponse.json({ error: 'Indicá el motivo de la cancelación.' }, { status: 400 });
                data = { estado: 'cancelado' };
                break;

            case 'cerrar': {
                if (!actor.esGestor) return prohibido();
                if (viaje.estado !== 'finalizado') return conflicto('Solo se cierra un viaje que está por rendir.');
                const resumen = calcularResumen({ ...viaje, gastos: viaje.gastos });
                if (resumen.pendientes > 0) {
                    return conflicto(`Faltan verificar ${resumen.pendientes} gasto${resumen.pendientes === 1 ? '' : 's'}.`);
                }
                data = {
                    estado: 'cerrado',
                    fechaCierre: new Date(),
                    cerradoPorId: actor.userId,
                    cerradoPorNombre: actor.nombre,
                    observacionCierre: nota,
                    cierre: {
                        dias: resumen.dias,
                        personas: resumen.personas,
                        fechaFin: formatFechaCorta(viaje.fechaFin),
                        estimado: resumen.estimado,
                        gastado: resumen.gastado,
                        gastadoFondos: resumen.gastadoFondos,
                        gastadoPropio: resumen.gastadoPropio,
                        aprobado: resumen.aprobado,
                        rechazado: resumen.rechazado,
                        anticipo: resumen.anticipo,
                        resultado: resumen.resultado,
                        porPersona: resumen.porPersona,
                    },
                };
                const r = resumen.resultado;
                detalle = [
                    `Aprobado: $${resumen.aprobado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
                    r > 0 ? `devuelve el responsable $${r.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                        : r < 0 ? `reintegra la empresa $${(-r).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                            : 'sin saldo pendiente',
                    nota,
                ].filter(Boolean).join(' · ');
                break;
            }
        }

        const nombreAccion: Record<string, string> = {
            iniciar: 'iniciado', concluir: 'concluido', devolver: 'devuelto', cerrar: 'cerrado', cancelar: 'cancelado',
        };

        await prisma.$transaction(async (tx) => {
            // Evita dos transiciones simultáneas desde el mismo estado.
            const r = await tx.viaje.updateMany({ where: { id, estado: viaje.estado }, data });
            if (r.count === 0) throw new Error('CONFLICTO_ESTADO');
            await registrarHistorial(tx, id, actor, nombreAccion[accion], detalle);
        });

        await logAudit({
            userId: actor.userId || undefined, userName: actor.nombre,
            action: accion === 'cerrar' ? 'APPROVE' : 'UPDATE',
            entity: 'Viaje', entityId: id,
            oldValue: { estado: viaje.estado }, newValue: { estado: data.estado, nota },
        });

        const evento = ({ iniciar: 'iniciado', concluir: 'concluido', devolver: 'devuelto', cerrar: 'cerrado', cancelar: 'cancelado' } as const)[accion];
        await notificarViaje(viaje, actor, evento, detalle);

        const actualizado = await cargarViaje(id);
        return NextResponse.json(serializarViaje(actualizado!, actor));
    } catch (error: any) {
        if (error?.message === 'CONFLICTO_ESTADO') return conflicto('El viaje cambió de estado mientras tanto. Actualizá la vista.');
        console.error('[VIAJE_ESTADO]', error);
        return NextResponse.json({ error: 'Error al cambiar el estado del viaje.' }, { status: 500 });
    }
}
