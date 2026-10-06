import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const size = 256;
const raw = Buffer.alloc((size * 4 + 1) * size);

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len));
  const x = x1 + t * dx;
  const y = y1 + t * dy;
  return Math.hypot(px - x, py - y);
}

for (let y = 0; y < size; y += 1) {
  const row = y * (size * 4 + 1);
  raw[row] = 0;
  for (let x = 0; x < size; x += 1) {
    const px = x + 0.5;
    const py = y + 0.5;
    const onCheck =
      distToSegment(px, py, size * 0.3, size * 0.52, size * 0.45, size * 0.68) < size * 0.045 ||
      distToSegment(px, py, size * 0.45, size * 0.68, size * 0.72, size * 0.34) < size * 0.045;
    const i = row + 1 + x * 4;
    if (onCheck) {
      raw[i] = 255;
      raw[i + 1] = 255;
      raw[i + 2] = 255;
      raw[i + 3] = 255;
    } else {
      raw[i] = 34;
      raw[i + 1] = 197;
      raw[i + 2] = 94;
      raw[i + 3] = 255;
    }
  }
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(body));
  return Buffer.concat([length, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(size, 0);
ihdr.writeUInt32BE(size, 4);
ihdr[8] = 8;
ihdr[9] = 6;

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = path.join(root, 'frontend', 'assets');
fs.mkdirSync(assets, { recursive: true });
fs.writeFileSync(path.join(assets, 'icon.png'), png);
console.log('wrote', path.join(assets, 'icon.png'));
