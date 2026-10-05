// Genera los iconos de la PWA, el favicon y la imagen OpenGraph a partir de un SVG inline.
// Uso: pnpm icons
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const OUT = path.resolve("public");
const PRIMARY = "#1f4e5f";
const MINT = "#a8dccb";
const BG = "#faf8f5";

/** Monograma: círculo que "respira" (dos anillos) con una M suave. */
function iconSvg(size, { maskable = false } = {}) {
  const pad = maskable ? size * 0.12 : 0;
  const inner = size - pad * 2;
  const c = size / 2;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${maskable ? 0 : size * 0.22}" fill="${PRIMARY}"/>
  <circle cx="${c}" cy="${c}" r="${inner * 0.34}" fill="none" stroke="${MINT}" stroke-opacity="0.35" stroke-width="${inner * 0.035}"/>
  <circle cx="${c}" cy="${c}" r="${inner * 0.24}" fill="${MINT}" fill-opacity="0.18"/>
  <path d="M ${c - inner * 0.16} ${c + inner * 0.12} L ${c - inner * 0.16} ${c - inner * 0.1} L ${c} ${c + inner * 0.05} L ${c + inner * 0.16} ${c - inner * 0.1} L ${c + inner * 0.16} ${c + inner * 0.12}"
        fill="none" stroke="${BG}" stroke-width="${inner * 0.055}" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}

function ogSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="g" cx="15%" cy="10%" r="80%">
      <stop offset="0%" stop-color="#d5e6ea"/>
      <stop offset="60%" stop-color="${BG}"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <circle cx="1010" cy="330" r="190" fill="none" stroke="${MINT}" stroke-width="22" stroke-opacity="0.55"/>
  <circle cx="1010" cy="330" r="120" fill="${MINT}" fill-opacity="0.35"/>
  <text x="90" y="250" font-family="Georgia, 'Times New Roman', serif" font-size="64" fill="${PRIMARY}">Psicología</text>
  <text x="90" y="330" font-family="Georgia, 'Times New Roman', serif" font-size="64" fill="${PRIMARY}">Matías Sánchez</text>
  <text x="92" y="400" font-family="Helvetica, Arial, sans-serif" font-size="28" fill="#5b6b70">Psicólogo · RP 14394-LP · Paraguay</text>
  <text x="92" y="470" font-family="Helvetica, Arial, sans-serif" font-size="24" fill="#5b6b70">Un espacio para comprender lo que te pasa</text>
  <text x="92" y="505" font-family="Helvetica, Arial, sans-serif" font-size="24" fill="#5b6b70">y trabajar en lo que necesitás.</text>
</svg>`;
}

async function png(svg, size, file) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(path.join(OUT, file));
}

await mkdir(path.join(OUT, "icons"), { recursive: true });
await png(iconSvg(512), 192, "icons/icon-192.png");
await png(iconSvg(512), 512, "icons/icon-512.png");
await png(iconSvg(512, { maskable: true }), 512, "icons/icon-maskable-512.png");
await png(iconSvg(512), 180, "icons/apple-touch-icon.png");
await png(iconSvg(512), 32, "favicon-32.png");
await writeFile(path.join(OUT, "icons/icon.svg"), iconSvg(512));
await sharp(Buffer.from(ogSvg())).png().toFile(path.join(OUT, "og.png"));
// favicon.ico (formato ICO simple con un PNG de 32px embebido)
const png32 = await sharp(Buffer.from(iconSvg(512))).resize(32, 32).png().toBuffer();
const header = Buffer.alloc(6 + 16);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
header.writeUInt8(32, 6); header.writeUInt8(32, 7); header.writeUInt8(0, 8); header.writeUInt8(0, 9);
header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12); header.writeUInt32LE(png32.length, 14); header.writeUInt32LE(22, 18);
await writeFile(path.join(OUT, "favicon.ico"), Buffer.concat([header, png32]));
console.log("Iconos generados en public/");
