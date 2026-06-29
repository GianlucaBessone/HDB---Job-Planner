'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Drawer } from '@/components/ui/Drawer';
import { Loader2 } from 'lucide-react';

// Lazy load drawer contents to keep the initial bundle small!
const OrdenServicioDrawerContent = dynamic(
    () => import('./OrdenServicioDrawerContent'),
    { loading: () => <DrawerLoading /> }
);

const OSCobroDrawerContent = dynamic(
    () => import('./OSCobroDrawerContent'),
    { loading: () => <DrawerLoading /> }
);

function DrawerLoading() {
    return (
        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
            <p>Cargando información...</p>
        </div>
    );
}

function GlobalDrawerInner() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    
    const drawerType = searchParams.get('drawer');
    const drawerId = searchParams.get('id');
    
    // We maintain local state for 'isOpen' to handle exit animations smoothly.
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (drawerType && drawerId) {
            setIsOpen(true);
        } else {
            setIsOpen(false);
        }
    }, [drawerType, drawerId]);

    const handleClose = () => {
        setIsOpen(false);
        
        // Remove drawer query params without refreshing the page
        const params = new URLSearchParams(searchParams.toString());
        params.delete('drawer');
        params.delete('id');
        
        const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
        router.push(newUrl, { scroll: false }); // keep scroll position!
    };

    if (!drawerType || !drawerId) {
        // If it's just closing, we still want to render the Drawer component briefly
        // so it can play its exit animation. The Drawer component itself handles null children
        // if we structure it right, but here we can just return null if it's completely closed.
        if (!isOpen) return null; 
    }

    // Determine title and content based on drawerType
    let content = null;
    let size: 'sm' | 'md' | 'lg' | 'xl' | 'full' = 'xl';

    switch (drawerType) {
        case 'os':
            content = <OrdenServicioDrawerContent id={drawerId!} onClose={handleClose} />;
            size = 'xl';
            break;
        case 'cobro':
            content = <OSCobroDrawerContent id={drawerId!} onClose={handleClose} />;
            size = 'xl';
            break;
        default:
            content = <div className="p-6">Tipo de registro no soportado.</div>;
    }

    return (
        <Drawer
            isOpen={isOpen}
            onClose={handleClose}
            size={size}
        >
            {content}
        </Drawer>
    );
}

export function GlobalDrawer() {
    return (
        <Suspense fallback={null}>
            <GlobalDrawerInner />
        </Suspense>
    );
}
