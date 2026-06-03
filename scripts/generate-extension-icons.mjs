#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { deflateSync } from "node:zlib";

const ROOT_DIR = resolve(new URL("..", import.meta.url).pathname);
const OUTPUT_DIR = resolve(ROOT_DIR, "apps/extension/public/icons");
const SIZES = [16, 32, 48, 128];

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function mix(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function writePng(path, width, height, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const scanlines = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (width * 4 + 1);
    scanlines[rowOffset] = 0;
    pixels.copy(scanlines, rowOffset + 1, y * width * 4, (y + 1) * width * 4);
  }

  writeFileSync(
    path,
    Buffer.concat([
      PNG_SIGNATURE,
      chunk("IHDR", header),
      chunk("IDAT", deflateSync(scanlines, { level: 9 })),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : clamp(((px - ax) * dx + (py - ay) * dy) / lenSq, 0, 1);
  const x = ax + t * dx;
  const y = ay + t * dy;
  return Math.hypot(px - x, py - y);
}

function roundedRectAlpha(x, y, size, radius) {
  const inset = radius;
  const cx = clamp(x, inset, size - inset);
  const cy = clamp(y, inset, size - inset);
  const dist = Math.hypot(x - cx, y - cy);
  return clamp(radius + 0.5 - dist, 0, 1);
}

function renderHighRes(size, scale) {
  const width = size * scale;
  const pixels = Buffer.alloc(width * width * 4);
  const radius = width * 0.25;
  const borderRadius = width * 0.23;
  const center = width / 2;
  const circleRadius = width * 0.38;

  for (let y = 0; y < width; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const rectAlpha = roundedRectAlpha(x + 0.5, y + 0.5, width - 1, borderRadius);
      if (rectAlpha <= 0) continue;

      const nx = x / (width - 1);
      const ny = y / (width - 1);
      const base = [
        mix(13, 28, nx * 0.45 + ny * 0.25),
        mix(14, 20, ny),
        mix(27, 50, 1 - nx * 0.35),
      ];
      pixels[i] = base[0];
      pixels[i + 1] = base[1];
      pixels[i + 2] = base[2];
      pixels[i + 3] = Math.round(255 * rectAlpha);

      const dx = x + 0.5 - center;
      const dy = y + 0.5 - center;
      const circleAlpha = clamp(circleRadius + 0.75 - Math.hypot(dx, dy), 0, 1);
      if (circleAlpha > 0) {
        const t = clamp((dx + dy + circleRadius * 1.3) / (circleRadius * 2.6), 0, 1);
        const violet = [126, 64, 255];
        const blue = [36, 111, 255];
        pixels[i] = mix(pixels[i], mix(violet[0], blue[0], t), circleAlpha);
        pixels[i + 1] = mix(pixels[i + 1], mix(violet[1], blue[1], t), circleAlpha);
        pixels[i + 2] = mix(pixels[i + 2], mix(violet[2], blue[2], t), circleAlpha);
      }
    }
  }

  const stroke = width * 0.082;
  const left = [width * 0.31, width * 0.72, width * 0.49, width * 0.27];
  const right = [width * 0.69, width * 0.72, width * 0.51, width * 0.27];
  const bar = [width * 0.40, width * 0.56, width * 0.60, width * 0.56];

  for (let y = 0; y < width; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;
      const d = Math.min(
        distanceToSegment(px, py, left[0], left[1], left[2], left[3]),
        distanceToSegment(px, py, right[0], right[1], right[2], right[3]),
        distanceToSegment(px, py, bar[0], bar[1], bar[2], bar[3]),
      );
      const alpha = clamp(stroke + 0.8 - d, 0, 1);
      if (alpha <= 0) continue;

      const i = (y * width + x) * 4;
      pixels[i] = mix(pixels[i], 255, alpha);
      pixels[i + 1] = mix(pixels[i + 1], 255, alpha);
      pixels[i + 2] = mix(pixels[i + 2], 255, alpha);
    }
  }

  return pixels;
}

function downsample(high, size, scale) {
  const width = size * scale;
  const pixels = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const sums = [0, 0, 0, 0];
      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          const i = ((y * scale + sy) * width + x * scale + sx) * 4;
          sums[0] += high[i];
          sums[1] += high[i + 1];
          sums[2] += high[i + 2];
          sums[3] += high[i + 3];
        }
      }
      const o = (y * size + x) * 4;
      const count = scale * scale;
      pixels[o] = Math.round(sums[0] / count);
      pixels[o + 1] = Math.round(sums[1] / count);
      pixels[o + 2] = Math.round(sums[2] / count);
      pixels[o + 3] = Math.round(sums[3] / count);
    }
  }

  return pixels;
}

mkdirSync(OUTPUT_DIR, { recursive: true });

for (const size of SIZES) {
  const scale = size <= 32 ? 6 : 4;
  const high = renderHighRes(size, scale);
  const pixels = downsample(high, size, scale);
  const path = resolve(OUTPUT_DIR, `icon-${size}.png`);
  mkdirSync(dirname(path), { recursive: true });
  writePng(path, size, size, pixels);
  console.log(`Wrote ${path}`);
}
