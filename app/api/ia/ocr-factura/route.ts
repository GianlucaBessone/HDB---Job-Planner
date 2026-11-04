import { NextRequest, NextResponse } from 'next/server';
import { logAiRequest } from '@/lib/ai/audit';
import { resolveRoute } from '@/lib/ai/router';
import { calculateCost } from '@/lib/ai/costs';
import { getRateLimiter } from '@/lib/ai/rate-limiter';

const { provider, model, providerName, effort } = resolveRoute('INVOICE_OCR');

const SYSTEM_INSTRUCTION = `
Actúa como un extractor profesional de datos de comprobantes fiscales argentinos.
Tu tarea es analizar el documento adjunto (imagen) y extraer únicamente la información que esté presente de forma explícita.

REGLAS OBLIGATORIAS:
1. Devuelve únicamente un JSON válido sin Markdown.
2. No agregues explicaciones ni comentarios.
3. No inventes datos. Si un campo no puede identificarse con certeza, devolver null.
4. Los importes deben devolverse como números sin símbolos de moneda.
5. Las fechas deben devolverse en formato YYYY-MM-DD.
6. Mantener exactamente los números de comprobante encontrados.
7. Si existen varios importes posibles, seleccionar únicamente el valor fiscal correspondiente.
8. Si el documento no es una factura, es_factura debe ser false.
9. CUIDADO CON LOS TRIBUTOS: En facturas argentinas, a veces dice "Impuestos Internos: 14,04" y debajo "Total Otros Tributos: 14,04". NO extraigas ambos porque se duplicarán al sumarlos. Prioriza colocar el importe final en "otros_impuestos" y deja "impuestos_internos" en null si es el mismo importe o si está totalizado. Lo mismo aplica a "no_gravado". Evita la duplicación matemática.
20. DESGLOSE DE NETOS GRAVADOS: Es crucial extraer el importe "Neto gravado" (o importe base) correspondiente a cada alícuota de IVA de forma individual. Si la factura muestra "IVA 21% (Neto gravado $ 6544.80)", debes colocar 6544.80 en "neto_21", y no sumarlo todo en "subtotal". Haz lo mismo para neto_10_5 y neto_27 si existen.
11. NÚMERO DE COMPROBANTE Y PUNTO DE VENTA: Cuando encuentres un número con guion (Ej: 0006-00025), lo que está a la izquierda del guion SIEMPRE es el "punto_venta" (ej. "0006") y lo que está a la derecha SIEMPRE es el "numero_comprobante" (ej. "00025").
`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    es_factura: { type: 'BOOLEAN' },
    tipo_comprobante: { type: 'STRING', nullable: true },
    letra_comprobante: { type: 'STRING', nullable: true },
    numero_comprobante: { type: 'STRING', nullable: true },
    punto_venta: { type: 'STRING', nullable: true },
    fecha_emision: { type: 'STRING', nullable: true },
    fecha_vencimiento: { type: 'STRING', nullable: true },
    proveedor: {
      type: 'OBJECT',
      nullable: true,
      properties: {
        razon_social: { type: 'STRING', nullable: true },
        nombre_fantasia: { type: 'STRING', nullable: true },
        cuit: { type: 'STRING', nullable: true },
        condicion_iva: { type: 'STRING', nullable: true },
        domicilio: { type: 'STRING', nullable: true },
      }
    },
    totales: {
      type: 'OBJECT',
      nullable: true,
      properties: {
        subtotal: { type: 'NUMBER', nullable: true },
        neto_21: { type: 'NUMBER', nullable: true },
        neto_10_5: { type: 'NUMBER', nullable: true },
        neto_27: { type: 'NUMBER', nullable: true },
        iva_21: { type: 'NUMBER', nullable: true },
        iva_10_5: { type: 'NUMBER', nullable: true },
        iva_27: { type: 'NUMBER', nullable: true },
        no_gravado: { type: 'NUMBER', nullable: true },
        percepciones_iva: { type: 'NUMBER', nullable: true },
        percepciones_iibb: { type: 'NUMBER', nullable: true },
        impuestos_internos: { type: 'NUMBER', nullable: true },
        otros_impuestos: { type: 'NUMBER', nullable: true },
        total: { type: 'NUMBER', nullable: true },
        moneda: { type: 'STRING', nullable: true },
      }
    },
    cae: { type: 'STRING', nullable: true },
    fecha_vencimiento_cae: { type: 'STRING', nullable: true },
    confianza_extraccion: { type: 'NUMBER' }
  },
  required: ["es_factura", "confianza_extraccion"]
};

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let userId = 'anonymous';
  let userName = 'Usuario Anónimo';
  let userRole = 'Desconocido';
  
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    // We can also extract userId, userName, userRole if they are sent in formData
    if (formData.has('userId')) userId = formData.get('userId') as string;
    if (formData.has('userName')) userName = formData.get('userName') as string;
    if (formData.has('userRole')) userRole = formData.get('userRole') as string;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // We send base64 inline for image handling
    const base64Data = buffer.toString('base64');
    const mimeType = file.type || 'image/jpeg';

    await getRateLimiter(providerName).waitIfLimitReached();

    const response = await provider.generate({
      prompt: 'Extrae los datos de esta factura.',
      systemInstruction: SYSTEM_INSTRUCTION,
      model,
      effort,
      temperature: 0.1, // Low temperature for factual extraction
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      attachments: [{ data: base64Data, mimeType }],
      timeoutMs: 45000,
    });

    if (!response.text) {
      throw new Error('La IA no devolvió datos de la factura.');
    }

    const jsonData = JSON.parse(response.text);

    // Log success
    await logAiRequest({
      action: 'OCR',
      model: response.model,
      provider: response.provider,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      totalTokens: response.totalTokens,
      estimatedCost: calculateCost(response.model, response.inputTokens, response.outputTokens),
      latencyMs: Date.now() - startTime,
      userId,
      userName,
      userRole,
      success: true,
      entity: 'Factura',
      entityId: file.name
    });

    return NextResponse.json({ data: jsonData });
  } catch (error: any) {
    console.error('Error in OCR processing:', error);
    
    // Log failure
    await logAiRequest({
      action: 'OCR',
      model,
      provider: providerName,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
      latencyMs: Date.now() - startTime,
      userId,
      userName,
      userRole,
      success: false,
      errorMessage: error.message || 'Error desconocido al procesar OCR',
      entity: 'Factura'
    });
    
    return NextResponse.json({ error: 'Failed to process document', details: error.message }, { status: 500 });
  }
}
