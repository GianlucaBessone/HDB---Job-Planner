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
        operador: 'EQUAL' | 'NOT_EQUAL' | 'GREATER' | 'LESS' | 'GREATER_EQUAL' | 'LESS_EQUAL' | 'LIKE' | 'ILIKE' | 'NOT_LIKE' | 'IN' | 'NOT_IN' | 'BETWEEN' | 'IS_NULL' | 'IS_NOT_NULL';
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

    const ayerDate = new Date(now);
    ayerDate.setDate(ayerDate.getDate() - 1);
    const ayerStr = `${ayerDate.getFullYear()}-${String(ayerDate.getMonth() + 1).padStart(2, '0')}-${String(ayerDate.getDate()).padStart(2, '0')}`;

    const d7 = new Date(now);
    d7.setDate(d7.getDate() - 7);
    const d7Str = `${d7.getFullYear()}-${String(d7.getMonth() + 1).padStart(2, '0')}-${String(d7.getDate()).padStart(2, '0')}`;

    const d30 = new Date(now);
    d30.setDate(d30.getDate() - 30);
    const d30Str = `${d30.getFullYear()}-${String(d30.getMonth() + 1).padStart(2, '0')}-${String(d30.getDate()).padStart(2, '0')}`;

    let resultado = sql;

    // Helper to replace both quoted '{{VAR}}' and unquoted {{VAR}} with a single safe quoted string `'${val}'`
    const replaceDateVar = (varName: string, dateVal: string) => {
        const regex = new RegExp(`'?(?:\\{\\{${varName}\\}\\})'?`, 'gi');
        resultado = resultado.replace(regex, `'${dateVal}'`);
    };

    // Date variables (always evaluated as safe quoted string literal)
    replaceDateVar('FECHA_ACTUAL', `${año}-${mes}-${dia}`);
    replaceDateVar('INICIO_MES', inicioMes);
    replaceDateVar('FIN_MES', finMesStr);
    replaceDateVar('AYER', ayerStr);
    replaceDateVar('HACE_7_DIAS', d7Str);
    replaceDateVar('HACE_30_DIAS', d30Str);
    replaceDateVar('INICIO_AÑO', `${año}-01-01`);
    replaceDateVar('INICIO_ANIO', `${año}-01-01`);
    replaceDateVar('FIN_AÑO', `${año}-12-31`);
    replaceDateVar('FIN_ANIO', `${año}-12-31`);

    // Numeric / integer variables (evaluated as numbers)
    resultado = resultado.replace(/\{\{MES_ACTUAL\}\}/gi, `${now.getMonth() + 1}`);
    resultado = resultado.replace(/\{\{AÑO_ACTUAL\}\}/gi, `${año}`);
    resultado = resultado.replace(/\{\{ANIO_ACTUAL\}\}/gi, `${año}`);
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

    // 1. Remove comments (both multi-line /* ... */ and single-line -- ...)
    const sinComentarios = sql
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/--.*$/gm, ' ')
        .trim();

    if (!sinComentarios) {
        errores.push('La consulta SQL está vacía o solo contiene comentarios');
        return { valido: false, errores };
    }

    // 2. Disallow multiple statements separated by semicolon (strip string literals first)
    const sinStrings = sinComentarios.replace(/'(?:''|[^'])*'/g, "''");
    const partesSemicolon = sinStrings.split(';').map(p => p.trim()).filter(Boolean);
    if (partesSemicolon.length > 1) {
        errores.push('No se permiten múltiples sentencias encadenadas con punto y coma (;). Solo se permite una única consulta de lectura.');
    }

    // 3. Normalizar para detección de sentencias prohibidas
    const sqlUpper = sinStrings.toUpperCase().replace(/\s+/g, ' ').trim();

    // Detectar sentencias prohibidas como palabras completas fuera de cadenas de texto
    for (const sentencia of SENTENCIAS_PROHIBIDAS) {
        const regex = new RegExp(`\\b${sentencia}\\b`, 'i');
        if (regex.test(sqlUpper)) {
            errores.push(`Sentencia o comando "${sentencia}" no está permitido. Solo se permiten consultas de lectura (SELECT / WITH).`);
        }
    }

    // 4. Verificar que empiece con SELECT o WITH (CTEs)
    if (!sqlUpper.startsWith('SELECT') && !sqlUpper.startsWith('WITH')) {
        errores.push('La consulta debe comenzar con SELECT o WITH');
    }

    return { valido: errores.length === 0, errores };
}

