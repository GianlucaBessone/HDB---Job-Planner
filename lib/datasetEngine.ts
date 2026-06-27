import { prisma } from './prisma';

// ── Tipos ─────────────────────────────────────────────────────────────────

export interface VariableDefinicion {
    nombre: string;
    tipo: 'sistema' | 'personalizada';
    valorDefecto?: string;
}

export interface ResultadoDataset {
    datos: Record<string, any>[];
    schema: { nombre: string; tipo: string }[];
    cantidadRegistros: number;
    duracionMs: number;
    consultaEjecutada: string;
}

export interface DefinicionVisual {
    tablas: { nombreTabla: string; alias?: string }[];
    relaciones: {
        tablaOrigen: string;
        campoOrigen: string;
        tablaDestino: string;
        campoDestino: string;
        tipoJoin: 'INNER JOIN' | 'LEFT JOIN' | 'RIGHT JOIN' | 'FULL JOIN';
    }[];
    campos: {
        tabla: string;
        nombreCampo: string;
        alias?: string;
        funcion?: 'SUM' | 'COUNT' | 'AVG' | 'MIN' | 'MAX' | 'DISTINCT' | null;
    }[];
    filtros: {
        campo: string;         // tabla.campo
        operador: 'EQUAL' | 'NOT_EQUAL' | 'GREATER' | 'LESS' | 'GREATER_EQUAL' | 'LESS_EQUAL' | 'LIKE' | 'IN' | 'BETWEEN' | 'IS_NULL' | 'IS_NOT_NULL';
        valor?: string;
        valor2?: string;       // Para BETWEEN
        conector?: 'AND' | 'OR';
    }[];
    agrupaciones: { campo: string }[];  // tabla.campo
    ordenamiento: { campo: string; direccion: 'ASC' | 'DESC' }[];
    limite?: number;
}

// ── Sentencias prohibidas ─────────────────────────────────────────────────

const SENTENCIAS_PROHIBIDAS = [
    'DROP', 'ALTER', 'CREATE', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE',
    'GRANT', 'REVOKE', 'COPY', 'EXECUTE', 'VACUUM', 'REINDEX',
];

// ── Variables del sistema ─────────────────────────────────────────────────

function resolverVariablesSistema(sql: string, variables?: VariableDefinicion[]): string {
    const now = new Date();
    const año = now.getFullYear();
    const mes = String(now.getMonth() + 1).padStart(2, '0');
    const dia = String(now.getDate()).padStart(2, '0');

    const inicioMes = `${año}-${mes}-01`;
    const finMes = new Date(año, now.getMonth() + 1, 0);
    const finMesStr = `${año}-${mes}-${String(finMes.getDate()).padStart(2, '0')}`;

    let resultado = sql;

    // Variables del sistema
    resultado = resultado.replace(/\{\{FECHA_ACTUAL\}\}/gi, `'${año}-${mes}-${dia}'`);
    resultado = resultado.replace(/\{\{MES_ACTUAL\}\}/gi, `${now.getMonth() + 1}`);
    resultado = resultado.replace(/\{\{AÑO_ACTUAL\}\}/gi, `${año}`);
    resultado = resultado.replace(/\{\{ANIO_ACTUAL\}\}/gi, `${año}`);
    resultado = resultado.replace(/\{\{INICIO_MES\}\}/gi, `'${inicioMes}'`);
    resultado = resultado.replace(/\{\{FIN_MES\}\}/gi, `'${finMesStr}'`);
    resultado = resultado.replace(/\{\{DIA_ACTUAL\}\}/gi, `${now.getDate()}`);

    // Variables personalizadas
    if (variables && Array.isArray(variables)) {
        for (const v of variables) {
            if (v.nombre && v.valorDefecto !== undefined) {
                const regex = new RegExp(`\\{\\{${v.nombre}\\}\\}`, 'gi');
                resultado = resultado.replace(regex, v.valorDefecto);
            }
        }
    }

    return resultado;
}

