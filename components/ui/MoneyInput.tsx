'use client';

import React, { InputHTMLAttributes, forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * Entrada de importes en formato ARS (es-AR): punto para miles y coma para decimales.
 *
 * - Mientras se escribe agrega los separadores de miles: "158751,35" → "158.751,35".
 * - La tecla "." (o el punto del teclado numérico) se toma como coma decimal.
 * - Al salir del campo completa los centavos: "1.500" → "1.500,00".
 * - Hacia afuera expone el valor numérico en texto con punto decimal ("158751.35"),
 *   o "" si el campo está vacío, igual que un <input type="number">.
 */

export interface MoneyInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'defaultValue'> {
  value: number | string | null | undefined;
  onValueChange: (value: string) => void;
  /** Cantidad de decimales admitidos (por defecto 2). */
  decimals?: number;
}

const formatInteger = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Normaliza lo tecleado a texto ARS con miles agrupados. */
function normalizeTyped(raw: string, decimals: number): string {
  let text = raw.replace(/[^\d,]/g, '');
  const commaIdx = text.indexOf(',');
  let intPart = commaIdx === -1 ? text : text.slice(0, commaIdx);
  let decPart = commaIdx === -1 ? null : text.slice(commaIdx + 1).replace(/,/g, '');

  intPart = intPart.replace(/^0+(?=\d)/, '');
  if (decPart !== null) {
    if (decimals <= 0) decPart = null;
    else decPart = decPart.slice(0, decimals);
  }
  if (decPart !== null && intPart === '') intPart = '0';

  text = formatInteger(intPart);
  if (decPart !== null) text += `,${decPart}`;
  return text;
}

/** Texto ARS → número en texto con punto decimal ("" si está vacío). */
function toPlain(text: string): string {
  if (!text) return '';
  const [intPart, decPart] = text.replace(/\./g, '').split(',');
  if (!intPart && !decPart) return '';
  const plain = `${intPart || '0'}${decPart ? `.${decPart}` : ''}`;
  return String(Number(plain));
}

/** Valor numérico externo → texto ARS completo con decimales. */
function fromValue(value: number | string | null | undefined, decimals: number): string {
  if (value === null || value === undefined || value === '') return '';
  const num = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  if (!isFinite(num)) return '';
  return num.toLocaleString('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: true,
  });
}

const sameNumber = (a: string, b: number | string | null | undefined) => {
  if (b === null || b === undefined || b === '') return a === '';
  if (a === '') return false;
  return Math.abs(Number(a) - Number(b)) < 1e-9;
};

export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onValueChange, decimals = 2, className, onBlur, onFocus, onKeyDown, placeholder, ...props }, ref) => {
    const inputRef = useRef<HTMLInputElement>(null);
    useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    const [text, setText] = useState(() => fromValue(value, decimals));
    const focusedRef = useRef(false);

    // Sincroniza cambios externos (p. ej., "Sugerir precio") sin pisar lo que se está tecleando
    useEffect(() => {
      if (!sameNumber(toPlain(text), value)) {
        setText(focusedRef.current ? fromValue(value, decimals).replace(/,0+$/, '') : fromValue(value, decimals));
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, decimals]);

    const applyText = (el: HTMLInputElement, raw: string, caret: number) => {
      // Cantidad de caracteres significativos (dígitos y coma) antes del cursor
      const significantBefore = raw.slice(0, caret).replace(/[^\d,]/g, '').length;
      const next = normalizeTyped(raw, decimals);
      setText(next);
      const plain = toPlain(next);
      if (!sameNumber(plain, value)) onValueChange(plain);

      requestAnimationFrame(() => {
        if (document.activeElement !== el) return;
        let count = 0;
        let pos = 0;
        while (pos < next.length && count < significantBefore) {
          if (/[\d,]/.test(next[pos])) count++;
          pos++;
        }
        el.setSelectionRange(pos, pos);
      });
    };

    return (
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={text}
        placeholder={placeholder ?? (decimals > 0 ? `0,${'0'.repeat(decimals)}` : '0')}
        className={cn('tabular-nums', className)}
        onFocus={(e) => {
          focusedRef.current = true;
          onFocus?.(e);
        }}
        onBlur={(e) => {
          focusedRef.current = false;
          setText(fromValue(toPlain(text), decimals));
          onBlur?.(e);
        }}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.defaultPrevented) return;
          // "." y "," se interpretan siempre como separador decimal
          if ((e.key === '.' || e.key === ',' || e.key === 'Decimal') && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            if (decimals <= 0) return;
            const el = e.currentTarget;
            const start = el.selectionStart ?? text.length;
            const end = el.selectionEnd ?? start;
            const before = text.slice(0, start).replace(/,/g, '');
            const after = text.slice(end).replace(/,/g, '');
            const raw = `${before},${after}`;
            applyText(el, raw, before.length + 1);
          }
        }}
        onChange={(e) => {
          const el = e.currentTarget;
          applyText(el, el.value, el.selectionStart ?? el.value.length);
        }}
        onPaste={(e) => {
          // Al pegar, se acepta cualquier formato ("8,096.20", "8.096,20", "8096.2")
          const pasted = e.clipboardData.getData('text');
          if (!pasted) return;
          e.preventDefault();
          const lastDot = pasted.lastIndexOf('.');
          const lastComma = pasted.lastIndexOf(',');
          let normalized = pasted.replace(/[^\d.,]/g, '');
          if (lastDot > lastComma) {
            const dots = (normalized.match(/\./g) || []).length;
            normalized =
              dots === 1 && lastComma === -1 && normalized.length - normalized.lastIndexOf('.') - 1 === 3
                ? normalized.replace(/\./g, '') // "1.500" → miles
                : normalized.replace(/,/g, '').replace(/\.(?=[^.]*$)/, ',').replace(/\./g, '');
          } else {
            normalized = normalized.replace(/\./g, '');
          }
          const el = e.currentTarget;
          const start = el.selectionStart ?? text.length;
          const end = el.selectionEnd ?? start;
          const raw = `${text.slice(0, start)}${normalized}${text.slice(end)}`;
          applyText(el, raw, start + normalized.length);
        }}
        {...props}
      />
    );
  }
);
MoneyInput.displayName = 'MoneyInput';

export default MoneyInput;
