'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Legacy redirect: /carros -> /herramientas?tab=retiros
 */
export default function CarrosRedirect() {
    const router = useRouter();
    useEffect(() => { router.replace('/herramientas?tab=retiros'); }, [router]);
    return (
        <div className="min-h-[60vh] flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
    );
}
