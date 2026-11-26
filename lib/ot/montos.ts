/**
 * Montos de órdenes de trabajo.
 *
 * Valor hora, mano de obra, precios de materiales y totales solo los ve quien tiene
 * la función `ot.ver_montos` (por defecto admin y supervisor). Para el resto, la API
 * devuelve esos campos en null: no alcanza con ocultarlos en pantalla.
 */

const CAMPOS_CICLO = ['totalManoObra', 'totalMateriales', 'totalGeneral'] as const;
const CAMPOS_OPERADOR = ['valorHoraSnapshot', 'costoManoObra'] as const;
const CAMPOS_MATERIAL = ['precioBaseSnapshot', 'porcentajeClienteSnapshot', 'precioFinalSnapshot', 'importeTotal'] as const;

function anular<T extends Record<string, any>>(obj: T, campos: readonly string[]): T {
  const copia: Record<string, any> = { ...obj };
  for (const c of campos) if (c in copia) copia[c] = null;
  return copia as T;
}

/** Copia del ciclo sin montos (en sus operadores y materiales también). */
export function cicloSinMontos<T extends Record<string, any>>(ciclo: T): T {
  const c: Record<string, any> = anular(ciclo, CAMPOS_CICLO);
  if (Array.isArray(c.operadores)) c.operadores = c.operadores.map((o: any) => anular(o, CAMPOS_OPERADOR));
  if (Array.isArray(c.materiales)) c.materiales = c.materiales.map((m: any) => anular(m, CAMPOS_MATERIAL));
  // Los datos canónicos del sellado incluyen montos.
  if ('datosCanonicos' in c) c.datosCanonicos = null;
  return c as T;
}

/** Copia de la OT sin montos. */
export function otSinMontos<T extends Record<string, any>>(ot: T): T {
  if (!Array.isArray(ot.ciclos)) return ot;
  return { ...ot, ciclos: ot.ciclos.map((c: any) => cicloSinMontos(c)) };
}
