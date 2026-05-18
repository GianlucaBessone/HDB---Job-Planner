"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
    const { theme, setTheme, systemTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    // Placeholder while mounting to avoid hydration mismatch
    if (!mounted) {
        return (
            <div className="w-12 h-6 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse shrink-0 !min-h-0" />
        );
    }

    const currentTheme = theme === 'system' ? systemTheme : theme;
    const isDark = currentTheme === 'dark';

    const handleToggle = () => {
        setTheme(isDark ? 'light' : 'dark');
    };

    return (
        <button
            type="button"
            onClick={handleToggle}
            className={`
                relative flex items-center shrink-0 w-12 h-6 rounded-full transition-colors duration-300
                focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500
                ${isDark ? 'bg-slate-700' : 'bg-slate-200'}
                btn-icon-inline !min-h-0
            `}
            aria-label="Alternar modo oscuro"
            title="Alternar Tema"
        >
            <span className="sr-only">Toggle theme</span>
            
            {/* Background Icons */}
            <span className="absolute inset-y-0 left-0 flex items-center justify-center w-6 text-slate-400">
                <Sun className="w-3 h-3" />
            </span>
            <span className="absolute inset-y-0 right-0 flex items-center justify-center w-6 text-slate-400/70">
                <Moon className="w-3 h-3" />
            </span>

            {/* Moving Thumb */}
            <span
                className={`
                    absolute left-0.5 flex items-center justify-center w-5 h-5 rounded-full bg-white dark:bg-slate-900 shadow-sm transition-transform duration-300 ease-in-out z-10
                    ${isDark ? 'translate-x-6' : 'translate-x-0'}
                `}
            >
                {isDark ? (
                    <Moon className="w-3 h-3 text-slate-300" />
                ) : (
                    <Sun className="w-3 h-3 text-slate-600" />
                )}
            </span>
        </button>
    );
}
