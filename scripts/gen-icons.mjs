// Gera os ícones PWA (icon-192.png / icon-512.png) sem dependências.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public");
mkdirSync(outDir, { recursive: true });

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function pngData(w, h, pixels) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter none
    pixels.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function desenha(s) {
  const pixels = Buffer.alloc(s * s * 4);
  const put = (x, y, r, g, b) => {
    if (x < 0 || y < 0 || x >= s || y >= s) return;
    const i = (y * s + x) * 4;
    pixels[i] = r;
    pixels[i + 1] = g;
    pixels[i + 2] = b;
    pixels[i + 3] = 255;
  };

  const corner = s * 0.22;
  const emCorner = (x, y) => {
    const dxr = Math.max(corner - x, 0);
    const dxl = Math.max(x - (s - corner - 1), 0);
    const dyb = Math.max(corner - y, 0);
    const dyt = Math.max(y - (s - corner - 1), 0);
    return Math.sqrt(
      Math.max(
        dxr * dxr + dyb * dyb,
        dxr * dxr + dyt * dyt,
        dxl * dxl + dyb * dyb,
        dxl * dxl + dyt * dyt
      )
    );
  };

  // fundo (gradiente vertical) + destaque esmeralda inferior
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      if (emCorner(x, y) > corner) continue;
      const t = y / s;
      const emPhase = y > s * 0.55 ? (y - s * 0.55) / (s * 0.45) : 0;
      put(
        x,
        y,
        Math.round(13 + 10 * t),
        Math.round(14 + (2 + 46 * emPhase) * t <= 0 ? 14 : 14 + (1 - t) * 46 * emPhase),
        Math.round(19 + 5 * t + 34 * emPhase * (1 - t))
      );
    }
  }

  // fachada da "loja"
  const cx = s / 2;
  const shopW = s * 0.56;
  const shopH = s * 0.34;
  const shopY = s * 0.47;
  const shopX0 = cx - shopW / 2;
  const shopX1 = cx + shopW / 2;
  const doorW = shopW * 0.3;
  const doorX0 = cx - doorW / 2;
  const doorX1 = cx + doorW / 2;

  const emerald = (x) => {
    const p = Math.abs(x - cx) / (shopW / 2);
    return [Math.round(52 - 22 * p), Math.round(205 - 25 * p), Math.round(140 - 18 * p)];
  };

  for (let y = shopY; y < shopY + shopH; y++) {
    const onStripe =
      y - shopY < shopH * 0.22 && Math.floor((y - shopY) / Math.max(1, shopH * 0.11)) % 2 === 0;
    for (let x = shopX0; x < shopX1; x++) {
      const xp = Math.round(x);
      const yp = Math.round(y);
      const [r, g, b] = emerald(xp);
      if (onStripe) {
        put(xp, yp, Math.min(255, Math.round(r * 1.4)), Math.min(255, Math.round(g * 1.15)), Math.min(255, Math.round(b * 1.25)));
      } else {
        put(xp, yp, r, g, b);
      }
    }
  }

  // porta
  for (let y = shopY + shopH * 0.36; y < shopY + shopH; y++) {
    for (let x = doorX0; x < doorX1; x++) {
      put(Math.round(x), Math.round(y), 8, 10, 14);
    }
  }

  return pixels;
}

for (const s of [192, 512]) {
  writeFileSync(join(outDir, `icon-${s}.png`), pngData(s, s, desenha(s)));
  console.log(`public/icon-${s}.png gerado (${s}x${s})`);
}