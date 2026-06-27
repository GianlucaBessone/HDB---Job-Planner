'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DiccionarioCliente from './DiccionarioCliente';

export default function DiccionarioDatosPage() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<any>(null);

    useEffect(() => {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            const user = JSON.parse(stored);
            const role = user.role?.toLowerCase() || '';
            if (['admin', 'qa', 'supervisor'].includes(role)) {
                setCurrentUser(user);
            } else {
                router.replace('/');
            }
        } else {
            router.replace('/');
        }
    }, [router]);

    if (!currentUser) return (
        <div className="min-h-[60vh] flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <DiccionarioCliente user={currentUser} />
            </div>
        </div>
    );
}
