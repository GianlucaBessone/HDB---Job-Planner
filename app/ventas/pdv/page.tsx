'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import VentasNavTabs from '@/components/ventas/VentasNavTabs';
import {
  Search,
  Barcode,
  ShoppingBag,
  CreditCard,
  User,
  History,
  Trash2,
  Plus,
  Minus,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Tag,
  AlertCircle,
  CheckCircle2,
  Package,
  Layers,
  Percent,
  ChevronDown,
  Edit2,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  Receipt,
  Building2,
  Maximize2,
  Minimize2,
  UserCheck,
  Home,
  ArrowLeft,
  RefreshCw,
  Settings2,
  Truck,
  PackageCheck,
  Star,
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
import CobroModal from '@/components/ventas/pdv/CobroModal';
import SeleccionarClienteModal from '@/components/ventas/pdv/SeleccionarClienteModal';
import ComprobanteModal from '@/components/ventas/pdv/ComprobanteModal';
import HistorialVentasModal from '@/components/ventas/pdv/HistorialVentasModal';
import ModificarPrecioModal from '@/components/ventas/pdv/ModificarPrecioModal';
import CambioRapidoVendedorModal from '@/components/ventas/pdv/CambioRapidoVendedorModal';
import ConfigListasPreciosModal from '@/components/ventas/ConfigListasPreciosModal';
import GenerarRemitoModal from '@/components/ventas/pdv/GenerarRemitoModal';
import ImprimirRemitoModal from '@/components/ventas/pdv/ImprimirRemitoModal';
import PendientesEntregaModal from '@/components/ventas/pdv/PendientesEntregaModal';
import ErrorBoundary from '@/components/ErrorBoundary';

interface ItemCarrito {
  id: string; // id temporal en el carrito
  productoId: string | null;
  esManual?: boolean;
  sku: string;
  codigoBarras?: string | null;
  descripcion: string;
  unidad: string;
  cantidad: number;
  precioOriginal: number;
  precioUnitario: number;
  descuentoPorcentaje: number;
  descuentoMonto: number;
  ivaPorcentaje: number;
  subtotal: number;
  precioModificado: boolean;
  motivoModificacion?: string | null;
  stockActual: number;
  esFallbackPrecio?: boolean;
}

type ProductoBuscado = ProductoPDV;

interface ListaPrecioItem {
  id: string;
  codigo: string;
  nombre: string;
  tipoAjuste: string;
  valorAjuste: number;
  esPredeterminada: boolean;
  ivaDiscriminado?: boolean;
  orden?: number | null;
}

export default function PdvPage() {
  const router = useRouter();

  // Operador / Vendedor logueado y control de acceso
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Pantalla Completa / Vista Maximizada
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Listas de Precios disponibles
  const [listasPrecios, setListasPrecios] = useState<ListaPrecioItem[]>([]);
  const [listaSeleccionadaId, setListaSeleccionadaId] = useState<string>('');
  const [listaCambioPendiente, setListaCambioPendiente] = useState<string | null>(null);

  // Cliente de la venta
  const [cliente, setCliente] = useState<{
    id: string | null;
    nombre: string;
    identificacion?: string | null;
  }>({
    id: null,
    nombre: 'Consumidor Final',
    identificacion: null,
  });

  // Carrito / Detalle de venta
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [descuentoGlobal, setDescuentoGlobal] = useState<number>(0);
  const [cotizacionOrigen, setCotizacionOrigen] = useState<{ id: string; numero: string } | null>(null);

  // Catálogo completo e índice de búsqueda en memoria
  const [rawCatalogo, setRawCatalogo] = useState<ProductoPDV[]>([]);
  const [catalogIndex, setCatalogIndex] = useState<CatalogIndex | null>(null);
  const [isLoadingCatalogo, setIsLoadingCatalogo] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [displayLimit, setDisplayLimit] = useState<number>(50);
  const [totalResultados, setTotalResultados] = useState<number>(0);

  // Búsqueda de productos y catálogo
  const [searchQuery, setSearchQuery] = useState('');
  const [resultadosBusqueda, setResultadosBusqueda] = useState<ProductoPDV[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  // Modales
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [showCobroModal, setShowCobroModal] = useState(false);
  const [showHistorialModal, setShowHistorialModal] = useState(false);
  const [showCambioVendedorModal, setShowCambioVendedorModal] = useState(false);
  const [comprobanteVenta, setComprobanteVenta] = useState<any | null>(null);
  const [showConfirmLimpiar, setShowConfirmLimpiar] = useState(false);
  const [itemParaModificarPrecio, setItemParaModificarPrecio] = useState<ItemCarrito | null>(null);
  const [showConfigListasModal, setShowConfigListasModal] = useState(false);
  const [metaListas, setMetaListas] = useState<{ marcas: any[]; familias: any[] }>({ marcas: [], familias: [] });

  // Remitos y Pendientes
  const [ventaParaRemito, setVentaParaRemito] = useState<any | null>(null);
  const [remitoParaImprimir, setRemitoParaImprimir] = useState<any | null>(null);
  const [showPendientesModal, setShowPendientesModal] = useState(false);

  // Refs de elementos de UI
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 1. Cargar usuario, validar acceso
  useEffect(() => {
    try {
      const stored = localStorage.getItem('currentUser');
      if (stored) {
        const user = JSON.parse(stored);
        setCurrentUser(user);
        const rol = (user.role || '').toLowerCase();
        if (!['admin', 'administrador', 'supervisor', 'vendedor'].includes(rol)) {
          showToast('Acceso denegado: sólo Vendedores, Supervisores o Administradores pueden ingresar al Punto de Venta.', 'error');
          router.push('/');
          return;
        }
      } else {
        router.push('/');
        return;
      }

      const fsPref = localStorage.getItem('pdv_fullscreen');
      if (fsPref === 'true') {
        setIsFullscreen(true);
      } else {
        setIsFullscreen(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAuthChecking(false);
    }
  }, [router]);

  // Manejo de cambio de pantalla completa / maximización in-app
  const toggleFullscreen = () => {
    setIsFullscreen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('pdv_fullscreen', String(next));
      } catch (e) {
        console.error('Fullscreen toggle error:', e);
      }
      return next;
    });
  };

  // Cargar listas de precios activas
  const fetchListasPrecios = async (preferDefault = false) => {
    try {
      const res = await fetch('/api/ventas/listas-precios');
      if (res.ok) {
        const data = await res.json();
        const activas = Array.isArray(data) ? data.filter((l: any) => l.activo !== false) : [];
        setListasPrecios(activas);

        const pred = activas.find((l: any) => l.esPredeterminada) || activas[0];

        setListaSeleccionadaId((prev) => {
          if (!preferDefault && prev && activas.some((l: any) => l.id === prev)) {
            return prev;
          }
          return pred?.id || prev || '';
        });

        if (preferDefault && pred && (!cliente.id || cliente.nombre === 'Consumidor Final')) {
          aplicarCambioListaInmediato(pred.id);
        }
      }
    } catch (e) {
      console.error('Error cargando listas de precios:', e);
    }
  };

  useEffect(() => {
    fetchListasPrecios();
  }, []);

  const handleAbrirConfigListas = async () => {
    try {
      if (metaListas.marcas.length === 0) {
        const res = await fetch('/api/ventas/meta');
        if (res.ok) {
          const data = await res.json();
          setMetaListas({
            marcas: data.marcas || [],
            familias: data.familias || [],
          });
        }
      }
      setShowConfigListasModal(true);
    } catch (e) {
      console.error('Error cargando meta para listas:', e);
      setShowConfigListasModal(true);
    }
  };

  const handleEstablecerListaActualComoPredeterminada = async () => {
    if (!listaSeleccionadaId) return;
    try {
      const res = await fetch(`/api/ventas/listas-precios/${listaSeleccionadaId}/predeterminada`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cambiar lista predeterminada');
      showToast(
        data.mensaje || `"${listaActual?.nombre}" establecida como lista por defecto para Consumidor Final y PDV`,
        'success'
      );
      await fetchListasPrecios();
    } catch (e: any) {
      showToast(e.message || 'Error al establecer lista predeterminada', 'error');
    }
  };

  const listaActual = useMemo(
    () => listasPrecios.find((l) => l.id === listaSeleccionadaId) || null,
    [listasPrecios, listaSeleccionadaId]
  );

  // 2. Cargar catálogo completo en memoria con soporte offline / sessionStorage
  const cargarCatalogo = useCallback(async (forceRefresh = false) => {
    try {
      if (!forceRefresh) {
        const cached = sessionStorage.getItem('pdv_catalog_cache_v1');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed.productos) && parsed.productos.length > 0) {
              setRawCatalogo(parsed.productos);
              setIsLoadingCatalogo(false);
            }
          } catch (e) {
            console.error('Error parseando catálogo de sessionStorage:', e);
          }
        }
      }

      const res = await fetch(`/api/ventas/pdv/catalogo?refresh=${forceRefresh ? 'true' : 'false'}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.productos)) {
          setRawCatalogo(data.productos);
          try {
            sessionStorage.setItem(
              'pdv_catalog_cache_v1',
              JSON.stringify({
                productos: data.productos,
                timestamp: Date.now(),
                version: data.version,
              })
            );
          } catch (e) {
            console.warn('No se pudo guardar catálogo en sessionStorage');
          }
        }
      }
    } catch (error) {
      console.error('Error al cargar catálogo en memoria:', error);
      showToast('Error cargando catálogo de artículos', 'error');
    } finally {
      setIsLoadingCatalogo(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    cargarCatalogo(false);
  }, [cargarCatalogo]);

  // 3. Indexar catálogo con precios dinámicos según lista de precios actual
  useEffect(() => {
    if (rawCatalogo.length === 0) return;

    const productosConPrecios: ProductoPDV[] = rawCatalogo.map((prod) => {
      const { precio, esFallback, detalleAjuste } = resolverPrecioProducto(prod, listaActual);
      return {
        ...prod,
        precioAplicado: precio,
        esFallbackPrecio: esFallback,
        detalleAjuste,
      };
    });

    const index = buildCatalogIndex(productosConPrecios);
    setCatalogIndex(index);
  }, [rawCatalogo, listaActual]);

  // 4. Búsqueda instantánea sub-milisegundo en memoria
  useEffect(() => {
    if (!catalogIndex) {
      setResultadosBusqueda([]);
      setTotalResultados(0);
      return;
    }

    const { resultados, exactMatchId, totalEncontrados } = searchCatalog(searchQuery, catalogIndex);
    setResultadosBusqueda(resultados);
    setTotalResultados(totalEncontrados);
    setDisplayLimit(50);

    if (searchQuery.trim()) {
      const exactIdx = exactMatchId ? resultados.findIndex((p) => p.id === exactMatchId) : -1;
      setSelectedIndex(exactIdx >= 0 ? exactIdx : resultados.length > 0 ? 0 : -1);
    } else {
      setSelectedIndex(-1);
    }
  }, [searchQuery, catalogIndex]);

  // Paginado progresivo de resultados para renderizado a 60 FPS
  const resultadosVisibles = useMemo(
    () => resultadosBusqueda.slice(0, displayLimit),
    [resultadosBusqueda, displayLimit]
  );

  // Manejo de teclado global (F2 foco búsqueda, F4 cobrar, F8 historial, F9 vendedor, F11 fullscreen)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        showCobroModal ||
        showClienteModal ||
        showHistorialModal ||
        showCambioVendedorModal ||
        comprobanteVenta ||
        showConfirmLimpiar ||
        itemParaModificarPrecio
      ) {
        return;
      }

      // F2: Foco en búsqueda
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      // F4: Cobrar / Confirmar venta
      if (e.key === 'F4') {
        e.preventDefault();
        if (carrito.length > 0) {
          setShowCobroModal(true);
        } else {
          showToast('Agregue productos a la venta antes de cobrar', 'info');
        }
        return;
      }

      // F8: Historial de Ventas
      if (e.key === 'F8') {
        e.preventDefault();
        setShowHistorialModal(true);
        return;
      }

      // F9: Cambio Rápido de Vendedor
      if (e.key === 'F9') {
        e.preventDefault();
        setShowCambioVendedorModal(true);
        return;
      }

      // F11: Pantalla Completa
      if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
        return;
      }

      // Escape: Limpiar búsqueda o reiniciar venta
      if (e.key === 'Escape') {
        if (searchQuery) {
          e.preventDefault();
          setSearchQuery('');
        } else if (carrito.length > 0) {
          e.preventDefault();
          setShowConfirmLimpiar(true);
        }
        return;
      }

      // Flechas y Enter en lista de productos
      if (document.activeElement === searchInputRef.current && resultadosBusqueda.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex((prev) => (prev < resultadosBusqueda.length - 1 ? prev + 1 : 0));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : resultadosBusqueda.length - 1));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          const target = selectedIndex >= 0 ? resultadosBusqueda[selectedIndex] : resultadosBusqueda[0];
          if (target) {
            agregarProductoAlCarrito(target);
            setSearchQuery('');
            setSelectedIndex(-1);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    showCobroModal,
    showClienteModal,
    showHistorialModal,
    showCambioVendedorModal,
    comprobanteVenta,
    showConfirmLimpiar,
    itemParaModificarPrecio,
    carrito.length,
    resultadosBusqueda,
    selectedIndex,
    searchQuery,
  ]);

  // Agregar producto al carrito
  const agregarProductoAlCarrito = (prod: ProductoBuscado) => {
    setCarrito((prev) => {
      const idx = prev.findIndex((item) => item.productoId === prod.id);
      if (idx >= 0) {
        const updated = [...prev];
        const existing = updated[idx];
        const nuevaCantidad = existing.cantidad + 1;
        const bruto = nuevaCantidad * existing.precioUnitario;
        const descuentoMonto =
          Math.round(((bruto * existing.descuentoPorcentaje) / 100) * 100) / 100;
        const subtotal = Math.round((bruto - descuentoMonto) * 100) / 100;

        updated[idx] = {
          ...existing,
          cantidad: nuevaCantidad,
          descuentoMonto,
          subtotal,
        };
        return updated;
      } else {
        const precio = prod.precioAplicado > 0 ? prod.precioAplicado : prod.precioBase;
        const nuevoItem: ItemCarrito = {
          id: `cart-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          productoId: prod.id,
          esManual: false,
          sku: prod.sku,
          codigoBarras: prod.codigoBarras,
          descripcion: prod.descripcion,
          unidad: prod.unidad || 'UNID',
          cantidad: 1,
          precioOriginal: precio,
          precioUnitario: precio,
          descuentoPorcentaje: 0,
          descuentoMonto: 0,
          ivaPorcentaje: prod.ivaPorcentaje ?? 21,
          subtotal: precio,
          precioModificado: false,
          stockActual: prod.stockActual,
          esFallbackPrecio: prod.esFallbackPrecio,
        };
        return [nuevoItem, ...prev];
      }
    });

    setTimeout(() => {
      searchInputRef.current?.focus({ preventScroll: true });
    }, 50);
  };

  // Modificar cantidad de un ítem
  const handleCambiarCantidad = (id: string, delta: number) => {
    setCarrito((prev) =>
      prev
        .map((item) => {
          if (item.id !== id) return item;
          const nuevaCantidad = Math.round((item.cantidad + delta) * 100) / 100;
          if (nuevaCantidad <= 0) return null;
          const bruto = nuevaCantidad * item.precioUnitario;
          const descuentoMonto =
            Math.round(((bruto * item.descuentoPorcentaje) / 100) * 100) / 100;
          const subtotal = Math.round((bruto - descuentoMonto) * 100) / 100;
          return { ...item, cantidad: nuevaCantidad, descuentoMonto, subtotal };
        })
        .filter((item): item is ItemCarrito => item !== null)
    );
  };

  const handleSetCantidadManual = (id: string, cantidad: number) => {
    if (cantidad <= 0) return;
    setCarrito((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const bruto = cantidad * item.precioUnitario;
        const descuentoMonto =
          Math.round(((bruto * item.descuentoPorcentaje) / 100) * 100) / 100;
        const subtotal = Math.round((bruto - descuentoMonto) * 100) / 100;
        return { ...item, cantidad, descuentoMonto, subtotal };
      })
    );
  };

  // Eliminar línea
  const handleEliminarItem = (id: string) => {
    setCarrito((prev) => prev.filter((item) => item.id !== id));
  };

  // Solicitar modificación de precio unitario vía modal estilizado
  const handleSolicitarEditarPrecio = (item: ItemCarrito) => {
    setItemParaModificarPrecio(item);
  };

  const handlePrecioModificado = (nuevoPrecio: number, motivo: string) => {
    if (!itemParaModificarPrecio) return;
    const itemTarget = itemParaModificarPrecio;
    setCarrito((prev) =>
      prev.map((it) => {
        if (it.id !== itemTarget.id) return it;
        const bruto = it.cantidad * nuevoPrecio;
        const descuentoMonto =
          Math.round(((bruto * it.descuentoPorcentaje) / 100) * 100) / 100;
        const subtotal = Math.round((bruto - descuentoMonto) * 100) / 100;
        return {
          ...it,
          precioUnitario: nuevoPrecio,
          precioModificado: true,
          motivoModificacion: motivo,
          descuentoMonto,
          subtotal,
        };
      })
    );
    showToast(`Precio modificado para ${itemTarget.sku}`, 'success');
    setItemParaModificarPrecio(null);
  };

  // Cambio de lista de precios con confirmación si hay ítems cargados
  const aplicarCambioListaInmediato = (nuevaId: string, carritoBase?: ItemCarrito[]) => {
    const nuevaLista = listasPrecios.find((l) => l.id === nuevaId);
    if (!nuevaLista) return;
    setListaSeleccionadaId(nuevaId);
    setListaCambioPendiente(null);

    const base = carritoBase ?? carrito;
    if (base.length > 0) {
      setCarrito(
        base.map((item) => {
          if (item.precioModificado || item.esManual || !item.productoId) return item; // Mantener modificaciones manuales autorizadas e ítems libres
          const rawProd = rawCatalogo.find((p) => p.id === item.productoId);
          const { precio, esFallback } = resolverPrecioProducto(
            rawProd || {
              precioBase: item.precioOriginal,
              costo: 0,
              ivaPorcentaje: item.ivaPorcentaje,
            },
            nuevaLista
          );
          const bruto = item.cantidad * precio;
          const descuentoMonto =
            Math.round(((bruto * item.descuentoPorcentaje) / 100) * 100) / 100;
          const subtotal = Math.round((bruto - descuentoMonto) * 100) / 100;
          return {
            ...item,
            precioOriginal: precio,
            precioUnitario: precio,
            descuentoMonto,
            subtotal,
            esFallbackPrecio: esFallback,
          };
        })
      );
    }
  };

  const handleSolicitarCambioLista = (nuevaListaId: string) => {
    if (nuevaListaId === listaSeleccionadaId) return;

    if (carrito.length > 0) {
      setListaCambioPendiente(nuevaListaId);
    } else {
      aplicarCambioListaInmediato(nuevaListaId);
    }
  };

  const confirmarCambioLista = () => {
    if (!listaCambioPendiente) return;
    aplicarCambioListaInmediato(listaCambioPendiente);
    showToast('Precios recalculados según la nueva lista', 'success');
  };

  // Manejo de cambio de cliente (desde barra superior o desde CobroModal)
  const handleClienteSeleccionado = (nuevoCli: {
    id: string | null;
    nombre: string;
    identificacion?: string | null;
    listaPrecioId?: string | null;
    listaPrecio?: { id: string; nombre: string; codigo: string; ivaDiscriminado?: boolean } | null;
  }) => {
    setCliente({
      id: nuevoCli.id,
      nombre: nuevoCli.nombre,
      identificacion: nuevoCli.identificacion || null,
    });

    let targetListaId = nuevoCli.listaPrecioId;
    if (!targetListaId || !nuevoCli.id || nuevoCli.nombre === 'Consumidor Final') {
      const pred = listasPrecios.find((l) => l.esPredeterminada) || listasPrecios[0];
      targetListaId = pred?.id || null;
    }

    if (targetListaId && targetListaId !== listaSeleccionadaId) {
      aplicarCambioListaInmediato(targetListaId);
      const targetLista = listasPrecios.find((l) => l.id === targetListaId);
      showToast(
        `Cliente: ${nuevoCli.nombre} • Lista aplicada: ${targetLista?.nombre || 'General'}${
          targetLista?.ivaDiscriminado ? ' (IVA Disc.)' : ''
        }`,
        'info'
      );
    } else {
      showToast(`Cliente seleccionado: ${nuevoCli.nombre}`, 'info');
    }
  };

  // Totales calculados en el cliente según IVA Discriminado
  const esIvaDiscriminado = Boolean(listaActual?.ivaDiscriminado);

  const subtotalLineas = useMemo(
    () => Math.round(carrito.reduce((acc, it) => acc + (it.subtotal || 0), 0) * 100) / 100,
    [carrito]
  );

  const descuentoGlobalMonto = useMemo(
    () => Math.round(((subtotalLineas * descuentoGlobal) / 100) * 100) / 100,
    [subtotalLineas, descuentoGlobal]
  );

  const subtotalConDescuento = useMemo(
    () => Math.max(0, Math.round((subtotalLineas - descuentoGlobalMonto) * 100) / 100),
    [subtotalLineas, descuentoGlobalMonto]
  );

  const impuestosEstimados = useMemo(() => {
    return (
      Math.round(
        carrito.reduce((acc, it) => {
          const base = (it.subtotal || 0) * (1 - descuentoGlobal / 100);
          const ivaPorc = it.ivaPorcentaje ?? 21;
          if (esIvaDiscriminado) {
            const iva = ivaPorc > 0 ? Math.round(((base * ivaPorc) / 100) * 100) / 100 : 0;
            return acc + iva;
          } else {
            const divisor = 1 + ivaPorc / 100;
            const netoSinIva = divisor > 0 ? base / divisor : base;
            const iva = Math.round((base - netoSinIva) * 100) / 100;
            return acc + iva;
          }
        }, 0) * 100
      ) / 100
    );
  }, [carrito, descuentoGlobal, esIvaDiscriminado]);

  // Si la lista tiene ivaDiscriminado: total = subtotalNeto - desc + IVA.
  // Si no tiene ivaDiscriminado: total = subtotal - desc (el precio ya incluye IVA y no se suma al final).
  const totalFinal = useMemo(() => {
    if (esIvaDiscriminado) {
      return Math.max(0, Math.round((subtotalConDescuento + impuestosEstimados) * 100) / 100);
    }
    return subtotalConDescuento;
  }, [esIvaDiscriminado, subtotalConDescuento, impuestosEstimados]);

  // Cargar cotización si viene ?cotizacionId=... en la URL
  useEffect(() => {
    if (typeof window === 'undefined' || isLoadingCatalogo) return;
    const params = new URLSearchParams(window.location.search);
    const cotId = params.get('cotizacionId');
    if (!cotId || cotizacionOrigen?.id === cotId) return;

    (async () => {
      try {
        const res = await fetch(`/api/ventas/cotizaciones/${cotId}`);
        if (!res.ok) return;
        const cot = await res.json();
        setCotizacionOrigen({ id: cot.id, numero: cot.numero });
        setCliente({
          id: cot.clienteId || null,
          nombre: cot.clienteNombre || 'Consumidor Final',
          identificacion: cot.clienteIdentificacion || cot.clienteCuit || null,
        });
        if (cot.listaPrecioId) {
          setListaSeleccionadaId(cot.listaPrecioId);
        }
        setDescuentoGlobal(cot.descuentoPorcentaje || cot.descuentoGlobalPct || 0);

        const itemsCargados: ItemCarrito[] = [];
        for (const it of cot.items || []) {
          const prod = it.productoId ? rawCatalogo.find((p) => p.id === it.productoId) : undefined;
          const esManual = Boolean(it.esManual || !it.productoId);
          itemsCargados.push({
            id: `cot-it-${it.id}`,
            productoId: it.productoId || null,
            esManual,
            sku: it.sku || it.codigo || prod?.sku || 'MANUAL',
            codigoBarras: prod?.codigoBarras || null,
            descripcion: it.descripcion || it.nombre,
            unidad: it.unidad || prod?.unidad || 'u',
            cantidad: it.cantidad,
            precioOriginal: it.precioOriginal || it.precioUnitario,
            precioUnitario: it.precioUnitario,
            descuentoPorcentaje: it.descuentoPorcentaje || it.descuentoPct || 0,
            descuentoMonto: it.descuentoMonto || 0,
            ivaPorcentaje: it.ivaPorcentaje ?? it.alicuotaIva ?? 21,
            subtotal: it.subtotal,
            precioModificado:
              esManual || Math.abs((it.precioOriginal || it.precioUnitario) - it.precioUnitario) > 0.01,
            motivoModificacion: `Precio de Cotización ${cot.numero}`,
            stockActual: prod?.stockActual ?? 999999,
          });
        }
        setCarrito(itemsCargados);
        // Limpiar el parámetro de la URL para evitar recargas al finalizar o limpiar la venta
        window.history.replaceState({}, '', window.location.pathname);
        showToast(`Cotización ${cot.numero} cargada lista para facturar`, 'success');
      } catch (err) {
        console.error('Error al cargar cotización en PDV:', err);
      }
    })();
  }, [rawCatalogo, isLoadingCatalogo, cotizacionOrigen?.id]);

  // Limpiar venta
  const handleLimpiarVenta = () => {
    setCarrito([]);
    setDescuentoGlobal(0);
    setCotizacionOrigen(null);
    setSearchQuery('');
    setCliente({
      id: null,
      nombre: 'Consumidor Final',
      identificacion: null,
    });
    const pred = listasPrecios.find((l) => l.esPredeterminada) || listasPrecios[0];
    if (pred && listaSeleccionadaId !== pred.id) {
      aplicarCambioListaInmediato(pred.id, []);
    }
    setShowConfirmLimpiar(false);
    showToast('Venta reiniciada', 'info');
    searchInputRef.current?.focus();
  };

  // Confirmar venta desde CobroModal
  const handleConfirmarVentaBackend = async (datosCobro: any) => {
    const activeVendorName =
      currentUser?.nombreCompleto || currentUser?.name || currentUser?.nombre || 'Ventas HDB';

    const payload = {
      cotizacionId: cotizacionOrigen?.id || null,
      autorizadoPorSupervisor: true,
      clienteId: cliente.id,
      clienteNombre: cliente.nombre,
      clienteIdentificacion: cliente.identificacion,
      listaPrecioId: listaSeleccionadaId || null,
      vendedorId: currentUser?.id || undefined,
      vendedorNombre: activeVendorName,
      descuentoPorcentaje: descuentoGlobal,
      items: carrito.map((it) => ({
        productoId: it.productoId || null,
        esManual: Boolean(it.esManual || !it.productoId),
        sku: it.sku,
        descripcion: it.descripcion,
        unidad: it.unidad,
        cantidad: it.cantidad,
        precioOriginal: it.precioOriginal,
        precioUnitario: it.precioUnitario,
        descuentoPorcentaje: it.descuentoPorcentaje,
        descuentoMonto: it.descuentoMonto,
        ivaPorcentaje: it.ivaPorcentaje,
        precioModificado: it.precioModificado,
        motivoModificacion: it.motivoModificacion,
      })),
      pagos: datosCobro.pagos,
      observaciones: datosCobro.observaciones,
    };

    const res = await fetch('/api/ventas/pdv/confirmar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': datosCobro.idempotencyKey,
        'x-user-id': currentUser?.id || '',
        'x-user-name': activeVendorName,
        'x-user-role': currentUser?.role || '',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Error al confirmar la venta');
    }

    showToast(`Venta ${data.venta.numero} registrada con éxito`, 'success');

    // Cerrar modal de cobro y mostrar comprobante de forma segura
    setShowCobroModal(false);
    setComprobanteVenta(data.venta);

    // Reiniciar venta
    setCarrito([]);
    setDescuentoGlobal(0);
    setCotizacionOrigen(null);
    setSearchQuery('');
    setCliente({
      id: null,
      nombre: 'Consumidor Final',
      identificacion: null,
    });
    const pred = listasPrecios.find((l) => l.esPredeterminada) || listasPrecios[0];
    if (pred && listaSeleccionadaId !== pred.id) {
      aplicarCambioListaInmediato(pred.id, []);
    }

    return data.venta;
  };

  const formatARS = (val: number) =>
    new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(val || 0);

  if (isAuthChecking) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
        <p className="text-xs font-medium text-slate-500">Cargando Punto de Venta...</p>
      </div>
    );
  }

  const rolUsuario = (currentUser?.role || '').toLowerCase();
  if (!['admin', 'administrador', 'supervisor', 'vendedor'].includes(rolUsuario)) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-14 h-14 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center border border-red-200 dark:border-red-800">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Acceso Restringido</h2>
          <p className="text-xs text-slate-500 max-w-md mt-1">
            Esta vista está reservada exclusivamente para personal con rol Vendedor, Supervisor o Administrador.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm transition-all"
        >
          <Home className="w-4 h-4" />
          <span>Volver al Inicio</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={`transition-all duration-200 ${
        isFullscreen
          ? 'fixed inset-0 z-[70] bg-slate-50 dark:bg-slate-950 flex flex-col h-screen w-screen overflow-hidden p-2 sm:p-2.5'
          : 'flex flex-col h-full w-full min-h-0 max-h-full overflow-hidden space-y-1.5'
      }`}
    >
      {/* Pestañas de Navegación (ocultas en pantalla completa) */}
      {!isFullscreen && (
        <div className="shrink-0">
          <VentasNavTabs currentTab="pdv" className="mb-0" />
        </div>
      )}

      {/* Barra Superior Sobria y Profesional */}
      <header className="bg-card border border-slate-200/90 dark:border-slate-800 rounded-xl px-3 py-2 shadow-xs flex flex-wrap items-center justify-between gap-2 shrink-0">
        {/* Izquierda: Home, Cliente, Lista de Precios */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-background hover:bg-muted text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors shrink-0"
            title="Volver al Inicio"
          >
            <Home className="w-4 h-4" />
          </button>

          {/* Selector de Cliente */}
          <div className="h-8 flex items-center gap-2 bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-lg px-2.5">
            <User className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">Cliente:</span>
              <strong className="text-slate-800 dark:text-slate-200 font-semibold truncate max-w-[120px] sm:max-w-[160px]">
                {cliente.nombre}
              </strong>
            </div>
            <button
              type="button"
              onClick={() => setShowClienteModal(true)}
              className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline px-1 py-0.5 ml-0.5"
            >
              Cambiar
            </button>
          </div>

          {/* Selector de Lista de Precios con indicador de IVA y Acceso a Configuración */}
          <div className="h-8 flex items-center gap-1.5 bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-lg px-2">
            <Tag className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <select
              value={listaSeleccionadaId}
              onChange={(e) => handleSolicitarCambioLista(e.target.value)}
              className="bg-transparent font-medium text-slate-800 dark:text-slate-200 focus:outline-hidden cursor-pointer text-xs"
            >
              {listasPrecios.map((l) => (
                <option key={l.id} value={l.id} className="dark:bg-slate-900 text-xs">
                  {l.nombre} {l.esPredeterminada ? '★ (Defecto)' : ''} {l.ivaDiscriminado ? '• IVA Disc.' : ''}
                </option>
              ))}
            </select>
            {esIvaDiscriminado && (
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300/40">
                IVA Disc.
              </span>
            )}
            {listaActual?.esPredeterminada ? (
              <span
                className="p-1 text-amber-500 cursor-default"
                title="Lista por defecto actual para Consumidor Final y PDV"
              >
                <Star className="w-3.5 h-3.5 fill-amber-500" />
              </span>
            ) : (
              <button
                type="button"
                onClick={handleEstablecerListaActualComoPredeterminada}
                className="p-1 rounded text-slate-400 hover:text-amber-500 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                title="Establecer esta lista como predeterminada para Consumidor Final y PDV"
              >
                <Star className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={handleAbrirConfigListas}
              className="p-1 rounded text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors ml-0.5"
              title="Configurar Listas de Precios (IVA discriminado, márgenes, reglas)"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Derecha: Vendedor, Pantalla Completa, Historial, Limpiar */}
        <div className="flex items-center gap-1.5">
          {/* Vendedor Activo */}
          <div className="h-8 flex items-center gap-1.5 bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-lg px-2.5">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span className="text-xs font-medium text-slate-800 dark:text-slate-200 max-w-[110px] sm:max-w-[140px] truncate">
              {currentUser?.nombreCompleto || 'Cajero'}
            </span>
            <button
              type="button"
              onClick={() => setShowCambioVendedorModal(true)}
              className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline px-1 py-0.5 ml-1"
              title="Cambiar vendedor [F9]"
            >
              F9
            </button>
          </div>

          {/* Botón Pantalla Completa */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className={`h-8 w-8 rounded-lg border transition-all flex items-center justify-center ${
              isFullscreen
                ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                : 'bg-background border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-muted'
            }`}
            title={isFullscreen ? 'Salir de Pantalla Completa (F11)' : 'Pantalla Completa (F11)'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {/* Pendientes de Entrega */}
          <button
            type="button"
            onClick={() => setShowPendientesModal(true)}
            className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-lg border border-amber-300/60 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/30 hover:bg-amber-100/70 text-xs font-semibold text-amber-800 dark:text-amber-300 shadow-xs transition-colors"
            title="Pendientes de Entrega de Materiales"
          >
            <Truck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span className="hidden sm:inline">Pendientes</span>
          </button>

          {/* Historial */}
          <button
            type="button"
            onClick={() => setShowHistorialModal(true)}
            className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-background hover:bg-muted text-xs font-medium text-slate-700 dark:text-slate-300 shadow-xs transition-colors"
            title="Historial de ventas (F8)"
          >
            <History className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span className="hidden sm:inline">Historial</span>
            <span className="text-[10px] text-slate-400 font-mono">F8</span>
          </button>

          {carrito.length > 0 && (
            <button
              type="button"
              onClick={() => setShowConfirmLimpiar(true)}
              className="h-8 inline-flex items-center gap-1 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-background hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              title="Limpiar carrito actual (Esc)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Limpiar</span>
            </button>
          )}
        </div>
      </header>

      {/* Contenedor Principal Flexible del PDV (Altura Fija al 100% sin desborde) */}
      <div className="flex flex-col lg:flex-row gap-2.5 items-stretch flex-1 min-h-0 h-full max-h-full overflow-hidden">
        {/* PANEL IZQUIERDO: Catálogo y Búsqueda (42% de ancho en desktop, altura fija y scroll confinado) */}
        <section className="w-full lg:w-[42%] xl:w-[40%] bg-card border border-slate-200/90 dark:border-slate-800 rounded-xl p-3 shadow-xs flex flex-col space-y-2 h-full min-h-0 max-h-full overflow-hidden shrink-0">
          {/* Input de Búsqueda */}
          <div className="shrink-0 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-indigo-500" />
                <span>Búsqueda de Artículos</span>
                {totalResultados > 0 && (
                  <span className="text-[10px] text-slate-400 font-normal">
                    ({totalResultados.toLocaleString()} disp.)
                  </span>
                )}
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsRefreshing(true);
                    cargarCatalogo(true);
                  }}
                  disabled={isRefreshing || isLoadingCatalogo}
                  className="p-1 text-slate-400 hover:text-indigo-600 rounded-md transition-colors"
                  title="Actualizar catálogo de productos"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
                </button>
                <span className="text-[10px] text-slate-400 font-mono">F2 para enfocar</span>
              </div>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                autoFocus
                placeholder="SKU (ej: 3, 5001), código de barras o descripción..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-8 bg-slate-100/60 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:bg-background focus:outline-hidden focus:ring-1 focus:ring-indigo-500 transition-all"
              />
              {isLoadingCatalogo && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500 absolute right-2.5 top-1/2 -translate-y-1/2" />
              )}
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-400 px-0.5">
              <span>
                {searchQuery
                  ? `Filtrando: ${totalResultados.toLocaleString()} de ${rawCatalogo.length.toLocaleString()}`
                  : `Catálogo completo: ${totalResultados.toLocaleString()} artículos`}
              </span>
              <span>Enter: agregar • ↑↓: navegar</span>
            </div>
          </div>

          {/* Lista de Resultados de Catálogo con Scroll Progresivo de 4.000 artículos */}
          <div
            onScroll={(e) => {
              const el = e.currentTarget;
              if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200) {
                setDisplayLimit((prev) => Math.min(prev + 50, resultadosBusqueda.length));
              }
            }}
            className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar"
          >
            {isLoadingCatalogo && rawCatalogo.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                <span className="text-xs">Cargando catálogo en memoria...</span>
              </div>
            ) : resultadosVisibles.length > 0 ? (
              <>
                {resultadosVisibles.map((prod, idx) => {
                  const isSelected = selectedIndex === idx;
                  const isExact = prod.esCoincidenciaExacta;

                  return (
                    <div
                      key={prod.id}
                      onClick={() => {
                        agregarProductoAlCarrito(prod);
                        setSearchQuery('');
                      }}
                      className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                        isExact
                          ? 'border-emerald-400/80 dark:border-emerald-600/80 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs ring-1 ring-emerald-400/30'
                          : isSelected
                          ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-950/40 shadow-xs ring-1 ring-indigo-400/30'
                          : 'border-slate-200/70 dark:border-slate-800 bg-background/60 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/80 dark:hover:bg-slate-900/40'
                      }`}
                    >
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                            {prod.sku}
                          </span>

                          {isExact && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-300/50 dark:border-emerald-700/50 flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              Exacto [Enter]
                            </span>
                          )}

                          {prod.marca && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium truncate max-w-[90px]">
                              {prod.marca}
                            </span>
                          )}
                        </div>

                        <div className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                          {prod.descripcion}
                        </div>

                        <div className="flex items-center gap-2.5 text-[10px] text-slate-400">
                          {prod.codigoBarras && (
                            <span className="flex items-center gap-1">
                              <Barcode className="w-3 h-3 text-slate-400" />
                              {prod.codigoBarras}
                            </span>
                          )}
                          <span>Stock: <strong className="text-slate-600 dark:text-slate-300">{prod.stockActual}</strong> {prod.unidad}</span>
                          {prod.esFallbackPrecio && (
                            <span className="text-amber-600 dark:text-amber-400 font-medium">(Base)</span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {formatARS(prod.precioAplicado > 0 ? prod.precioAplicado : prod.precioBase)}
                        </div>
                        {esIvaDiscriminado && (
                          <div className="text-[9px] text-slate-400">Neto s/IVA</div>
                        )}
                        <button
                          type="button"
                          className={`mt-1 h-6 px-2.5 rounded-md font-semibold text-[11px] flex items-center gap-1 transition-colors ${
                            isExact
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <Plus className="w-3 h-3" />
                          <span>Agregar</span>
                        </button>
                      </div>
                    </div>
                  );
                })}

                {resultadosVisibles.length < totalResultados && (
                  <div className="py-2.5 text-center text-[10px] text-slate-400">
                    Mostrando {resultadosVisibles.length} de {totalResultados.toLocaleString()} productos. Desplácese hacia abajo para ver más...
                  </div>
                )}
              </>
            ) : (
              <div className="py-12 text-center text-slate-400 text-xs space-y-1">
                <Package className="w-7 h-7 text-slate-300 dark:text-slate-700 mx-auto" />
                <p>No se encontraron productos para <strong>"{searchQuery}"</strong>.</p>
              </div>
            )}
          </div>
        </section>

        {/* PANEL DERECHO: Detalle de Venta / Carrito y Totales (flex-1 para ocupar el resto del ancho, altura fija y botón de cobro anclado) */}
        <section className="w-full lg:flex-1 bg-card border border-slate-200/90 dark:border-slate-800 rounded-xl p-3 shadow-xs flex flex-col justify-between h-full min-h-0 max-h-full overflow-hidden">
          {/* Header del carrito */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-800 mb-1.5 shrink-0">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                Detalle de Venta
              </h2>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                {carrito.length} {carrito.length === 1 ? 'artículo' : 'artículos'}
              </span>
            </div>

            <span className="text-[11px] font-mono text-slate-400">
              [F4] Cobrar
            </span>
          </div>

          {/* Grilla de productos cargados con scroll independiente */}
          <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
            {carrito.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs space-y-2">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-900/60 flex items-center justify-center mx-auto text-slate-400">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <p className="font-semibold text-slate-600 dark:text-slate-400">El carrito de venta está vacío</p>
                <p className="text-[11px]">Busque productos en el panel izquierdo para agregarlos a la venta.</p>
              </div>
            ) : (
              carrito.map((item) => (
                <div
                  key={item.id}
                  className="p-2 rounded-lg border border-slate-200/70 dark:border-slate-800 bg-background/50 hover:bg-slate-50/60 dark:hover:bg-slate-900/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                >
                  {/* Info producto */}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                        {item.sku}
                      </span>
                      {item.precioModificado && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-semibold">
                          Modificado
                        </span>
                      )}
                    </div>
                    <div className="font-medium text-slate-800 dark:text-slate-200 truncate">
                      {item.descripcion}
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-2.5">
                      <span>P. Unit: {formatARS(item.precioUnitario)}</span>
                      {item.descuentoPorcentaje > 0 && (
                        <span className="text-emerald-600 font-semibold">
                          Desc: {item.descuentoPorcentaje}%
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleSolicitarEditarPrecio(item)}
                        className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5 font-medium"
                      >
                        <Edit2 className="w-2.5 h-2.5" />
                        Editar precio
                      </button>
                    </div>
                  </div>

                  {/* Controles de Cantidad & Subtotal */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    {/* Stepper Cantidad */}
                    <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-md bg-card overflow-hidden h-7">
                      <button
                        type="button"
                        onClick={() => handleCambiarCantidad(item.id, -1)}
                        className="w-7 h-full flex items-center justify-center hover:bg-muted text-slate-500 transition-colors"
                        title="Restar 1"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="number"
                        step="1"
                        min="0.01"
                        value={item.cantidad}
                        onChange={(e) =>
                          handleSetCantidadManual(item.id, parseFloat(e.target.value) || 0)
                        }
                        className="w-10 text-center text-xs font-bold text-slate-900 dark:text-slate-100 bg-transparent focus:outline-hidden py-0.5"
                      />
                      <button
                        type="button"
                        onClick={() => handleCambiarCantidad(item.id, 1)}
                        className="w-7 h-full flex items-center justify-center hover:bg-muted text-slate-500 transition-colors"
                        title="Sumar 1"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Subtotal fila */}
                    <div className="text-right min-w-[80px]">
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {formatARS(item.subtotal)}
                      </div>
                    </div>

                    {/* Eliminar fila */}
                    <button
                      type="button"
                      onClick={() => handleEliminarItem(item.id)}
                      className="p-1 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                      title="Quitar artículo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Cuadro Inferior de Totales y Botón Cobrar (Fijo al Fondo) */}
          <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800 space-y-2.5 mt-auto shrink-0">
            {/* Desglose numérico */}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>{esIvaDiscriminado ? 'Subtotal Neto:' : 'Subtotal:'}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {formatARS(subtotalLineas)}
                </span>
              </div>

              {/* Descuento global */}
              <div className="flex justify-between items-center text-slate-500">
                <span className="flex items-center gap-1">
                  Descuento general (%):
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={descuentoGlobal === 0 ? '' : descuentoGlobal}
                    onChange={(e) =>
                      setDescuentoGlobal(
                        Math.max(0, Math.min(100, parseFloat(e.target.value) || 0))
                      )
                    }
                    placeholder="0"
                    className="w-12 h-6 px-1 text-center text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded bg-background ml-1 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </span>
                {descuentoGlobalMonto > 0 && (
                  <span className="font-semibold text-emerald-600">
                    -{formatARS(descuentoGlobalMonto)}
                  </span>
                )}
              </div>

              {/* IVA: solo si la lista tiene IVA discriminado */}
              {esIvaDiscriminado && (
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">IVA:</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">
                    +{formatARS(impuestosEstimados)}
                  </span>
                </div>
              )}
            </div>

            {/* Total Final y Botón de Cobro */}
            <div className="p-3 rounded-xl bg-slate-900 text-white dark:bg-slate-950 dark:border dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Total Final a Cobrar {esIvaDiscriminado ? '(Neto + IVA)' : ''}
                </span>
                <span className="text-2xl font-black text-emerald-400 tracking-tight">
                  {formatARS(totalFinal)}
                </span>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Cliente: <strong className="text-white">{cliente.nombre}</strong>
                </div>
                {!esIvaDiscriminado && impuestosEstimados > 0 && (
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    (Incluye IVA estimado: {formatARS(impuestosEstimados)})
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={carrito.length === 0}
                onClick={() => setShowCobroModal(true)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <CreditCard className="w-4 h-4" />
                <span>Cobrar / Confirmar (F4)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Modal de Cambio Rápido de Vendedor */}
      <CambioRapidoVendedorModal
        isOpen={showCambioVendedorModal}
        onClose={() => setShowCambioVendedorModal(false)}
        currentUserId={currentUser?.id}
        onVendedorCambiado={(nuevoVendedor) => {
          setCurrentUser(nuevoVendedor);
        }}
      />

      {/* Modal de Selección de Cliente */}
      <SeleccionarClienteModal
        isOpen={showClienteModal}
        onClose={() => setShowClienteModal(false)}
        clienteActual={cliente}
        onSeleccionar={handleClienteSeleccionado}
      />

      {/* Modal de Cobro y Pagos (Soporta cambiar cliente directamente y discrimina IVA) */}
      {showCobroModal && (
        <CobroModal
          isOpen={showCobroModal}
          onClose={() => setShowCobroModal(false)}
          cliente={cliente}
          totalVenta={totalFinal}
          subtotal={subtotalLineas}
          descuentoMonto={descuentoGlobalMonto}
          impuestosMonto={impuestosEstimados}
          itemsCount={carrito.length}
          listaPrecioNombre={listaActual?.nombre || 'General'}
          ivaDiscriminado={esIvaDiscriminado}
          onCambiarCliente={handleClienteSeleccionado}
          onConfirmarVenta={handleConfirmarVentaBackend}
        />
      )}

      {/* Modales de Comprobantes, Remitos e Historial protegidos por ErrorBoundary */}
      <ErrorBoundary
        fallbackTitle="Error en el módulo de comprobantes o remitos"
        onReset={() => {
          setComprobanteVenta(null);
          setVentaParaRemito(null);
          setRemitoParaImprimir(null);
          setShowPendientesModal(false);
        }}
      >
        {/* Modal de Comprobante / Impresión */}
        {comprobanteVenta && (
          <ComprobanteModal
            isOpen={!!comprobanteVenta}
            onClose={() => setComprobanteVenta(null)}
            venta={comprobanteVenta}
            onGenerarRemito={(v) => {
              setComprobanteVenta(null);
              setVentaParaRemito(v);
            }}
          />
        )}

        {/* Modal para Generar Remito */}
        {ventaParaRemito && (
          <GenerarRemitoModal
            isOpen={!!ventaParaRemito}
            onClose={() => setVentaParaRemito(null)}
            venta={ventaParaRemito}
            onRemitoGenerado={(nuevoRemito) => {
              setVentaParaRemito(null);
              setRemitoParaImprimir(nuevoRemito);
            }}
          />
        )}

        {/* Modal para Imprimir Remito */}
        {remitoParaImprimir && (
          <ImprimirRemitoModal
            isOpen={!!remitoParaImprimir}
            onClose={() => setRemitoParaImprimir(null)}
            remito={remitoParaImprimir}
          />
        )}

        {/* Modal de Pendientes de Entrega */}
        {showPendientesModal && (
          <PendientesEntregaModal
            isOpen={showPendientesModal}
            onClose={() => setShowPendientesModal(false)}
            onEntregar={(v) => {
              setShowPendientesModal(false);
              setVentaParaRemito(v);
            }}
            onVerRemito={(rem) => {
              setShowPendientesModal(false);
              setRemitoParaImprimir(rem);
            }}
          />
        )}

        {/* Modal de Historial de Ventas */}
        {showHistorialModal && (
          <HistorialVentasModal
            isOpen={showHistorialModal}
            onClose={() => setShowHistorialModal(false)}
            currentUserRole={currentUser?.role}
            currentUserId={currentUser?.id}
            onVerComprobante={(v) => {
              setComprobanteVenta(v);
            }}
          />
        )}
      </ErrorBoundary>

      {/* Modal Nativo para Modificación de Precios */}
      <ModificarPrecioModal
        isOpen={!!itemParaModificarPrecio}
        onClose={() => setItemParaModificarPrecio(null)}
        item={itemParaModificarPrecio}
        currentUser={currentUser}
        onPrecioModificado={handlePrecioModificado}
      />

      {/* Dialog para Confirmar Limpieza de Venta */}
      <ConfirmDialog
        isOpen={showConfirmLimpiar}
        title="¿Reiniciar la venta actual?"
        message="Se perderán los artículos cargados en el borrador de venta. Esta acción no se puede deshacer."
        confirmLabel="Sí, reiniciar"
        cancelLabel="Continuar venta"
        variant="danger"
        onConfirm={handleLimpiarVenta}
        onCancel={() => setShowConfirmLimpiar(false)}
      />

      {/* Dialog para Confirmar Cambio de Lista de Precios */}
      <ConfirmDialog
        isOpen={!!listaCambioPendiente}
        title="¿Cambiar lista de precios?"
        message="Hay productos cargados en el carrito. Al cambiar la lista, los precios unitarios se recalcularán automáticamente según la nueva configuración comercial."
        confirmLabel="Recalcular precios"
        cancelLabel="Mantener lista actual"
        variant="warning"
        onConfirm={confirmarCambioLista}
        onCancel={() => setListaCambioPendiente(null)}
      />
      {/* Modal de Configuración de Listas de Precios */}
      <ConfigListasPreciosModal
        isOpen={showConfigListasModal}
        onClose={() => setShowConfigListasModal(false)}
        meta={metaListas}
        onListasUpdated={async () => {
          await fetchListasPrecios(true);
          await cargarCatalogo(true);
          showToast('Listas de precios actualizadas y sincronizadas', 'success');
        }}
      />
    </div>
  );
}
