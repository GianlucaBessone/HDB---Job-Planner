'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight, Home, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { DEFAULT_VIEWS, DEFAULT_SECTIONS } from '@/lib/viewAccess';
import { useHistoryStore } from '@/lib/store/useHistoryStore';
import { useEffect, useState } from 'react';

export function Breadcrumbs() {
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const historyEntries = useHistoryStore((state) => state.entries);
    const popHistory = useHistoryStore((state) => state.pop);
    const titles = useHistoryStore((state) => state.titles);

    const [isMounted, setIsMounted] = useState(false);
    
    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!pathname || pathname === '/') return null;
    if (!isMounted) return null; // Prevent hydration mismatch

    // Split pathname into segments
    const parts = pathname.split('/').filter(Boolean);
    
    // Generate breadcrumb items
    const breadcrumbItems = parts.map((part, index) => {
        const url = '/' + parts.slice(0, index + 1).join('/');
        
        let label = '';
        
        // 1. Try to find it in history titles
        if (titles[url]) {
            label = titles[url];
        } 
        // 2. Try to find it in DEFAULT_VIEWS config
        else {
            const viewConfig = DEFAULT_VIEWS.find(v => v.key === url);
            if (viewConfig) {
                label = viewConfig.label;
            } else {
                // 3. Fallback: Format the URL segment nicely
                const decoded = decodeURIComponent(part);
                const readable = decoded.replace(/-/g, ' ');
                // Capitalize first letter of each word
                label = readable.replace(/\b\w/g, char => char.toUpperCase());
                
                // If it's a UUID/CUID, truncate it or say 'Detalle'
                if (label.length > 20 && /^[a-zA-Z0-9]+$/.test(part)) {
                    label = 'Detalle';
                }
            }
        }
        
        return { url, label };
    });

    // Append drawer if it exists
    const drawerType = searchParams.get('drawer');
    const drawerId = searchParams.get('id');
    
    if (drawerType && drawerId) {
        // Look up title if provided by the Drawer store or fallback to drawerId
        const drawerUrl = `${pathname}?drawer=${drawerType}&id=${drawerId}`;
        let drawerLabel = titles[drawerUrl] || drawerId;
        
        if (drawerLabel.length > 20 && /^[a-zA-Z0-9]+$/.test(drawerId)) {
            drawerLabel = 'Detalle';
        }

        breadcrumbItems.push({
            url: drawerUrl,
            label: drawerLabel
        });
    }

    const handleBack = () => {
        // Find previous in history stack, excluding current
        if (historyEntries.length > 1) {
            const previous = popHistory();
            if (previous) {
                router.push(previous.url);
                return;
            }
        }
        router.back();
    };

    return (
        <div className="flex items-center gap-1 min-w-0 h-9">
            <button
                onClick={handleBack}
                className="btn btn-ghost btn-icon btn-sm btn-icon-inline shrink-0"
                title="Volver (Alt + Flecha Izquierda)"
                aria-label="Volver"
            >
                <ArrowLeft />
            </button>

            <nav aria-label="Ruta de navegación" className="min-w-0">
                <ol className="flex items-center text-[13px] text-slate-500 dark:text-slate-400 whitespace-nowrap min-w-0">
                    <li className="hidden md:flex items-center shrink-0">
                        <Link href="/" className="p-1 rounded hover:text-slate-900 dark:hover:text-slate-100 transition-colors" aria-label="Inicio">
                            <Home className="w-3.5 h-3.5" />
                        </Link>
                    </li>
                    {breadcrumbItems.map((item, index) => {
                        const isLast = index === breadcrumbItems.length - 1;
                        return (
                            <li key={item.url} className={`items-center min-w-0 ${isLast ? 'flex' : 'hidden md:flex shrink-0'}`}>
                                <ChevronRight className="hidden md:block w-3.5 h-3.5 mx-0.5 text-slate-300 dark:text-slate-600 shrink-0" aria-hidden="true" />
                                {isLast ? (
                                    <span aria-current="page" className="font-medium text-slate-900 dark:text-slate-100 truncate">{item.label}</span>
                                ) : (
                                    <Link href={item.url} className="px-1 rounded hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
                                        {item.label}
                                    </Link>
                                )}
                            </li>
                        );
                    })}
                </ol>
            </nav>
        </div>
    );
}
