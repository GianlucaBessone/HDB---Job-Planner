"use client";

import { useEffect, useState } from 'react';
import { subscribeToSync, processSyncQueue } from '@/lib/offline';
import { Wifi, WifiOff, RefreshCcw } from 'lucide-react';
import { showToast } from '@/components/Toast';

export default function SyncIndicator() {
  const [status, setStatus] = useState<'online' | 'syncing' | 'offline'>('online');
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    // 1. Subscribe to sync state changes
    const unsubscribe = subscribeToSync((newStatus, count) => {
      setStatus(newStatus);
      setPendingCount(count);
    });

    // 2. Listen for custom offline events
    const handleSave = (e: any) => {
      if (e.detail?.message) {
        showToast(e.detail.message, 'info');
      }
    };

    const handleSync = (e: any) => {
      if (e.detail?.message) {
        showToast(e.detail.message, 'success');
      }
    };

    window.addEventListener('offline-save', handleSave);
    window.addEventListener('offline-sync', handleSync);

    // 3. Trigger initial sync check
    processSyncQueue();

    return () => {
      unsubscribe();
      window.removeEventListener('offline-save', handleSave);
      window.removeEventListener('offline-sync', handleSync);
    };
  }, []);

  // Don't show anything if we are online and there is nothing pending
  if (status === 'online' && pendingCount === 0) return null;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-xl border transition-all duration-500 shadow-sm ${
      status === 'syncing' ? 'bg-indigo-50 text-indigo-700 border-indigo-200 animate-pulse' :
      status === 'offline' ? 'bg-amber-50 text-amber-700 border-amber-200' :
      'bg-emerald-50 text-emerald-700 border-emerald-200'
    }`}>
      {status === 'syncing' && (
        <>
          <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
          <span>Sincronizando {pendingCount > 0 ? `(${pendingCount})` : ''}</span>
        </>
      )}
      {status === 'offline' && (
        <>
          <div className="relative">
            <WifiOff className="w-3.5 h-3.5" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full border border-white animate-pulse"></span>
          </div>
          <span>Modo Offline {pendingCount > 0 ? `(${pendingCount})` : ''}</span>
        </>
      )}
      {status === 'online' && pendingCount > 0 && (
          <>
            <Wifi className="w-3.5 h-3.5 text-emerald-500" />
            <span>Pendiente ({pendingCount})</span>
          </>
      )}
    </div>
  );
}
