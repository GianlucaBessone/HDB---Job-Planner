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

/**
 * Introspecciona la base de datos PostgreSQL y sincroniza el Diccionario de Datos.
 * Usa information_schema para obtener metadatos de tablas y columnas.
 */
export async function sincronizarDiccionario(): Promise<{
    tablasCreadas: number;
    tablasActualizadas: number;
    camposActualizados: number;
}> {
    let tablasCreadas = 0;
    let tablasActualizadas = 0;
    let camposActualizados = 0;

    // 1. Obtener todas las tablas del schema public
    const tablas = await prisma.$queryRaw<{ table_name: string }[]>`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
    `;

    // 2. Obtener todas las columnas
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
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
    `;

    // 3. Obtener primary keys
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
    `;

    // 4. Obtener foreign keys
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
    `;

    // Crear sets para lookup rápido
    const pkSet = new Set(primaryKeys.map(pk => `${pk.table_name}.${pk.column_name}`));
    const fkMap = new Map<string, FKInfo>();
    for (const fk of foreignKeys) {
        fkMap.set(`${fk.table_name}.${fk.column_name}`, fk);
    }

    // 5. Procesar cada tabla
    for (const tabla of tablas) {
        const nombreTabla = tabla.table_name;
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
        const tablaExistente = await prisma.diccionarioTabla.findUnique({
            where: { nombreTabla },
        });

        let tablaRecord;
        if (tablaExistente) {
            tablaRecord = await prisma.diccionarioTabla.update({
                where: { nombreTabla },
                data: {
                    cantidadRegistros,
                    ultimaActualizacion: new Date(),
                    oculta: esOculta,
                },
            });
            tablasActualizadas++;
        } else {
            tablaRecord = await prisma.diccionarioTabla.create({
                data: {
                    nombreTabla,
                    cantidadRegistros,
                    ultimaActualizacion: new Date(),
                    oculta: esOculta,
                },
            });
            tablasCreadas++;
        }

        // 6. Procesar columnas de la tabla
        const columnasTabla = columnas.filter(c => c.table_name === nombreTabla);

        for (const col of columnasTabla) {
            const fkInfo = fkMap.get(`${nombreTabla}.${col.column_name}`);
            const esPK = pkSet.has(`${nombreTabla}.${col.column_name}`);

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
        const nombresColumnasActuales = new Set(columnasTabla.map(c => c.column_name));
        const camposEnDiccionario = await prisma.diccionarioCampo.findMany({
            where: { tablaId: tablaRecord.id },
            select: { id: true, nombreCampo: true },
        });
        for (const campo of camposEnDiccionario) {
            if (!nombresColumnasActuales.has(campo.nombreCampo)) {
                await prisma.diccionarioCampo.delete({ where: { id: campo.id } });
            }
        }
    }

    // 8. Eliminar tablas del diccionario que ya no existen en la BD
    const nombresTablaActuales = new Set(tablas.map(t => t.table_name));
    const tablasEnDiccionario = await prisma.diccionarioTabla.findMany({
        select: { id: true, nombreTabla: true },
    });
    for (const tablaDict of tablasEnDiccionario) {
        if (!nombresTablaActuales.has(tablaDict.nombreTabla)) {
            await prisma.diccionarioTabla.delete({ where: { id: tablaDict.id } });
        }
    }

    return { tablasCreadas, tablasActualizadas, camposActualizados };
}
