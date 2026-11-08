// Pixel Adventure 1 ile birebir uyumlu placeholder asset üreteci.
// Kare sayıları gerçek paketle aynı: idle 11, run 12, jump 1, fall 1, hit 7.
// Gerçek paket gelince public/assets altındaki PNG'lerin üzerine yazmak yeterli.
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
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
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
const pick = (a) => a[Math.floor(rnd() * a.length)];

/* -------------------------------- palet -------------------------------- */
const C = {
  out: [31, 58, 24, 255],
  body: [79, 155, 54, 255],
  bodyLt: [108, 192, 74, 255],
  belly: [216, 238, 174, 255],
  white: [255, 255, 255, 255],
  black: [22, 28, 20, 255],
  stem: [96, 62, 32, 255],
  leaf: [70, 160, 60, 255],
  dirt: [122, 82, 56, 255],
  dirtDk: [95, 62, 42, 255],
  dirtLt: [146, 102, 70, 255],
  grass: [95, 174, 68, 255],
  grassDk: [63, 122, 46, 255],
  grassLt: [120, 201, 86, 255],
  stone: [90, 100, 114, 255],
  stoneLt: [142, 160, 180, 255],
  stoneDk: [62, 70, 82, 255],
  spike: [176, 186, 198, 255],
  spikeDk: [108, 118, 132, 255],
};

/* -------------------------------- frog --------------------------------- */
function drawFrog(c, ox, p = {}) {
  const { bob = 0, legA = 0, legB = 0, pupil = 1, dead = false } = p;
  const oy = bob;

  // arka ayaklar
  for (const [fx, fl] of [
    [10 + legA, 1],
    [22 + legB, -1],
  ]) {
    c.ellipse(ox + fx, 28 + oy, 4.5, 3, C.out);
    c.ellipse(ox + fx, 28 + oy, 3.5, 2.2, C.body);
    c.rect(ox + fx - 3, 29 + oy, 6, 1, C.bodyLt);
  }

  // gövde
  c.ellipse(ox + 16, 19 + oy, 10, 8.5, C.out);
  c.ellipse(ox + 16, 19 + oy, 9, 7.5, C.body);
  c.ellipse(ox + 14, 16.5 + oy, 5.5, 4, C.bodyLt);
  c.ellipse(ox + 16, 22.5 + oy, 6, 3.5, C.belly);

  // gözler
  for (const ex of [10, 22]) {
    c.ellipse(ox + ex, 8.5 + oy, 4.6, 4.6, C.out);
    c.ellipse(ox + ex, 8.5 + oy, 3.8, 3.8, C.white);
  }
  if (dead) {
    for (const ex of [10, 22]) {
      for (let i = -2; i <= 2; i++) {
        c.px(ox + ex + i, 8 + oy + i, C.black);
        c.px(ox + ex + i, 8 + oy - i, C.black);
      }
    }
  } else {
    c.ellipse(ox + 11 + pupil, 9 + oy, 1.9, 2.3, C.black);
    c.ellipse(ox + 23 + pupil, 9 + oy, 1.9, 2.3, C.black);
  }

  // burun + ağız
  c.px(ox + 14, 13 + oy, C.out);
  c.px(ox + 18, 13 + oy, C.out);
  c.rect(ox + 14, 16 + oy, 4, 1, C.out);
}

const makeFrogStrip = (frames, path, pose) => {
  const c = new Canvas(32 * frames, 32);
  for (let i = 0; i < frames; i++) drawFrog(c, i * 32, pose(i, frames));
  c.save(join(OUT, path));
};

makeFrogStrip(11, "frog/idle.png", (i, n) => ({
  bob: [0, -1, -1, 0, 0, 1, 1, 0][i % 8],
  legA: 0,
  legB: 0,
  pupil: 1,
}));

makeFrogStrip(12, "frog/run.png", (i, n) => {
  const s = Math.sin((i / n) * Math.PI * 2);
  return { bob: -Math.abs(s) > 0.5 ? -1 : 0, legA: Math.round(s * 3), legB: -Math.round(s * 3), pupil: 1 };
});

