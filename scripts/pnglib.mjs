// PNG oku/yaz + analiz: bbox, tile coverage haritasi, kirpma/buyutme.
import { inflateSync, deflateSync } from "node:zlib";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

/* ------------------------------- decode -------------------------------- */
const channelsOf = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

export function decodePNG(path) {
  const buf = readFileSync(path);
  let pos = 8;
  let w = 0;
  let h = 0;
  let depth = 8;
  let colorType = 6;
  let interlace = 0;
  let palette = null;
  let trns = null;
  const idat = [];

  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      depth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "PLTE") palette = data;
    else if (type === "tRNS") trns = data;
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  if (interlace) throw new Error("interlaced PNG desteklenmiyor");
  if (depth !== 8) throw new Error("bit derinligi " + depth + " desteklenmiyor");

  const raw = inflateSync(Buffer.concat(idat));
  const ch = channelsOf[colorType];
  const stride = w * ch;
  const out = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride);
  let p = 0;

  for (let y = 0; y < h; y++) {
    const filter = raw[p++];
    const cur = Buffer.from(raw.subarray(p, p + stride));
    p += stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0;
      const b = prev[i];
      const c = i >= ch ? prev[i - ch] : 0;
      let v = cur[i];
      if (filter === 1) v = (v + a) & 255;
      else if (filter === 2) v = (v + b) & 255;
      else if (filter === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (filter === 4) {
        const pa = Math.abs(b - c);
        const pb = Math.abs(a - c);
        const pc = Math.abs(a + b - 2 * c);
        const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        v = (v + pr) & 255;
      }
      cur[i] = v;
    }
    for (let x = 0; x < w; x++) {
      let r = 0;
      let g = 0;
      let bl = 0;
      let al = 255;
      if (colorType === 6) {
        r = cur[x * 4]; g = cur[x * 4 + 1]; bl = cur[x * 4 + 2]; al = cur[x * 4 + 3];
      } else if (colorType === 2) {
        r = cur[x * 3]; g = cur[x * 3 + 1]; bl = cur[x * 3 + 2];
      } else if (colorType === 0) {
        r = g = bl = cur[x];
      } else if (colorType === 4) {
        r = g = bl = cur[x * 2]; al = cur[x * 2 + 1];
      } else if (colorType === 3) {
        const idx = cur[x];
        r = palette[idx * 3]; g = palette[idx * 3 + 1]; bl = palette[idx * 3 + 2];
        al = trns && idx < trns.length ? trns[idx] : 255;
      }
      const o = (y * w + x) * 4;
      out[o] = r; out[o + 1] = g; out[o + 2] = bl; out[o + 3] = al;
    }
    prev = cur;
  }
  return { w, h, data: out };
}

/* ------------------------------- encode -------------------------------- */
const CRC = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC[n] = c;
}
const crc32 = (buf) => {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (type, data) => {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(body));
  return Buffer.concat([head, body, tail]);
};

export function encodePNG(w, h, rgba) {
  const stride = w * 4 + 1;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * stride + 1, y * w * 4, (y + 1) * w * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* -------------------------------- util --------------------------------- */
export const savePNG = (path, img) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, encodePNG(img.w, img.h, img.data));
};

export function crop(img, sx, sy, w, h, scale = 1) {
  const out = { w: w * scale, h: h * scale, data: Buffer.alloc(w * scale * h * scale * 4) };
  for (let y = 0; y < h * scale; y++) {
    for (let x = 0; x < w * scale; x++) {
      const si = ((sy + Math.floor(y / scale)) * img.w + (sx + Math.floor(x / scale))) * 4;
      const di = (y * out.w + x) * 4;
      img.data.copy(out.data, di, si, si + 4);
    }
  }
  return out;
}

export function bbox(img, x0, y0, w, h) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = img.data[((y0 + y) * img.w + (x0 + x)) * 4 + 3];
      if (a > 8) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { x: x0 + minX, y: y0 + minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

export const coverage = (img, x0, y0, w, h) => {
  let solid = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (img.data[((y0 + y) * img.w + (x0 + x)) * 4 + 3] > 8) solid++;
    }
  }
  return solid / (w * h);
};
