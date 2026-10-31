/**
 * Regenera los íconos de la PWA (public/images/**) y el favicon (public/icon.svg)
 * a partir del isotipo de components/shell/BrandMark.tsx.
 *
 *   node scripts/pwa/generate-icons.js
 *
 * Si cambia el isotipo, actualizá GLYPH y volvé a correr el script.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const BRAND = '#1F60C1'; // brand-600 / primary
const GLYPH = `
    <path d="M5 4v16" />
    <path d="M19 4v16" />
    <path d="M5 12h4l2-3 2 6 2-3h4" />`;

const PUBLIC = path.join(__dirname, '../../public');
const IMAGES = path.join(PUBLIC, 'images');

/** Glifo blanco centrado, ocupando `scale` del lado. */
function glyph(size, scale) {
    const box = size * scale;
    const offset = (size - box) / 2;
    return `<g transform="translate(${offset} ${offset}) scale(${box / 24})" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${GLYPH}</g>`;
}

/** El isotipo tal como se ve en la app: cuadrado de marca con radio 8/28 y glifo al 62 %. */
function markSvg(size, { rounded = true, scale = 0.62 } = {}) {
    const r = rounded ? size * (8 / 28) : 0;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" fill="${BRAND}" />
  ${glyph(size, scale)}
</svg>`;
}

async function render(svg, file) {
    await sharp(Buffer.from(svg)).png().toFile(file);
}

/** Isotipo redondeado centrado sobre un lienzo transparente (mosaicos de Windows). */
async function renderOnCanvas(width, height, markSize, file) {
    const mark = await sharp(Buffer.from(markSvg(markSize))).png().toBuffer();
    await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: mark, gravity: 'center' }])
        .png()
        .toFile(file);
}

async function main() {
    const written = [];

    // Android ("any"): isotipo redondeado con esquinas transparentes.
    for (const size of [48, 72, 96, 144, 192, 512]) {
        const file = path.join(IMAGES, 'android', `launchericon-${size}x${size}.png`);
        await render(markSvg(size), file);
        written.push(file);
    }

    // Android ("maskable"): a sangre, con el glifo dentro de la zona segura (círculo del 80 %).
    for (const size of [192, 512]) {
        const file = path.join(IMAGES, 'android', `maskable-${size}x${size}.png`);
        await render(markSvg(size, { rounded: false, scale: 0.5 }), file);
        written.push(file);
    }

    // iOS: cuadrado opaco; el sistema aplica sus propias esquinas.
    for (const name of fs.readdirSync(path.join(IMAGES, 'ios'))) {
        const size = parseInt(name, 10);
        const file = path.join(IMAGES, 'ios', name);
        await render(markSvg(size, { rounded: false }), file);
        written.push(file);
    }

    // Windows: los íconos de barra de tareas y tienda llevan el isotipo completo;
    // los mosaicos, el isotipo a la mitad del lado menor sobre fondo transparente.
    for (const name of fs.readdirSync(path.join(IMAGES, 'windows'))) {
        const file = path.join(IMAGES, 'windows', name);
        const { width, height } = await sharp(file).metadata();
        if (/^(Square44x44Logo|StoreLogo)/.test(name)) {
            await render(markSvg(width), file);
        } else {
            await renderOnCanvas(width, height, Math.round(Math.min(width, height) * 0.5), file);
        }
        written.push(file);
    }

    // Favicon vectorial.
    const favicon = path.join(PUBLIC, 'icon.svg');
    fs.writeFileSync(favicon, markSvg(32) + '\n');
    written.push(favicon);

    console.log(`${written.length} archivos generados.`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
