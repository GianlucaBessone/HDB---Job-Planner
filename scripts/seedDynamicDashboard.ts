import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('Seeding Dynamic Dashboard Datasets and Graficos...');

    // Clear existing for idempotency
    await prisma.graficoConfig.deleteMany({
        where: { codigoGrafico: { startsWith: 'GRF-DASH-' } }
    });
    await prisma.dataset.deleteMany({
        where: { codigoDataset: { startsWith: 'DS-DASH-' } }
    });

    // 1. TPI por Proyecto
    const ds1 = await prisma.dataset.create({
        data: {
            codigoDataset: 'DS-DASH-001',
            nombre: 'Performance de Proyectos (TPI)',
            modoConsulta: 'SQL',
            consultaSQL: `
                SELECT "nombre", "codigoProyecto", 
                CASE WHEN "horasConsumidas" > 0 THEN "horasEstimadas"::float / "horasConsumidas" ELSE 0 END as "ipt",
                "horasEstimadas" - "horasConsumidas" as "savings"
                FROM "Project"
                WHERE "horasEstimadas" > 0 AND "horasConsumidas" > 0 AND "estado" != 'finalizado'
                ORDER BY "ipt" DESC
                LIMIT 10
            `,
            estado: 'Activo',
            habilitado: true,
            limiteRegistros: 100
        }
    });

    await prisma.graficoConfig.create({
        data: {
            codigoGrafico: 'GRF-DASH-001',
            nombre: 'TPI por Proyecto',
            tipoGrafico: 'Barra',
            datasetId: ds1.id,
            configuracion: {
                ejeX: 'nombre',
                series: ['ipt']
            }
        }
    });

    // 2. Clasificación (Donut)
    const ds2 = await prisma.dataset.create({
        data: {
            codigoDataset: 'DS-DASH-002',
            nombre: 'Clasificación TPI',
            modoConsulta: 'SQL',
            consultaSQL: `
                WITH tpi_data AS (
                    SELECT 
                        CASE 
                            WHEN ("horasEstimadas"::float / "horasConsumidas") > 1.05 THEN 'Eficientes'
                            WHEN ("horasEstimadas"::float / "horasConsumidas") < 0.95 THEN 'Con Desvío'
                            ELSE 'Exactos'
                        END as "clasificacion"
                    FROM "Project"
                    WHERE "horasEstimadas" > 0 AND "horasConsumidas" > 0 AND "estado" != 'finalizado'
                )
                SELECT "clasificacion", COUNT(*)::int as "cantidad"
                FROM tpi_data
                GROUP BY "clasificacion"
            `,
            estado: 'Activo',
            habilitado: true,
            limiteRegistros: 10
        }
    });

    await prisma.graficoConfig.create({
        data: {
            codigoGrafico: 'GRF-DASH-002',
            nombre: 'Clasificación de Performance',
            tipoGrafico: 'Torta',
            datasetId: ds2.id,
            configuracion: {
                ejeX: 'clasificacion',
                series: ['cantidad'],
                colores: ['#10b981', '#f43f5e', '#3b82f6'] // Green, Red, Blue
            }
        }
    });

    // 3. Balance de Horas (Divergent)
    const ds3 = await prisma.dataset.create({
        data: {
            codigoDataset: 'DS-DASH-003',
            nombre: 'Balance de Horas (Ahorro vs Exceso)',
            modoConsulta: 'SQL',
            consultaSQL: `
                SELECT "nombre", ("horasEstimadas" - "horasConsumidas") as "ahorro"
                FROM "Project"
                WHERE "horasEstimadas" > 0 AND "horasConsumidas" > 0 AND "estado" != 'finalizado'
                ORDER BY "ahorro" DESC
                LIMIT 6
            `,
            estado: 'Activo',
            habilitado: true,
            limiteRegistros: 10
        }
    });

    await prisma.graficoConfig.create({
        data: {
            codigoGrafico: 'GRF-DASH-003',
            nombre: 'Balance de Horas por Proyecto',
            tipoGrafico: 'Barra',
            datasetId: ds3.id,
            configuracion: {
                ejeX: 'nombre',
                series: ['ahorro']
            }
        }
    });

    console.log('Seeding complete.');
}

main().catch(e => {
    console.error(e);
    process.exit(1);
}).finally(async () => {
    await prisma.$disconnect();
});
