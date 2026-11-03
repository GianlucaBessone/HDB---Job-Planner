'use client';

import React, { useEffect, useState } from 'react';
import { Save, Building2 } from 'lucide-react';
import { Dialog, Button, Input, Select } from '@/components/ui';
import { showToast } from '@/components/Toast';
import { CONDICIONES_IVA, formatCuit } from '@/lib/ventas/proveedorVentas';

export interface ProveedorVentas {
  id: string;
  codigo: string | null;
  razonSocial: string;
  nombreFantasia: string | null;
  cuit: string | null;
  condicionIva: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  localidad: string | null;
  provincia: string | null;
  activo: boolean;
  productosCount?: number;
}

type FormState = Record<
  'codigo' | 'razonSocial' | 'nombreFantasia' | 'cuit' | 'condicionIva' | 'telefono' | 'email' | 'direccion' | 'localidad' | 'provincia',
  string
>;

const EMPTY: FormState = {
  codigo: '',
  razonSocial: '',
  nombreFantasia: '',
  cuit: '',
  condicionIva: '',
  telefono: '',
  email: '',
  direccion: '',
  localidad: '',
  provincia: '',
};

interface Props {
  open: boolean;
  onClose: () => void;
  /** Proveedor a editar; si falta, el modal da de alta uno nuevo. */
  proveedor?: ProveedorVentas | null;
  /** Razón social sugerida al crear (p. ej., lo que se escribió en el buscador). */
  initialRazonSocial?: string;
  onSaved: (proveedor: ProveedorVentas) => void;
}

export default function ProveedorVentasFormModal({ open, onClose, proveedor, initialRazonSocial, onSaved }: Props) {
  const isEdit = !!proveedor;
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (proveedor) {
      setForm({
        codigo: proveedor.codigo || '',
        razonSocial: proveedor.razonSocial,
        nombreFantasia: proveedor.nombreFantasia || '',
        cuit: proveedor.cuit || '',
        condicionIva: proveedor.condicionIva || '',
        telefono: proveedor.telefono || '',
        email: proveedor.email || '',
        direccion: proveedor.direccion || '',
        localidad: proveedor.localidad || '',
        provincia: proveedor.provincia || '',
      });
    } else {
      setForm({ ...EMPTY, razonSocial: initialRazonSocial?.trim() || '' });
    }
  }, [open, proveedor, initialRazonSocial]);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = () => {
    const next: typeof errors = {};
    if (!form.razonSocial.trim()) next.razonSocial = 'La razón social es obligatoria';
    const cuitDigits = form.cuit.replace(/\D/g, '');
    if (form.cuit.trim() && cuitDigits.length !== 11) next.cuit = 'El CUIT debe tener 11 dígitos';
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'El email no es válido';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!validate()) return;

    setSaving(true);
    try {
      const res = await fetch(isEdit ? `/api/ventas/proveedores/${proveedor!.id}` : '/api/ventas/proveedores', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar el proveedor');

      showToast(isEdit ? 'Proveedor actualizado' : `Proveedor ${data.razonSocial} creado`, 'success');
      onSaved(data);
      onClose();
    } catch (err: any) {
      showToast(err.message || 'No se pudo guardar el proveedor', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Si el proveedor tiene una condición fuera de la lista sugerida, se conserva como opción.
  const condiciones: string[] = [...CONDICIONES_IVA];
  if (form.condicionIva && !condiciones.includes(form.condicionIva)) condiciones.push(form.condicionIva);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!saving}
      size="lg"
      icon={
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-200">
          <Building2 className="w-[18px] h-[18px]" />
        </div>
      }
      title={isEdit ? 'Editar proveedor' : 'Nuevo proveedor'}
      description={
        isEdit
          ? 'Los cambios se reflejan en todos los productos vinculados a este proveedor.'
          : 'Alta en el maestro de proveedores de ventas. Solo la razón social es obligatoria.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => handleSubmit()} isLoading={saving} icon={<Save />}>
            {isEdit ? 'Guardar cambios' : 'Crear proveedor'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <Input
              label="Razón social"
              required
              value={form.razonSocial}
              onChange={set('razonSocial')}
              error={errors.razonSocial}
              placeholder="Ej: Distribuidora Eléctrica Norte S.A."
              data-autofocus
              autoComplete="off"
            />
          </div>
          <Input
            label="Código"
            value={form.codigo}
            onChange={set('codigo')}
            placeholder="Ej: PV-004"
            hint="Opcional, único"
            className="font-mono uppercase"
            autoComplete="off"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            label="Nombre de fantasía"
            value={form.nombreFantasia}
            onChange={set('nombreFantasia')}
            placeholder="Ej: Eléctrica Norte"
            autoComplete="off"
          />
          <Input
            label="CUIT"
            value={form.cuit}
            onChange={set('cuit')}
            onBlur={() => form.cuit && setForm((prev) => ({ ...prev, cuit: formatCuit(prev.cuit) }))}
            error={errors.cuit}
            placeholder="30-12345678-9"
            inputMode="numeric"
            className="font-mono"
            autoComplete="off"
          />
          <Select label="Condición frente al IVA" value={form.condicionIva} onChange={set('condicionIva')}>
            <option value="">Sin especificar</option>
            {condiciones.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Teléfono" type="tel" value={form.telefono} onChange={set('telefono')} placeholder="Ej: 351 555-1234" />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={set('email')}
            error={errors.email}
            placeholder="ventas@proveedor.com"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input label="Dirección" value={form.direccion} onChange={set('direccion')} placeholder="Calle y número" />
          <Input label="Localidad" value={form.localidad} onChange={set('localidad')} />
          <Input label="Provincia" value={form.provincia} onChange={set('provincia')} />
        </div>

        {/* Enter en cualquier campo envía el formulario */}
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Dialog>
  );
}
