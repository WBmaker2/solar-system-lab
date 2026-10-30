import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(here, '../public/icons');
mkdirSync(outputDir, { recursive: true });

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const compressed = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function mix(a, b, t) {
  const clamped = Math.max(0, Math.min(1, t));
  return [
    Math.round(a[0] + (b[0] - a[0]) * clamped),
    Math.round(a[1] + (b[1] - a[1]) * clamped),
    Math.round(a[2] + (b[2] - a[2]) * clamped),
  ];
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function render(size, maskable) {
  const rgba = Buffer.alloc(size * size * 4);
  const scale = maskable ? 0.8 : 1;
  const cos24 = Math.cos((24 * Math.PI) / 180);
  const sin24 = Math.sin((24 * Math.PI) / 180);

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      const samples = 2;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const x = ((px + (sx + 0.5) / samples) / size) * 64;
          const y = ((py + (sy + 0.5) / samples) / size) * 64;
          const cx = 32;
          const cy = 32;
          const dx = (x - cx) / scale;
          const dy = (y - cy) / scale;
          const cxScaled = cx;
          const cyScaled = cy;
          const px2 = cxScaled + dx;
          const py2 = cyScaled + dy;

          // Background: deep navy radial.
          const distanceFromCenter = Math.hypot(px2 - 32, py2 - 30) / 38;
          let color = mix([18, 35, 71], [5, 9, 18], distanceFromCenter);

          // The orbit ellipse, rotated -24°.
          const ex = px2 - 32;
          const ey = py2 - 31;
          const lx = ex * cos24 - ey * sin24;
          const ly = ex * sin24 + ey * cos24;
          const q = Math.sqrt((lx / 25) ** 2 + (ly / 9.4) ** 2);
          const ringAlpha = (1 - smoothstep(0.035, 0.075, Math.abs(q - 1))) * 0.76;
          if (ringAlpha > 0) color = mix(color, [255, 209, 102], ringAlpha);

          // Sun glow.
          const sunDistance = Math.hypot(px2 - 32, py2 - 31);
          const glow = Math.exp(-((sunDistance / 17) ** 2)) * 0.3;
          if (glow > 0) color = mix(color, [255, 183, 70], glow);

          // Sun disk.
          if (sunDistance < 9.2) {
            const highlight = Math.max(0, 1 - Math.hypot(px2 - 29, py2 - 28) / 13);
            const sun = mix([255, 170, 40], [255, 247, 198], highlight);
            color = mix(color, sun, 1 - smoothstep(8.4, 9.5, sunDistance));
          }

          // Moon dot on the ring.
          const moonDistance = Math.hypot(px2 - 50.5, py2 - 23.5);
          if (moonDistance < 5.4) {
            const moonGlow = Math.exp(-((moonDistance / 9) ** 2)) * 0.35;
            color = mix(color, [131, 192, 255], moonGlow);
            const moon = mix([65, 130, 220], [190, 228, 255], 1 - moonDistance / 5.4);
            color = mix(color, moon, 1 - smoothstep(4.2, 5.2, moonDistance));
          }

          // Tiny star.
          const starDistance = Math.hypot(px2 - 44, py2 - 48);
          if (starDistance < 1.4) color = mix(color, [224, 238, 255], 0.8);

          r += color[0];
          g += color[1];
          b += color[2];
        }
      }
      const total = samples * samples;
      const index = (py * size + px) * 4;
      rgba[index] = Math.round(r / total);
      rgba[index + 1] = Math.round(g / total);
      rgba[index + 2] = Math.round(b / total);
      rgba[index + 3] = 255;
    }
  }
  return encodePng(size, size, rgba);
}

for (const [name, size, maskable] of [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true],
]) {
  writeFileSync(resolve(outputDir, name), render(size, maskable));
  console.log(`wrote public/icons/${name}`);
}
