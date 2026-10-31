import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

/**
 * Tailwind es la capa de tokens del sistema de diseño (docs/DESIGN_SYSTEM.md).
 * Los valores viven como variables CSS en app/globals.css: acá solo se
 * mapean a nombres de utilidades. No agregues colores, radios ni sombras
 * sueltos: extendé los tokens.
 */

const rgb = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;
const ramp = (prefix: string) =>
    Object.fromEntries(
        [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((step) => [step, rgb(`${prefix}-${step}`)])
    );

const neutral = ramp("neutral");
const brand = ramp("brand");

const config: Config = {
    darkMode: "class",
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
        "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            screens: {
                md: "768px",
                lg: "1024px",
                xl: "1200px",
                "2xl": "1600px",
            },
            fontFamily: {
                sans: ['"IBM Plex Sans"', "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
                mono: ['"IBM Plex Mono"', "ui-monospace", "SFMono-Regular", "Consolas", "monospace"],
            },
            fontSize: {
                // Escala tipográfica semántica (base html 14px)
                display: ["1.75rem", { lineHeight: "2.125rem", letterSpacing: "-0.015em", fontWeight: "600" }],
                title: ["1.375rem", { lineHeight: "1.75rem", letterSpacing: "-0.01em", fontWeight: "600" }],
                heading: ["1.0625rem", { lineHeight: "1.5rem", fontWeight: "600" }],
                body: ["0.9375rem", { lineHeight: "1.375rem" }],
                caption: ["0.8125rem", { lineHeight: "1.125rem" }],
                eyebrow: ["0.8rem", { lineHeight: "1rem", letterSpacing: "0.04em", fontWeight: "600" }],
                // text-xs sube de 10,5 a 11,2 px: es el piso de lectura del sistema
                xs: ["0.8rem", { lineHeight: "1.1rem" }],
                // Alias heredados
                "h1-desktop": ["1.5rem", { lineHeight: "1.25", fontWeight: "600" }],
                "h2-desktop": ["1.125rem", { lineHeight: "1.375", fontWeight: "600" }],
                "h3-desktop": ["0.875rem", { lineHeight: "1.5", fontWeight: "500" }],
                "body-desktop": ["0.8125rem", { lineHeight: "1.5" }],
                "secondary-desktop": ["0.75rem", { lineHeight: "1.5" }],
                "label-desktop": ["0.75rem", { lineHeight: "1.5", letterSpacing: "0.03em", fontWeight: "600" }],
            },
            maxWidth: {
                "1800": "1800px",
                page: "1600px",
            },
            colors: {
                // Neutros (grafito). slate/gray son alias para el código existente.
                neutral,
                slate: neutral,
                gray: neutral,
                // Marca: sigue al tema de color elegido por el usuario.
                brand,
                indigo: brand,
                // Estados: un solo tono por significado.
                success: ramp("success"),
                warning: ramp("warning"),
                danger: ramp("danger"),
                info: ramp("info"),
                red: ramp("danger"),
                rose: ramp("danger"),
                green: ramp("success"),
                emerald: ramp("success"),
                yellow: ramp("warning"),
                amber: ramp("warning"),
                blue: ramp("info"),
                purple: ramp("accent"),
                violet: ramp("accent"),

                border: rgb("border"),
                input: rgb("input"),
                ring: rgb("ring"),
                background: rgb("background"),
                foreground: rgb("foreground"),
                surface: {
                    DEFAULT: rgb("card"),
                    sunken: rgb("surface-sunken"),
                    raised: rgb("popover"),
                },
                primary: {
                    DEFAULT: rgb("primary"),
                    foreground: rgb("primary-foreground"),
                    hover: rgb("primary-hover"),
                },
                secondary: {
                    DEFAULT: rgb("secondary"),
                    foreground: rgb("secondary-foreground"),
                },
                destructive: {
                    DEFAULT: rgb("destructive"),
                    foreground: rgb("destructive-foreground"),
                },
                muted: {
                    DEFAULT: rgb("muted"),
                    foreground: rgb("muted-foreground"),
                },
                accent: {
                    DEFAULT: rgb("accent"),
                    foreground: rgb("accent-foreground"),
                },
                popover: {
                    DEFAULT: rgb("popover"),
                    foreground: rgb("popover-foreground"),
                },
                card: {
                    DEFAULT: rgb("card"),
                    foreground: rgb("card-foreground"),
                },
            },
            borderRadius: {
                none: "0",
                sm: "var(--radius-sm)",
                DEFAULT: "var(--radius-md)",
                md: "var(--radius-md)",
                lg: "var(--radius-lg)",
                xl: "var(--radius-xl)",
                "2xl": "var(--radius-2xl)",
                "3xl": "var(--radius-3xl)",
            },
            boxShadow: {
                xs: "var(--shadow-xs)",
                sm: "var(--shadow-xs)",
                DEFAULT: "var(--shadow-sm)",
                md: "var(--shadow-sm)",
                lg: "var(--shadow-md)",
                xl: "var(--shadow-lg)",
                "2xl": "var(--shadow-xl)",
                inner: "var(--shadow-inner)",
                focus: "0 0 0 3px rgb(var(--ring) / 0.28)",
            },
            transitionTimingFunction: {
                standard: "cubic-bezier(0.2, 0, 0, 1)",
            },
            keyframes: {
                "sheet-in": {
                    from: { transform: "translateX(-100%)" },
                    to: { transform: "translateX(0)" },
                },
            },
            animation: {
                "sheet-in": "sheet-in 200ms cubic-bezier(0.2, 0, 0, 1)",
            },
        },
    },
    plugins: [animate],
};
export default config;