// ── Validación SQL ────────────────────────────────────────────────────────

export function validarSQL(sql: string): { valido: boolean; errores: string[] } {
    const errores: string[] = [];

    if (!sql || sql.trim().length === 0) {
        errores.push('La consulta SQL está vacía');
        return { valido: false, errores };
    }

    // Normalizar para detección
    const sqlUpper = sql.toUpperCase().replace(/\s+/g, ' ').trim();

    // Detectar sentencias prohibidas
    for (const sentencia of SENTENCIAS_PROHIBIDAS) {
        // Match como palabra completa al inicio o después de ;
        const regex = new RegExp(`(^|;\\s*)${sentencia}\\s`, 'i');
        if (regex.test(sqlUpper)) {
            errores.push(`Sentencia "${sentencia}" no está permitida. Solo se permiten consultas de lectura (SELECT).`);
        }
    }

    // Verificar que empiece con SELECT o WITH (CTEs)
    if (!sqlUpper.startsWith('SELECT') && !sqlUpper.startsWith('WITH')) {
        errores.push('La consulta debe comenzar con SELECT o WITH');
    }

    // Detectar comentarios de inyección
    if (sql.includes('--') && sql.indexOf('--') < sql.length - 3) {
        // Permitir -- al final, pero no inyección de comentarios
    }

    return { valido: errores.length === 0, errores };
}

// ── Construir SQL desde definición visual ─────────────────────────────────

