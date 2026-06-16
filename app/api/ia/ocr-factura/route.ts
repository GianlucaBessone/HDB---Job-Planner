import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';

// Initialize the new Gemini SDK
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    es_factura: { type: Type.BOOLEAN },
    tipo_comprobante: { type: Type.STRING, nullable: true },
    letra_comprobante: { type: Type.STRING, nullable: true },
    numero_comprobante: { type: Type.STRING, nullable: true },
    punto_venta: { type: Type.STRING, nullable: true },
    fecha_emision: { type: Type.STRING, nullable: true },
    fecha_vencimiento: { type: Type.STRING, nullable: true },
    proveedor: {
      type: Type.OBJECT,
      nullable: true,
      properties: {
        razon_social: { type: Type.STRING, nullable: true },
        nombre_fantasia: { type: Type.STRING, nullable: true },
        cuit: { type: Type.STRING, nullable: true },
        condicion_iva: { type: Type.STRING, nullable: true },
        domicilio: { type: Type.STRING, nullable: true },
      }
    },
    totales: {
      type: Type.OBJECT,
      nullable: true,
      properties: {
        subtotal: { type: Type.NUMBER, nullable: true },
        iva_21: { type: Type.NUMBER, nullable: true },
        iva_10_5: { type: Type.NUMBER, nullable: true },
        iva_27: { type: Type.NUMBER, nullable: true },
        no_gravado: { type: Type.NUMBER, nullable: true },
        percepciones_iva: { type: Type.NUMBER, nullable: true },
        percepciones_iibb: { type: Type.NUMBER, nullable: true },
        impuestos_internos: { type: Type.NUMBER, nullable: true },
        otros_impuestos: { type: Type.NUMBER, nullable: true },
        total: { type: Type.NUMBER, nullable: true },
        moneda: { type: Type.STRING, nullable: true },
      }
    },
    cae: { type: Type.STRING, nullable: true },
    fecha_vencimiento_cae: { type: Type.STRING, nullable: true },
    confianza_extraccion: { type: Type.NUMBER }
  },
  required: ["es_factura", "confianza_extraccion"]
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // We send base64 inline for image handling
    const base64Data = buffer.toString('base64');
    const mimeType = file.type || 'image/jpeg';

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: "Extrae los datos de esta factura." },
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType
              }
            }
          ]
        }
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.1, // Low temperature for factual extraction
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error('No text returned from Gemini');
    }

    const jsonData = JSON.parse(resultText);

    return NextResponse.json({ data: jsonData });
  } catch (error: any) {
    console.error('Error in OCR processing:', error);
    return NextResponse.json({ error: 'Failed to process document', details: error.message }, { status: 500 });
  }
}
