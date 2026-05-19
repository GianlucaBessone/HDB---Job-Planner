import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
    try {
        const doc = await prisma.controlledDocument.findUnique({
            where: { id: params.id },
            include: {
                versions: {
                    orderBy: [{ versionMayor: 'desc' }, { versionMenor: 'desc' }],
                    take: 1
                }
            }
        });

        if (!doc) {
            return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
        }

        const latestVersion = doc.versions[0];
        const versionLabel = latestVersion ? latestVersion.versionLabel : `${doc.versionMayor}.${doc.versionMenor}`;
        const fechaEmision = doc.fechaEmision ? new Date(doc.fechaEmision).toLocaleDateString() : new Date().toLocaleDateString();

        const html = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <title>Template ISO 9001 - ${doc.codigoDocumental}</title>
            <!--[if gte mso 9]>
            <xml>
                <w:WordDocument>
                    <w:View>Print</w:View>
                    <w:Zoom>100</w:Zoom>
                </w:WordDocument>
            </xml>
            <![endif]-->
            <style>
                @page {
                    size: 8.5in 11in;
                    margin: 1.0in 1.0in 1.0in 1.0in;
                }
                body { 
                    font-family: 'Arial', sans-serif; 
                    font-size: 10pt; 
                    line-height: 1.4; 
                    color: #000000; 
                }
                .title-centered {
                    text-align: center;
                    font-size: 14pt;
                    font-weight: bold;
                    margin-bottom: 3px;
                }
                .subtitle-centered {
                    text-align: center;
                    font-size: 12pt;
                    font-weight: bold;
                    margin-top: 0px;
                    margin-bottom: 20px;
                }
                .description-paragraph {
                    font-size: 10pt;
                    margin-bottom: 25px;
                    text-align: justify;
                }
                .section-title {
                    font-size: 11pt;
                    font-weight: bold;
                    margin-top: 20px;
                    margin-bottom: 10px;
                    border-bottom: 0.5pt solid #000000;
                    padding-bottom: 2px;
                }
                .doc-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 25px;
                }
                .doc-table th {
                    border: 0.5pt solid #000000;
                    padding: 6px;
                    font-size: 9.5pt;
                    font-weight: bold;
                    text-align: left;
                    background-color: #dbeafe;
                }
                .doc-table td {
                    border: 0.5pt solid #000000;
                    padding: 6px;
                    font-size: 9pt;
                }
                .doc-table td.label-cell {
                    font-weight: bold;
                    background-color: #f8fafc;
                    width: 30%;
                }
                .doc-table td.value-cell {
                    width: 70%;
                }
                p, li {
                    font-size: 10pt;
                    margin-bottom: 10px;
                }
                ul {
                    margin-top: 5px;
                    margin-bottom: 15px;
                    padding-left: 20px;
                }
            </style>
        </head>
        <body>
            <div class="title-centered">HDB QMS - Documento Controlado</div>
            <div class="subtitle-centered">${doc.tipoDocumento} • ${doc.titulo}</div>

            <div class="description-paragraph">
                Este documento es una plantilla generada automáticamente por el sistema QMS de HDB. El creador o autor del documento debe completar los espacios indicados en negrita y cursiva entre corchetes <strong><em>[...]</em></strong> antes de proceder con su firma y posterior verificación técnica.
            </div>

            <div class="section-title">1. Encabezado Documental</div>
            <table class="doc-table">
                <thead>
                    <tr>
                        <th style="width: 30%;">Campo</th>
                        <th style="width: 70%;">Valor del Sistema</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td class="label-cell">Código Documental</td>
                        <td class="value-cell">${doc.codigoDocumental}</td>
                    </tr>
                    <tr>
                        <td class="label-cell">Título</td>
                        <td class="value-cell">${doc.titulo}</td>
                    </tr>
                    <tr>
                        <td class="label-cell">Tipo de Documento</td>
                        <td class="value-cell">${doc.tipoDocumento}</td>
                    </tr>
                    <tr>
                        <td class="label-cell">Versión</td>
                        <td class="value-cell">v${versionLabel}</td>
                    </tr>
                    <tr>
                        <td class="label-cell">Estado</td>
                        <td class="value-cell">Vigente</td>
                    </tr>
                    <tr>
                        <td class="label-cell">Área / Sector</td>
                        <td class="value-cell">${doc.area || 'Operaciones'}</td>
                    </tr>
                    <tr>
                        <td class="label-cell">Creado Por</td>
                        <td class="value-cell">${doc.createdByName || '(Sin especificar)'}</td>
                    </tr>
                    <tr>
                        <td class="label-cell">Revisado Por</td>
                        <td class="value-cell">${doc.revisadorNombre || '(Sin especificar)'}</td>
                    </tr>
                    <tr>
                        <td class="label-cell">Aprobado Por</td>
                        <td class="value-cell">${doc.aprobadorNombre || '(Sin especificar)'}</td>
                    </tr>
                    <tr>
                        <td class="label-cell">Fecha de Emisión</td>
                        <td class="value-cell">${fechaEmision}</td>
                    </tr>
                    <tr>
                        <td class="label-cell">Fecha de Revisión</td>
                        <td class="value-cell">${new Date(new Date(doc.fechaEmision || new Date()).setFullYear(new Date(doc.fechaEmision || new Date()).getFullYear() + 1)).toLocaleDateString()}</td>
                    </tr>
                    <tr>
                        <td class="label-cell">Clasificación</td>
                        <td class="value-cell">Uso Interno</td>
                    </tr>
                </tbody>
            </table>

            <div class="section-title">2. Objetivo</div>
            <p style="color: #475569; font-style: italic;">
                <strong><em>[Escriba el objetivo del documento aquí: Describa con precisión cuál es el propósito final de este ${doc.tipoDocumento.toLowerCase()} y qué metas operativas busca estandarizar para HDB.]</em></strong>
            </p>

            <div class="section-title">3. Alcance</div>
            <p style="color: #475569; font-style: italic;">
                <strong><em>[Escriba el alcance del documento aquí: Indique a qué sucursales, puestos de trabajo, personal técnico, herramientas o tipos de órdenes de servicio aplica directamente este procedimiento.]</em></strong>
            </p>

            <div class="section-title">4. Desarrollo de la Actividad</div>
            <p style="color: #475569; font-style: italic;">
                <strong><em>[Describa detalladamente el desarrollo operativo paso a paso aquí: Describa las tareas técnicas, los métodos seguros de trabajo, las mejores prácticas del servicio, los diagramas de flujo o fotos si correspondieran, detallando de forma clara y secuencial el procedimiento operativo.]</em></strong>
            </p>

            <div class="section-title">5. Responsabilidades</div>
            <p style="color: #475569; font-style: italic;">
                <strong><em>[Escriba las responsabilidades asociadas aquí: Detalle las responsabilidades de cada rol en la ejecución (ej: qué le corresponde realizar a los Técnicos, qué a los Supervisores de Campo y qué al departamento de QA/Calidad).]</em></strong>
            </p>

            <div class="section-title">6. Definiciones y Abreviaturas</div>
            <p style="color: #475569; font-style: italic;">
                <strong><em>[Escriba las definiciones necesarias aquí: Registre el glosario de términos o siglas del documento como EPP, OS, QMS, etc.]</em></strong>
            </p>

            <div class="section-title">7. Referencias y Documentación Anexa</div>
            <p style="color: #475569; font-style: italic;">
                <strong><em>[Registre las referencias aquí: Indique las normas ISO, reglamentaciones legales locales, manuales del fabricante u otros instructivos internos aplicados.]</em></strong>
            </p>
            <p style="margin-top: 15px; font-size: 9.5pt; color: #334155;">
                <strong>Descripción original del sistema cargada en la creación (utilizar como guía de redacción):</strong><br/>
                ${doc.descripcion || '(Sin descripción provista en el sistema)'}
            </p>
        </body>
        </html>
        `;

        const filename = `${doc.codigoDocumental}_Plantilla.doc`;

        return new Response(html, {
            headers: {
                'Content-Type': 'application/msword',
                'Content-Disposition': `attachment; filename="${filename}"`
            }
        });
    } catch (e: any) {
        return NextResponse.json({ error: 'Error al generar la plantilla', details: e.message }, { status: 500 });
    }
}
