#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { deflateSync, inflateSync } from "node:zlib";

const ROOT_DIR = resolve(new URL("..", import.meta.url).pathname);
const SOURCE_LOGO_PATH = resolve(ROOT_DIR, "apps/extension/public/Anidachi_logo.png");
const OUTPUT_DIR = resolve(ROOT_DIR, "apps/extension/public/icons");
const SIZES = [16, 32, 48, 128];
const CHECK_ONLY = process.argv.includes("--check");

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

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

function encodePng(width, height, pixels) {
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

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(scanlines, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function paethPredictor(left, up, upLeft) {
  const p = left + up - upLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upLeft);
  if (pa <= pb && pa <= pc) return left;
  if (pb <= pc) return up;
  return upLeft;
}

function readRgbaPng(path) {
  const buffer = readFileSync(path);
  if (!buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error(`Expected PNG signature: ${path}`);
  }

  let offset = PNG_SIGNATURE.length;
  let width = 0;
  let height = 0;
  const idatChunks = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    offset += 4;
    const type = buffer.subarray(offset, offset + 4).toString("ascii");
    offset += 4;
    const data = buffer.subarray(offset, offset + length);
    offset += length + 4;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const bitDepth = data[8];
      const colorType = data[9];
      const compression = data[10];
      const filter = data[11];
      const interlace = data[12];
      if (
        bitDepth !== 8 ||
        colorType !== 6 ||
        compression !== 0 ||
        filter !== 0 ||
        interlace !== 0
      ) {
        throw new Error("Only 8-bit non-interlaced RGBA PNG logos are supported.");
      }
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  if (!width || !height || !idatChunks.length) {
    throw new Error(`Could not read PNG image data: ${path}`);
  }

  const inflated = inflateSync(Buffer.concat(idatChunks));
  const stride = width * 4;
  const pixels = Buffer.alloc(width * height * 4);
  let inputOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filterType = inflated[inputOffset];
    inputOffset += 1;
    const row = inflated.subarray(inputOffset, inputOffset + stride);
    inputOffset += stride;

    for (let x = 0; x < stride; x += 1) {
      const left = x >= 4 ? pixels[y * stride + x - 4] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upLeft = y > 0 && x >= 4 ? pixels[(y - 1) * stride + x - 4] : 0;
      let value = row[x];
      if (filterType === 1) {
        value += left;
      } else if (filterType === 2) {
        value += up;
      } else if (filterType === 3) {
        value += Math.floor((left + up) / 2);
      } else if (filterType === 4) {
        value += paethPredictor(left, up, upLeft);
      } else if (filterType !== 0) {
        throw new Error(`Unsupported PNG filter type ${filterType}.`);
      }
      pixels[y * stride + x] = value & 0xff;
    }
  }

  return { width, height, pixels };
}

function sampleBilinear(source, x, y) {
  const x0 = Math.max(0, Math.min(source.width - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(source.height - 1, Math.floor(y)));
  const x1 = Math.max(0, Math.min(source.width - 1, x0 + 1));
  const y1 = Math.max(0, Math.min(source.height - 1, y0 + 1));
  const tx = x - x0;
  const ty = y - y0;
  const weights = [
    [(1 - tx) * (1 - ty), x0, y0],
    [tx * (1 - ty), x1, y0],
    [(1 - tx) * ty, x0, y1],
    [tx * ty, x1, y1],
  ];

  let alpha = 0;
  let red = 0;
  let green = 0;
  let blue = 0;

  for (const [weight, sx, sy] of weights) {
    const index = (sy * source.width + sx) * 4;
    const sourceAlpha = (source.pixels[index + 3] / 255) * weight;
    alpha += sourceAlpha;
    red += source.pixels[index] * sourceAlpha;
    green += source.pixels[index + 1] * sourceAlpha;
    blue += source.pixels[index + 2] * sourceAlpha;
  }

  if (alpha <= 0) {
    return [0, 0, 0, 0];
  }

  return [
    Math.round(red / alpha),
    Math.round(green / alpha),
    Math.round(blue / alpha),
    Math.round(alpha * 255),
  ];
}

function resizeLogo(source, size) {
  const pixels = Buffer.alloc(size * size * 4);
  const scaleX = source.width / size;
  const scaleY = source.height / size;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const sourceX = (x + 0.5) * scaleX - 0.5;
      const sourceY = (y + 0.5) * scaleY - 0.5;
      const [red, green, blue, alpha] = sampleBilinear(source, sourceX, sourceY);
      const index = (y * size + x) * 4;
      pixels[index] = red;
      pixels[index + 1] = green;
      pixels[index + 2] = blue;
      pixels[index + 3] = alpha;
    }
  }

  return pixels;
}

if (!CHECK_ONLY) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

const sourceLogo = readRgbaPng(SOURCE_LOGO_PATH);
const stalePaths = [];

for (const size of SIZES) {
  const pixels = resizeLogo(sourceLogo, size);
  const path = resolve(OUTPUT_DIR, `icon-${size}.png`);
  const expected = encodePng(size, size, pixels);
  const current = existsSync(path) ? readFileSync(path) : null;

  if (current?.equals(expected)) {
    console.log(`${CHECK_ONLY ? "Verified" : "Unchanged"} ${path}`);
    continue;
  }

  if (CHECK_ONLY) {
    stalePaths.push(path);
    continue;
  }

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, expected);
  console.log(`Updated ${path}`);
}

if (stalePaths.length > 0) {
  console.error("Extension icons are missing or stale:");
  for (const path of stalePaths) {
    console.error(`- ${path}`);
  }
  console.error("Run `pnpm build:extension:icons` and commit the generated icons.");
  process.exitCode = 1;
}
