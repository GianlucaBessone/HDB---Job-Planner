'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to audit or console
    console.error('[GlobalError] Root error boundary caught error:', error);

    const isChunkError =
      error.name === 'ChunkLoadError' ||
      /loading\s+chunk/i.test(error.message) ||
      error.message.includes('ChunkLoadError');

    if (isChunkError) {
      console.warn('[GlobalError] ChunkLoadError detected. Clearing caches and forcing reload...');

      // Programmatic cleanup of Service Worker caches
      if ('serviceWorker' in navigator && typeof caches !== 'undefined') {
        caches.keys().then((cacheNames) => {
          Promise.all(cacheNames.map((name) => caches.delete(name)))
            .then(() => {
              console.log('[GlobalError] Cache storage cleared successfully.');
              window.location.reload();
            })
            .catch((err) => {
              console.error('[GlobalError] Error clearing cache, reloading anyway:', err);
              window.location.reload();
            });
        });
      } else {
        window.location.reload();
      }
    }
  }, [error]);

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background text-foreground p-6 text-center">
      <div className="max-w-md w-full p-8 bg-card text-card-foreground rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700">
        <h2 className="text-2xl font-black text-rose-600 dark:text-rose-400 mb-4 uppercase tracking-wide">
          Algo salió mal
        </h2>
        <p className="text-slate-600 dark:text-slate-300 text-sm mb-6 leading-relaxed">
          Ha ocurrido un error en la aplicación. Si el problema persiste, intenta recargar la página.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => reset()}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-md hover:shadow-indigo-200 dark:hover:shadow-none"
          >
            Reintentar Acción
          </button>
          <button
            onClick={() => {
              if ('serviceWorker' in navigator && typeof caches !== 'undefined') {
                caches.keys().then((names) => {
                  Promise.all(names.map((name) => caches.delete(name))).finally(() => {
                    window.location.reload();
                  });
                });
              } else {
                window.location.reload();
              }
            }}
            className="w-full py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 font-bold rounded-xl transition-all"
          >
            Limpiar Caché y Forzar Recarga
          </button>
        </div>
      </div>
    </div>
  );
}
