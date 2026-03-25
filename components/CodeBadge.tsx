'use client';
import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CodeBadgeProps {
    code: string;
    variant?: 'project' | 'os';
    size?: 'sm' | 'md' | 'lg';
    showCopy?: boolean;
    className?: string;
}

const VARIANT_STYLES = {
    project: 'bg-indigo-600/10 text-indigo-700 border-indigo-200/50 hover:bg-indigo-600/20 hover:border-indigo-300 shadow-sm',
    os: 'bg-emerald-600/10 text-emerald-700 border-emerald-200/50 hover:bg-emerald-600/20 hover:border-emerald-300 shadow-sm',
};

const SIZE_STYLES = {
    sm: 'text-[9px] min-h-[1.5rem] px-2 py-0.5 gap-1.5 tracking-wider',
    md: 'text-[11px] min-h-[1.75rem] px-3 py-1 gap-1.5 tracking-widest',
    lg: 'text-xs min-h-[2rem] px-4 py-1.5 gap-2 tracking-[0.1em]',
};

export default function CodeBadge({
    code,
    variant = 'project',
    size = 'md',
    showCopy = true,
    className = '',
}: CodeBadgeProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <span
            onClick={showCopy ? handleCopy : undefined}
            className={`
                inline-flex items-center justify-center font-mono font-bold border rounded-full transition-all 
                ${showCopy ? 'cursor-pointer active:scale-95' : ''}
                ${VARIANT_STYLES[variant]} 
                ${SIZE_STYLES[size]} 
                ${className}
            `}
            title={showCopy ? (copied ? '¡Copiado!' : 'Clic para copiar código') : undefined}
        >
            <span className="flex-1 text-center flex items-center justify-center">
                {code}
            </span>
            {showCopy && (
                <div className="shrink-0 flex items-center justify-center">
                    {copied
                        ? <Check className="w-3 h-3 text-emerald-500 animate-in zoom-in duration-300" />
                        : <Copy className="w-3 h-3 opacity-40 group-hover:opacity-100 transition-opacity" />
                    }
                </div>
            )}
        </span>
    );
}
