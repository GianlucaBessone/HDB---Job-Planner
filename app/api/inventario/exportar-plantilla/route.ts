import { NextResponse } from 'next/server';
import * as xlsx from 'xlsx';

export async function GET() {
    try {
        const requiredHeaders = ['Codigo', 'Material', 'Precio Venta', 'Costo'];
        
        const worksheet = xlsx.utils.aoa_to_sheet([requiredHeaders]);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Inventario');

        // buffer creation
        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Disposition': 'attachment; filename="plantilla_inventario.xlsx"',
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            }
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Error generando plantilla' }, { status: 500 });
    }
}
