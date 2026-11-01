'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import VentasNavTabs from '@/components/ventas/VentasNavTabs';
import {
    Search, FileText, Trash2, Plus, Minus, Loader2, Wrench, ShoppingCart, RefreshCw,
    X, Save, Package, FilePlus2, History, ChevronDown, ChevronUp,
} from 'lucide-react';
import {
    buildCatalogIndex,
    searchCatalog,
    CatalogIndex,
    ProductoPDV,
} from '@/lib/ventas/pdvSearchEngine';
import { resolverPrecioProducto } from '@/lib/ventas/priceRules';
import {
    CONDICIONES_PAGO,
    PLAZOS_ENTREGA,
    VALIDEZ_DIAS,
    CONDICION_PAGO_DEFAULT,
    PLAZO_ENTREGA_DEFAULT,
    opcionesConValor,
} from '@/lib/ventas/cotizacionOpciones';
import { showToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Badge, Button, EmptyState, Field, SegmentedControl } from '@/components/ui';
import SeleccionarClienteModal from '@/components/ventas/pdv/SeleccionarClienteModal';
import ImprimirCotizacionModal from '@/components/ventas/cotizaciones/ImprimirCotizacionModal';
import AgregarItemManualModal, { ItemManualOutput } from '@/components/ventas/cotizaciones/AgregarItemManualModal';
import HistorialCotizaciones from '@/components/ventas/cotizaciones/HistorialCotizaciones';

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

type Vista = 'cotizador' | 'historial';

