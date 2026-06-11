import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as xlsx from 'xlsx';

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No se envió ningún archivo' }, { status: 400 });
        }

        const buffer = await file.arrayBuffer();
        const workbook = xlsx.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Ensure raw string output and that headers are exactly matched from row 1
        const data = xlsx.utils.sheet_to_json(sheet, { defval: '' }) as any[];

        if (data.length === 0) {
            return NextResponse.json({ error: 'El archivo Excel está vacío' }, { status: 400 });
        }

        // Validate Exact Columns from the first row of data
        // Actually, if we use sheet_to_json, the keys of the first non-empty object are headers
        const firstRowKeys = Object.keys(data[0]);
        const requiredHeaders = ['Codigo', 'Material', 'Precio Venta', 'Costo'];
        
        const missingHeaders = requiredHeaders.filter(h => !firstRowKeys.includes(h));
        // If exact match isn't found in keys, maybe they mispelled.
        if (missingHeaders.length > 0) {
            return NextResponse.json({ 
                error: `Formato inválido. El archivo debe contener exactamente las columnas: ${requiredHeaders.join(', ')}. Falta: ${missingHeaders.join(', ')}` 
            }, { status: 400 });
        }

        let procesados = 0;
        const errores = [];

        const parsePrice = (val: any) => {
            if (val === undefined || val === null || val === '') return null;
            const parsed = parseFloat(val.toString().replace(',', '.')); // in case they use comma
            return isNaN(parsed) ? null : parsed;
        };

        const validRows = [];
        for (const row of data) {
            const codigo = row['Codigo']?.toString().trim();
            const material = row['Material']?.toString().trim();
            
            if (!codigo) continue;
            if (!material) {
                errores.push({ fila: row, motivo: 'Material está vacío' });
                continue;
            }
            
            validRows.push({
                row,
                codigo,
                material,
                precioVenta: parsePrice(row['Precio Venta']),
                costo: parsePrice(row['Costo'])
            });
        }

        // Process in chunks of 50 to avoid connection pool exhaustion
        const chunkSize = 50;
        for (let i = 0; i < validRows.length; i += chunkSize) {
            const chunk = validRows.slice(i, i + chunkSize);
            const promises = chunk.map(async (item) => {
                try {
                    await prisma.materialMaestro.upsert({
                        where: { codigo: item.codigo },
                        update: {
                            nombre: item.material,
                            precioVenta: item.precioVenta,
                            costo: item.costo
                        },
                        create: {
                            codigo: item.codigo,
                            nombre: item.material,
                            unidad: 'unidad',
                            precioVenta: item.precioVenta,
                            costo: item.costo
                        }
                    });
                    procesados++;
                } catch (err: any) {
                    errores.push({ fila: item.row, motivo: err.message || 'Error al guardar en base de datos' });
                }
            });
            await Promise.all(promises);
        }

        return NextResponse.json({
            message: 'Importación finalizada',
            procesados,
            errores
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Error importando archivo' }, { status: 500 });
    }
}
