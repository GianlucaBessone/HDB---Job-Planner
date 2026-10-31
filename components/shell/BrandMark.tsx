import { cn } from '@/lib/cn';

/**
 * Isotipo de HDB SGI: una "H" cuyo travesaño es una chispa, en referencia a
 * los servicios eléctricos de la empresa. Ver docs/BRAND_GUIDELINES.md.
 */
export function BrandMark({ className }: { className?: string }) {
    return (
        <span
            aria-hidden="true"
            className={cn('inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground shrink-0', className ?? 'w-7 h-7')}
        >
            <svg viewBox="0 0 24 24" className="w-[62%] h-[62%]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 4v16" />
                <path d="M19 4v16" />
                <path d="M5 12h4l2-3 2 6 2-3h4" />
            </svg>
        </span>
    );
}

export function BrandWordmark({ className }: { className?: string }) {
    return (
        <span className={cn('inline-flex items-center gap-2', className)}>
            <BrandMark />
            <span className="text-[15px] font-semibold tracking-tight text-slate-900 dark:text-slate-50 leading-none">
                HDB <span className="font-normal text-slate-500 dark:text-slate-400">SGI</span>
            </span>
        </span>
    );
}