const fmt = (n: number) =>
    (n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Controles compactos de la grilla (32 px de alto en lugar de 36)
const CONTROL = 'input h-8 text-[13px]';
const CELDA_NUM = 'input h-7 px-2 text-right text-[13px] tabular-nums';

export default function CotizacionesPage() {
    const router = useRouter();

    const [vista, setVista] = useState<Vista>('cotizador');
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
    const [mostrarDatosCliente, setMostrarDatosCliente] = useState(false);

    // Condiciones comerciales de la cotización
    const [validezDias, setValidezDias] = useState<number>(15);
    const [condicionPago, setCondicionPago] = useState<string>(CONDICION_PAGO_DEFAULT);
    const [plazoEntrega, setPlazoEntrega] = useState<string>(PLAZO_ENTREGA_DEFAULT);
    const [referenciaObra, setReferenciaObra] = useState('');
    const [observaciones, setObservaciones] = useState('');
    const [descuentoGlobalPct, setDescuentoGlobalPct] = useState<number>(0);

    // Ítems cotizados
    const [items, setItems] = useState<ItemCotizador[]>([]);
    const [guardando, setGuardando] = useState(false);

    // Modales y vistas auxiliares
    const [showClienteModal, setShowClienteModal] = useState(false);
    const [showItemManualModal, setShowItemManualModal] = useState(false);
    const [documento, setDocumento] = useState<{ cotizacion: any; recienGuardada: boolean } | null>(null);
    const [showConfirmReiniciar, setShowConfirmReiniciar] = useState(false);
    const [historialToken, setHistorialToken] = useState(0);

    const searchInputRef = useRef<HTMLInputElement>(null);

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
        showToast('Ítem libre agregado', 'success');
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
        setMostrarDatosCliente(false);
        setReferenciaObra('');
        setObservaciones('');
        setDescuentoGlobalPct(0);
        setValidezDias(15);
        setCondicionPago(CONDICION_PAGO_DEFAULT);
        setPlazoEntrega(PLAZO_ENTREGA_DEFAULT);
        setVista('cotizador');
        setTimeout(() => searchInputRef.current?.focus(), 0);
    }, []);

    const handleSolicitarNueva = () => {
        if (items.length > 0) {
            setShowConfirmReiniciar(true);
        } else {
            handleLimpiarCotizador();
        }
    };

    // Guardar cotización y luego abrir el documento o pasarla al PDV
    const handleGuardarCotizacion = async (accionPosterior: 'VER_DOCUMENTO' | 'ENVIAR_PDV') => {
        if (items.length === 0) {
            showToast('Agregá al menos un artículo a la cotización', 'error');
            return;
        }

        const itemInvalido = items.find((it) => !it.nombre?.trim() || Number(it.cantidad) <= 0);
        if (itemInvalido) {
            showToast('Todos los artículos necesitan descripción y cantidad mayor a 0', 'error');
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
                    ? `Cotización ${cotGuardada.numero} actualizada`
                    : `Cotización ${cotGuardada.numero} guardada`,
                'success'
            );

            setCotizacionEditandoId(cotGuardada.id);
            setCotizacionEditandoNumero(cotGuardada.numero);
            setHistorialToken((t) => t + 1);

            if (accionPosterior === 'ENVIAR_PDV') {
                router.push(`/ventas/pdv?cotizacionId=${cotGuardada.id}`);
            } else {
                setDocumento({ cotizacion: cotGuardada, recienGuardada: true });
            }
        } catch (err: any) {
            showToast(err.message || 'Error al guardar la cotización', 'error');
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
        setMostrarDatosCliente(
            Boolean(cot.clienteIdentificacion || cot.clienteTelefono || cot.clienteEmail || cot.clienteDireccion)
        );
        if (cot.listaPrecioId) setListaSeleccionadaId(cot.listaPrecioId);
        setValidezDias(cot.validezDias || 15);
        setCondicionPago(cot.condicionPago || CONDICION_PAGO_DEFAULT);
        setPlazoEntrega(cot.plazoEntrega || PLAZO_ENTREGA_DEFAULT);
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
        setDocumento(null);
        setVista('cotizador');
        showToast(
            comoDuplicado
                ? `Copia de ${cot.numero} lista para editar`
                : `Editando ${cot.numero}`,
            'info'
        );
    };

    const handleEnviarAPdv = (cot: any) => {
        setDocumento(null);
        router.push(`/ventas/pdv?cotizacionId=${cot.id}`);
    };

    // Atajos de teclado (mismos que el PDV)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'F8') {
                e.preventDefault();
                setVista((v) => (v === 'historial' ? 'cotizador' : 'historial'));
                return;
            }
            if (vista !== 'cotizador') return;
            if (e.key === 'F2') {
                e.preventDefault();
                searchInputRef.current?.focus();
            } else if (e.key === 'F3') {
                e.preventDefault();
                setShowClienteModal(true);
            } else if (e.key === 'F4') {
                e.preventDefault();
                if (!guardando) handleGuardarCotizacion('VER_DOCUMENTO');
            } else if (e.key === 'F6') {
                e.preventDefault();
                setShowItemManualModal(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    });

    const totalDescuentos = totales.descuentoLineasMonto + totales.descuentoGlobalMonto;

    return (
        <div className="flex flex-col h-full w-full min-h-0 max-h-full overflow-hidden gap-2">
            <h1 className="sr-only">Cotizaciones</h1>
            <VentasNavTabs currentTab="cotizaciones" className="mb-0 shrink-0" />

            {/* Barra de la vista */}
            <header className="flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div className="flex flex-wrap items-center gap-2">
                    <SegmentedControl<Vista>
                        label="Vista de cotizaciones"
                        value={vista}
                        onChange={setVista}
                        options={[
                            { value: 'cotizador', label: 'Cotizador', icon: <FileText /> },
                            { value: 'historial', label: <>Historial <span className="kbd ml-1">F8</span></>, icon: <History /> },
                        ]}
                    />
                    {vista === 'cotizador' && cotizacionEditandoNumero && (
                        <Badge tone="warning" dot>Editando {cotizacionEditandoNumero}</Badge>
                    )}
                </div>

                {vista === 'cotizador' && (
                    <div className="flex items-center gap-1.5">
                        <Button variant="ghost" size="sm" icon={<Wrench />} onClick={() => setShowItemManualModal(true)}>
                            Ítem libre <span className="kbd">F6</span>
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            icon={<FilePlus2 />}
                            onClick={handleSolicitarNueva}
                            disabled={items.length === 0 && !cotizacionEditandoId}
                        >
                            Nueva
                        </Button>
                    </div>
                )}
            </header>

            {vista === 'historial' ? (
                <HistorialCotizaciones
                    recargarToken={historialToken}
                    onVer={(cot) => setDocumento({ cotizacion: cot, recienGuardada: false })}
                    onEditar={(cot) => handleCargarCotizacionEnEditor(cot, false)}
                    onDuplicar={(cot) => handleCargarCotizacionEnEditor(cot, true)}
                    onEnviarAPdv={handleEnviarAPdv}
                />
            ) : (
                <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-2 overflow-y-auto lg:overflow-hidden">
                    {/* Catálogo */}
                    <section className="h-[42dvh] min-h-[260px] lg:h-auto lg:min-h-0 lg:w-[36%] xl:w-[32%] shrink-0 bg-card border border-border rounded-xl flex flex-col overflow-hidden">
                        <div className="p-3 space-y-2 border-b border-border shrink-0">
                            <div className="flex items-center justify-between">
                                <h2 className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                                    Catálogo
                                    <span className="ml-1.5 font-normal text-slate-500 tabular-nums">
                                        {searchQuery
                                            ? `${allSearchMatches.length.toLocaleString('es-AR')} de ${rawCatalogo.length.toLocaleString('es-AR')}`
                                            : rawCatalogo.length.toLocaleString('es-AR')}
                                    </span>
                                </h2>
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={cargarCatalogoYListas}
                                    aria-label="Recargar catálogo"
                                    title="Recargar catálogo"
                                >
                                    <RefreshCw className={isLoadingCatalogo ? 'animate-spin' : ''} />
                                </Button>
                            </div>
                            <div className="relative">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    autoFocus
                                    aria-label="Buscar en el catálogo"
                                    placeholder="Código, descripción o marca (F2)"
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
                                    className="input pl-9 pr-8"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery('')}
                                        className="btn btn-ghost btn-icon btn-sm absolute right-0.5 top-1/2 -translate-y-1/2"
                                        aria-label="Limpiar búsqueda"
                                    >
                                        <X />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div
                            className="flex-1 overflow-y-auto divide-y divide-border"
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
                            {isLoadingCatalogo && rawCatalogo.length === 0 ? (
                                <div className="py-12 flex flex-col items-center gap-2 text-[13px] text-slate-500">
                                    <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                                    Cargando catálogo…
                                </div>
                            ) : resultadosBusqueda.length === 0 ? (
                                <EmptyState
                                    compact
                                    icon={<Package />}
                                    title="Sin resultados"
                                    description={`Nada coincide con “${searchQuery}”. Podés cotizarlo como ítem libre.`}
                                    action={
                                        <Button variant="tonal" size="sm" icon={<Plus />} onClick={() => setShowItemManualModal(true)}>
                                            Ítem libre
                                        </Button>
                                    }
                                />
                            ) : (
                                resultadosBusqueda.map((prod, idx) => {
                                    const { precio } = resolverPrecioProducto(prod, listaActiva);
                                    const isSelected = idx === selectedIndex;
                                    return (
                                        <button
                                            key={prod.id}
                                            type="button"
                                            onClick={() => handleAgregarProducto(prod)}
                                            className={`group w-full px-3 py-2 flex items-center gap-3 text-left transition-colors ${
                                                isSelected
                                                    ? 'bg-brand-50 dark:bg-brand-950/40'
                                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                                            }`}
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                                    <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                                                        {prod.sku}
                                                    </span>
                                                    {prod.marca && <span className="truncate">{prod.marca}</span>}
                                                    <span
                                                        className={`shrink-0 tabular-nums ${
                                                            prod.stockActual > 0 ? 'text-success-700 dark:text-success-400' : 'text-warning-700 dark:text-warning-400'
                                                        }`}
                                                    >
                                                        {prod.stockActual > 0 ? `Stock ${prod.stockActual}` : 'Sin stock'}
                                                    </span>
                                                </div>
                                                <div className="text-[13px] text-slate-900 dark:text-slate-100 truncate" title={prod.descripcion}>
                                                    {prod.descripcion}
                                                </div>
                                            </div>
                                            <div className="shrink-0 text-right text-[13px] font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                                                $ {fmt(precio)}
                                            </div>
                                            <Plus
                                                className="w-4 h-4 shrink-0 text-slate-400 group-hover:text-primary"
                                                aria-hidden="true"
                                            />
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </section>

                    {/* Cotización */}
                    <section className="shrink-0 lg:shrink lg:flex-1 min-w-0 bg-card border border-border rounded-xl flex flex-col lg:min-h-0 overflow-hidden">
                        {/* Datos comerciales */}
                        <div className="p-3 border-b border-border grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-x-2.5 gap-y-2 shrink-0">
                            <Field label="Cliente" className="col-span-2" htmlFor="cot-cliente">
                                <div className="flex items-center gap-1">
                                    <input
                                        id="cot-cliente"
                                        type="text"
                                        value={clienteNombre}
                                        onChange={(e) => setClienteNombre(e.target.value)}
                                        placeholder="Nombre o razón social"
                                        className={`${CONTROL} flex-1 min-w-0 font-medium`}
                                    />
                                    <Button variant="secondary" size="sm" onClick={() => setShowClienteModal(true)} title="Elegir cliente (F3)">
                                        Elegir
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={() => setMostrarDatosCliente((v) => !v)}
                                        aria-expanded={mostrarDatosCliente}
                                        aria-label="Datos de contacto del cliente"
                                        title="CUIT, teléfono, email y dirección"
                                    >
                                        {mostrarDatosCliente ? <ChevronUp /> : <ChevronDown />}
                                    </Button>
                                </div>
                            </Field>
                            <Field label="Lista de precios" htmlFor="cot-lista">
                                <select
                                    id="cot-lista"
                                    value={listaSeleccionadaId}
                                    onChange={(e) => handleCambiarLista(e.target.value)}
                                    className={`${CONTROL} pr-8`}
                                >
                                    {listasPrecios.map((l) => (
                                        <option key={l.id} value={l.id}>
                                            {l.nombre}{l.ivaDiscriminado ? ' (+IVA)' : ''}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                            <Field label="Validez" htmlFor="cot-validez">
                                <select
                                    id="cot-validez"
                                    value={validezDias}
                                    onChange={(e) => setValidezDias(Number(e.target.value))}
                                    className={`${CONTROL} pr-8`}
                                >
                                    {Array.from(new Set([...VALIDEZ_DIAS, validezDias])).sort((a, b) => a - b).map((d) => (
                                        <option key={d} value={d}>{d} días</option>
                                    ))}
                                </select>
                            </Field>
                            <Field label="Forma de pago" htmlFor="cot-pago">
                                <select
                                    id="cot-pago"
                                    value={condicionPago}
                                    onChange={(e) => setCondicionPago(e.target.value)}
                                    className={`${CONTROL} pr-8`}
                                >
                                    {opcionesConValor(CONDICIONES_PAGO, condicionPago).map((o) => (
                                        <option key={o} value={o}>{o}</option>
                                    ))}
                                </select>
                            </Field>
                            <Field label="Entrega" htmlFor="cot-entrega">
                                <select
                                    id="cot-entrega"
                                    value={plazoEntrega}
                                    onChange={(e) => setPlazoEntrega(e.target.value)}
                                    className={`${CONTROL} pr-8`}
                                >
                                    {opcionesConValor(PLAZOS_ENTREGA, plazoEntrega).map((o) => (
                                        <option key={o} value={o}>{o}</option>
                                    ))}
                                </select>
                            </Field>

                            {mostrarDatosCliente && (
                                <>
                                    <Field label="CUIT / DNI" htmlFor="cot-cuit">
                                        <input id="cot-cuit" type="text" value={clienteCuit} onChange={(e) => setClienteCuit(e.target.value)} className={`${CONTROL} font-mono`} />
                                    </Field>
                                    <Field label="Teléfono" htmlFor="cot-tel">
                                        <input id="cot-tel" type="tel" value={clienteTelefono} onChange={(e) => setClienteTelefono(e.target.value)} className={CONTROL} />
                                    </Field>
                                    <Field label="Email" htmlFor="cot-email" className="col-span-2 md:col-span-1 xl:col-span-2">
                                        <input id="cot-email" type="email" value={clienteEmail} onChange={(e) => setClienteEmail(e.target.value)} className={CONTROL} />
                                    </Field>
                                    <Field label="Dirección" htmlFor="cot-dir" className="col-span-2">
                                        <input id="cot-dir" type="text" value={clienteDireccion} onChange={(e) => setClienteDireccion(e.target.value)} className={CONTROL} />
                                    </Field>
                                </>
                            )}

                            <Field label="Referencia u obra" htmlFor="cot-ref" className="col-span-2">
                                <input
                                    id="cot-ref"
                                    type="text"
                                    value={referenciaObra}
                                    onChange={(e) => setReferenciaObra(e.target.value)}
                                    placeholder="Obra, licitación u orden de compra"
                                    className={CONTROL}
                                />
                            </Field>
                            <Field label="Observaciones" htmlFor="cot-obs" className="col-span-2 xl:col-span-4">
                                <input
                                    id="cot-obs"
                                    type="text"
                                    value={observaciones}
                                    onChange={(e) => setObservaciones(e.target.value)}
                                    placeholder="Se imprimen al pie del documento"
                                    className={CONTROL}
                                />
                            </Field>
                        </div>

                        {/* Ítems */}
                        <div className="flex-1 min-h-[220px] lg:min-h-0 overflow-auto">
                            {items.length === 0 ? (
                                <EmptyState
                                    icon={<FileText />}
                                    title="La cotización está vacía"
                                    description="Elegí artículos del catálogo o agregá un ítem libre para servicios y mano de obra."
                                    action={
                                        <Button variant="tonal" size="sm" icon={<Wrench />} onClick={() => setShowItemManualModal(true)}>
                                            Agregar ítem libre
                                        </Button>
                                    }
                                    className="h-full"
                                />
                            ) : (
                                <table className="w-full min-w-[640px] text-[13px]">
                                    <thead className="sticky top-0 z-10 bg-card">
                                        <tr className="border-b border-border">
                                            <th className="py-2 px-3 text-left">Artículo</th>
                                            <th className="py-2 px-2 text-center w-28">Cant.</th>
                                            <th className="py-2 px-2 text-right w-32">P. unitario</th>
                                            <th className="py-2 px-2 text-right w-20 whitespace-nowrap">Bonif. %</th>
                                            <th className="py-2 px-3 text-right w-32">Subtotal</th>
                                            <th className="py-2 px-2 w-10"><span className="sr-only">Quitar</span></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {items.map((it) => (
                                            <tr key={it.id} className="align-middle hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                                <td className="py-1.5 px-3 max-w-0">
                                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                                        <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{it.codigo}</span>
                                                        {it.esManual && <span>Ítem libre</span>}
                                                        {it.marca && <span className="truncate">{it.marca}</span>}
                                                    </div>
                                                    <div className="truncate text-slate-900 dark:text-slate-100" title={it.nombre}>
                                                        {it.nombre}
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={it.observacion}
                                                        onChange={(e) => handleActualizarItem(it.id, 'observacion', e.target.value)}
                                                        placeholder="Agregar nota"
                                                        aria-label={`Nota de ${it.nombre}`}
                                                        className="w-full bg-transparent text-xs text-slate-600 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none"
                                                    />
                                                </td>
                                                <td className="py-1.5 px-2">
                                                    <div className="mx-auto flex items-center w-fit h-7 border border-input rounded-lg bg-card overflow-hidden">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleActualizarItem(it.id, 'cantidad', Math.max(1, (Number(it.cantidad) || 0) - 1))}
                                                            className="w-7 h-full flex items-center justify-center text-slate-500 hover:bg-muted"
                                                            aria-label="Restar 1"
                                                        >
                                                            <Minus className="w-3 h-3" />
                                                        </button>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min="0.01"
                                                            value={it.cantidad}
                                                            onChange={(e) => handleActualizarItem(it.id, 'cantidad', e.target.value)}
                                                            aria-label={`Cantidad de ${it.nombre}`}
                                                            className="w-12 h-full text-center tabular-nums bg-transparent focus:outline-none"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleActualizarItem(it.id, 'cantidad', (Number(it.cantidad) || 0) + 1)}
                                                            className="w-7 h-full flex items-center justify-center text-slate-500 hover:bg-muted"
                                                            aria-label="Sumar 1"
                                                        >
                                                            <Plus className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="py-1.5 px-2">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={it.precioUnitario}
                                                        onChange={(e) => handleActualizarItem(it.id, 'precioUnitario', e.target.value)}
                                                        aria-label={`Precio unitario de ${it.nombre}`}
                                                        className={`${CELDA_NUM} w-full`}
                                                    />
                                                </td>
                                                <td className="py-1.5 px-2">
                                                    <input
                                                        type="number"
                                                        step="0.5"
                                                        min="0"
                                                        max="100"
                                                        value={it.descuentoPct}
                                                        onChange={(e) => handleActualizarItem(it.id, 'descuentoPct', e.target.value)}
                                                        aria-label={`Bonificación de ${it.nombre}`}
                                                        className={`${CELDA_NUM} w-full`}
                                                    />
                                                </td>
                                                <td className="py-1.5 px-3 text-right font-semibold tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap">
                                                    $ {fmt(it.subtotal)}
                                                </td>
                                                <td className="py-1.5 px-2">
                                                    <Button
                                                        variant="danger-ghost"
                                                        size="icon-sm"
                                                        onClick={() => handleEliminarItem(it.id)}
                                                        aria-label={`Quitar ${it.nombre}`}
                                                        title="Quitar"
                                                    >
                                                        <Trash2 />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Totales y acciones */}
                        <footer className="px-3 py-2.5 border-t border-border bg-surface-sunken flex flex-wrap items-center gap-x-6 gap-y-2 shrink-0">
                            <label className="flex items-center gap-2 text-[13px] text-slate-600 dark:text-slate-300">
                                Descuento general
                                <span className="relative">
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.5"
                                        value={descuentoGlobalPct === 0 ? '' : descuentoGlobalPct}
                                        placeholder="0"
                                        onChange={(e) => {
                                            const parsed = parseFloat(e.target.value);
                                            setDescuentoGlobalPct(isNaN(parsed) ? 0 : Math.min(100, Math.max(0, parsed)));
                                        }}
                                        className="input h-8 w-20 pr-6 text-right tabular-nums"
                                    />
                                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">%</span>
                                </span>
                            </label>

                            <dl className="flex items-center gap-x-5 gap-y-1 text-[13px] tabular-nums ml-auto">
                                {totalDescuentos > 0 && (
                                    <div className="text-right">
                                        <dt className="text-xs text-slate-500">Bonificaciones</dt>
                                        <dd className="text-success-700 dark:text-success-400">− $ {fmt(totalDescuentos)}</dd>
                                    </div>
                                )}
                                {esIvaDiscriminado && (
                                    <>
                                        <div className="text-right">
                                            <dt className="text-xs text-slate-500">Neto</dt>
                                            <dd className="text-slate-800 dark:text-slate-200">$ {fmt(totales.baseImponible)}</dd>
                                        </div>
                                        <div className="text-right">
                                            <dt className="text-xs text-slate-500">IVA</dt>
                                            <dd className="text-slate-800 dark:text-slate-200">$ {fmt(totales.montoIvaTotal)}</dd>
                                        </div>
                                    </>
                                )}
                                <div className="text-right">
                                    <dt className="text-xs text-slate-500">
                                        Total · {items.length} {items.length === 1 ? 'ítem' : 'ítems'}
                                    </dt>
                                    <dd className="text-title font-semibold text-slate-900 dark:text-slate-50">$ {fmt(totales.totalFinal)}</dd>
                                </div>
                            </dl>

                            <div className="flex items-center gap-2">
                                <Button
                                    variant="secondary"
                                    icon={<ShoppingCart />}
                                    disabled={guardando || items.length === 0}
                                    onClick={() => handleGuardarCotizacion('ENVIAR_PDV')}
                                    title="Guarda la cotización y la abre en el Punto de Venta"
                                >
                                    Facturar en PDV
                                </Button>
                                <Button
                                    icon={<Save />}
                                    isLoading={guardando}
                                    disabled={items.length === 0}
                                    onClick={() => handleGuardarCotizacion('VER_DOCUMENTO')}
                                    title="Guarda la cotización y muestra el documento (F4)"
                                >
                                    {cotizacionEditandoId ? 'Guardar cambios' : 'Guardar'}
                                </Button>
                            </div>
                        </footer>
                    </section>
                </div>
            )}

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

            <ImprimirCotizacionModal
                isOpen={!!documento}
                cotizacion={documento?.cotizacion}
                onClose={() => setDocumento(null)}
                onNuevaCotizacion={
                    documento?.recienGuardada
                        ? () => {
                              setDocumento(null);
                              handleLimpiarCotizador();
                          }
                        : undefined
                }
                onEnviarAPdv={handleEnviarAPdv}
            />

            <ConfirmDialog
                isOpen={showConfirmReiniciar}
                title="¿Empezar una cotización nueva?"
                message="Se descartan los artículos y datos cargados que no hayas guardado."
                confirmLabel="Empezar de nuevo"
                cancelLabel="Seguir editando"
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
