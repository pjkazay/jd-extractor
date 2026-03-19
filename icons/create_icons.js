#!/usr/bin/env node
// create_icons.js — generates placeholder PNG icons for the extension.
// Run once with: node icons/create_icons.js
// Replace the generated files with proper artwork before publishing.

const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

// ── CRC32 ─────────────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (const b of buf) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ b) & 0xFF];
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ── PNG chunk ─────────────────────────────────────────────────────────────────

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const dataBytes = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const crcIn     = Buffer.concat([typeBytes, dataBytes]);
  const len = Buffer.alloc(4); len.writeUInt32BE(dataBytes.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(crcIn));
  return Buffer.concat([len, typeBytes, dataBytes, crc]);
}

// ── Minimal solid-color PNG ───────────────────────────────────────────────────

function makePNG(size, r, g, b) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8]  = 8; // bit depth
  ihdrData[9]  = 2; // color type: RGB
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  // Raw image data: filter byte (0x00) + RGB per row
  const raw = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    const row = y * (1 + size * 3);
    raw[row] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const px = row + 1 + x * 3;
      raw[px]     = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
    }
  }

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdrData),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Generate icons ────────────────────────────────────────────────────────────

// Indigo (#6366f1) placeholder
const [R, G, B] = [99, 102, 241];
const outDir = __dirname;

for (const size of [16, 48, 128]) {
  const filename = path.join(outDir, `icon${size}.png`);
  fs.writeFileSync(filename, makePNG(size, R, G, B));
  console.log(`Created ${filename}`);
}
