import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const documentId = params.id;
    const body = await request.json();
    const { operatorId, operatorNombre, versionId } = body;

    if (!operatorId || !operatorNombre || !versionId) {
      return NextResponse.json({ error: 'Faltan datos obligatorios' }, { status: 400 });
    }

    // Verify document and version exists
    const document = await prisma.controlledDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
    }

    const version = await prisma.documentVersion.findUnique({
      where: { id: versionId },
    });

    if (!version) {
      return NextResponse.json({ error: 'Versión de documento no encontrada' }, { status: 404 });
    }

    // Generate a unique token
    const token = crypto.randomUUID();

    // Create print record
    const documentPrint = await prisma.documentPrint.create({
      data: {
        documentId,
        versionId,
        operatorId,
        operatorNombre,
        token,
      },
    });

    return NextResponse.json({ success: true, token: documentPrint.token });
  } catch (error) {
    console.error('Error generating document print:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