export function construirSQLDesdeVisual(definicion: DefinicionVisual): string {
    if (!definicion.tablas || definicion.tablas.length === 0) {
        throw new Error('Se requiere al menos una tabla');
    }
    if (!definicion.campos || definicion.campos.length === 0) {
        throw new Error('Se requiere al menos un campo');
    }

    const partes: string[] = [];

    // SELECT
    const selectCampos = definicion.campos.map(c => {
        const tablaRef = c.tabla ? `"${c.tabla}".` : '';
        const campo = `${tablaRef}"${c.nombreCampo}"`;

        if (c.funcion) {
            if (c.funcion === 'DISTINCT') {
                return `DISTINCT ${campo}${c.alias ? ` AS "${c.alias}"` : ''}`;
            }
            return `${c.funcion}(${campo})${c.alias ? ` AS "${c.alias}"` : ''}`;
        }

        return `${campo}${c.alias ? ` AS "${c.alias}"` : ''}`;
    });
    partes.push(`SELECT ${selectCampos.join(', ')}`);

    // FROM
    const tablaPrincipal = definicion.tablas[0];
    partes.push(`FROM "${tablaPrincipal.nombreTabla}"`);

    // JOINs
    if (definicion.relaciones && definicion.relaciones.length > 0) {
        for (const rel of definicion.relaciones) {
            const tipoJoin = rel.tipoJoin || 'INNER JOIN';
            partes.push(`${tipoJoin} "${rel.tablaDestino}" ON "${rel.tablaOrigen}"."${rel.campoOrigen}" = "${rel.tablaDestino}"."${rel.campoDestino}"`);
        }
    }

    // WHERE
    if (definicion.filtros && definicion.filtros.length > 0) {
        const condiciones: string[] = [];
        for (let i = 0; i < definicion.filtros.length; i++) {
            const filtro = definicion.filtros[i];
            const campo = filtro.campo.includes('.') 
                ? filtro.campo.split('.').map(p => `"${p}"`).join('.')
                : `"${filtro.campo}"`;

            let condicion = '';
            switch (filtro.operador) {
                case 'EQUAL': condicion = `${campo} = '${escapeSQLString(filtro.valor || '')}'`; break;
                case 'NOT_EQUAL': condicion = `${campo} != '${escapeSQLString(filtro.valor || '')}'`; break;
                case 'GREATER': condicion = `${campo} > '${escapeSQLString(filtro.valor || '')}'`; break;
                case 'LESS': condicion = `${campo} < '${escapeSQLString(filtro.valor || '')}'`; break;
                case 'GREATER_EQUAL': condicion = `${campo} >= '${escapeSQLString(filtro.valor || '')}'`; break;
                case 'LESS_EQUAL': condicion = `${campo} <= '${escapeSQLString(filtro.valor || '')}'`; break;
                case 'LIKE': condicion = `${campo} LIKE '${escapeSQLString(filtro.valor || '')}'`; break;
                case 'IN': condicion = `${campo} IN (${(filtro.valor || '').split(',').map(v => `'${escapeSQLString(v.trim())}'`).join(', ')})`; break;
                case 'BETWEEN': condicion = `${campo} BETWEEN '${escapeSQLString(filtro.valor || '')}' AND '${escapeSQLString(filtro.valor2 || '')}'`; break;
                case 'IS_NULL': condicion = `${campo} IS NULL`; break;
                case 'IS_NOT_NULL': condicion = `${campo} IS NOT NULL`; break;
            }

            if (i > 0 && filtro.conector) {
                condiciones.push(`${filtro.conector} ${condicion}`);
            } else {
                condiciones.push(condicion);
            }
        }
        partes.push(`WHERE ${condiciones.join(' ')}`);
    }

    // GROUP BY
    const tieneAgregacion = definicion.campos.some(c => c.funcion && c.funcion !== 'DISTINCT');
    let gruposManuales = (definicion.agrupaciones || []).map(g => g.campo);

    if (tieneAgregacion) {
        // Auto-group by all non-aggregated fields if any aggregation exists
        const camposNoAgregados = definicion.campos
            .filter(c => !c.funcion || c.funcion === 'DISTINCT')
            .map(c => c.tabla ? `"${c.tabla}"."${c.nombreCampo}"` : `"${c.nombreCampo}"`);
        
        if (camposNoAgregados.length > 0) {
            partes.push(`GROUP BY ${camposNoAgregados.join(', ')}`);
        }
    } else if (gruposManuales.length > 0) {
        const gruposFormateados = gruposManuales.map(campo => {
            return campo.includes('.')
                ? campo.split('.').map(p => `"${p}"`).join('.')
                : `"${campo}"`;
        });
        partes.push(`GROUP BY ${gruposFormateados.join(', ')}`);
    }

    // ORDER BY
    if (definicion.ordenamiento && definicion.ordenamiento.length > 0) {
        const ordenes = definicion.ordenamiento.map(o => {
            const campo = o.campo.includes('.')
                ? o.campo.split('.').map(p => `"${p}"`).join('.')
                : `"${o.campo}"`;
            return `${campo} ${o.direccion || 'ASC'}`;
        });
        partes.push(`ORDER BY ${ordenes.join(', ')}`);
    }

    // LIMIT
    if (definicion.limite && definicion.limite > 0) {
        partes.push(`LIMIT ${definicion.limite}`);
    }

    return partes.join('\n');
}

