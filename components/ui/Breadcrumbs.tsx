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
        <div className="flex items-center gap-1.5 mb-2 h-7">
            <button 
                onClick={handleBack}
                className="px-2 py-1 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors mr-1.5 flex items-center gap-1 text-xs font-bold"
                title="Volver (Alt + Flecha Izquierda)"
            >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Volver</span>
            </button>

            <nav className="flex items-center text-xs font-medium text-slate-500 overflow-x-auto whitespace-nowrap hide-scrollbar">
                <Link href="/" className="hover:text-primary transition-colors flex items-center shrink-0">
                    <Home className="w-3.5 h-3.5" />
                </Link>
                
                {breadcrumbItems.map((item, index) => {
                    const isLast = index === breadcrumbItems.length - 1;
                    return (
                        <div key={item.url} className="flex items-center shrink-0">
                            <ChevronRight className="w-3 h-3 mx-1 text-slate-400" />
                            {isLast ? (
                                <span className="text-slate-800 dark:text-slate-200 font-bold">{item.label}</span>
                            ) : (
                                <Link 
                                    href={item.url} 
                                    className="hover:text-primary transition-colors"
                                >
                                    {item.label}
                                </Link>
                            )}
                        </div>
                    );
                })}
            </nav>
        </div>
    );
}
