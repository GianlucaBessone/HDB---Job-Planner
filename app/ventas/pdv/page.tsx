'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  KeyRound,
  ShieldCheck,
  Receipt,
  Building2,
  Maximize2,
  Minimize2,
  UserCheck,
} from 'lucide-react';
import { showToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import CobroModal from '@/components/ventas/pdv/CobroModal';
import SeleccionarClienteModal from '@/components/ventas/pdv/SeleccionarClienteModal';
import ComprobanteModal from '@/components/ventas/pdv/ComprobanteModal';
import HistorialVentasModal from '@/components/ventas/pdv/HistorialVentasModal';
import AutorizacionPrecioModal from '@/components/ventas/pdv/AutorizacionPrecioModal';
import CambioRapidoVendedorModal from '@/components/ventas/pdv/CambioRapidoVendedorModal';

interface ItemCarrito {
  id: string; // id temporal en el carrito
  productoId: string;
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

interface ProductoBuscado {
  id: string;
  sku: string;
  codigoBarras?: string | null;
  descripcion: string;
  marca?: string | null;
  unidad: string;
  precioBase: number;
  precioAplicado: number;
  esFallbackPrecio: boolean;
  detalleAjuste?: string;
  ivaPorcentaje: number;
  costo: number;
  stockActual: number;
  esCoincidenciaExacta?: boolean;
}

interface ListaPrecioItem {
  id: string;
  codigo: string;
  nombre: string;
  tipoAjuste: string;
  valorAjuste: number;
  esPredeterminada: boolean;
}

export default function PdvPage() {
  // Operador / Vendedor logueado
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Pantalla Completa
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

  // Búsqueda de productos
  const [searchQuery, setSearchQuery] = useState('');
  const [resultadosBusqueda, setResultadosBusqueda] = useState<ProductoBuscado[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const searchCacheRef = useRef<Map<string, ProductoBuscado[]>>(new Map());

  // Modales
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [showCobroModal, setShowCobroModal] = useState(false);
  const [showHistorialModal, setShowHistorialModal] = useState(false);
  const [showCambioVendedorModal, setShowCambioVendedorModal] = useState(false);
  const [comprobanteVenta, setComprobanteVenta] = useState<any | null>(null);
  const [showConfirmLimpiar, setShowConfirmLimpiar] = useState(false);
  const [itemParaEditarPrecio, setItemParaEditarPrecio] = useState<ItemCarrito | null>(null);
  const [showAutorizacionModal, setShowAutorizacionModal] = useState(false);

  // Refs para control de teclado
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cargar usuario actual y preferencia de pantalla completa desde localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('currentUser');
      if (stored) {
        setCurrentUser(JSON.parse(stored));
      }
      const fsPref = localStorage.getItem('pdv_fullscreen');
      if (fsPref === 'true') {
        setIsFullscreen(true);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Manejo de cambio de pantalla completa
  const toggleFullscreen = () => {
    setIsFullscreen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('pdv_fullscreen', String(next));
        if (next) {
          if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(() => {});
          }
        } else {
          if (document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
          }
        }
      } catch (e) {
        console.error('Fullscreen toggle error:', e);
      }
      return next;
    });
  };

  // Cargar listas de precios activas
  useEffect(() => {
    fetchListasPrecios();
  }, []);

  const fetchListasPrecios = async () => {
    try {
      const res = await fetch('/api/ventas/listas-precios');
      if (res.ok) {
        const data = await res.json();
        const activas = Array.isArray(data) ? data.filter((l: any) => l.activo !== false) : [];
        setListasPrecios(activas);

        // Seleccionar lista predeterminada o LISTA_1
        const pred = activas.find((l: any) => l.esPredeterminada) || activas[0];
        if (pred) {
          setListaSeleccionadaId(pred.id);
        }
      }
    } catch (e) {
      console.error('Error cargando listas de precios:', e);
    }
  };

  const listaActual = useMemo(
    () => listasPrecios.find((l) => l.id === listaSeleccionadaId) || null,
    [listasPrecios, listaSeleccionadaId]
  );

  // Búsqueda ultra-rápida de productos (40ms para números, 90ms para texto)
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setResultadosBusqueda([]);
      setIsSearching(false);
      setSelectedIndex(-1);
      return;
    }

    const isNum = /^\d+$/.test(q);
    const delay = isNum ? 40 : 90;

    const timer = setTimeout(() => {
      ejecutarBusqueda(q);
    }, delay);

    return () => clearTimeout(timer);
  }, [searchQuery, listaSeleccionadaId]);

  const ejecutarBusqueda = async (q: string) => {
    // 1. Revisar caché local en memoria para velocidad instantánea (0ms)
    const cacheKey = `${q}__${listaSeleccionadaId || 'def'}`;
    if (searchCacheRef.current.has(cacheKey)) {
      const cached = searchCacheRef.current.get(cacheKey)!;
      setResultadosBusqueda(cached);
      setSelectedIndex(cached.length > 0 ? 0 : -1);
      return;
    }

    setIsSearching(true);
    try {
      const params = new URLSearchParams({
        q,
        limit: '20',
      });
      if (listaSeleccionadaId) {
        params.set('listaPrecioId', listaSeleccionadaId);
      }

      const res = await fetch(`/api/ventas/pdv/buscar-productos?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const prods: ProductoBuscado[] = data.productos || [];

        // Guardar en caché
        searchCacheRef.current.set(cacheKey, prods);

        setResultadosBusqueda(prods);

        // Si hay coincidencia exacta o escaneo inequívoco
        if (prods.length > 0) {
          setSelectedIndex(0); // Siempre preseleccionar la coincidencia exacta (que el backend coloca en posición 0)
        } else {
          setSelectedIndex(-1);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  // Manejo de teclado global (F2 foco búsqueda, F4 cobrar, F8 historial, F9 vendedor, F11 fullscreen)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Si hay algún modal abierto, no interceptar atajos principales
      if (
        showCobroModal ||
        showClienteModal ||
        showHistorialModal ||
        showCambioVendedorModal ||
        comprobanteVenta ||
        showConfirmLimpiar ||
        showAutorizacionModal
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

      // Escape: Limpiar búsqueda o cancelar
      if (e.key === 'Escape') {
        if (searchQuery) {
          e.preventDefault();
          setSearchQuery('');
          setResultadosBusqueda([]);
        } else if (carrito.length > 0) {
          e.preventDefault();
          setShowConfirmLimpiar(true);
        }
        return;
      }

      // Flechas en resultados de búsqueda
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
            setResultadosBusqueda([]);
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
    showAutorizacionModal,
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
        // Incrementar cantidad si ya existe
        const updated = [...prev];
        const existing = updated[idx];
        const nuevaCantidad = existing.cantidad + 1;
        const subtotal = Math.round(
          (nuevaCantidad * existing.precioUnitario * (1 - existing.descuentoPorcentaje / 100)) * 100
        ) / 100;

        updated[idx] = {
          ...existing,
          cantidad: nuevaCantidad,
          subtotal,
        };
        return updated;
      } else {
        // Nuevo ítem en carrito
        const precio = prod.precioAplicado > 0 ? prod.precioAplicado : prod.precioBase;
        const nuevoItem: ItemCarrito = {
          id: `cart-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          productoId: prod.id,
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

    // Mantener foco en el buscador para escaneo continuo
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  // Modificar cantidad de un ítem
  const handleCambiarCantidad = (id: string, delta: number) => {
    setCarrito((prev) =>
      prev
        .map((item) => {
          if (item.id !== id) return item;
          const nuevaCantidad = Math.max(0.01, Math.round((item.cantidad + delta) * 100) / 100);
          const subtotal = Math.round(
            (nuevaCantidad * item.precioUnitario * (1 - item.descuentoPorcentaje / 100)) * 100
          ) / 100;
          return { ...item, cantidad: nuevaCantidad, subtotal };
        })
        .filter((item) => item.cantidad > 0)
    );
  };

  const handleSetCantidadManual = (id: string, cantidad: number) => {
    if (cantidad <= 0) return;
    setCarrito((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const subtotal = Math.round(
          (cantidad * item.precioUnitario * (1 - item.descuentoPorcentaje / 100)) * 100
        ) / 100;
        return { ...item, cantidad, subtotal };
      })
    );
  };

  // Eliminar línea
  const handleEliminarItem = (id: string) => {
    setCarrito((prev) => prev.filter((item) => item.id !== id));
  };

  // Solicitar modificación de precio unitario
  const handleSolicitarEditarPrecio = (item: ItemCarrito) => {
    const rol = (currentUser?.role || '').toLowerCase();
    if (['admin', 'supervisor'].includes(rol)) {
      aplicarNuevoPrecioPrompt(item);
    } else {
      setItemParaEditarPrecio(item);
      setShowAutorizacionModal(true);
    }
  };

  const aplicarNuevoPrecioPrompt = (item: ItemCarrito) => {
    const nuevoPrecioStr = window.prompt(
      `Modificar precio unitario para ${item.sku}\nPrecio actual: $${item.precioUnitario}`,
      String(item.precioUnitario)
    );
    if (nuevoPrecioStr === null) return;
    const nuevoPrecio = parseFloat(nuevoPrecioStr);
    if (isNaN(nuevoPrecio) || nuevoPrecio < 0) {
      showToast('Precio inválido', 'error');
      return;
    }

    const motivo = window.prompt(
      'Ingrese el motivo de la modificación de precio:',
      'Ajuste comercial autorizado'
    );

    setCarrito((prev) =>
      prev.map((it) => {
        if (it.id !== item.id) return it;
        const subtotal = Math.round(
          (it.cantidad * nuevoPrecio * (1 - it.descuentoPorcentaje / 100)) * 100
        ) / 100;
        return {
          ...it,
          precioUnitario: nuevoPrecio,
          precioModificado: true,
          motivoModificacion: motivo || 'Ajuste manual de precio',
          subtotal,
        };
      })
    );
    showToast(`Precio modificado para ${item.sku}`, 'success');
  };

  // Cambio de lista de precios con advertencia si hay ítems cargados
  const handleSolicitarCambioLista = (nuevaListaId: string) => {
    if (nuevaListaId === listaSeleccionadaId) return;

    if (carrito.length > 0) {
      setListaCambioPendiente(nuevaListaId);
    } else {
      setListaSeleccionadaId(nuevaListaId);
    }
  };

  const confirmarCambioLista = async () => {
    if (!listaCambioPendiente) return;
    const nuevaId = listaCambioPendiente;
    setListaCambioPendiente(null);
    setListaSeleccionadaId(nuevaId);

    try {
      const res = await fetch('/api/ventas/pdv/calcular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: carrito,
          listaPrecioId: nuevaId,
          descuentoPorcentaje: descuentoGlobal,
        }),
      });

      if (res.ok) {
        const calculo = await res.json();
        if (calculo.items) {
          setCarrito(calculo.items);
          showToast('Precios recalculados según la nueva lista', 'success');
        }
      }
    } catch (e) {
      console.error(e);
      showToast('Error al recalcular precios', 'error');
    }
  };

  // Totales calculados en el cliente
  const subtotalLineas = useMemo(
    () => Math.round(carrito.reduce((acc, it) => acc + (it.subtotal || 0), 0) * 100) / 100,
    [carrito]
  );

  const descuentoGlobalMonto = useMemo(
    () => Math.round(((subtotalLineas * descuentoGlobal) / 100) * 100) / 100,
    [subtotalLineas, descuentoGlobal]
  );

  const totalFinal = useMemo(
    () => Math.max(0, Math.round((subtotalLineas - descuentoGlobalMonto) * 100) / 100),
    [subtotalLineas, descuentoGlobalMonto]
  );

  const impuestosEstimados = useMemo(() => {
    return (
      Math.round(
        carrito.reduce((acc, it) => {
          const neto = it.subtotal || 0;
          const iva = it.ivaPorcentaje > 0 ? (neto * it.ivaPorcentaje) / 100 : 0;
          return acc + iva;
        }, 0) * 100
      ) / 100
    );
  }, [carrito]);

  // Limpiar venta
  const handleLimpiarVenta = () => {
    setCarrito([]);
    setDescuentoGlobal(0);
    setSearchQuery('');
    setResultadosBusqueda([]);
    setCliente({
      id: null,
      nombre: 'Consumidor Final',
      identificacion: null,
    });
    setShowConfirmLimpiar(false);
    showToast('Venta reiniciada', 'info');
    searchInputRef.current?.focus();
  };

  // Confirmar venta desde CobroModal
  const handleConfirmarVentaBackend = async (datosCobro: any) => {
    const payload = {
      clienteId: cliente.id,
      clienteNombre: cliente.nombre,
      clienteIdentificacion: cliente.identificacion,
      listaPrecioId: listaSeleccionadaId || null,
      vendedorId: currentUser?.id || undefined,
      vendedorNombre: currentUser?.nombreCompleto || undefined,
      descuentoPorcentaje: descuentoGlobal,
      items: carrito.map((it) => ({
        productoId: it.productoId,
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
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Error al confirmar la venta');
    }

    showToast(`Venta ${data.venta.numero} registrada con éxito`, 'success');

    // Mostrar comprobante para imprimir
    setComprobanteVenta(data.venta);

    // Reiniciar carrito para la siguiente venta
    setCarrito([]);
    setDescuentoGlobal(0);
    setSearchQuery('');
    setCliente({
      id: null,
      nombre: 'Consumidor Final',
      identificacion: null,
    });

    return data.venta;
  };

  const formatARS = (val: number) =>
    new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(val || 0);

  return (
    <div
      className={`transition-all duration-200 ${
        isFullscreen
          ? 'fixed inset-0 z-50 bg-background overflow-y-auto p-2 sm:p-3 flex flex-col min-h-screen'
          : 'space-y-3 pb-8'
      }`}
    >
      {/* Pestañas de Navegación de Ventas (ocultas en pantalla completa para máximo espacio) */}
      {!isFullscreen && <VentasNavTabs currentTab="pdv" />}

      {/* Barra Superior de Estado y Controles del PDV */}
      <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 sm:p-3 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
        {/* Izquierda: Cliente & Lista de Precios */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Selector de Cliente */}
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-xl px-2.5 py-1.5">
            <User className="w-4 h-4 text-indigo-500 shrink-0" />
            <div className="text-xs">
              <span className="text-[9px] uppercase font-bold text-slate-400 block leading-tight">
                Cliente
              </span>
              <strong className="text-slate-900 dark:text-slate-100 font-bold truncate max-w-[130px] sm:max-w-[180px] inline-block">
                {cliente.nombre}
              </strong>
            </div>
            <button
              type="button"
              onClick={() => setShowClienteModal(true)}
              className="ml-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline px-1 py-0.5"
            >
              Cambiar
            </button>
          </div>

          {/* Selector de Lista de Precios */}
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-xl px-2.5 py-1.5">
            <Tag className="w-4 h-4 text-emerald-500 shrink-0" />
            <div className="text-xs">
              <span className="text-[9px] uppercase font-bold text-slate-400 block leading-tight">
                Lista de Precios
              </span>
              <select
                value={listaSeleccionadaId}
                onChange={(e) => handleSolicitarCambioLista(e.target.value)}
                className="bg-transparent font-bold text-slate-900 dark:text-slate-100 focus:outline-hidden cursor-pointer text-xs"
              >
                {listasPrecios.map((l) => (
                  <option key={l.id} value={l.id} className="dark:bg-slate-900">
                    {l.nombre} {l.tipoAjuste !== 'MANUAL' ? `(${l.tipoAjuste})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Derecha: Operador / Cambio Rápido Vendedor / Pantalla Completa / Acciones */}
        <div className="flex items-center gap-2">
          {/* Vendedor Activo & Botón de Cambio Rápido */}
          <div className="flex items-center gap-1.5 bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-xl px-2.5 py-1">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <div className="text-xs">
              <span className="text-[9px] uppercase font-bold text-slate-400 block leading-tight">
                Vendedor en Caja
              </span>
              <strong className="text-slate-800 dark:text-slate-200 font-bold max-w-[120px] sm:max-w-[150px] truncate inline-block">
                {currentUser?.nombreCompleto || 'Cajero'}
              </strong>
            </div>
            <button
              type="button"
              onClick={() => setShowCambioVendedorModal(true)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] ml-1 transition-colors"
              title="Cambiar operador vendedor (F9)"
            >
              <UserCheck className="w-3 h-3" />
              <span>Cambiar (F9)</span>
            </button>
          </div>

          {/* Botón de Pantalla Completa */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className={`p-2 rounded-xl border transition-all ${
              isFullscreen
                ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                : 'bg-card border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
            title={isFullscreen ? 'Salir de Pantalla Completa (F11)' : 'Pantalla Completa (F11)'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Historial */}
          <button
            type="button"
            onClick={() => setShowHistorialModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-card hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 shadow-xs transition-colors"
            title="Ver ventas históricas (F8)"
          >
            <History className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span className="hidden sm:inline">Historial (F8)</span>
          </button>

          {carrito.length > 0 && (
            <button
              type="button"
              onClick={() => setShowConfirmLimpiar(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-card hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 shadow-xs transition-colors"
              title="Limpiar carrito actual (Esc)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Limpiar</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid Principal del PDV (Layout de Mostrador: Izquierda Búsqueda, Derecha Detalle) */}
      <div className={`grid grid-cols-1 lg:grid-cols-12 gap-3 items-start ${isFullscreen ? 'flex-1' : ''}`}>
        {/* PANEL IZQUIERDO: Búsqueda rápida y resultados de catálogo (5 cols en lg) */}
        <div className="lg:col-span-5 bg-card border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs flex flex-col space-y-3 min-h-[500px]">
          {/* Input de Búsqueda con foco inicial */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Barcode className="w-4 h-4 text-indigo-500" />
                Buscar Producto o Escanear Código
              </label>
              <span className="text-[10px] text-slate-400 font-mono">Atajo [F2]</span>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                autoFocus
                placeholder="Escribir SKU (ignora ceros: ej. 3 ó 0003), código o descripción..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 bg-slate-100/70 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 placeholder:font-normal focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
              />
              {isSearching && (
                <Loader2 className="w-4 h-4 animate-spin text-indigo-500 absolute right-3 top-1/2 -translate-y-1/2" />
              )}
            </div>
            <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400 px-1">
              <span>Enter: agregar exacto / seleccionado</span>
              <span>↑↓: navegar lista</span>
            </div>
          </div>

          {/* Lista de Resultados de Búsqueda */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[540px]">
            {isSearching && resultadosBusqueda.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                <span className="text-xs">Buscando en catálogo...</span>
              </div>
            ) : resultadosBusqueda.length > 0 ? (
              resultadosBusqueda.map((prod, idx) => {
                const isSelected = selectedIndex === idx;
                const isExact = prod.esCoincidenciaExacta;

                return (
                  <div
                    key={prod.id}
                    onClick={() => {
                      agregarProductoAlCarrito(prod);
                      setSearchQuery('');
                      setResultadosBusqueda([]);
                    }}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isExact
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-600 shadow-sm ring-2 ring-emerald-400/40'
                        : isSelected
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-700 shadow-xs ring-1 ring-indigo-400/30'
                        : 'bg-slate-50/50 dark:bg-slate-900/30 border-slate-200/80 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800 hover:bg-slate-100/60 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-xs font-black text-slate-900 dark:text-slate-100">
                          {prod.sku}
                        </span>

                        {isExact && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-600 text-white font-black uppercase tracking-wider flex items-center gap-1 shadow-xs">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            Coincidencia Exacta [Enter]
                          </span>
                        )}

                        {prod.marca && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold truncate max-w-[100px]">
                            {prod.marca}
                          </span>
                        )}

                        {prod.esFallbackPrecio && (
                          <span
                            className="text-[9px] px-1 py-0.2 rounded bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-bold"
                            title="Precio base aplicado (regla no definida o fallback)"
                          >
                            Base
                          </span>
                        )}
                      </div>

                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {prod.descripcion}
                      </div>

                      <div className="flex items-center gap-3 text-[10px] text-slate-400">
                        {prod.codigoBarras && (
                          <span className="flex items-center gap-1">
                            <Barcode className="w-3 h-3 text-slate-400" />
                            {prod.codigoBarras}
                          </span>
                        )}
                        <span>Stock: {prod.stockActual} {prod.unidad}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-black text-slate-900 dark:text-slate-100">
                        {formatARS(prod.precioAplicado > 0 ? prod.precioAplicado : prod.precioBase)}
                      </div>
                      <button
                        type="button"
                        className={`mt-1 px-2.5 py-1 rounded-lg font-bold text-[11px] shadow-xs flex items-center gap-1 text-white ${
                          isExact
                            ? 'bg-emerald-600 hover:bg-emerald-700'
                            : 'bg-indigo-600 hover:bg-indigo-700'
                        }`}
                      >
                        <Plus className="w-3 h-3" />
                        {isExact ? 'Agregar (Enter)' : 'Agregar'}
                      </button>
                    </div>
                  </div>
                );
              })
            ) : searchQuery ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No se encontraron productos para <strong>"{searchQuery}"</strong> en {listaActual?.nombre || 'catálogo'}.
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 text-xs space-y-2">
                <Package className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
                <p>Escriba el número de SKU (ej: 3, 25, 561), código de barras o descripción para comenzar la venta.</p>
              </div>
            )}
          </div>
        </div>

        {/* PANEL DERECHO: Detalle de Venta / Carrito y Cobro (7 cols en lg) */}
        <div className="lg:col-span-7 bg-card border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs flex flex-col justify-between min-h-[500px]">
          {/* Header del carrito */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-2">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 tracking-tight">
                Detalle de Venta
              </h2>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                {carrito.length} {carrito.length === 1 ? 'ítem' : 'ítems'}
              </span>
            </div>

            <span className="text-xs font-mono font-bold text-slate-400">
              F4: Cobrar venta
            </span>
          </div>

          {/* Grilla editable de productos cargados */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[390px]">
            {carrito.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-900/60 flex items-center justify-center mx-auto text-slate-400">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <p className="font-bold text-slate-600 dark:text-slate-400">El carrito de venta está vacío</p>
                <p className="text-[11px]">Utilice el panel izquierdo para buscar y agregar artículos.</p>
              </div>
            ) : (
              carrito.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-900/30 hover:border-slate-300 dark:hover:border-slate-700 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  {/* Info producto */}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-black text-slate-900 dark:text-slate-100">
                        {item.sku}
                      </span>
                      {item.precioModificado && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-bold">
                          Precio Modificado
                        </span>
                      )}
                    </div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {item.descripcion}
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-3">
                      <span>P. Unit: {formatARS(item.precioUnitario)}</span>
                      {item.descuentoPorcentaje > 0 && (
                        <span className="text-emerald-600 font-bold">
                          Desc: {item.descuentoPorcentaje}%
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleSolicitarEditarPrecio(item)}
                        className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5"
                      >
                        <Edit2 className="w-2.5 h-2.5" />
                        Modificar precio
                      </button>
                    </div>
                  </div>

                  {/* Controles de Cantidad & Subtotal */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                    {/* Controles +/- */}
                    <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg bg-card overflow-hidden">
                      <button
                        type="button"
                        onClick={() => handleCambiarCantidad(item.id, -1)}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
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
                        className="w-12 text-center text-xs font-black text-slate-900 dark:text-slate-100 bg-transparent focus:outline-hidden py-1"
                      />
                      <button
                        type="button"
                        onClick={() => handleCambiarCantidad(item.id, 1)}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                        title="Sumar 1"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Subtotal */}
                    <div className="text-right min-w-[90px]">
                      <div className="text-sm font-black text-slate-900 dark:text-slate-100">
                        {formatARS(item.subtotal)}
                      </div>
                    </div>

                    {/* Eliminar fila */}
                    <button
                      type="button"
                      onClick={() => handleEliminarItem(item.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                      title="Quitar producto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Cuadro Inferior de Totales y Botón Cobrar */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3 mt-2">
            {/* Resumen numérico */}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal ({carrito.length} artículos):</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
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
                    className="w-12 px-1 py-0.5 text-center text-xs font-bold border border-slate-200 dark:border-slate-700 rounded bg-card ml-1"
                  />
                </span>
                {descuentoGlobalMonto > 0 && (
                  <span className="font-bold text-emerald-600">
                    -{formatARS(descuentoGlobalMonto)}
                  </span>
                )}
              </div>

              {impuestosEstimados > 0 && (
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>IVA estimado incluido:</span>
                  <span>{formatARS(impuestosEstimados)}</span>
                </div>
              )}
            </div>

            {/* Total Final Destacado y Botón Cobrar */}
            <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900 text-white dark:bg-slate-950 dark:border dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                  Total Final a Cobrar
                </span>
                <span className="text-3xl font-black text-emerald-400 tracking-tight">
                  {formatARS(totalFinal)}
                </span>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Cliente: <strong className="text-white">{cliente.nombre}</strong>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={carrito.length === 0}
                  onClick={() => setShowCobroModal(true)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-sm shadow-lg shadow-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <CreditCard className="w-5 h-5" />
                  <span>Cobrar / Confirmar (F4)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
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
        onSeleccionar={(cli) => {
          setCliente(cli);
          if (cli.listaPrecioId && cli.listaPrecioId !== listaSeleccionadaId) {
            handleSolicitarCambioLista(cli.listaPrecioId);
          }
          showToast(`Cliente seleccionado: ${cli.nombre}`, 'info');
        }}
      />

      {/* Modal de Cobro y Pagos */}
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
        onConfirmarVenta={handleConfirmarVentaBackend}
      />

      {/* Modal de Comprobante / Impresión */}
      <ComprobanteModal
        isOpen={!!comprobanteVenta}
        onClose={() => setComprobanteVenta(null)}
        venta={comprobanteVenta}
      />

      {/* Modal de Historial de Ventas */}
      <HistorialVentasModal
        isOpen={showHistorialModal}
        onClose={() => setShowHistorialModal(false)}
        currentUserRole={currentUser?.role}
        currentUserId={currentUser?.id}
        onVerComprobante={(v) => {
          setComprobanteVenta(v);
        }}
      />

      {/* Modal de Autorización por PIN para Modificación de Precios */}
      <AutorizacionPrecioModal
        isOpen={showAutorizacionModal}
        onClose={() => {
          setShowAutorizacionModal(false);
          setItemParaEditarPrecio(null);
        }}
        onAutorizado={(supervisor) => {
          if (itemParaEditarPrecio) {
            aplicarNuevoPrecioPrompt(itemParaEditarPrecio);
          }
        }}
        mensaje="La modificación manual de precios unitarios requiere autorización de un Supervisor o Administrador."
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
    </div>
  );
}