// ── Construir SQL desde definición visual ─────────────────────────────────

export function construirSQLDesdeVisual(definicion: DefinicionVisual): string {
    if (!definicion.tablas || definicion.tablas.length === 0) {
        throw new Error('Se requiere al menos una tabla');
    }

    const camposValidos = (definicion.campos || []).filter(c => c && c.nombreCampo && c.nombreCampo.trim());
    if (camposValidos.length === 0) {
        throw new Error('Se requiere al menos un campo');
    }

    const partes: string[] = [];

    // SELECT
    const selectCampos = camposValidos.map(c => {
        const tablaRef = c.tabla ? `"${c.tabla}".` : '';
        const campo = `${tablaRef}"${c.nombreCampo}"`;
        const aliasFinal = c.alias?.trim() || (c.funcion && c.funcion !== 'DISTINCT' ? `${c.nombreCampo}_${c.funcion.toLowerCase()}` : undefined);
        const aliasClausula = aliasFinal ? ` AS "${aliasFinal}"` : '';

        if (c.funcion) {
            if (c.funcion === 'DISTINCT') {
                return `DISTINCT ${campo}${aliasClausula}`;
            }
            return `${c.funcion}(${campo})${aliasClausula}`;
        }

        return `${campo}${aliasClausula}`;
    });
    partes.push(`SELECT ${selectCampos.join(', ')}`);

    // FROM
    const tablaPrincipal = definicion.tablas[0];
    partes.push(`FROM "${tablaPrincipal.nombreTabla}"`);

    // JOINs - ignore incomplete relations
    if (definicion.relaciones && definicion.relaciones.length > 0) {
        for (const rel of definicion.relaciones) {
            if (!rel.tablaDestino || !rel.campoDestino || !rel.tablaOrigen || !rel.campoOrigen) {
                continue;
            }
            const tipoJoin = rel.tipoJoin || 'INNER JOIN';
            partes.push(`${tipoJoin} "${rel.tablaDestino}" ON "${rel.tablaOrigen}"."${rel.campoOrigen}" = "${rel.tablaDestino}"."${rel.campoDestino}"`);
        }
    }

    // WHERE - ignore incomplete filters
    if (definicion.filtros && definicion.filtros.length > 0) {
        const condicionesValidas: { conector?: string; condicion: string }[] = [];

        for (const filtro of definicion.filtros) {
            if (!filtro.campo || !filtro.campo.trim()) continue;

            const campo = filtro.campo.includes('.') 
                ? filtro.campo.split('.').map(p => `"${p.trim()}"`).join('.')
                : `"${filtro.campo.trim()}"`;

            let condicion = '';
            const rawVal = filtro.valor !== undefined && filtro.valor !== null ? String(filtro.valor).trim() : '';
            const escaped = escapeSQLString(rawVal);
            
            // Check if value is a system variable like {{FECHA_ACTUAL}}
            const isVar = /^\{\{[A-Z0-9_]+\}\}$/i.test(rawVal);
            const valExpr = isVar ? rawVal : `'${escaped}'`;

            switch (filtro.operador) {
                case 'EQUAL': condicion = `${campo} = ${valExpr}`; break;
                case 'NOT_EQUAL': condicion = `${campo} != ${valExpr}`; break;
                case 'GREATER': condicion = `${campo} > ${valExpr}`; break;
                case 'LESS': condicion = `${campo} < ${valExpr}`; break;
                case 'GREATER_EQUAL': condicion = `${campo} >= ${valExpr}`; break;
                case 'LESS_EQUAL': condicion = `${campo} <= ${valExpr}`; break;
                case 'LIKE': condicion = `${campo} LIKE '%${escaped}%'`; break;
                case 'ILIKE': condicion = `${campo} ILIKE '%${escaped}%'`; break;
                case 'NOT_LIKE': condicion = `${campo} NOT LIKE '%${escaped}%'`; break;
                case 'IN': {
                    const items = rawVal ? rawVal.split(',').map(v => `'${escapeSQLString(v.trim())}'`).filter(Boolean) : [];
                    condicion = items.length > 0 ? `${campo} IN (${items.join(', ')})` : '';
                    break;
                }
                case 'NOT_IN': {
                    const items = rawVal ? rawVal.split(',').map(v => `'${escapeSQLString(v.trim())}'`).filter(Boolean) : [];
                    condicion = items.length > 0 ? `${campo} NOT IN (${items.join(', ')})` : '';
                    break;
                }
                case 'BETWEEN': {
                    const rawVal2 = filtro.valor2 !== undefined && filtro.valor2 !== null ? String(filtro.valor2).trim() : '';
                    const isVar2 = /^\{\{[A-Z0-9_]+\}\}$/i.test(rawVal2);
                    const valExpr2 = isVar2 ? rawVal2 : `'${escapeSQLString(rawVal2)}'`;
                    condicion = `${campo} BETWEEN ${valExpr} AND ${valExpr2}`;
                    break;
                }
                case 'IS_NULL': condicion = `${campo} IS NULL`; break;
                case 'IS_NOT_NULL': condicion = `${campo} IS NOT NULL`; break;
                default: break;
            }

            if (condicion) {
                condicionesValidas.push({
                    conector: filtro.conector || 'AND',
                    condicion
                });
            }
        }

        if (condicionesValidas.length > 0) {
            const whereClause = condicionesValidas.map((item, idx) => {
                if (idx === 0) return item.condicion;
                return `${item.conector || 'AND'} ${item.condicion}`;
            }).join(' ');
            partes.push(`WHERE ${whereClause}`);
        }
    }

    // GROUP BY
    const tieneAgregacion = camposValidos.some(c => c.funcion && c.funcion !== 'DISTINCT');
    let gruposManuales = (definicion.agrupaciones || []).map(g => g.campo).filter(Boolean);

    if (tieneAgregacion) {
        // Auto-group by all non-aggregated fields if any aggregation exists
        const camposNoAgregados = camposValidos
            .filter(c => !c.funcion || c.funcion === 'DISTINCT')
            .map(c => c.tabla ? `"${c.tabla}"."${c.nombreCampo}"` : `"${c.nombreCampo}"`);
        
        if (camposNoAgregados.length > 0) {
            partes.push(`GROUP BY ${camposNoAgregados.join(', ')}`);
        }
    } else if (gruposManuales.length > 0) {
        const gruposFormateados = gruposManuales.map(campo => {
            return campo.includes('.')
                ? campo.split('.').map(p => `"${p.trim()}"`).join('.')
                : `"${campo.trim()}"`;
        });
        partes.push(`GROUP BY ${gruposFormateados.join(', ')}`);
    }

    // ORDER BY
    const ordenValido = (definicion.ordenamiento || []).filter(o => o && o.campo && o.campo.trim());
    if (ordenValido.length > 0) {
        const ordenes = ordenValido.map(o => {
            const campo = o.campo.includes('.')
                ? o.campo.split('.').map(p => `"${p.trim()}"`).join('.')
                : `"${o.campo.trim()}"`;
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
        sqlEjecutar = `${sqlEjecutar.trim().replace(/;$/, '')}\nLIMIT ${limite}`;
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
        ? Object.keys(datos[0]).map(key => {
            const sampleRow = datos.find(r => r[key] !== null && r[key] !== undefined);
            const val = sampleRow ? sampleRow[key] : datos[0][key];
            return {
                nombre: key,
                tipo: detectarTipo(val),
            };
        })
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
        sql = `${sql.trim().replace(/;$/, '')}\nLIMIT ${limite}`;
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
        ? Object.keys(datos[0]).map(key => {
            const sampleRow = datos.find(r => r[key] !== null && r[key] !== undefined);
            const val = sampleRow ? sampleRow[key] : datos[0][key];
            return {
                nombre: key,
                tipo: detectarTipo(val),
            };
        })
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

    const func = funcionAgregacion?.toUpperCase() || '';

    // Handle COUNT
    if (func === 'COUNT') {
        if (!campoValor || campoValor === '*') {
            return datos.length;
        }
        return datos.filter(row => row[campoValor] !== null && row[campoValor] !== undefined).length;
    }

    // For other functions, extract numeric values
    const valores = datos
        .map(row => {
            const val = row[campoValor];
            if (val === null || val === undefined) return NaN;
            return typeof val === 'number' ? val : parseFloat(val);
        })
        .filter(v => !isNaN(v));

    if (valores.length === 0) return null;

    switch (func) {
        case 'SUM': return valores.reduce((a, b) => a + b, 0);
        case 'AVG': return valores.reduce((a, b) => a + b, 0) / valores.length;
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
