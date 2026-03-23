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
    project: 'bg-indigo-600/10 text-indigo-700 border-indigo-200/50 hover:bg-indigo-600/20 shadow-sm',
    os: 'bg-emerald-600/10 text-emerald-700 border-emerald-200/50 hover:bg-emerald-600/20 shadow-sm',
};

const SIZE_STYLES = {
    sm: 'text-[9px] px-1.5 py-0.5 gap-1 tracking-wider',
    md: 'text-[11px] px-2.5 py-1 gap-1.5 tracking-widest',
    lg: 'text-xs px-3 py-1.5 gap-2 tracking-[0.1em]',
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
            className={`inline-flex items-center font-mono font-bold border rounded-lg transition-colors ${VARIANT_STYLES[variant]} ${SIZE_STYLES[size]} ${className}`}
        >
            {code}
            {showCopy && (
                <button
                    onClick={handleCopy}
                    title={copied ? '¡Copiado!' : 'Copiar código'}
                    className="opacity-50 hover:opacity-100 transition-opacity shrink-0"
                >
                    {copied
                        ? <Check className="w-3 h-3" />
                        : <Copy className="w-3 h-3" />
                    }
                </button>
            )}
        </span>
    );
}
