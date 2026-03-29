"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    // After mounting, we have access to the theme
    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        // Prevents hydration mismatch while keeping space reserved
        return <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse" />;
    }

    return (
        <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="relative flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 group"
            aria-label="Toggle theme"
        >
            <Sun className="h-[1.2rem] w-[1.2rem] transition-all scale-100 rotate-0 dark:-rotate-90 dark:scale-0 group-hover:text-amber-500" />
            <Moon className="absolute h-[1.2rem] w-[1.2rem] transition-all scale-0 rotate-90 dark:rotate-0 dark:scale-100 group-hover:text-blue-400" />
            <span className="sr-only">Toggle theme</span>
        </button>
    );
}