function escapeSQLString(value: string): string {
    return value.replace(/'/g, "''");
}

// ── Testear SQL en Vivo ───────────────────────────────────────────────────

export async function testearSQL(sql: string, opciones?: { variables?: VariableDefinicion[], limite?: number }): Promise<ResultadoDataset> {
    let sqlEjecutar = resolverVariablesSistema(sql, opciones?.variables);

    const validacion = validarSQL(sqlEjecutar);
    if (!validacion.valido) {
        throw new Error(`SQL inválido: ${validacion.errores.join('. ')}`);
    }

    const limite = opciones?.limite || 10;
    if (!sqlEjecutar.toUpperCase().includes('LIMIT')) {
        sqlEjecutar = `${sqlEjecutar}\nLIMIT ${limite}`;
    }

    const inicio = Date.now();
    let datos: Record<string, any>[] = [];

    try {
        const timeoutMs = 15000; // 15s max for testing
        await prisma.$executeRawUnsafe(`SET statement_timeout = ${timeoutMs}`);
        datos = await prisma.$queryRawUnsafe<Record<string, any>[]>(sqlEjecutar);
        await prisma.$executeRawUnsafe(`SET statement_timeout = 0`);
    } catch (err: any) {
        try { await prisma.$executeRawUnsafe(`SET statement_timeout = 0`); } catch {}
        throw new Error(err.message || 'Error al ejecutar la consulta de prueba');
    }

    const duracionMs = Date.now() - inicio;

    const schema = datos.length > 0
        ? Object.keys(datos[0]).map(key => ({
            nombre: key,
            tipo: detectarTipo(datos[0][key]),
        }))
        : [];

    const datosSerializados = datos.map(row => {
        const newRow: Record<string, any> = {};
        for (const [key, val] of Object.entries(row)) {
            newRow[key] = typeof val === 'bigint' ? Number(val) : val;
        }
        return newRow;
    });

    return {
        datos: datosSerializados,
        schema,
        cantidadRegistros: datosSerializados.length,
        duracionMs,
        consultaEjecutada: sqlEjecutar,
    };
}

// ── Ejecutar Dataset ──────────────────────────────────────────────────────

export async function ejecutarDataset(
    datasetId: string,
    opciones?: {
        preview?: boolean;       // Si true, añade LIMIT 10 y no registra
        usuarioId?: string;
        tipo?: 'Manual' | 'Programada';
    }
): Promise<ResultadoDataset> {
    const dataset = await prisma.dataset.findUnique({
        where: { id: datasetId },
    });

    if (!dataset) {
        throw new Error('Dataset no encontrado');
    }

    // 1. Obtener SQL
    let sql: string;
    if (dataset.modoConsulta === 'Visual' && dataset.definicionVisual) {
        sql = construirSQLDesdeVisual(dataset.definicionVisual as unknown as DefinicionVisual);
    } else if (dataset.consultaSQL) {
        sql = dataset.consultaSQL;
    } else {
        throw new Error('El dataset no tiene una consulta definida');
    }

    // 2. Resolver variables
    const variables = (dataset.variables as unknown as VariableDefinicion[]) || [];
    sql = resolverVariablesSistema(sql, variables);

    // 3. Validar SQL
    const validacion = validarSQL(sql);
    if (!validacion.valido) {
        throw new Error(`SQL inválido: ${validacion.errores.join('. ')}`);
    }

    // 4. Aplicar límite
    const limite = opciones?.preview ? 10 : (dataset.limiteRegistros || 10000);
    if (!sql.toUpperCase().includes('LIMIT')) {
        sql = `${sql}\nLIMIT ${limite}`;
    }

    // 5. Ejecutar con timeout
    const inicio = Date.now();
    let datos: Record<string, any>[] = [];
    let error: string | null = null;
    let estado = 'Exitosa';

    try {
        const timeoutMs = (dataset.timeoutSegundos || 30) * 1000;
        
        // Set statement timeout for this query
        await prisma.$executeRawUnsafe(`SET statement_timeout = ${timeoutMs}`);
        
        datos = await prisma.$queryRawUnsafe<Record<string, any>[]>(sql);
        
        // Reset timeout
        await prisma.$executeRawUnsafe(`SET statement_timeout = 0`);
    } catch (err: any) {
        estado = err.message?.includes('timeout') ? 'Timeout' : 'Error';
        error = err.message || 'Error desconocido al ejecutar la consulta';
        
        // Reset timeout on error
        try { await prisma.$executeRawUnsafe(`SET statement_timeout = 0`); } catch {}
    }

    const duracionMs = Date.now() - inicio;

    // 6. Extraer schema del resultado
    const schema = datos.length > 0
        ? Object.keys(datos[0]).map(key => ({
            nombre: key,
            tipo: detectarTipo(datos[0][key]),
        }))
        : [];

    // 7. Serializar BigInt a number para evitar errores de JSON
    const datosSerializados = datos.map(row => {
        const newRow: Record<string, any> = {};
        for (const [key, val] of Object.entries(row)) {
            newRow[key] = typeof val === 'bigint' ? Number(val) : val;
        }
        return newRow;
    });

    const resultado: ResultadoDataset = {
        datos: datosSerializados,
        schema,
        cantidadRegistros: datosSerializados.length,
        duracionMs,
        consultaEjecutada: sql,
    };

    // 8. Registrar ejecución (si no es preview)
    if (!opciones?.preview) {
        await prisma.datasetEjecucion.create({
            data: {
                datasetId,
                duracionMs,
                cantidadRegistros: datosSerializados.length,
                estado,
                mensajeError: error,
                consultaEjecutada: sql,
                usuarioId: opciones?.usuarioId || null,
                tipo: opciones?.tipo || 'Manual',
            },
        });

        // Actualizar el dataset con el último resultado
        if (estado === 'Exitosa') {
            await prisma.dataset.update({
                where: { id: datasetId },
                data: {
                    ultimoResultado: datosSerializados as any,
                    ultimoSchema: schema as any,
                    ultimaEjecucion: new Date(),
                    estado: 'Activo',
                },
            });
        } else {
            await prisma.dataset.update({
                where: { id: datasetId },
                data: {
                    ultimaEjecucion: new Date(),
                    estado: 'Error',
                },
            });
        }
    }

    if (estado !== 'Exitosa' && !opciones?.preview) {
        throw new Error(error || 'Error al ejecutar el dataset');
    }

    return resultado;
}

// ── Extraer valor para KPI ────────────────────────────────────────────────

export function extraerValorParaKpi(
    datos: Record<string, any>[],
    campoValor: string,
    funcionAgregacion?: string | null
): number | null {
    if (!datos || datos.length === 0) return null;

    const valores = datos
        .map(row => {
            const val = row[campoValor];
            return typeof val === 'number' ? val : parseFloat(val);
        })
        .filter(v => !isNaN(v));

    if (valores.length === 0) return null;

    switch (funcionAgregacion?.toUpperCase()) {
        case 'SUM': return valores.reduce((a, b) => a + b, 0);
        case 'AVG': return valores.reduce((a, b) => a + b, 0) / valores.length;
        case 'COUNT': return valores.length;
        case 'MIN': return Math.min(...valores);
        case 'MAX': return Math.max(...valores);
        case 'LAST': return valores[0]; // Already sorted desc in most queries
        default: return valores[0]; // Sin agregación: primer valor
    }
}

// ── Calcular próxima ejecución ────────────────────────────────────────────

export function calcularProximaEjecucion(
    frecuencia: string,
    horaEjecucion?: string | null
): Date {
    const ahora = new Date();
    const proxima = new Date(ahora);

    // Parsear hora
    if (horaEjecucion) {
        const [h, m] = horaEjecucion.split(':').map(Number);
        proxima.setHours(h, m, 0, 0);
    }

    switch (frecuencia) {
        case 'Cada hora':
            proxima.setHours(ahora.getHours() + 1, 0, 0, 0);
            break;
        case 'Diario':
            if (proxima <= ahora) proxima.setDate(proxima.getDate() + 1);
            break;
        case 'Semanal':
            proxima.setDate(proxima.getDate() + (7 - proxima.getDay()) % 7 || 7);
            break;
        case 'Mensual':
            proxima.setMonth(proxima.getMonth() + 1, 1);
            break;
        default:
            proxima.setDate(proxima.getDate() + 1);
            break;
    }

    return proxima;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function detectarTipo(valor: any): string {
    if (valor === null || valor === undefined) return 'null';
    if (typeof valor === 'number') return 'number';
    if (typeof valor === 'bigint') return 'number';
    if (typeof valor === 'boolean') return 'boolean';
    if (valor instanceof Date) return 'date';
    if (typeof valor === 'string') {
        // Check if it looks like a date
        if (/^\d{4}-\d{2}-\d{2}/.test(valor)) return 'date';
        return 'string';
    }
    if (typeof valor === 'object') return 'json';
    return 'string';
}