makeFrogStrip(1, "frog/jump.png", () => ({ bob: -1, legA: -2, legB: 2, pupil: 1 }));
makeFrogStrip(1, "frog/fall.png", () => ({ bob: 1, legA: 2, legB: -2, pupil: 1 }));

makeFrogStrip(7, "frog/hit.png", (i) => ({
  bob: [-1, 1, -1, 1, 0, 0, 0][i],
  legA: 3,
  legB: -3,
  dead: true,
}));

/* -------------------------------- meyveler ------------------------------ */
const fruit = (name, draw) => {
  const c = new Canvas(32, 32);
  draw(c);
  c.save(join(OUT, "fruits", `${name}.png`));
};

fruit("apple", (c) => {
  c.ellipse(16, 19, 9.5, 9, [150, 26, 26, 255]);
  c.ellipse(16, 19, 8.5, 8, [214, 46, 46, 255]);
  c.ellipse(12, 15, 3.2, 2.2, [255, 130, 120, 255]);
  c.rect(15, 6, 2, 6, C.stem);
  c.ellipse(21, 7.5, 4, 2.4, C.leaf);
});

fruit("banana", (c) => {
  for (let t = 0; t <= 1; t += 0.01) {
    const x = 7 + t * 18;
    const y = 8 + Math.sin(t * Math.PI) * 14;
    c.ellipse(x, y, 3, 3, [214, 168, 40, 255]);
    c.ellipse(x, y - 0.6, 2.4, 2.4, [255, 224, 102, 255]);
  }
  c.ellipse(7, 8, 2.4, 2.4, C.stem);
});

fruit("cherries", (c) => {
  c.rect(15, 6, 1, 12, [88, 132, 44, 255]);
  c.rect(11, 13, 1, 6, [88, 132, 44, 255]);
  c.rect(20, 12, 1, 7, [88, 132, 44, 255]);
  c.ellipse(16, 6, 4, 2, C.leaf);
  c.ellipse(11, 21, 6, 6, [140, 22, 34, 255]);
  c.ellipse(21, 21, 6, 6, [140, 22, 34, 255]);
  c.ellipse(11, 21, 5, 5, [214, 44, 62, 255]);
  c.ellipse(21, 21, 5, 5, [214, 44, 62, 255]);
  c.ellipse(9, 19, 1.8, 1.4, [255, 140, 150, 255]);
});

fruit("kiwi", (c) => {
  c.ellipse(16, 17, 10, 10, [120, 88, 48, 255]);
  c.ellipse(16, 17, 8.6, 8.6, [138, 186, 62, 255]);
  c.ellipse(16, 17, 4, 4, [240, 246, 210, 255]);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    c.ellipse(16 + Math.cos(a) * 6, 17 + Math.sin(a) * 6, 0.8, 1.6, C.black);
  }
});

fruit("melon", (c) => {
  c.ellipse(16, 17, 10, 10, [56, 108, 36, 255]);
  c.ellipse(16, 17, 8.6, 8.6, [108, 190, 74, 255]);
  for (const dx of [-5, -1.5, 2, 5.5]) {
    for (let y = 9; y < 26; y++) {
      const h = Math.sqrt(Math.max(0, 1 - ((y - 17) / 9) ** 2));
      if (Math.abs(dx) < h * 8) c.px(16 + dx, y, [72, 148, 56, 255]);
    }
  }
});

fruit("orange", (c) => {
  c.ellipse(16, 18, 9.5, 9.5, [190, 96, 16, 255]);
  c.ellipse(16, 18, 8.5, 8.5, [240, 148, 34, 255]);
  c.ellipse(12, 14, 3, 2.2, [255, 198, 96, 255]);
  for (let i = 0; i < 9; i++) c.px(9 + rnd() * 14, 11 + rnd() * 14, [214, 118, 20, 255]);
  c.ellipse(20, 7, 3.4, 2, C.leaf);
});

