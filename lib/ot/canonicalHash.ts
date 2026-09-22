import crypto from 'crypto';

export interface CanonicalCicloData {
  esquemaVersion: string;
  numeroOT: string;
  refCliente: string;
  clienteNombre: string;
  proyectoNombre: string;
  sector: string;
  reporteTrabajo: string;
  numeroCiclo: number;
  periodo: string;
  tipoCierre: string;
  firmanteNombre: string;
  fechaFirma: string;
  operadores: {
    operadorNombre: string;
    horas: string;
    valorHora: string;
    subtotal: string;
  }[];
  materiales: {
    codigo: string;
    descripcion: string;
    cantidad: string;
    metros: string;
    precioFinal: string;
    subtotal: string;
  }[];
  totales: {
    totalHoras: string;
    totalManoObra: string;
    totalMateriales: string;
    totalGeneral: string;
  };
}

/**
 * Builds a deterministic, sorted JSON string from a canonical object.
 */
export function stringifyCanonical(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map((item) => stringifyCanonical(item)).join(',') + ']';
  }
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map((k) => `${JSON.stringify(k)}:${stringifyCanonical(obj[k])}`);
  return '{' + pairs.join(',') + '}';
}

/**
 * Computes the SHA-256 hex digest of a canonical string.
 */
export function computeSha256(canonicalString: string): string {
  return crypto.createHash('sha256').update(canonicalString, 'utf8').digest('hex');
}

/**
 * Prepares the canonical data object and returns both the deterministic string and its SHA-256 hash.
 */
export function generateCanonicalHash(params: {
  numeroOT: string;
  refCliente?: string | null;
  clienteNombre: string;
  proyectoNombre: string;
  sector?: string | null;
  reporteTrabajo: string;
  numeroCiclo: number;
  periodo: string;
  tipoCierre: string;
  firmanteNombre: string;
  fechaFirma: Date | string;
  operadores: {
    operadorNombre: string;
    horas: number;
    valorHoraSnapshot: number;
    costoManoObra: number;
  }[];
  materiales: {
    materialCodigo: string;
    descripcion: string;
    cantidad: number;
    metros?: number | null;
    precioFinalSnapshot: number;
    importeTotal: number;
  }[];
  totales: {
    totalHoras: number;
    totalManoObra: number;
    totalMateriales: number;
    totalGeneral: number;
  };
}): { canonicalString: string; hash: string; canonicalData: CanonicalCicloData } {
  const fechaFirmaIso = params.fechaFirma instanceof Date ? params.fechaFirma.toISOString() : new Date(params.fechaFirma).toISOString();

  const sortedOperadores = [...params.operadores]
    .map((op) => ({
      operadorNombre: op.operadorNombre.trim(),
      horas: op.horas.toFixed(2),
      valorHora: op.valorHoraSnapshot.toFixed(2),
      subtotal: op.costoManoObra.toFixed(2),
    }))
    .sort((a, b) => a.operadorNombre.localeCompare(b.operadorNombre));

  const sortedMateriales = [...params.materiales]
    .map((mat) => ({
      codigo: mat.materialCodigo.trim(),
      descripcion: mat.descripcion.trim(),
      cantidad: mat.cantidad.toFixed(2),
      metros: (mat.metros ?? 0).toFixed(2),
      precioFinal: mat.precioFinalSnapshot.toFixed(2),
      subtotal: mat.importeTotal.toFixed(2),
    }))
    .sort((a, b) => a.codigo.localeCompare(b.codigo) || a.descripcion.localeCompare(b.descripcion));

  const canonicalData: CanonicalCicloData = {
    esquemaVersion: '1.0',
    numeroOT: params.numeroOT.trim(),
    refCliente: (params.refCliente || '').trim(),
    clienteNombre: params.clienteNombre.trim(),
    proyectoNombre: params.proyectoNombre.trim(),
    sector: (params.sector || '').trim(),
    reporteTrabajo: params.reporteTrabajo.trim(),
    numeroCiclo: params.numeroCiclo,
    periodo: params.periodo.trim(),
    tipoCierre: params.tipoCierre.trim(),
    firmanteNombre: params.firmanteNombre.trim(),
    fechaFirma: fechaFirmaIso,
    operadores: sortedOperadores,
    materiales: sortedMateriales,
    totales: {
      totalHoras: params.totales.totalHoras.toFixed(2),
      totalManoObra: params.totales.totalManoObra.toFixed(2),
      totalMateriales: params.totales.totalMateriales.toFixed(2),
      totalGeneral: params.totales.totalGeneral.toFixed(2),
    },
  };

  const canonicalString = stringifyCanonical(canonicalData);
  const hash = computeSha256(canonicalString);

  return { canonicalString, hash, canonicalData };
}

/**
 * Verifies the integrity of a signed cycle by comparing its stored hash against the hash recomputed
 * from its canonical data or current DB state.
 */
export function verifyCycleIntegrity(storedHash: string, canonicalString: string): {
  valido: boolean;
  hashAlmacenado: string;
  hashCalculado: string;
} {
  const hashCalculado = computeSha256(canonicalString);
  return {
    valido: storedHash.toLowerCase() === hashCalculado.toLowerCase(),
    hashAlmacenado: storedHash,
    hashCalculado,
  };
}
