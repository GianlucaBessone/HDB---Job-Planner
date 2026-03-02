'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
    const router = useRouter();

    useEffect(() => {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            try {
                const user = JSON.parse(stored);
                if (user.role === 'operador') {
                    router.replace('/timesheets');
                } else {
                    router.replace('/dashboard');
                }
            } catch (e) {
                // Should be handled by layout auth check
            }
        }
    }, [router]);

    return (
        <div className="min-h-[60vh] flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        </div>
    );
}
