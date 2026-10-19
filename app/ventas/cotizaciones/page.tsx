'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import VentasNavTabs from '@/components/ventas/VentasNavTabs';
import {
    Search, FileText, User, History, Trash2, Plus, Printer,
    RotateCcw, Package, Edit3, Loader2, Wrench, ShoppingCart, RefreshCw,
    ArrowUpDown, ArrowUp, ArrowDown, X, FileCheck2, Save
} from 'lucide-react';
import {
    buildCatalogIndex,
    searchCatalog,
    CatalogIndex,
    ProductoPDV,
} from '@/lib/ventas/pdvSearchEngine';
import { resolverPrecioProducto } from '@/lib/ventas/priceRules';
import { showToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import SeleccionarClienteModal from '@/components/ventas/pdv/SeleccionarClienteModal';
import ImprimirCotizacionModal from '@/components/ventas/cotizaciones/ImprimirCotizacionModal';
import AgregarItemManualModal, { ItemManualOutput } from '@/components/ventas/cotizaciones/AgregarItemManualModal';
import HistorialCotizacionesModal from '@/components/ventas/cotizaciones/HistorialCotizacionesModal';

interface ItemCotizador {
    id: string;
    productoId: string | null;
    esManual: boolean;
    codigo: string;
    nombre: string;
    marca?: string | null;
    unidad: string;
    cantidad: number;
    precioOriginal: number;
    precioUnitario: number;
    alicuotaIva: number;
    descuentoPct: number;
    subtotal: number;
    observacion: string;
    stockActual?: number;
}

interface ListaPrecioItem {
    id: string;
    codigo: string;
    nombre: string;
    tipoAjuste: string;
    valorAjuste: number;
    esPredeterminada: boolean;
    ivaDiscriminado?: boolean;
}

export default function CotizacionesPage() {
    const router = useRouter();

    const [currentUser, setCurrentUser] = useState<any>(null);
    const [cotizacionEditandoId, setCotizacionEditandoId] = useState<string | null>(null);
    const [cotizacionEditandoNumero, setCotizacionEditandoNumero] = useState<string | null>(null);

    // Catálogo e índice en memoria
    const [rawCatalogo, setRawCatalogo] = useState<ProductoPDV[]>([]);
    const [catalogIndex, setCatalogIndex] = useState<CatalogIndex | null>(null);
    const [isLoadingCatalogo, setIsLoadingCatalogo] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [allSearchMatches, setAllSearchMatches] = useState<ProductoPDV[]>([]);
    const [visibleCatalogLimit, setVisibleCatalogLimit] = useState<number>(60);
    const [selectedIndex, setSelectedIndex] = useState<number>(-1);

    // Ordenamiento de la tabla de ítems cotizados
    const [itemSortBy, setItemSortBy] = useState<'none' | 'nombre' | 'cantidad' | 'precioUnitario' | 'descuentoPct' | 'subtotal'>('none');
    const [itemSortOrder, setItemSortOrder] = useState<'asc' | 'desc'>('asc');

    // Listas de precios
    const [listasPrecios, setListasPrecios] = useState<ListaPrecioItem[]>([]);
    const [listaSeleccionadaId, setListaSeleccionadaId] = useState<string>('');

    // Datos del cliente / destinatario
    const [clienteId, setClienteId] = useState<string | null>(null);
    const [clienteNombre, setClienteNombre] = useState('Consumidor Final');
    const [clienteCuit, setClienteCuit] = useState('');
    const [clienteTelefono, setClienteTelefono] = useState('');
    const [clienteEmail, setClienteEmail] = useState('');
    const [clienteDireccion, setClienteDireccion] = useState('');
    const [mostrarDatosProspecto, setMostrarDatosProspecto] = useState(false);

    // Condiciones comerciales de la cotización
    const [validezDias, setValidezDias] = useState<number>(15);
    const [condicionPago, setCondicionPago] = useState('Contado / Transferencia');
    const [plazoEntrega, setPlazoEntrega] = useState('Inmediata s/stock');
    const [referenciaObra, setReferenciaObra] = useState('');
    const [observaciones, setObservaciones] = useState('');
    const [descuentoGlobalPct, setDescuentoGlobalPct] = useState<number>(0);

    // Ítems cotizados
    const [items, setItems] = useState<ItemCotizador[]>([]);
    const [guardando, setGuardando] = useState(false);

    // Modales
    const [showClienteModal, setShowClienteModal] = useState(false);
    const [showItemManualModal, setShowItemManualModal] = useState(false);
    const [showHistorialModal, setShowHistorialModal] = useState(false);
    const [cotizacionImprimir, setCotizacionImprimir] = useState<any | null>(null);
    const [showConfirmReiniciar, setShowConfirmReiniciar] = useState(false);

    const searchInputRef = useRef<HTMLInputElement>(null);

    const fmt = (n: number) =>
        (n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // 1. Cargar operador actual
    useEffect(() => {
        try {
            const stored = localStorage.getItem('currentUser');
            if (stored) {
                setCurrentUser(JSON.parse(stored));
            }
        } catch (err) {
            console.error(err);
        }
    }, []);

    // 2. Cargar catálogo y listas de precios
    const cargarCatalogoYListas = useCallback(async () => {
        setIsLoadingCatalogo(true);
        try {
            const [resCat, resListas] = await Promise.all([
                fetch('/api/ventas/pdv/catalogo'),
                fetch('/api/ventas/listas-precios'),
            ]);
            if (resCat.ok) {
                const dataCat = await resCat.json();
                const prods: ProductoPDV[] = dataCat.productos || [];
                setRawCatalogo(prods);
                const idx = buildCatalogIndex(prods);
                setCatalogIndex(idx);
                setAllSearchMatches(prods);
            }
            if (resListas.ok) {
                const dataListas = await resListas.json();
                const rawListas: any[] = Array.isArray(dataListas)
                    ? dataListas
                    : dataListas.listas || [];
                const listas: ListaPrecioItem[] = rawListas.filter((l: any) => l.activo !== false);
                setListasPrecios(listas);
                const pred = listas.find((l) => l.esPredeterminada) || listas[0];
                if (pred) {
                    setListaSeleccionadaId((prev) => prev || pred.id);
                }
            }
        } catch (err) {
            console.error('Error cargando catálogo en cotizador:', err);
        } finally {
            setIsLoadingCatalogo(false);
        }
    }, []);

    useEffect(() => {
        cargarCatalogoYListas();
    }, [cargarCatalogoYListas]);

    // 3. Búsqueda instantánea en memoria con scroll progresivo
    useEffect(() => {
        if (!catalogIndex) return;
        const q = searchQuery.trim();
        setVisibleCatalogLimit(60);
        if (!q) {
            setAllSearchMatches(rawCatalogo);
            setSelectedIndex(-1);
            return;
        }
        const res = searchCatalog(q, catalogIndex);
        setAllSearchMatches(res.resultados);
        setSelectedIndex(res.resultados.length > 0 ? 0 : -1);
    }, [searchQuery, catalogIndex, rawCatalogo]);

    const resultadosBusqueda = useMemo(
        () => allSearchMatches.slice(0, visibleCatalogLimit),
        [allSearchMatches, visibleCatalogLimit]
    );

    const itemsOrdenados = useMemo(() => {
        if (itemSortBy === 'none') return items;
        const dir = itemSortOrder === 'desc' ? -1 : 1;
        return [...items].sort((a, b) => {
            switch (itemSortBy) {
                case 'nombre':
                    return a.nombre.localeCompare(b.nombre) * dir;
                case 'cantidad':
                    return (a.cantidad - b.cantidad) * dir;
                case 'precioUnitario':
                    return (a.precioUnitario - b.precioUnitario) * dir;
                case 'descuentoPct':
                    return (a.descuentoPct - b.descuentoPct) * dir;
                case 'subtotal':
                    return (a.subtotal - b.subtotal) * dir;
                default:
                    return 0;
            }
        });
    }, [items, itemSortBy, itemSortOrder]);

    const listaActiva = useMemo(
        () => listasPrecios.find((l) => l.id === listaSeleccionadaId) || null,
        [listasPrecios, listaSeleccionadaId]
    );

    const esIvaDiscriminado = Boolean(listaActiva?.ivaDiscriminado);

    // Agregar producto del catálogo a la cotización
    const handleAgregarProducto = useCallback(
        (prod: ProductoPDV) => {
            const { precio } = resolverPrecioProducto(prod, listaActiva);
            setItems((prev) => {
                const existente = prev.find((it) => !it.esManual && it.productoId === prod.id);
                if (existente) {
                    return prev.map((it) => {
                        if (it.id !== existente.id) return it;
                        const nuevaCant = Math.round((it.cantidad + 1) * 100) / 100;
                        const sub =
                            Math.round(
                                nuevaCant * it.precioUnitario * (1 - it.descuentoPct / 100) * 100
                            ) / 100;
                        return { ...it, cantidad: nuevaCant, subtotal: sub };
                    });
                }
                const nuevo: ItemCotizador = {
                    id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    productoId: prod.id,
                    esManual: false,
                    codigo: prod.sku,
                    nombre: prod.descripcion,
                    marca: prod.marca || null,
                    unidad: prod.unidad || 'u',
                    cantidad: 1,
                    precioOriginal: precio,
                    precioUnitario: precio,
                    alicuotaIva: prod.ivaPorcentaje ?? 21,
                    descuentoPct: 0,
                    subtotal: precio,
                    observacion: '',
                    stockActual: prod.stockActual,
                };
                return [...prev, nuevo];
            });
            setSearchQuery('');
            searchInputRef.current?.focus();
        },
        [listaActiva]
    );

    // Agregar ítem libre / manual
    const handleAgregarItemManual = (itemMan: ItemManualOutput) => {
        const sub =
            Math.round(
                itemMan.cantidad * itemMan.precioUnitario * (1 - itemMan.descuentoPct / 100) * 100
            ) / 100;
        const nuevo: ItemCotizador = {
            id: `man-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            productoId: null,
            esManual: true,
            codigo: itemMan.codigo,
            nombre: itemMan.nombre,
            unidad: itemMan.unidad,
            cantidad: itemMan.cantidad,
            precioOriginal: itemMan.precioUnitario,
            precioUnitario: itemMan.precioUnitario,
            alicuotaIva: itemMan.alicuotaIva,
            descuentoPct: itemMan.descuentoPct,
            subtotal: sub,
            observacion: itemMan.observacion,
        };
        setItems((prev) => [...prev, nuevo]);
        showToast('Ítem personalizado agregado a la cotización', 'success');
    };

    // Cambio de lista de precios recalcula ítems de catálogo
    const handleCambiarLista = (nuevaListaId: string) => {
        setListaSeleccionadaId(nuevaListaId);
        const nuevaLista = listasPrecios.find((l) => l.id === nuevaListaId) || null;
        if (!nuevaLista) return;

        setItems((prev) =>
            prev.map((it) => {
                if (it.esManual || !it.productoId) return it;
                const prod = rawCatalogo.find((p) => p.id === it.productoId);
                if (!prod) return it;
                const { precio } = resolverPrecioProducto(prod, nuevaLista);
                const sub =
                    Math.round(it.cantidad * precio * (1 - it.descuentoPct / 100) * 100) / 100;
                return {
                    ...it,
                    precioOriginal: precio,
                    precioUnitario: precio,
                    subtotal: sub,
                };
            })
        );
    };

    const handleActualizarItem = (
        id: string,
        field: 'cantidad' | 'precioUnitario' | 'descuentoPct' | 'nombre' | 'observacion',
        value: string | number
    ) => {
        setItems((prev) =>
            prev.map((it) => {
                if (it.id !== id) return it;
                const updated = { ...it, [field]: value };
                const rawCant = updated.cantidad;
                const rawPrecio = updated.precioUnitario;
                const rawDesc = updated.descuentoPct;
                const cant = typeof rawCant === 'number' ? Math.max(0, rawCant) : (rawCant === '' ? '' : Math.max(0, parseFloat(rawCant) || 0));
                const precio = typeof rawPrecio === 'number' ? Math.max(0, rawPrecio) : (rawPrecio === '' ? '' : Math.max(0, parseFloat(rawPrecio) || 0));
                const desc = typeof rawDesc === 'number' ? Math.min(100, Math.max(0, rawDesc)) : (rawDesc === '' ? '' : Math.min(100, Math.max(0, parseFloat(rawDesc) || 0)));
                const calcCant = typeof cant === 'number' ? cant : 0;
                const calcPrecio = typeof precio === 'number' ? precio : 0;
                const calcDesc = typeof desc === 'number' ? desc : 0;
                const sub = Math.round(calcCant * calcPrecio * (1 - calcDesc / 100) * 100) / 100;
                return {
                    ...updated,
                    cantidad: cant as any,
                    precioUnitario: precio as any,
                    descuentoPct: desc as any,
                    subtotal: sub,
                };
            })
        );
    };

    const handleEliminarItem = (id: string) => {
        setItems((prev) => prev.filter((it) => it.id !== id));
    };

    // Totales calculados en vivo
    const totales = useMemo(() => {
        let subtotalBruto = 0;
        let descuentoLineasMonto = 0;
        let subtotalLineas = 0;

        for (const it of items) {
            const bruto = Math.round(it.cantidad * it.precioUnitario * 100) / 100;
            const desc = Math.round(bruto * (it.descuentoPct / 100) * 100) / 100;
            const neto = Math.round((bruto - desc) * 100) / 100;
            subtotalBruto += bruto;
            descuentoLineasMonto += desc;
            subtotalLineas += neto;
        }

        subtotalBruto = Math.round(subtotalBruto * 100) / 100;
        descuentoLineasMonto = Math.round(descuentoLineasMonto * 100) / 100;
        subtotalLineas = Math.round(subtotalLineas * 100) / 100;

        const descuentoGlobalMonto =
            Math.round(
                subtotalLineas * (Math.min(100, Math.max(0, descuentoGlobalPct)) / 100) * 100
            ) / 100;
        const baseImponible = Math.round((subtotalLineas - descuentoGlobalMonto) * 100) / 100;

        let montoIvaTotal = 0;
        const factorGlobal = 1 - Math.min(100, Math.max(0, descuentoGlobalPct)) / 100;
        for (const it of items) {
            const baseItem = Math.round(it.subtotal * factorGlobal * 100) / 100;
            if (esIvaDiscriminado) {
                montoIvaTotal += Math.round(baseItem * (it.alicuotaIva / 100) * 100) / 100;
            } else {
                const netoSinIva = baseItem / (1 + it.alicuotaIva / 100);
                montoIvaTotal += Math.round((baseItem - netoSinIva) * 100) / 100;
            }
        }
        montoIvaTotal = Math.round(montoIvaTotal * 100) / 100;

        const totalFinal = esIvaDiscriminado
            ? Math.round((baseImponible + montoIvaTotal) * 100) / 100
            : baseImponible;

        return {
            subtotalBruto,
            descuentoLineasMonto,
            subtotalLineas,
            descuentoGlobalMonto,
            baseImponible,
            montoIvaTotal,
            totalFinal,
        };
    }, [items, descuentoGlobalPct, esIvaDiscriminado]);

    const handleLimpiarCotizador = useCallback(() => {
        setCotizacionEditandoId(null);
        setCotizacionEditandoNumero(null);
        setItems([]);
        setClienteId(null);
        setClienteNombre('Consumidor Final');
        setClienteCuit('');
        setClienteTelefono('');
        setClienteEmail('');
        setClienteDireccion('');
        setReferenciaObra('');
        setObservaciones('');
        setDescuentoGlobalPct(0);
        setValidezDias(15);
        setCondicionPago('Contado / Transferencia');
        setPlazoEntrega('Inmediata s/stock');
        searchInputRef.current?.focus();
    }, []);

    const handleSolicitarReiniciar = () => {
        if (items.length > 0) {
            setShowConfirmReiniciar(true);
        } else {
            handleLimpiarCotizador();
        }
    };

    // Guardar cotización (y opcionalmente imprimir o enviar a PDV)
    const handleGuardarCotizacion = async (accionPosterior: 'IMPRIMIR' | 'ENVIAR_PDV' | 'SOLO_GUARDAR') => {
        if (items.length === 0) {
            showToast('Agregue al menos un ítem para generar la cotización', 'error');
            return;
        }

        const itemInvalido = items.find((it) => !it.nombre?.trim() || Number(it.cantidad) <= 0);
        if (itemInvalido) {
            showToast('Todos los artículos deben tener descripción y cantidad mayor a 0', 'error');
            return;
        }

        setGuardando(true);
        try {
            const vendedorNombre =
                currentUser?.nombreCompleto ||
                currentUser?.name ||
                currentUser?.nombre ||
                'Ventas HDB';

            const payload = {
                cotizacionId: cotizacionEditandoId || undefined,
                clienteId,
                clienteNombre: clienteNombre.trim() || 'Consumidor Final',
                clienteIdentificacion: clienteCuit.trim() || null,
                clienteTelefono: clienteTelefono.trim() || null,
                clienteEmail: clienteEmail.trim() || null,
                clienteDireccion: clienteDireccion.trim() || null,
                vendedorId: currentUser?.id || null,
                vendedorNombre,
                listaPrecioId: listaSeleccionadaId || null,
                ivaDiscriminado: esIvaDiscriminado,
                validezDias,
                condicionPago,
                plazoEntrega,
                referenciaObra: referenciaObra.trim() || null,
                descuentoPorcentaje: descuentoGlobalPct,
                observaciones: observaciones.trim() || null,
                items: items.map((it) => ({
                    productoId: it.productoId,
                    esManual: it.esManual,
                    sku: it.codigo || '999999',
                    descripcion: it.nombre,
                    marca: it.marca || null,
                    unidad: it.unidad,
                    cantidad: Number(it.cantidad) || 1,
                    precioOriginal: Number(it.precioOriginal) || 0,
                    precioUnitario: Number(it.precioUnitario) || 0,
                    ivaPorcentaje: it.alicuotaIva,
                    descuentoPorcentaje: Number(it.descuentoPct) || 0,
                    precioModificado: Math.abs(it.precioOriginal - it.precioUnitario) > 0.01,
                    motivoModificacion: it.observacion || null,
                })),
            };

            const isUpdate = Boolean(cotizacionEditandoId);
            const url = isUpdate
                ? `/api/ventas/cotizaciones/${cotizacionEditandoId}`
                : '/api/ventas/cotizaciones';
            const method = isUpdate ? 'PUT' : 'POST';
            const idempotencyKey = `cot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'x-idempotency-key': idempotencyKey,
                },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Error al guardar la cotización');
            }

            const cotGuardada = data.cotizacion || data;

            showToast(
                isUpdate
                    ? `Cotización ${cotGuardada.numero} actualizada con éxito`
                    : `Cotización ${cotGuardada.numero} generada con éxito`,
                'success'
            );

            setCotizacionEditandoId(cotGuardada.id);
            setCotizacionEditandoNumero(cotGuardada.numero);

            if (accionPosterior === 'ENVIAR_PDV') {
                router.push(`/ventas/pdv?cotizacionId=${cotGuardada.id}`);
            } else if (accionPosterior === 'IMPRIMIR') {
                setCotizacionImprimir(cotGuardada);
            }
        } catch (err: any) {
            showToast(err.message || 'Error al registrar cotización', 'error');
        } finally {
            setGuardando(false);
        }
    };

    const handleCargarCotizacionEnEditor = (cot: any, comoDuplicado = false) => {
        setCotizacionEditandoId(comoDuplicado ? null : cot.id);
        setCotizacionEditandoNumero(comoDuplicado ? null : cot.numero);
        setClienteId(cot.clienteId || null);
        setClienteNombre(cot.clienteNombre || 'Consumidor Final');
        setClienteCuit(cot.clienteIdentificacion || cot.clienteCuit || '');
        setClienteTelefono(cot.clienteTelefono || '');
        setClienteEmail(cot.clienteEmail || '');
        setClienteDireccion(cot.clienteDireccion || '');
        if (cot.clienteIdentificacion || cot.clienteTelefono || cot.clienteEmail || cot.clienteDireccion) {
            setMostrarDatosProspecto(true);
        }
        if (cot.listaPrecioId) setListaSeleccionadaId(cot.listaPrecioId);
        setValidezDias(cot.validezDias || 15);
        setCondicionPago(cot.condicionPago || 'Contado / Transferencia');
        setPlazoEntrega(cot.plazoEntrega || 'Inmediata s/stock');
        setReferenciaObra(cot.referenciaObra || '');
        setObservaciones(cot.observaciones || '');
        setDescuentoGlobalPct(cot.descuentoPorcentaje || 0);

        const loadedItems: ItemCotizador[] = (cot.items || []).map((it: any, idx: number) => ({
            id: `loaded-${idx}-${Date.now()}`,
            productoId: it.productoId || null,
            esManual: Boolean(it.esManual || !it.productoId),
            codigo: it.sku || it.codigo || 'ITEM',
            nombre: it.descripcion || it.nombre,
            marca: it.marca || null,
            unidad: it.unidad || 'u',
            cantidad: it.cantidad,
            precioOriginal: it.precioOriginal || it.precioUnitario,
            precioUnitario: it.precioUnitario,
            alicuotaIva: it.ivaPorcentaje ?? it.alicuotaIva ?? 21,
            descuentoPct: it.descuentoPorcentaje || it.descuentoPct || 0,
            subtotal: it.subtotal,
            observacion: it.motivoModificacion || it.observacion || '',
        }));
        setItems(loadedItems);
        setShowHistorialModal(false);
        setCotizacionImprimir(null);
        showToast(
            comoDuplicado
                ? `Cotización ${cot.numero} duplicada como nuevo borrador`
                : `Editando cotización ${cot.numero}`,
            'info'
        );
    };

    // Atajos de teclado rápidos (estilo PDV)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'F2') {
                e.preventDefault();
                searchInputRef.current?.focus();
            } else if (e.key === 'F3') {
                e.preventDefault();
                setShowClienteModal(true);
            } else if (e.key === 'F4') {
                e.preventDefault();
                if (items.length === 0) {
                    showToast('Agregue al menos un ítem para generar la cotización', 'info');
                } else if (!guardando) {
                    handleGuardarCotizacion('IMPRIMIR');
                }
            } else if (e.key === 'F6') {
                e.preventDefault();
                setShowItemManualModal(true);
            } else if (e.key === 'F8') {
                e.preventDefault();
                setShowHistorialModal(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    });

    return (
        <div className="flex flex-col h-full w-full min-h-0 max-h-full overflow-hidden gap-2">
            {/* Barra superior de navegación + Estado del Cotizador */}
            <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
                <VentasNavTabs currentTab="cotizaciones" />

                <div className="flex items-center gap-2 flex-wrap">
                    {cotizacionEditandoNumero && (
                        <div className="px-3 py-1.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-black flex items-center gap-2 whitespace-nowrap">
                            <span>Editando {cotizacionEditandoNumero}</span>
                            <button
                                onClick={handleSolicitarReiniciar}
                                className="text-[10px] underline hover:text-amber-950 dark:hover:text-white"
                            >
                                Salir / Nueva
                            </button>
                        </div>
                    )}

                    <button
                        onClick={() => setShowItemManualModal(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-colors whitespace-nowrap"
                    >
                        <Wrench className="w-3.5 h-3.5 shrink-0" />
                        <span>+ Ítem Libre / M.O. [F6]</span>
                    </button>

                    <button
                        onClick={() => setShowHistorialModal(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-card hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 transition-colors shadow-2xs whitespace-nowrap"
                    >
                        <History className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <span>Historial Cotizaciones [F8]</span>
                    </button>
                </div>
            </div>

            {/* Cuerpo Split-Pane estilo PDV */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-2.5 overflow-y-auto lg:overflow-hidden">
                {/* Panel Izquierdo: Buscador de Catálogo Ultra-Rápido (5 cols) */}
                <div className="lg:col-span-5 bg-card rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col min-h-[350px] lg:min-h-0 h-full overflow-hidden">
                    <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 space-y-2.5 shrink-0">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                                <Package className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                Catálogo de Materiales ({allSearchMatches.length} / {rawCatalogo.length})
                            </span>
                            <button
                                onClick={cargarCatalogoYListas}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                title="Recargar catálogo"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCatalogo ? 'animate-spin' : ''}`} />
                            </button>
                        </div>

                        <div className="relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder="[F2] Buscar por código, descripción, marca o escáner..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Escape' && searchQuery) {
                                        e.preventDefault();
                                        setSearchQuery('');
                                    } else if (e.key === 'ArrowDown') {
                                        e.preventDefault();
                                        setSelectedIndex((prev) =>
                                            Math.min(resultadosBusqueda.length - 1, prev + 1)
                                        );
                                    } else if (e.key === 'ArrowUp') {
                                        e.preventDefault();
                                        setSelectedIndex((prev) => Math.max(0, prev - 1));
                                    } else if (e.key === 'Enter' && resultadosBusqueda.length > 0) {
                                        e.preventDefault();
                                        const idx = selectedIndex >= 0 ? selectedIndex : 0;
                                        if (resultadosBusqueda[idx]) {
                                            handleAgregarProducto(resultadosBusqueda[idx]);
                                        }
                                    }
                                }}
                                className="w-full pl-10 pr-8 py-2.5 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-700 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Resultados del Catálogo con Scroll Progresivo */}
                    <div
                        className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80"
                        onScroll={(e) => {
                            const target = e.currentTarget;
                            if (
                                target.scrollHeight - target.scrollTop - target.clientHeight < 180 &&
                                visibleCatalogLimit < allSearchMatches.length
                            ) {
                                setVisibleCatalogLimit((prev) =>
                                    Math.min(allSearchMatches.length, prev + 60)
                                );
                            }
                        }}
                    >
                        {isLoadingCatalogo ? (
                            <div className="p-12 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                                <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                                Indexando catálogo para cotización rápida...
                            </div>
                        ) : resultadosBusqueda.length === 0 ? (
                            <div className="p-8 text-center space-y-3">
                                <p className="text-xs text-slate-500">
                                    No se encontraron artículos en catálogo para &ldquo;{searchQuery}&rdquo;.
                                </p>
                                <button
                                    onClick={() => setShowItemManualModal(true)}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700"
                                >
                                    <Plus className="w-4 h-4" />
                                    Cotizar como Ítem Especial / Fuera de Catálogo
                                </button>
                            </div>
                        ) : (
                            resultadosBusqueda.map((prod, idx) => {
                                const { precio } = resolverPrecioProducto(prod, listaActiva);
                                const isSelected = idx === selectedIndex;

                                return (
                                    <div
                                        key={prod.id}
                                        onClick={() => handleAgregarProducto(prod)}
                                        className={`p-3 cursor-pointer transition-colors flex items-center justify-between gap-3 ${
                                            isSelected
                                                ? 'bg-indigo-50/90 dark:bg-indigo-950/40'
                                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                                        }`}
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-mono text-[11px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded">
                                                    {prod.sku}
                                                </span>
                                                {prod.marca && (
                                                    <span className="text-[10px] font-bold uppercase text-slate-400">
                                                        {prod.marca}
                                                    </span>
                                                )}
                                                <span
                                                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                                        prod.stockActual > 0
                                                            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                                                            : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'
                                                    }`}
                                                >
                                                    {prod.stockActual > 0
                                                        ? `Stock: ${prod.stockActual} ${prod.unidad || 'u'}`
                                                        : 'S/Stock (Cotizable)'}
                                                </span>
                                            </div>
                                            <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate mt-1">
                                                {prod.descripcion}
                                            </div>
                                        </div>

                                        <div className="text-right shrink-0">
                                            <div className="text-sm font-black font-mono text-slate-900 dark:text-slate-100">
                                                $ {fmt(precio)}{' '}
                                                <span className="text-[10px] font-sans font-bold text-slate-400">ARS</span>
                                            </div>
                                            <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">
                                                + Agregar
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Panel Derecho: Armador de Cotización Profesional (7 cols) */}
                <div className="lg:col-span-7 bg-card rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col min-h-[450px] lg:min-h-0 h-full overflow-hidden">
                    {/* Cabecera Comercial: Cliente + Lista + Validez + Condiciones */}
                    <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 space-y-2.5 shrink-0">
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                            {/* Selector de Cliente */}
                            <div className="sm:col-span-5 flex items-center gap-2 bg-background px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
                                <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                <div className="min-w-0 flex-1">
                                    <div className="text-[10px] font-bold uppercase text-slate-400">
                                        Cliente / Destinatario [F3]
                                    </div>
                                    <input
                                        type="text"
                                        value={clienteNombre}
                                        onChange={(e) => setClienteNombre(e.target.value)}
                                        placeholder="Nombre de Empresa o Cliente..."
                                        className="w-full text-xs font-bold text-slate-900 dark:text-slate-100 bg-transparent focus:outline-none"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowClienteModal(true)}
                                    className="px-2 py-1 rounded-lg text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 shrink-0"
                                >
                                    Elegir
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMostrarDatosProspecto(!mostrarDatosProspecto)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                    title="Editar CUIT, Teléfono y Email del destinatario"
                                >
                                    <Edit3 className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            {/* Lista de Precios */}
                            <div className="sm:col-span-4 bg-background px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
                                <label className="block text-[10px] font-bold uppercase text-slate-400">
                                    Lista de Precios
                                </label>
                                <select
                                    value={listaSeleccionadaId}
                                    onChange={(e) => handleCambiarLista(e.target.value)}
                                    className="w-full text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none bg-transparent"
                                >
                                    {listasPrecios.map((l) => (
                                        <option key={l.id} value={l.id}>
                                            {l.nombre} {l.ivaDiscriminado ? '(+IVA)' : '(Final)'}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Validez en días */}
                            <div className="sm:col-span-3 bg-background px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
                                <label className="block text-[10px] font-bold uppercase text-slate-400">
                                    Validez Oferta
                                </label>
                                <select
                                    value={validezDias}
                                    onChange={(e) => setValidezDias(Number(e.target.value))}
                                    className="w-full text-xs font-bold text-amber-800 dark:text-amber-300 focus:outline-none bg-transparent"
                                >
                                    <option value={3}>3 días corridos</option>
                                    <option value={7}>7 días corridos</option>
                                    <option value={15}>15 días corridos</option>
                                    <option value={30}>30 días corridos</option>
                                    <option value={60}>60 días corridos</option>
                                </select>
                            </div>
                        </div>

                        {/* Barra de Condiciones Comerciales y Obra */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <input
                                type="text"
                                value={condicionPago}
                                onChange={(e) => setCondicionPago(e.target.value)}
                                placeholder="Condición de pago (Ej: Contado / 30 días)"
                                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-foreground"
                            />
                            <input
                                type="text"
                                value={plazoEntrega}
                                onChange={(e) => setPlazoEntrega(e.target.value)}
                                placeholder="Plazo de entrega (Ej: Inmediata s/stock)"
                                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-foreground"
                            />
                            <input
                                type="text"
                                value={referenciaObra}
                                onChange={(e) => setReferenciaObra(e.target.value)}
                                placeholder="Referencia Obra / Licitación / OC..."
                                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-foreground font-medium"
                            />
                        </div>

                        {mostrarDatosProspecto && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-slate-200 dark:border-slate-700 animate-in fade-in duration-150">
                                <input
                                    type="text"
                                    value={clienteCuit}
                                    onChange={(e) => setClienteCuit(e.target.value)}
                                    placeholder="CUIT / DNI del destinatario"
                                    className="px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-foreground"
                                />
                                <input
                                    type="text"
                                    value={clienteTelefono}
                                    onChange={(e) => setClienteTelefono(e.target.value)}
                                    placeholder="Teléfono / WhatsApp"
                                    className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-foreground"
                                />
                                <input
                                    type="text"
                                    value={clienteEmail}
                                    onChange={(e) => setClienteEmail(e.target.value)}
                                    placeholder="Email de contacto"
                                    className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-foreground"
                                />
                            </div>
                        )}
                    </div>

                    {/* Grilla de Ítems de la Cotización */}
                    <div className="flex-1 overflow-y-auto">
                        {items.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
                                <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-2" />
                                <div className="text-sm font-bold text-slate-600 dark:text-slate-300">
                                    Cotización vacía
                                </div>
                                <p className="text-xs text-slate-400 max-w-sm mt-1">
                                    Seleccione materiales del catálogo izquierdo o presione{' '}
                                    <button
                                        onClick={() => setShowItemManualModal(true)}
                                        className="text-indigo-600 dark:text-indigo-400 font-bold underline"
                                    >
                                        + Ítem Libre [F6]
                                    </button>{' '}
                                    para cotizar tableros, mano de obra o artículos bajo pedido.
                                </p>
                            </div>
                        ) : (
                            <table className="w-full text-xs">
                                <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 select-none whitespace-nowrap">
                                    <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                        {[
                                            { key: 'nombre', label: 'Material / Concepto', align: 'left', className: 'py-2 px-3 text-left' },
                                            { key: 'cantidad', label: 'Cant.', align: 'center', className: 'py-2 px-2 text-center w-24' },
                                            { key: 'precioUnitario', label: 'Precio Unit. (ARS)', align: 'right', className: 'py-2 px-2 text-right w-36' },
                                            { key: 'descuentoPct', label: 'Bonif %', align: 'right', className: 'py-2 px-2 text-right w-24' },
                                            { key: 'subtotal', label: 'Subtotal (ARS)', align: 'right', className: 'py-2 px-3 text-right w-32' },
                                        ].map((col) => {
                                            const isSorted = itemSortBy === col.key;
                                            return (
                                                <th
                                                    key={col.key}
                                                    onClick={() => {
                                                        if (itemSortBy === col.key) {
                                                            setItemSortOrder(itemSortOrder === 'asc' ? 'desc' : 'asc');
                                                        } else {
                                                            setItemSortBy(col.key as any);
                                                            setItemSortOrder('asc');
                                                        }
                                                    }}
                                                    className={`${col.className} cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 transition-colors ${
                                                        isSorted ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/30 dark:bg-indigo-950/20' : ''
                                                    }`}
                                                >
                                                    <div
                                                        className={`inline-flex items-center gap-1 ${
                                                            col.align === 'right' ? 'justify-end w-full' : col.align === 'center' ? 'justify-center w-full' : ''
                                                        }`}
                                                    >
                                                        <span>{col.label}</span>
                                                        {isSorted ? (
                                                            itemSortOrder === 'asc' ? (
                                                                <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                                            ) : (
                                                                <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                                            )
                                                        ) : (
                                                            <ArrowUpDown className="w-3 h-3 opacity-35 shrink-0" />
                                                        )}
                                                    </div>
                                                </th>
                                            );
                                        })}
                                        <th className="py-2 px-2 w-9"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {itemsOrdenados.map((it) => (
                                        <tr key={it.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                                            <td className="py-2.5 px-3">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-mono text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                                        {it.codigo}
                                                    </span>
                                                    {it.esManual && (
                                                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                                                            Especial
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                                                    {it.nombre}
                                                </div>
                                                <input
                                                    type="text"
                                                    value={it.observacion}
                                                    onChange={(e) =>
                                                        handleActualizarItem(
                                                            it.id,
                                                            'observacion',
                                                            e.target.value
                                                        )
                                                    }
                                                    placeholder="+ Agregar nota técnica o marca..."
                                                    className="w-full text-[11px] text-slate-500 italic bg-transparent focus:outline-none focus:text-slate-800 dark:focus:text-slate-200 mt-0.5"
                                                />
                                            </td>

                                            <td className="py-2.5 px-2 text-center">
                                                <div className="inline-flex items-center border border-slate-200 dark:border-slate-700 rounded-lg bg-background">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handleActualizarItem(
                                                                it.id,
                                                                'cantidad',
                                                                Math.max(1, it.cantidad - 1)
                                                            )
                                                        }
                                                        className="px-1.5 py-1 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                                                    >
                                                        -
                                                    </button>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0.01"
                                                        value={it.cantidad}
                                                        onChange={(e) =>
                                                            handleActualizarItem(
                                                                it.id,
                                                                'cantidad',
                                                                e.target.value
                                                            )
                                                        }
                                                        className="w-12 text-center font-mono font-bold text-xs bg-transparent text-foreground focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handleActualizarItem(
                                                                it.id,
                                                                'cantidad',
                                                                it.cantidad + 1
                                                            )
                                                        }
                                                        className="px-1.5 py-1 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </td>

                                            <td className="py-2.5 px-2 text-right">
                                                <div className="inline-flex items-center justify-end">
                                                    <span className="text-xs font-bold text-slate-400 mr-1 select-none">$</span>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={it.precioUnitario}
                                                        onChange={(e) =>
                                                            handleActualizarItem(
                                                                it.id,
                                                                'precioUnitario',
                                                                e.target.value
                                                            )
                                                        }
                                                        className="w-28 px-2 py-1 text-right font-mono font-bold text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    />
                                                </div>
                                            </td>

                                            <td className="py-2.5 px-2 text-right">
                                                <div className="inline-flex items-center justify-end">
                                                    <input
                                                        type="number"
                                                        step="0.5"
                                                        min="0"
                                                        max="100"
                                                        value={it.descuentoPct}
                                                        onChange={(e) =>
                                                            handleActualizarItem(
                                                                it.id,
                                                                'descuentoPct',
                                                                e.target.value
                                                            )
                                                        }
                                                        className="w-14 px-2 py-1 text-right font-mono text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    />
                                                    <span className="text-[11px] font-bold text-slate-400 ml-1 select-none">%</span>
                                                </div>
                                            </td>

                                            <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900 dark:text-slate-100">
                                                ${fmt(it.subtotal)}
                                            </td>

                                            <td className="py-2.5 px-2 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleEliminarItem(it.id)}
                                                    className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Pie de Totales + Observaciones + Botonera de Emisión */}
                    <div className="p-4 border-t border-slate-200 bg-slate-900 text-white space-y-3 shrink-0">
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                            <div className="sm:col-span-6 space-y-1.5">
                                <input
                                    type="text"
                                    value={observaciones}
                                    onChange={(e) => setObservaciones(e.target.value)}
                                    placeholder="Observaciones al pie del presupuesto (Ej: Precios sujetos a variación del dólar BNA)..."
                                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-800 border border-slate-700 text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-400"
                                />
                                <div className="flex items-center gap-3 text-xs text-slate-300">
                                    <label className="flex items-center gap-1.5">
                                        <span>Desc. Global:</span>
                                        <div className="relative inline-flex items-center">
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                step="0.5"
                                                value={descuentoGlobalPct === 0 ? '' : descuentoGlobalPct}
                                                placeholder="0"
                                                onChange={(e) => {
                                                    const raw = e.target.value;
                                                    if (raw === '') {
                                                        setDescuentoGlobalPct(0);
                                                    } else {
                                                        const parsed = parseFloat(raw);
                                                        setDescuentoGlobalPct(
                                                            isNaN(parsed)
                                                                ? 0
                                                                : Math.min(100, Math.max(0, parsed))
                                                        );
                                                    }
                                                }}
                                                className="w-16 px-2 py-0.5 text-right font-mono font-bold rounded bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-1 focus:ring-indigo-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            />
                                            <span className="text-xs font-bold text-slate-400 ml-1 select-none">%</span>
                                        </div>
                                    </label>
                                    {totales.descuentoLineasMonto + totales.descuentoGlobalMonto >
                                        0 && (
                                        <span className="text-emerald-400 font-mono">
                                            Ahorro: -$ {fmt(
                                                totales.descuentoLineasMonto +
                                                    totales.descuentoGlobalMonto
                                            )} ARS
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="sm:col-span-6 flex items-center justify-end gap-5">
                                {esIvaDiscriminado && (
                                    <div className="text-right text-xs text-slate-400">
                                        <div>
                                            Neto:{' '}
                                            <span className="font-mono text-slate-200">
                                                $ {fmt(totales.baseImponible)}
                                            </span>
                                        </div>
                                        <div>
                                            IVA:{' '}
                                            <span className="font-mono text-slate-200">
                                                $ {fmt(totales.montoIvaTotal)}
                                            </span>
                                        </div>
                                    </div>
                                )}
                                <div className="text-right">
                                    <div className="text-[10px] font-black uppercase tracking-wider text-indigo-400">
                                        Total Cotizado ({items.length} ítems)
                                    </div>
                                    <div className="text-2xl font-black font-mono text-white">
                                        $ {fmt(totales.totalFinal)}{' '}
                                        <span className="text-xs font-sans font-bold text-slate-400">ARS</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
                            <button
                                type="button"
                                onClick={handleSolicitarReiniciar}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Reiniciar
                            </button>

                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    disabled={guardando || items.length === 0}
                                    onClick={() => handleGuardarCotizacion('ENVIAR_PDV')}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 disabled:opacity-40 transition-all shadow-xs"
                                    title="Guardar cotización y pasarla inmediatamente al Punto de Venta para cobrar"
                                >
                                    <ShoppingCart className="w-4 h-4" />
                                    Guardar y Facturar en PDV
                                </button>

                                <button
                                    type="button"
                                    disabled={guardando || items.length === 0}
                                    onClick={() => handleGuardarCotizacion('SOLO_GUARDAR')}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-40 transition-all"
                                    title="Guardar cotización sin abrir el visor de impresión"
                                >
                                    <Save className="w-4 h-4" />
                                    {cotizacionEditandoId ? 'Guardar Cambios' : 'Guardar'}
                                </button>

                                <button
                                    type="button"
                                    disabled={guardando || items.length === 0}
                                    onClick={() => handleGuardarCotizacion('IMPRIMIR')}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 disabled:opacity-40 transition-all"
                                    title="Generar la cotización oficial y ver opciones de impresión o PDF"
                                >
                                    <FileCheck2 className="w-4 h-4" />
                                    {guardando
                                        ? 'Generando...'
                                        : cotizacionEditandoId
                                        ? '[F4] Actualizar Cotización'
                                        : '[F4] Generar Cotización'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modales */}
            <SeleccionarClienteModal
                isOpen={showClienteModal}
                onClose={() => setShowClienteModal(false)}
                clienteActual={{
                    id: clienteId,
                    nombre: clienteNombre,
                    identificacion: clienteCuit || clienteTelefono || null,
                }}
                onSeleccionar={async (cli) => {
                    setClienteId(cli.id);
                    setClienteNombre(cli.nombre);
                    setClienteCuit('');
                    setClienteTelefono(cli.telefono || '');
                    setClienteEmail(cli.email || '');
                    setClienteDireccion(cli.direccion || '');
                    if (cli.listaPrecioId) {
                        handleCambiarLista(cli.listaPrecioId);
                    }
                    setShowClienteModal(false);
                }}
            />

            <AgregarItemManualModal
                isOpen={showItemManualModal}
                onClose={() => setShowItemManualModal(false)}
                onAdd={handleAgregarItemManual}
            />

            <HistorialCotizacionesModal
                isOpen={showHistorialModal}
                onClose={() => setShowHistorialModal(false)}
                onImprimir={(cot) => {
                    setShowHistorialModal(false);
                    setCotizacionImprimir(cot);
                }}
                onEditar={(cot) => handleCargarCotizacionEnEditor(cot, false)}
                onDuplicar={(cot) => handleCargarCotizacionEnEditor(cot, true)}
                onEnviarAPdv={(cot) => {
                    setShowHistorialModal(false);
                    router.push(`/ventas/pdv?cotizacionId=${cot.id}`);
                }}
            />

            <ImprimirCotizacionModal
                isOpen={!!cotizacionImprimir}
                cotizacion={cotizacionImprimir}
                onClose={() => setCotizacionImprimir(null)}
                onNuevaCotizacion={() => {
                    setCotizacionImprimir(null);
                    handleLimpiarCotizador();
                }}
                onDuplicar={(cot) => handleCargarCotizacionEnEditor(cot, true)}
                onEnviarAPdv={(cot) => {
                    setCotizacionImprimir(null);
                    router.push(`/ventas/pdv?cotizacionId=${cot.id}`);
                }}
            />

            <ConfirmDialog
                isOpen={showConfirmReiniciar}
                title="¿Reiniciar cotización?"
                message="Se descartarán los artículos y datos cargados en el cotizador actual. Esta acción no se puede deshacer."
                confirmLabel="Sí, reiniciar"
                cancelLabel="Continuar editando"
                variant="danger"
                onConfirm={() => {
                    handleLimpiarCotizador();
                    setShowConfirmReiniciar(false);
                }}
                onCancel={() => setShowConfirmReiniciar(false)}
            />
        </div>
    );
}
