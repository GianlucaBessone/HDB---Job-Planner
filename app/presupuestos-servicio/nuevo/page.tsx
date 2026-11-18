'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Calculator, Save } from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';
import { EmptyState } from '@/components/ui';
import { useAcceso } from '@/lib/store/useAccessStore';
import { useHistoryStore } from '@/lib/store/useHistoryStore';
import PresupuestoEditor, { type PresupuestoEditorHandle } from '@/components/presupuestosServicio/PresupuestoEditor';

export default function NuevoPresupuestoPage() {
    const router = useRouter();
    const { puede, cargado } = useAcceso();
    const pathname = usePathname();
    const setTitle = useHistoryStore((s) => s.setTitle);
    useEffect(() => { if (pathname) setTitle(pathname, 'Nuevo'); }, [pathname, setTitle]);
    const editor = useRef<PresupuestoEditorHandle>(null);
    const [guardando, setGuardando] = useState(false);

    if (cargado && !puede('presupuestos.gestionar')) {
        return <div className="surface"><EmptyState title="No tenés permiso para crear presupuestos" description="Pedile a un administrador el acceso “Crear y editar presupuestos”." /></div>;
    }

    const guardar = async () => {
        setGuardando(true);
        const p = await editor.current?.guardar();
        setGuardando(false);
        if (p) router.replace(`/presupuestos-servicio/${p.id}`);
    };

    return (
        <div className="w-full space-y-5">
            <ModuleHeader
                title="Nuevo presupuesto de servicio"
                description="Se guarda como borrador. Lo enviás al cliente cuando esté listo."
                icon={<Calculator className="w-5 h-5" />}
                actions={[{ id: 'guardar', label: guardando ? 'Guardando…' : 'Guardar borrador', icon: <Save className="w-4 h-4" />, onClick: guardar, variant: 'primary', disabled: guardando }]}
            />
            <PresupuestoEditor ref={editor} />
        </div>
    );
}
