// Génère les icônes PNG de la PWA sans dépendance (zlib + format PNG minimal).
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function writePng(path, size, pixelFn) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelFn(x, y, size);
      const o = rowStart + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  writeFileSync(path, png);
  console.log(`${path} (${png.length} octets)`);
}

const BG = [18, 20, 28];
const TRACK = [58, 63, 84];
const BLOCKS = [
  [96, 165, 250], // bleu
  [74, 222, 128], // vert
  [251, 146, 60], // orange
];

function inRoundedRect(x, y, x0, y0, x1, y1, r) {
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function makeIcon(paddingRatio, rounded) {
  return (x, y, size) => {
    // Icône masquable plein cadre ; les autres sont découpées en carré arrondi.
    if (rounded && !inRoundedRect(x, y, 0, 0, size, size, size * 0.18)) {
      return [0, 0, 0, 0];
    }
    const p = size * paddingRatio;
    const u = (size - 2 * p) / 100; // unité de design 100x100
    const ux = (x - p) / u;
    const uy = (y - p) / u;

    let color = BG;

    // Rail vertical
    if (ux >= 22 && ux <= 28 && uy >= 8 && uy <= 92) color = TRACK;

    // Blocs
    const bar = (y0, y1, c) => {
      if (ux >= 36 && ux <= 88 && uy >= y0 && uy <= y1) color = c;
    };
    bar(12, 32, BLOCKS[0]);
    bar(40, 60, BLOCKS[1]);
    bar(68, 88, BLOCKS[2]);

    return [color[0], color[1], color[2], 255];
  };
}

writePng(join(outDir, 'icon-192.png'), 192, makeIcon(0, true));
writePng(join(outDir, 'icon-512.png'), 512, makeIcon(0, true));
writePng(join(outDir, 'icon-512-maskable.png'), 512, makeIcon(0.12, false));
writePng(join(outDir, 'apple-touch-icon-180.png'), 180, makeIcon(0.04, true));
console.log('Icônes générées.');
