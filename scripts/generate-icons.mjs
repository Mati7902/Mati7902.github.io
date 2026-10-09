// Genera los iconos de la PWA, el favicon y la imagen para redes (OpenGraph) a partir del emblema
// (public/marca/emblema.svg) y la foto (public/marca/matias-sanchez.webp).
// Uso: pnpm icons
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const OUT = path.resolve("public");
const PRIMARY = "#2f6468";
const ACCENT = "#27b088";
const NAVY = "#0f2333";
const BG = "#fbfdfc";
const MINT = "#e1f3ec";

// Emblema de la identidad (nudo celta en forma de cerebro), vectorizado del logo.
const emblemSvg = await readFile(path.join(OUT, "marca/emblema.svg"), "utf8");
const emblemViewBox = /viewBox="([^"]+)"/.exec(emblemSvg)?.[1] ?? "0 0 816 824";
const emblemPaths = emblemSvg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
const emblem = (x, y, size, color = PRIMARY) =>
  `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="${emblemViewBox}">${emblemPaths.replaceAll("#2f6468", color)}</svg>`;

/** Ícono: emblema verde azulado sobre fondo claro con un toque menta. */
function iconSvg(size, { maskable = false } = {}) {
  const pad = size * (maskable ? 0.2 : 0.12);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${maskable ? 0 : size * 0.22}" fill="${BG}"/>
  <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.46}" fill="${MINT}" fill-opacity="0.55"/>
  ${emblem(pad, pad, size - pad * 2)}
</svg>`;
}

/** Imagen para compartir en redes: foto, nombre y frase de la identidad. */
function ogSvg(photoDataUri) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="g" cx="85%" cy="50%" r="70%">
      <stop offset="0%" stop-color="${MINT}"/>
      <stop offset="70%" stop-color="${BG}"/>
    </radialGradient>
    <clipPath id="c"><circle cx="930" cy="315" r="170"/></clipPath>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  ${emblem(90, 86, 92)}
  <text x="200" y="128" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="40" fill="${PRIMARY}">Lic. Matías Sánchez</text>
  <text x="202" y="166" font-family="Helvetica, Arial, sans-serif" font-size="18" letter-spacing="5" fill="#4b5d68">PSICOLOGÍA · NEUROCIENCIA APLICADA</text>
  <text x="90" y="300" font-family="Georgia, 'Times New Roman', serif" font-size="54" fill="${NAVY}">Terapia desde <tspan font-style="italic" fill="#1f8a6a">donde estés</tspan>,</text>
  <text x="90" y="370" font-family="Georgia, 'Times New Roman', serif" font-size="54" fill="${NAVY}">con el rigor de una</text>
  <text x="90" y="440" font-family="Georgia, 'Times New Roman', serif" font-size="54" fill="${NAVY}">consulta clínica.</text>
  <text x="92" y="520" font-family="Helvetica, Arial, sans-serif" font-size="24" fill="#4b5d68">Psicólogo · RP 14394-LP · Paraguay</text>
  <circle cx="930" cy="315" r="198" fill="none" stroke="${ACCENT}" stroke-opacity="0.35" stroke-width="2"/>
  <circle cx="930" cy="315" r="184" fill="none" stroke="#d8c9a5" stroke-width="4"/>
  <image x="760" y="145" width="340" height="340" clip-path="url(#c)" preserveAspectRatio="xMidYMid slice" xlink:href="${photoDataUri}"/>
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
const photo = await sharp(path.join(OUT, "marca/matias-sanchez.webp")).resize(340, 340).png().toBuffer();
await sharp(Buffer.from(ogSvg(`data:image/png;base64,${photo.toString("base64")}`))).png().toFile(path.join(OUT, "og.png"));
// favicon.ico (formato ICO simple con un PNG de 32px embebido)
const png32 = await sharp(Buffer.from(iconSvg(512))).resize(32, 32).png().toBuffer();
const header = Buffer.alloc(6 + 16);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
header.writeUInt8(32, 6); header.writeUInt8(32, 7); header.writeUInt8(0, 8); header.writeUInt8(0, 9);
header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12); header.writeUInt32LE(png32.length, 14); header.writeUInt32LE(22, 18);
await writeFile(path.join(OUT, "favicon.ico"), Buffer.concat([header, png32]));
console.log("Iconos generados en public/");
