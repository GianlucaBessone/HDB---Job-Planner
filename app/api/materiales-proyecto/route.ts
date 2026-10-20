import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildProductSearchWhere, getWordVariants } from '@/lib/ventas/skuUtils';
import { resolverPrecioProducto } from '@/lib/ventas/priceRules';
import { stripAccents } from '@/lib/ventas/pdvSearchEngine';

export const dynamic = 'force-dynamic';

// GET /api/materiales-proyecto?proyectoId=xxx&codigo=yyy&q=zzz
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const proyectoId = searchParams.get('proyectoId');
    
    // Autocomplete / Search — Gestión Comercial como fuente maestra
    const searchCodigo = searchParams.get('codigo');
    const searchQuery = searchParams.get('q') || searchParams.get('query');
    const listaPrecioIdParam = searchParams.get('listaPrecioId');
    const term = (searchCodigo || searchQuery || '').trim();

    if (term) {
        // 1. Resolver lista de precios aplicable
        let listaPrecio: any = null;
        if (listaPrecioIdParam) {
            listaPrecio = await prisma.listaPrecio.findUnique({
                where: { id: listaPrecioIdParam, activo: true }
            });
        }
        if (!listaPrecio && proyectoId) {
            const proj = await prisma.project.findUnique({
                where: { id: proyectoId },
                select: {
                    listaPrecioId: true,
                    listaPrecio: true,
                    client: { select: { listaPrecioId: true } }
                }
            });
            if (proj?.listaPrecio) {
                listaPrecio = proj.listaPrecio;
            } else if (proj?.client?.listaPrecioId) {
                listaPrecio = await prisma.listaPrecio.findUnique({
                    where: { id: proj.client.listaPrecioId, activo: true }
                });
            }
        }
        if (!listaPrecio) {
            listaPrecio = await prisma.listaPrecio.findFirst({
                where: { esPredeterminada: true, activo: true }
            });
        }

        // 2. Ejecutar búsqueda con el algoritmo de Gestión Comercial / PDV
        const isNumeric = /^\d+$/.test(term);
        const unpadded = term.replace(/^0+/, '') || '0';
        const padded5 = unpadded.padStart(5, '0');
        const upperRaw = term.toUpperCase();
        const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));
        const cleanQ = stripAccents(term);
        const unpaddedQ = cleanQ.replace(/^0+/, '') || cleanQ;
        const padded5Q = isNumeric ? unpaddedQ.padStart(5, '0') : cleanQ;

        const productInclude = {
            marca: { select: { id: true, nombre: true } },
            unidad: { select: { id: true, codigo: true, nombre: true } },
            iva: { select: { id: true, porcentaje: true, nombre: true } },
            proveedores: {
                where: { esPrincipal: true },
                take: 1,
                select: { costo: true, skuProveedor: true }
            },
            stocks: {
                take: 1,
                select: { stockActual: true }
            }
        };

        // Búsqueda de coincidencia exacta O(1)
        const exactConditions: any[] = [];
        if (isNumeric) {
            exactConditions.push({ sku: padded5 });
            exactConditions.push({ sku: unpadded });
            exactConditions.push({ sku: term });
            exactConditions.push({ codigoBarras: term });
            if (term !== padded5) {
                exactConditions.push({ codigoBarras: padded5 });
            }
        } else {
            exactConditions.push({ sku: upperRaw });
            exactConditions.push({ codigoBarras: term });
        }

        const exactMatch = await prisma.producto.findFirst({
            where: {
                OR: exactConditions,
                activo: true,
            },
            include: productInclude,
        });

        // Búsqueda SQL amplia para recolectar candidatos
        const where: any = { activo: true };
        if (isNumeric) {
            where.OR = [
                { sku: { startsWith: unpadded, mode: 'insensitive' } },
                { sku: { startsWith: padded5, mode: 'insensitive' } },
                { sku: { startsWith: term, mode: 'insensitive' } },
                { sku: { contains: unpadded, mode: 'insensitive' } },
                { sku: { contains: term, mode: 'insensitive' } },
                { codigoBarras: { startsWith: term, mode: 'insensitive' } },
                { codigoBarras: { contains: term, mode: 'insensitive' } },
                { descripcion: { contains: unpadded, mode: 'insensitive' } },
                { descripcion: { contains: term, mode: 'insensitive' } },
                {
                    proveedores: {
                        some: { skuProveedor: { contains: term, mode: 'insensitive' } }
                    }
                }
            ];
        } else {
            const searchWhere = buildProductSearchWhere(term);
            if (searchWhere.AND) {
                where.AND = searchWhere.AND;
            } else if (searchWhere.OR) {
                where.OR = searchWhere.OR;
            }
        }

        const rawList = await prisma.producto.findMany({
            where,
            take: Math.max(limit * 3, 60),
            include: productInclude,
        });

        // Asegurarse de incluir exactMatch si existía
        if (exactMatch && !rawList.some((p) => p.id === exactMatch.id)) {
            rawList.unshift(exactMatch);
        }

        // 3. Algoritmo de puntuación y ranking EXACTO al de PDV (pdvSearchEngine.ts)
        type ScoredProduct = { product: typeof rawList[0]; score: number; isExact: boolean };
        const scoredMatches: ScoredProduct[] = [];

        if (isNumeric) {
            for (const p of rawList) {
                const rawSku = (p.sku || '').trim();
                const cleanSku = rawSku.toLowerCase();
                const unpaddedSku = cleanSku.replace(/^0+/, '') || cleanSku;
                const cleanBarcode = (p.codigoBarras || '').trim().toLowerCase();
                const cleanDesc = stripAccents(p.descripcion || '');

                let score = 0;
                const isExact = exactMatch && p.id === exactMatch.id;
                if (isExact) score += 20000;

                // Prioridad alta: SKU empieza con el número buscado (con o sin ceros)
                if (cleanSku.startsWith(cleanQ) || unpaddedSku.startsWith(unpaddedQ) || cleanSku.startsWith(padded5Q)) {
                    score += 5000;
                    score += Math.max(0, 1000 - Math.abs(cleanSku.length - cleanQ.length) * 100);
                } else if (cleanBarcode.startsWith(cleanQ)) {
                    score += 4000;
                } else if (cleanSku.includes(cleanQ) || unpaddedSku.includes(unpaddedQ)) {
                    score += 2000;
                } else if (cleanBarcode.includes(cleanQ)) {
                    score += 1500;
                } else if (cleanDesc.includes(unpaddedQ) || cleanDesc.includes(cleanQ)) {
                    score += 500;
                }

                if (score > 0 || isExact) {
                    scoredMatches.push({ product: p, score, isExact: Boolean(isExact) });
                }
            }
        } else {
            const rawWords = cleanQ.split(/\s+/).filter(Boolean);
            const wordVariantsList = rawWords.map((w) => getWordVariants(w));

            for (const p of rawList) {
                const rawSku = (p.sku || '').trim();
                const cleanSku = rawSku.toLowerCase();
                const unpaddedSku = cleanSku.replace(/^0+/, '') || cleanSku;
                const cleanBarcode = (p.codigoBarras || '').trim().toLowerCase();
                const cleanDesc = stripAccents(p.descripcion || '');
                const cleanMarca = stripAccents(p.marca?.nombre || '');
                const searchString = `${cleanSku} ${unpaddedSku} ${cleanBarcode} ${cleanDesc} ${cleanMarca}`;

                let score = 0;
                const isExact = exactMatch && p.id === exactMatch.id;
                if (isExact) score += 20000;

                let allWordsMatch = true;
                for (let wIdx = 0; wIdx < wordVariantsList.length; wIdx++) {
                    const variants = wordVariantsList[wIdx];
                    let termMatch = false;
                    for (let vIdx = 0; vIdx < variants.length; vIdx++) {
                        const v = variants[vIdx];
                        if (searchString.includes(v)) {
                            termMatch = true;
                            if (cleanSku.includes(v)) score += 800;
                            if (cleanDesc.startsWith(v)) score += 500;
                            break;
                        }
                    }
                    if (!termMatch) {
                        allWordsMatch = false;
                        break;
                    }
                }

                if (allWordsMatch) {
                    score += 1000;
                    if (cleanDesc.includes(cleanQ)) score += 3000;
                    if (cleanSku.startsWith(cleanQ)) score += 4000;
                    scoredMatches.push({ product: p, score, isExact: Boolean(isExact) });
                } else if (isExact) {
                    scoredMatches.push({ product: p, score, isExact: true });
                }
            }
        }

        // Ordenar por score desc, y desempate por SKU natural
        scoredMatches.sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            return (a.product.sku || '').localeCompare(b.product.sku || '', undefined, { numeric: true });
        });

        const sortedMatches = scoredMatches.slice(0, limit);

        const candidatos = sortedMatches.map(({ product: p, isExact }) => {
            const prov = p.proveedores[0] || null;
            const costo = prov ? Number(prov.costo) || 0 : 0;
            const stockActual = p.stocks[0]?.stockActual ?? 0;
            const ivaPorcentaje = p.iva?.porcentaje ?? 21;

            const resPrecio = resolverPrecioProducto(
                {
                    precioBase: p.precioBase,
                    costo,
                    rentabilidad: p.rentabilidad,
                    familiaId: p.familiaId,
                    marcaId: p.marcaId,
                    ivaPorcentaje,
                },
                listaPrecio
            );

            return {
                id: p.id,
                codigo: p.sku,
                sku: p.sku,
                nombre: p.descripcion,
                descripcion: p.descripcion,
                marca: p.marca?.nombre || null,
                marcaId: p.marcaId,
                familiaId: p.familiaId,
                unidad: p.unidad?.codigo || p.unidad?.nombre || 'Unid.',
                precioVenta: resPrecio.precio,
                precioAplicado: resPrecio.precio,
                precioBase: p.precioBase,
                esFallbackPrecio: resPrecio.esFallback,
                detalleAjuste: resPrecio.detalleAjuste,
                ivaPorcentaje,
                costo,
                stockActual,
                esCoincidenciaExacta: isExact,
                skuProveedor: prov?.skuProveedor || null,
            };
        });

        // 4. Fallback retrocompatible a MaterialMaestro si no se encontró en Producto
        if (candidatos.length === 0) {
            const termNoZeros = term.replace(/^0+/, '').toLowerCase();
            const maestroCandidates = await prisma.materialMaestro.findMany({
                where: {
                    OR: [
                        { codigo: { contains: termNoZeros, mode: 'insensitive' } },
                        { nombre: { contains: term, mode: 'insensitive' } }
                    ]
                },
                take: 10
            });
            for (const m of maestroCandidates) {
                const isExact = m.codigo.replace(/^0+/, '').toLowerCase() === termNoZeros;
                candidatos.push({
                    id: m.codigo,
                    codigo: m.codigo,
                    sku: m.codigo,
                    nombre: m.nombre,
                    descripcion: m.nombre,
                    marca: null,
                    marcaId: null,
                    familiaId: null,
                    unidad: m.unidad || 'Unid.',
                    precioVenta: m.precioVenta || 0,
                    precioAplicado: m.precioVenta || 0,
                    precioBase: m.precioVenta || 0,
                    esFallbackPrecio: true,
                    detalleAjuste: 'Legacy MaterialMaestro',
                    ivaPorcentaje: 21,
                    costo: m.costo || 0,
                    stockActual: 0,
                    esCoincidenciaExacta: isExact,
                    skuProveedor: null,
                });
            }
        }

        const bestMatch = candidatos[0] || null;

        // Si se solicitó búsqueda por código simple (consumidor legacy):
        if (searchCodigo && !searchParams.get('all') && !searchQuery) {
            if (!bestMatch) {
                return NextResponse.json(null, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
            }
            return NextResponse.json({
                ...bestMatch,
                candidatos,
                listaPrecio: listaPrecio ? { id: listaPrecio.id, codigo: listaPrecio.codigo, nombre: listaPrecio.nombre } : null
            }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
        }

        // Búsqueda general o incremental (para dropdowns y buscadores interactivos)
        return NextResponse.json({
            productos: candidatos,
            candidatos,
            hasExactMatch: Boolean(exactMatch),
            exactMatchId: exactMatch?.id || null,
            totalEncontrados: candidatos.length,
            listaPrecio: listaPrecio ? { id: listaPrecio.id, codigo: listaPrecio.codigo, nombre: listaPrecio.nombre } : null
        }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
    }

    if (!proyectoId) return NextResponse.json({ error: 'proyectoId requerido' }, { status: 400 });

    const materiales = await prisma.materialProyecto.findMany({
        where: { proyectoId },
        include: {
            usos: { orderBy: { createdAt: 'desc' } },
            devoluciones: { orderBy: { createdAt: 'desc' } },
        },
        orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(materiales);
}

// POST /api/materiales-proyecto — crear material
export async function POST(req: Request) {
    const body = await req.json();
    const { proyectoId, nombre, unidad, codigo, cantidadSolicitada, cantidadDisponible, cantidadEntregada, precioVenta } = body;
    if (!proyectoId || !nombre) return NextResponse.json({ error: 'proyectoId y nombre son requeridos' }, { status: 400 });

    // Si el precio no fue ingresado manualmente, resolverlo desde Gestión Comercial si hay código
    let resolvedPrecioVenta = precioVenta !== undefined && precioVenta !== null && String(precioVenta).trim() !== ''
        ? parseFloat(precioVenta)
        : null;

    if (resolvedPrecioVenta === null && codigo) {
        try {
            const trimmedCode = String(codigo).trim();
            const upperCode = trimmedCode.toUpperCase();
            const unpadded = trimmedCode.replace(/^0+/, '') || '0';
            const padded5 = unpadded.padStart(5, '0');

            const prod = await prisma.producto.findFirst({
                where: {
                    activo: true,
                    OR: [
                        { sku: upperCode },
                        { sku: padded5 },
                        { sku: unpadded },
                        { codigoBarras: trimmedCode }
                    ]
                },
                include: {
                    iva: { select: { porcentaje: true } },
                    proveedores: { where: { esPrincipal: true }, take: 1, select: { costo: true } }
                }
            });

            if (prod) {
                let lp: any = null;
                const prj = await prisma.project.findUnique({
                    where: { id: proyectoId },
                    select: { listaPrecio: true, client: { select: { listaPrecioId: true } } }
                });
                if (prj?.listaPrecio) lp = prj.listaPrecio;
                else if (prj?.client?.listaPrecioId) {
                    lp = await prisma.listaPrecio.findUnique({ where: { id: prj.client.listaPrecioId, activo: true } });
                }
                if (!lp) {
                    lp = await prisma.listaPrecio.findFirst({ where: { esPredeterminada: true, activo: true } });
                }
                const costo = prod.proveedores[0]?.costo ? Number(prod.proveedores[0].costo) : 0;
                const calculated = resolverPrecioProducto({
                    precioBase: prod.precioBase,
                    costo,
                    rentabilidad: prod.rentabilidad,
                    familiaId: prod.familiaId,
                    marcaId: prod.marcaId,
                    ivaPorcentaje: prod.iva?.porcentaje ?? 21,
                }, lp);
                resolvedPrecioVenta = calculated.precio;
            }
        } catch (err) {
            console.error('Error auto-resolving price for project material:', err);
        }
    }

    const material = await prisma.materialProyecto.create({
        data: {
            proyectoId,
            nombre,
            codigo: codigo || null,
            unidad: unidad || 'unidad',
            cantidadSolicitada: parseFloat(cantidadSolicitada) || 0,
            cantidadDisponible: parseFloat(cantidadDisponible) || 0,
            cantidadEntregada: parseFloat(cantidadEntregada) || 0,
            precioVenta: resolvedPrecioVenta,
            estado: (parseFloat(cantidadEntregada) > 0) ? 'material_entregado' : 'material_cargado'
        },
        include: { usos: true, devoluciones: true },
    });

    // Actualizar MaterialMaestro en try/catch para retrocompatibilidad segura
    if (codigo) {
        try {
            await prisma.materialMaestro.upsert({
                where: { codigo },
                update: { 
                    nombre, 
                    unidad: unidad || 'unidad',
                    precioVenta: resolvedPrecioVenta ?? undefined
                },
                create: { 
                    codigo, 
                    nombre, 
                    unidad: unidad || 'unidad',
                    precioVenta: resolvedPrecioVenta
                },
            });
        } catch (e) {
            console.warn('Upsert fallback legacy MaterialMaestro ignored:', e);
        }
    }

    return NextResponse.json(material, { status: 201 });
}
