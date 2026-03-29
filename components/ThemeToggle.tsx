"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
    const { theme, setTheme, systemTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return <div className="w-[56px] h-[30px] rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse shrink-0 border border-slate-300 dark:border-slate-600" />;
    }

    const currentTheme = theme === 'system' ? systemTheme : theme;
    const isDark = currentTheme === 'dark';

    return (
        <button
            type="button"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className={`
                relative flex items-center h-[30px] w-[56px] rounded-full p-1 cursor-pointer transition-colors duration-500 shrink-0 border shadow-inner outline-none
                ${isDark ? 'bg-indigo-500 border-indigo-600' : 'bg-slate-200 border-slate-300'}
            `}
            aria-label="Alternar modo oscuro"
            title="Alternar Tema"
        >
            <span
                className={`
                    absolute flex items-center justify-center w-[22px] h-[22px] rounded-full bg-white shadow-sm transform transition-transform duration-500 cubic-bezier(0.34,1.56,0.64,1)
                    ${isDark ? 'translate-x-[24px]' : 'translate-x-0'}
                `}
            >
                <Sun 
                    className={`absolute w-3.5 h-3.5 text-amber-500 transition-all duration-500 
                    ${isDark ? 'opacity-0 scale-50 rotate-90' : 'opacity-100 scale-100 rotate-0'}
                `} />
                <Moon 
                    className={`absolute w-3 h-3 text-indigo-500 transition-all duration-500 
                    ${isDark ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 -rotate-90'}
                `} />
            </span>
        </button>
    );
}