fruit("pineapple", (c) => {
  c.ellipse(16, 20, 8, 9.5, [190, 132, 26, 255]);
  c.ellipse(16, 20, 7, 8.5, [242, 186, 64, 255]);
  for (let y = 12; y < 29; y += 3) {
    for (let x = 10; x < 23; x += 3) c.px(x + ((y / 3) % 2), y, [190, 132, 26, 255]);
  }
  for (const dx of [-6, -2, 2, 6]) c.tri(16 + dx, 3 + Math.abs(dx) * 0.6, 13, 2.4, [72, 160, 70, 255]);
});

fruit("strawberry", (c) => {
  c.ellipse(16, 15, 9, 8, [190, 30, 44, 255]);
  c.tri(16, 16, 29, 8, [190, 30, 44, 255]);
  c.ellipse(16, 15, 8, 7, [224, 58, 66, 255]);
  c.tri(16, 16, 28, 7, [224, 58, 66, 255]);
  c.ellipse(12, 12, 3, 2, [255, 140, 140, 255]);
  for (let i = 0; i < 12; i++) c.px(10 + rnd() * 12, 12 + rnd() * 14, [255, 226, 120, 255]);
  for (const dx of [-6, -2, 2, 6]) c.tri(16 + dx, 4, 9, 2.2, [72, 160, 70, 255]);
});

/* -------------------------------- zemin -------------------------------- */
{
  const c = new Canvas(32, 32);
  c.rect(0, 0, 32, 32, C.dirt);
  for (let i = 0; i < 26; i++) {
    const x = rnd() * 31;
    const y = 10 + rnd() * 21;
    c.rect(x, y, 2, 2, rnd() > 0.5 ? C.dirtDk : C.dirtLt);
  }
  c.rect(0, 0, 32, 9, C.grass);
  c.rect(0, 8, 32, 2, C.grassDk);
  for (let x = 0; x < 32; x++) {
    const h = 3 + Math.round(rnd() * 3);
    c.rect(x, 9 - h, 1, h, C.grassLt);
  }
  c.save(join(OUT, "ground.png"));
}

{
  const c = new Canvas(32, 32);
  c.rect(0, 0, 32, 32, C.dirt);
  for (let i = 0; i < 34; i++) {
    const x = rnd() * 31;
    const y = rnd() * 31;
    c.rect(x, y, 2, 2, rnd() > 0.5 ? C.dirtDk : C.dirtLt);
  }
  c.save(join(OUT, "dirt.png"));
}

{
  const c = new Canvas(32, 32);
  c.rect(0, 0, 32, 32, C.stoneDk);
  c.rect(0, 0, 32, 12, C.stone);
  c.rect(0, 0, 32, 4, C.grass);
  c.rect(0, 3, 32, 1, C.grassDk);
  for (let x = 0; x < 32; x += 7) c.rect(x, 5, 1, 7, C.stoneDk);
  c.rect(0, 12, 32, 2, C.stoneLt);
  for (let i = 0; i < 10; i++) c.rect(rnd() * 30, 15 + rnd() * 15, 3, 2, C.stone);
  c.save(join(OUT, "platform.png"));
}

{
  const c = new Canvas(32, 32);
  for (const cx of [6, 16, 26]) {
    c.tri(cx, 7, 28, 6.4, [38, 44, 56, 255]);
    c.tri(cx, 9, 28, 5.2, C.spike);
    c.tri(cx, 9, 28, 2, C.spikeDk);
  }
  c.rect(0, 28, 32, 4, [58, 40, 44, 255]);
  c.rect(0, 28, 32, 1, [158, 74, 74, 255]);
  c.save(join(OUT, "spike.png"));
}

/* ------------------------------ arka plan ------------------------------ */
const lerp = (a, b, t) => a + (b - a) * t;

