// Kings and Pigs paletinde castle tile + arka plan + sfx uretir.
// (PA1 placeholder'lari artik uretilmiyor; gerekirse npm run import:pa1 kullanilir.)
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const OUT = "public/assets";

/* ----------------------------- PNG encoder ----------------------------- */
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
const encodePNG = (w, h, rgba) => {
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
};

/* ------------------------------- canvas -------------------------------- */
class Canvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.buf = Buffer.alloc(w * h * 4);
  }
  px(x, y, c) {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.buf[i] = c[0];
    this.buf[i + 1] = c[1];
    this.buf[i + 2] = c[2];
    this.buf[i + 3] = c.length > 3 ? c[3] : 255;
  }
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
  }
  ellipse(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.px(x, y, c);
      }
    }
  }
  tri(cx, tipY, baseY, halfW, c) {
    for (let y = tipY; y <= baseY; y++) {
      const t = (y - tipY) / Math.max(1, baseY - tipY);
      const w = Math.max(1, Math.round(halfW * t));
      this.rect(cx - w, y, w * 2, 1, c);
    }
  }
  save(path) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, encodePNG(this.w, this.h, this.buf));
    console.log("  +", path);
  }
}

let seed = 20261108;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

/* ------------------------- Kings and Pigs paleti ------------------------ */
const P = {
  mortar: [52, 38, 56, 255],
  brick: [198, 122, 114, 255],
  brickLt: [232, 162, 143, 255],
  brickDk: [156, 88, 84, 255],
  stone: [126, 100, 132, 255],
  stoneLt: [168, 140, 172, 255],
  stoneDk: [88, 66, 96, 255],
  deep: [40, 30, 48, 255],
  sky: [26, 36, 66, 255],
  skyLt: [44, 62, 104, 255],
  moon: [240, 232, 200, 255],
  flame: [255, 176, 72, 255],
  flameLt: [255, 232, 150, 255],
};

/* ------------------------------- brick yardimcisi ---------------------- */
function bricks(c, x0, y0, w, h, base, lt, dk, mortar, bw = 16, bh = 8) {
  c.rect(x0, y0, w, h, mortar);
  for (let row = 0, y = y0; y < y0 + h; row++, y += bh) {
    const off = (row % 2) * (bw / 2);
    for (let x = x0 - bw + off; x < x0 + w; x += bw) {
      c.rect(x + 1, y + 1, bw - 2, bh - 2, base);
      c.rect(x + 1, y + 1, bw - 2, 1, lt);
      c.rect(x + 1, y + bh - 2, bw - 2, 1, dk);
    }
  }
}

/* --------------------------------- tiles -------------------------------- */
{
  const c = new Canvas(32, 32);
  bricks(c, 0, 6, 32, 26, P.brick, P.brickLt, P.brickDk, P.mortar);
  c.rect(0, 0, 32, 6, P.stone);
  c.rect(0, 0, 32, 2, P.stoneLt);
  c.rect(0, 5, 32, 2, P.stoneDk);
  for (let x = 0; x < 32; x += 16) c.rect(x, 0, 1, 6, P.stoneDk);
  c.save(join(OUT, "ground.png"));
}

{
  const c = new Canvas(32, 32);
  bricks(c, 0, 0, 32, 32, [118, 68, 68, 255], [150, 92, 86, 255], P.mortar, P.deep);
  for (let i = 0; i < 10; i++) c.rect(rnd() * 30, rnd() * 30, 2, 2, P.mortar);
  c.save(join(OUT, "dirt.png"));
}

{
  const c = new Canvas(32, 32);
  c.rect(0, 0, 32, 32, P.deep);
  c.rect(0, 0, 32, 12, P.stone);
  c.rect(0, 0, 32, 3, P.stoneLt);
  c.rect(0, 10, 32, 3, P.stoneDk);
  bricks(c, 4, 15, 24, 16, P.brickDk, P.brick, P.mortar, P.deep, 12, 8);
  c.save(join(OUT, "platform.png"));
}

{
  const c = new Canvas(32, 32);
  for (const cx of [6, 16, 26]) {
    c.tri(cx, 6, 27, 6.4, [30, 24, 38, 255]);
    c.tri(cx, 8, 27, 5, [198, 202, 216, 255]);
    c.tri(cx, 8, 27, 2, [128, 134, 152, 255]);
  }
  c.rect(0, 27, 32, 5, [44, 34, 52, 255]);
  c.rect(0, 27, 32, 1, [92, 76, 104, 255]);
  c.save(join(OUT, "spike.png"));
}

