import { prisma } from './prisma';

// Tablas internas que se ocultan por defecto
const TABLAS_OCULTAS = [
    '_prisma_migrations',
    'DiccionarioTabla',
    'DiccionarioCampo',
    'DatasetEjecucion',
];

interface ColumnaInfo {
    table_name: string;
    column_name: string;
    data_type: string;
    character_maximum_length: number | null;
    is_nullable: string;
    column_default: string | null;
    udt_name: string;
}

interface FKInfo {
    table_name: string;
    column_name: string;
    foreign_table_name: string;
    foreign_column_name: string;
}

interface PKInfo {
    table_name: string;
    column_name: string;
}

export async function getTablesToSync(): Promise<string[]> {
    const tablas = await prisma.$queryRaw<{ table_name: string }[]>`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
    `;
    return tablas.map(t => t.table_name);
}

export async function syncTable(nombreTabla: string): Promise<{ camposActualizados: number }> {
    let camposActualizados = 0;
    
    // 1. Obtener todas las columnas
    const columnas = await prisma.$queryRaw<ColumnaInfo[]>`
        SELECT
            table_name,
            column_name,
            data_type,
            character_maximum_length,
            is_nullable,
            column_default,
            udt_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ${nombreTabla}
        ORDER BY ordinal_position
    `;

    // 2. Obtener primary keys
    const primaryKeys = await prisma.$queryRaw<PKInfo[]>`
        SELECT
            tc.table_name,
            kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = 'public'
          AND tc.table_name = ${nombreTabla}
    `;

    // 3. Obtener foreign keys
    const foreignKeys = await prisma.$queryRaw<FKInfo[]>`
        SELECT
            tc.table_name,
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
            ON tc.constraint_name = ccu.constraint_name
            AND tc.table_schema = ccu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND tc.table_name = ${nombreTabla}
    `;

    const pkSet = new Set(primaryKeys.map(pk => pk.column_name));
    const fkMap = new Map<string, FKInfo>();
    for (const fk of foreignKeys) {
        fkMap.set(fk.column_name, fk);
    }

    const esOculta = TABLAS_OCULTAS.includes(nombreTabla);

    // Obtener conteo de registros
    let cantidadRegistros = 0;
    try {
        const countResult = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
            `SELECT COUNT(*) as count FROM "${nombreTabla}"`
        );
        cantidadRegistros = Number(countResult[0]?.count || 0);
    } catch {
        // Tabla puede ser inaccesible
    }

    // Upsert de la tabla en el diccionario
    let tablaRecord = await prisma.diccionarioTabla.findUnique({
        where: { nombreTabla },
    });

    if (tablaRecord) {
        tablaRecord = await prisma.diccionarioTabla.update({
            where: { nombreTabla },
            data: {
                cantidadRegistros,
                ultimaActualizacion: new Date(),
                oculta: esOculta,
            },
        });
    } else {
        tablaRecord = await prisma.diccionarioTabla.create({
            data: {
                nombreTabla,
                cantidadRegistros,
                ultimaActualizacion: new Date(),
                oculta: esOculta,
            },
        });
    }

    for (const col of columnas) {
        const fkInfo = fkMap.get(col.column_name);
        const esPK = pkSet.has(col.column_name);

        // Obtener ejemplo de valor
        let ejemploValor: string | null = null;
        try {
            if (!esPK && col.data_type !== 'bytea') {
                const sampleResult = await prisma.$queryRawUnsafe<any[]>(
                    `SELECT "${col.column_name}"::TEXT as val FROM "${nombreTabla}" WHERE "${col.column_name}" IS NOT NULL LIMIT 1`
                );
                if (sampleResult[0]?.val) {
                    ejemploValor = String(sampleResult[0].val).substring(0, 200);
                }
            }
        } catch {
            // Ignorar errores de casting
        }

        const campoExistente = await prisma.diccionarioCampo.findUnique({
            where: {
                tablaId_nombreCampo: {
                    tablaId: tablaRecord.id,
                    nombreCampo: col.column_name,
                },
            },
        });

        const tipoDatoDisplay = col.udt_name || col.data_type;

        if (campoExistente) {
            await prisma.diccionarioCampo.update({
                where: { id: campoExistente.id },
                data: {
                    tipoDato: tipoDatoDisplay,
                    longitud: col.character_maximum_length,
                    permiteNulos: col.is_nullable === 'YES',
                    esClavePrimaria: esPK,
                    esClaveForanea: !!fkInfo,
                    referenciaTabla: fkInfo?.foreign_table_name || null,
                    referenciaCampo: fkInfo?.foreign_column_name || null,
                    ejemploValor: ejemploValor ?? campoExistente.ejemploValor,
                },
            });
        } else {
            await prisma.diccionarioCampo.create({
                data: {
                    tablaId: tablaRecord.id,
                    nombreCampo: col.column_name,
                    tipoDato: tipoDatoDisplay,
                    longitud: col.character_maximum_length,
                    permiteNulos: col.is_nullable === 'YES',
                    esClavePrimaria: esPK,
                    esClaveForanea: !!fkInfo,
                    referenciaTabla: fkInfo?.foreign_table_name || null,
                    referenciaCampo: fkInfo?.foreign_column_name || null,
                    ejemploValor,
                },
            });
        }
        camposActualizados++;
    }

    // 7. Eliminar campos que ya no existen en la BD
    const nombresColumnasActuales = new Set(columnas.map(c => c.column_name));
    const camposEnDiccionario = await prisma.diccionarioCampo.findMany({
        where: { tablaId: tablaRecord.id },
        select: { id: true, nombreCampo: true },
    });
    for (const campo of camposEnDiccionario) {
        if (!nombresColumnasActuales.has(campo.nombreCampo)) {
            await prisma.diccionarioCampo.delete({ where: { id: campo.id } });
        }
    }

    return { camposActualizados };
}

export async function cleanupSync(validTables: string[]): Promise<{ tablasEliminadas: number }> {
    let tablasEliminadas = 0;
    const nombresTablaActuales = new Set(validTables);
    const tablasEnDiccionario = await prisma.diccionarioTabla.findMany({
        select: { id: true, nombreTabla: true },
    });
    for (const tablaDict of tablasEnDiccionario) {
        if (!nombresTablaActuales.has(tablaDict.nombreTabla)) {
            await prisma.diccionarioTabla.delete({ where: { id: tablaDict.id } });
            tablasEliminadas++;
        }
    }
    return { tablasEliminadas };
}
