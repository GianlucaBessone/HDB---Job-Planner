#!/usr/bin/env node
/**
 * Migración de utilidades Tailwind al sistema de diseño (docs/DESIGN_SYSTEM.md).
 *
 * Normaliza patrones heredados que ningún token puede corregir por sí solo:
 * pesos 800/900, tracking exagerado, tamaños de 8-10px, sombras de color,
 * escalas en hover/active, radios arbitrarios, scrims y clases de color que se
 * contradicen. Es idempotente: correrlo dos veces no cambia nada.
 *
 *   node scripts/design-system/migrate-classes.js          # aplica
 *   node scripts/design-system/migrate-classes.js --dry    # solo informa
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DIRS = ['app', 'components', 'lib'];
const DRY = process.argv.includes('--dry');

const SHADOW_COLORS = 'primary|indigo|blue|sky|cyan|teal|emerald|green|lime|yellow|amber|orange|red|rose|pink|fuchsia|purple|violet|slate|gray|black|white|brand';
const VARIANTS = '(?:[a-z0-9-]+:)*';

const stats = {};
const count = (rule, n = 1) => { stats[rule] = (stats[rule] || 0) + n; };

function replaceCount(str, re, rep, rule) {
    let n = 0;
    const out = str.replace(re, (...args) => {
        n++;
        return typeof rep === 'function' ? rep(...args) : rep.replace(/\$(\d)/g, (_, i) => args[+i] ?? '');
    });
    if (n) count(rule, n);
    return out;
}

/** Reglas que dependen del resto de la línea (contexto de la cadena de clases). */
function migrateLine(line) {
    const isLabelish = /\buppercase\b/.test(line);

    line = replaceCount(line, /\bfont-black\b/g, isLabelish ? 'font-semibold' : 'font-bold', 'font-black');
    line = replaceCount(line, /\bfont-extrabold\b/g, isLabelish ? 'font-semibold' : 'font-bold', 'font-extrabold');

    // Microanimaciones: cortas y discretas (tailwindcss-animate)
    if (/\banimate-in\b/.test(line)) {
        line = replaceCount(line, /\bduration-(300|500|700|1000)\b/g, 'duration-200', 'animate-duration');
        line = replaceCount(line, /\bslide-in-from-(bottom|top|left|right)-(4|5|6|8|10|12)\b/g, 'slide-in-from-$1-2', 'animate-distance');
        line = replaceCount(line, /\bzoom-in-(50|75|90)\b/g, 'zoom-in-95', 'animate-zoom');
    }

    // Scrims de modales: un solo tono, sin desenfoque
    if (/\bfixed\b/.test(line) && /\binset-0\b/.test(line) && /\bbg-(slate-(800|900|950)|black)\/\d+/.test(line)) {
        line = replaceCount(line, /\bbg-(?:slate-(?:800|900|950)|black)\/\d+\b/g, 'bg-slate-950/50', 'scrim');
        line = replaceCount(line, /\s*\bbackdrop-blur(?:-(?:none|sm|md|lg|xl|2xl|3xl))?\b/g, '', 'scrim-blur');
    } else {
        line = replaceCount(line, /\bbackdrop-blur-(md|lg|xl|2xl|3xl)\b/g, 'backdrop-blur-sm', 'blur');
    }

    // Degradados decorativos → color plano (el primero del degradado, que conserva el significado)
    if (/(?<![\w:-])bg-gradient-to-(?:r|l|t|b|br|bl|tr|tl)\b/.test(line)) {
        const onDark = /\btext-white\b/.test(line);
        const pick = (re) => {
            const m = line.match(re);
            if (!m) return null;
            let [, color, shade, alpha] = m;
            if (!shade) return color + (alpha || '');
            if (onDark && !alpha && +shade < 500) shade = '600';
            return `${color}-${shade}${alpha || ''}`;
        };
        const base = pick(/(?<![\w:-])from-([a-z]+)(?:-(\d{2,3}))?(\/\d+)?(?=[\s"'`])/);
        const dark = pick(/(?<![\w-])dark:from-([a-z]+)(?:-(\d{2,3}))?(\/\d+)?(?=[\s"'`])/);
        line = replaceCount(line, /(?<![\w:-])bg-gradient-to-(?:r|l|t|b|br|bl|tr|tl)\b/g, base ? `bg-${base}${dark ? ` dark:bg-${dark}` : ''}` : 'bg-card', 'gradient');
        line = line.replace(/\s(?:[a-z]+:)*(?:from|via|to)-[^\s"'`]+(?=[\s"'`])/g, '');
        line = line.replace(/\s(?:hover:)?opacity-9\d(?=[\s"'`])/g, '');
    }

    // Botones sólidos: sin sombra (la elevación es para lo que flota) y hover por token
    const solidButton = /\btext-white\b/.test(line)
        && /\bbg-(?:primary(?![\/\w-])|(?:indigo|blue|emerald|green|rose|red|amber|orange|violet|purple|teal|sky|cyan)-(?:500|600|700))\b/.test(line)
        && /\b(?:px|py)-/.test(line)
        && !/\b(?:fixed|absolute|sticky)\b/.test(line);
    if (solidButton) {
        line = replaceCount(line, /\s(?:hover:)?shadow-(?:sm|md|lg|xl|2xl)(?=[\s"'`])/g, '', 'button-shadow');
        line = replaceCount(line, /\bhover:bg-primary\/90\b/g, 'hover:bg-primary-hover', 'button-hover');
    }

    // Campos: siempre sobre superficie (blanco en claro), el borde los delimita
    const isField = /<(?:input|select|textarea)\b/.test(line)
        || (/\bw-full\b/.test(line) && /\bfocus:(?:ring|border)/.test(line) && /\bborder\b/.test(line));
    if (isField && !/\b(?:checkbox|radio)\b/.test(line)) {
        line = replaceCount(line, /\bbg-(?:background|slate-50(?:\/\d+)?)(?=[\s"'`])(?:\s+dark:bg-slate-(?:800|900|950)(?:\/\d+)?(?=[\s"'`]))?/g, 'bg-card', 'field-bg');
    }

    // Colores semánticos duplicados por migraciones automáticas anteriores
    if (/\btext-slate-\d/.test(line)) {
        line = replaceCount(line, /\s\btext-(?:card|muted|secondary|popover)-foreground(?:\/\d+)?(?=\s|"|'|`)/g, '', 'color-conflict');
    }
    return line;
}

/** Reglas de token independientes del contexto. */
function migrateTokens(src) {
    src = replaceCount(src, /\btracking-widest\b/g, 'tracking-wider', 'tracking');
    src = replaceCount(src, /\btracking-\[0?\.(1\d*|2\d*|3\d*|4\d*|5\d*)em\]/g, 'tracking-wider', 'tracking');
    src = replaceCount(src, /\btracking-tighter\b/g, 'tracking-tight', 'tracking');

    src = replaceCount(src, /\btext-\[(8|9)px\]/g, 'text-[10px]', 'text-size');
    src = replaceCount(src, /\btext-\[10px\]/g, 'text-[11px]', 'text-size');

    // Texto de campos al 50% de opacidad: falla de contraste (WCAG 1.4.3)
    src = replaceCount(src, /\btext-foreground\/50\b/g, 'text-foreground', 'input-contrast');

    // Radios arbitrarios → escala del sistema
    src = replaceCount(src, /\brounded(-[trbl]{1,2})?-\[(1\.25|1\.5|1\.75)rem\]/g, 'rounded$1-2xl', 'radius');
    src = replaceCount(src, /\brounded(-[trbl]{1,2})?-\[(2|2\.25|2\.5|3)rem\]/g, 'rounded$1-3xl', 'radius');

    // Sombras de color ("glow") → la elevación la dan los tokens
    src = replaceCount(
        src,
        new RegExp(`\\s${VARIANTS}shadow-(?:${SHADOW_COLORS})(?:-\\d{2,3})?(?:\\/\\d{1,3})?(?=[\\s"'\`])`, 'g'),
        '',
        'shadow-color'
    );

    // Escalas y desplazamientos decorativos en hover/active
    src = replaceCount(src, new RegExp(`\\s${VARIANTS}(?:hover|active|group-hover):(?:scale-(?:\\d+|\\[[^\\]]+\\])|-?translate-y-(?:\\d+(?:\\.\\d+)?|px|\\[[^\\]]+\\]))(?=[\\s"'\`])`, 'g'), '', 'motion');

    return src;
}

/** Etiquetas y botones: sin mayúsculas forzadas ni tracking (NN/g: legibilidad). */
function migrateElements(src) {
    const TAG_ATTR = (tag) => new RegExp(`(<${tag}\\b(?:[^>]|=>)*?className=)(["'])([^"'\\n]*)\\2`, 'g');

    src = replaceCount(src, TAG_ATTR('label'), (m, pre, q, cls) => {
        if (!/\buppercase\b/.test(cls)) return m;
        const kept = cls.split(/\s+/).filter(Boolean).filter(t =>
            !/^(uppercase|tracking-\S+|text-\[\d+px\]|text-(xs|sm)|font-\w+|(dark:)?text-slate-\d+|text-muted-foreground(\/\d+)?|leading-\S+)$/.test(t)
        );
        return `${pre}${q}${[...kept, 'text-[13px] font-medium text-slate-700 dark:text-slate-200'].join(' ')}${q}`;
    }, 'label');

    src = replaceCount(src, TAG_ATTR('button'), (m, pre, q, cls) => {
        if (!/\buppercase\b/.test(cls)) return m;
        const out = cls.split(/\s+/).filter(Boolean)
            .filter(t => !/^(uppercase|tracking-\S+)$/.test(t))
            .map(t => t.replace(/^((?:[a-z]+:)?)text-\[(9|10|11)px\]$/, '$1text-[12px]'))
            .join(' ');
        return `${pre}${q}${out}${q}`;
    }, 'button');

    return src;
}

/**
 * Títulos de página: una sola escala (text-title, o text-display en portadas)
 * en lugar de 30 combinaciones de tamaños, pesos y tracking.
 */
function migrateHeadings(src) {
    src = replaceCount(src, /<h([12]) className="([^"]*\btext-(?:2xl|3xl|4xl|5xl)\b[^"]*)"/g, (m, level, cls) => {
        const tokens = cls.split(/\s+/).filter(Boolean);
        const big = tokens.some(t => /(^|:)text-(4xl|5xl)$/.test(t));
        const kept = tokens.filter(t =>
            !/^((sm|md|lg|xl):)?text-(lg|xl|2xl|3xl|4xl|5xl)$/.test(t) &&
            !/^font-(bold|semibold|extrabold|black)$/.test(t) &&
            !/^tracking-(tight|tighter)$/.test(t) &&
            !/^(italic|uppercase)$/.test(t)
        );
        return `<h${level} className="${[big ? 'text-display' : 'text-title', ...kept].join(' ')}"`;
    }, 'heading');

    // Ícono dentro del título: 20px y color de marca
    src = replaceCount(
        src,
        /(<h[12] className="text-(?:title|display)[^"]*">\s*\n?\s*<[A-Z]\w* className=")([^"]*)(")/g,
        (m, pre, cls, post) => {
            const ICON = ['w-5', 'h-5', 'text-brand-600', 'dark:text-brand-300'];
            const kept = cls.split(/\s+/).filter(Boolean)
                .filter(t => !/^((sm|md|lg):)?[wh]-\d+$/.test(t) && t !== 'text-primary' && !ICON.includes(t));
            return `${pre}${[...kept, ...ICON].join(' ')}${post}`;
        },
        'heading-icon'
    );
    return src;
}

function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
            walk(full, out);
        } else if (/\.(tsx|ts|jsx)$/.test(entry.name)) {
            out.push(full);
        }
    }
    return out;
}

let changedFiles = 0;
for (const dir of DIRS) {
    for (const file of walk(path.join(ROOT, dir))) {
        const original = fs.readFileSync(file, 'utf8');
        let src = original.split('\n').map(migrateLine).join('\n');
        src = migrateTokens(src);
        src = migrateElements(src);
        src = migrateHeadings(src);
        if (src !== original) {
            changedFiles++;
            if (!DRY) fs.writeFileSync(file, src, 'utf8');
        }
    }
}

console.log(`${DRY ? '[dry] ' : ''}Archivos modificados: ${changedFiles}`);
console.table(stats);