/* ------------------------------ arka plan ------------------------------- */
{
  const w = 1280;
  const h = 360;
  const c = new Canvas(w, h);
  for (let y = 0; y < h; y++) {
    const t = y / h;
    c.rect(0, y, w, 1, [
      Math.round(30 + t * 18),
      Math.round(22 + t * 12),
      Math.round(40 + t * 16),
      255,
    ]);
  }
  // soluk tugla dokusu
  for (let row = 0, y = 0; y < h; row++, y += 16) {
    const off = (row % 2) * 16;
    for (let x = -32 + off; x < w; x += 32) {
      c.rect(x + 1, y + 1, 30, 1, [42, 32, 52, 255]);
      c.rect(x + 1, y + 14, 30, 1, [34, 26, 44, 255]);
    }
  }
  // kemerli pencereler
  for (const [cx, top, ww, hh] of [
    [150, 60, 90, 170],
    [470, 46, 104, 190],
    [790, 70, 84, 160],
    [1080, 56, 96, 176],
  ]) {
    const x = cx - ww / 2;
    const r = ww / 2;
    // pencere govdesi
    c.ellipse(cx, top + r, r, r, P.sky);
    c.rect(x, top + r, ww, hh - r, P.sky);
    // ay
    c.ellipse(cx + ww * 0.16, top + r * 0.9, r * 0.34, r * 0.34, P.moon);
    c.ellipse(cx + ww * 0.22, top + r * 0.82, r * 0.3, r * 0.3, P.sky);
    // yildizlar
    for (let i = 0; i < 9; i++) {
      c.rect(x + 10 + rnd() * (ww - 20), top + 14 + rnd() * (hh * 0.5), 2, 2, [180, 200, 240, 255]);
    }
    // tugla cerceve
    c.ellipse(cx, top + r, r + 6, r + 6, [0, 0, 0, 0]);
    for (let a = 0; a <= 180; a += 3) {
      const rad = (a * Math.PI) / 180;
      c.ellipse(cx + Math.cos(rad) * (r + 3), top + r - Math.sin(rad) * (r + 3), 4, 4, P.stoneDk);
    }
    c.rect(x - 6, top + r, 6, hh - r, P.stoneDk);
    c.rect(x + ww, top + r, 6, hh - r, P.stoneDk);
    c.rect(x - 6, top + hh - 6, ww + 12, 6, P.stoneDk);
  }
  c.save(join(OUT, "bg", "castle.png"));
}

{
  const w = 1280;
  const h = 360;
  const c = new Canvas(w, h);
  for (const x of [110, 380, 640, 940, 1180]) {
    c.rect(x - 26, 26, 52, 12, P.stoneDk);
    c.rect(x - 26, 26, 52, 3, P.stone);
    c.rect(x - 20, 38, 40, 322, [56, 42, 66, 255]);
    c.rect(x - 20, 38, 8, 322, [76, 58, 88, 255]);
    c.rect(x + 12, 38, 8, 322, [42, 32, 52, 255]);
    for (let y = 60; y < 340; y += 40) c.rect(x - 20, y, 40, 2, [46, 34, 58, 255]);
    c.rect(x - 26, 340, 52, 20, P.stoneDk);
  }
  c.save(join(OUT, "bg", "pillars.png"));
}

/* ---------------------------------- ses --------------------------------- */
const RATE = 22050;
const wav = (path, make) => {
  const n = Math.floor(RATE * 0.8);
  const samples = new Float32Array(n);
  make(samples, RATE);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(RATE, 24);
  buf.writeUInt32LE(RATE * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buf);
  console.log("  +", path);
};

const square = (phase) => (phase % 1 < 0.5 ? 1 : -1);

wav(join(OUT, "sfx", "jump.wav"), (s, rate) => {
  const dur = 0.16;
  for (let i = 0; i < rate * dur; i++) {
    const t = i / rate;
    const f = 260 + 520 * (t / dur);
    s[i] = square(t * f) * 0.26 * (1 - t / dur);
  }
});

wav(join(OUT, "sfx", "coin.wav"), (s, rate) => {
  const dur = 0.22;
  for (let i = 0; i < rate * dur; i++) {
    const t = i / rate;
    const f = t < 0.07 ? 1046 : 1568;
    const env = Math.max(0, 1 - t / dur) ** 1.5;
    s[i] = (square(t * f) * 0.55 + Math.sin(2 * Math.PI * t * f * 2) * 0.45) * 0.22 * env;
  }
});

wav(join(OUT, "sfx", "hit.wav"), (s, rate) => {
  const dur = 0.28;
  for (let i = 0; i < rate * dur; i++) {
    const t = i / rate;
    const f = 300 * Math.exp(-t * 9) + 55;
    s[i] = (Math.sin(2 * Math.PI * t * f) * 0.7 + (rnd() * 2 - 1) * 0.5) * 0.3 * Math.exp(-t * 7);
  }
});

wav(join(OUT, "sfx", "slash.wav"), (s, rate) => {
  const dur = 0.16;
  for (let i = 0; i < rate * dur; i++) {
    const t = i / rate;
    const n = rnd() * 2 - 1;
    s[i] = (n * 0.6 + Math.sin(2 * Math.PI * t * (900 - 2600 * t)) * 0.4) * 0.3 * (1 - t / dur);
  }
});

wav(join(OUT, "sfx", "stomp.wav"), (s, rate) => {
  const dur = 0.18;
  for (let i = 0; i < rate * dur; i++) {
    const t = i / rate;
    const f = 180 * Math.exp(-t * 12) + 40;
    s[i] = Math.sin(2 * Math.PI * t * f) * 0.4 * Math.exp(-t * 9);
  }
});

wav(join(OUT, "sfx", "death.wav"), (s, rate) => {
  const dur = 0.7;
  for (let i = 0; i < rate * dur; i++) {
    const t = i / rate;
    const f = 480 * Math.exp(-t * 4) + 45;
    s[i] = (square(t * f) * 0.5 + Math.sin(2 * Math.PI * t * f * 0.5) * 0.5) * 0.28 * (1 - t / dur);
  }
});

console.log("\nCastle asset uretimi tamam.");