{
  const w = 960;
  const h = 360;
  const c = new Canvas(w, h);
  const top = [95, 184, 232];
  const bot = [214, 240, 255];
  for (let y = 0; y < h; y++) {
    const t = y / h;
    c.rect(0, y, w, 1, [lerp(top[0], bot[0], t), lerp(top[1], bot[1], t), lerp(top[2], bot[2], t), 255]);
  }
  // güneş
  c.ellipse(790, 66, 46, 46, [255, 248, 198, 120]);
  c.ellipse(790, 66, 32, 32, [255, 246, 176, 255]);
  // uzak dağlar
  for (const [x, tip, base, hw, col] of [
    [120, 130, 300, 130, [126, 170, 184, 255]],
    [330, 96, 300, 150, [112, 158, 176, 255]],
    [600, 138, 300, 120, [126, 170, 184, 255]],
    [860, 112, 300, 140, [112, 158, 176, 255]],
  ]) {
    c.tri(x, tip, base, hw, col);
    c.tri(x, tip, tip + 40, Math.round(hw * 0.28), [232, 244, 250, 255]);
  }
  // bulutlar
  for (const [x, y, s] of [
    [90, 60, 1],
    [380, 40, 0.8],
    [640, 96, 1.15],
    [880, 150, 0.7],
  ]) {
    for (const [dx, dy, r] of [
      [0, 0, 20],
      [22, 4, 15],
      [-22, 6, 13],
      [10, -10, 14],
    ]) {
      c.ellipse(x + dx * s, y + dy * s, r * s, r * s * 0.85, [255, 255, 255, 235]);
    }
  }
  c.save(join(OUT, "bg", "blue.png"));
}

{
  const w = 960;
  const h = 360;
  const c = new Canvas(w, h);
  // tepeler
  for (const [x, y, rx, ry, col] of [
    [140, 356, 250, 150, [70, 132, 76, 255]],
    [420, 366, 300, 175, [60, 118, 66, 255]],
    [740, 352, 260, 140, [70, 132, 76, 255]],
    [900, 370, 220, 150, [60, 118, 66, 255]],
  ]) c.ellipse(x, y, rx, ry, col);
  // çalılar
  for (const [x, y, s] of [
    [60, 300, 1],
    [250, 312, 0.8],
    [520, 296, 1.1],
    [820, 306, 0.9],
  ]) {
    for (const [dx, dy, r] of [
      [0, 0, 26],
      [22, 6, 18],
      [-22, 8, 16],
    ]) c.ellipse(x + dx * s, y + dy * s, r * s, r * s * 0.8, [52, 104, 58, 255]);
  }
  c.save(join(OUT, "bg", "hills.png"));
}

/* --------------------------------- ses --------------------------------- */
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
  const dur = 0.17;
  for (let i = 0; i < rate * dur; i++) {
    const t = i / rate;
    const f = 300 + 900 * (t / dur);
    const env = 1 - t / dur;
    s[i] = square(t * f) * 0.28 * env;
  }
});

wav(join(OUT, "sfx", "coin.wav"), (s, rate) => {
  const dur = 0.24;
  for (let i = 0; i < rate * dur; i++) {
    const t = i / rate;
    const f = t < 0.08 ? 988 : 1319;
    const env = Math.max(0, 1 - t / dur) ** 1.6;
    s[i] = (square(t * f) * 0.6 + Math.sin(2 * Math.PI * t * f * 2) * 0.4) * 0.22 * env;
  }
});

wav(join(OUT, "sfx", "hit.wav"), (s, rate) => {
  const dur = 0.3;
  for (let i = 0; i < rate * dur; i++) {
    const t = i / rate;
    const f = 320 * Math.exp(-t * 9) + 60;
    const env = Math.exp(-t * 7);
    s[i] = (Math.sin(2 * Math.PI * t * f) * 0.7 + (rnd() * 2 - 1) * 0.5) * 0.32 * env;
  }
});

wav(join(OUT, "sfx", "death.wav"), (s, rate) => {
  const dur = 0.7;
  for (let i = 0; i < rate * dur; i++) {
    const t = i / rate;
    const f = 520 * Math.exp(-t * 4) + 45;
    const env = 1 - t / dur;
    s[i] = (square(t * f) * 0.5 + Math.sin(2 * Math.PI * t * f * 0.5) * 0.5) * 0.3 * env;
  }
});

console.log("\nAsset üretimi tamam.");
