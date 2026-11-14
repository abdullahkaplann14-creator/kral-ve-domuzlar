// Kale temali ozgun chiptune dongusu uretir (telifsiz, CC0).
// Cikti: public/assets/music/castle.wav  (8 bar, A minör, 128 BPM, dongu)
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const OUT = join("public", "assets", "music", "castle.wav");
const RATE = 22050;
const BPM = 128;
const BEAT = 60 / BPM;
const STEP = BEAT / 2; // sekizlik
const BARS = 8;
const STEPS = BARS * 8;
const DUR = STEPS * STEP;

let seed = 1234567;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

const buf = new Float32Array(Math.ceil(DUR * RATE) + RATE);

/* ------------------------------- enstruman ------------------------------ */
const tone = (t, freq, type) => {
  const p = (t * freq) % 1;
  if (type === "square") return p < 0.5 ? 1 : -1;
  if (type === "pulse") return p < 0.25 ? 1 : -1;
  if (type === "tri") return 1 - 4 * Math.abs(p - 0.5);
  if (type === "saw") return p * 2 - 1;
  return Math.sin(2 * Math.PI * p);
};

function note(step, freq, dur, amp, type = "square", decay = 3.2) {
  const start = Math.floor(step * STEP * RATE);
  const len = Math.floor(dur * RATE);
  for (let i = 0; i < len && start + i < buf.length; i++) {
    const t = i / RATE;
    const attack = Math.min(1, t / 0.008);
    const env = attack * Math.exp(-t * decay);
    buf[start + i] += tone(t, freq, type) * env * amp;
  }
}

function kick(step) {
  const start = Math.floor(step * STEP * RATE);
  const len = Math.floor(0.16 * RATE);
  for (let i = 0; i < len; i++) {
    const t = i / RATE;
    const f = 130 * Math.exp(-t * 18) + 42;
    buf[start + i] += Math.sin(2 * Math.PI * t * f) * Math.exp(-t * 9) * 0.55;
  }
}

function snare(step) {
  const start = Math.floor(step * STEP * RATE);
  const len = Math.floor(0.12 * RATE);
  for (let i = 0; i < len; i++) {
    const t = i / RATE;
    const env = Math.exp(-t * 26);
    buf[start + i] += ((rnd() * 2 - 1) * 0.7 + Math.sin(2 * Math.PI * 190 * t) * 0.3) * env * 0.28;
  }
}

function hat(step, amp) {
  const start = Math.floor(step * STEP * RATE);
  const len = Math.floor(0.035 * RATE);
  for (let i = 0; i < len; i++) {
    const t = i / RATE;
    buf[start + i] += (rnd() * 2 - 1) * Math.exp(-t * 70) * 0.14 * amp;
  }
}

/* ------------------------------- akorlar -------------------------------- */
// 2 bar = 16 step; Am - F - C - G
const CHORDS = [
  { root: 110.0, notes: [220.0, 261.63, 329.63] }, // Am
  { root: 87.31, notes: [174.61, 220.0, 261.63] }, // F
  { root: 130.81, notes: [196.0, 261.63, 329.63] }, // C
  { root: 98.0, notes: [196.0, 246.94, 293.66] }, // G
];
const ARP = [0, 1, 2, 1, 0, 2, 1, 2];

for (let step = 0; step < STEPS; step++) {
  const ch = CHORDS[Math.floor(step / 16) % CHORDS.length];
  const inBar = step % 8;

  // bas: her vurusun ilk yarisinda kok, ucuncude besli
  if (inBar === 0 || inBar === 4) note(step, ch.root, STEP * 1.7, 0.3, "tri", 2.2);
  if (inBar === 6) note(step, ch.root * 1.5, STEP * 0.9, 0.2, "tri", 3.0);

  // arpej
  const idx = ARP[step % ARP.length];
  const octave = Math.floor(step / 32) % 2 === 1 ? 2 : 1;
  note(step, ch.notes[idx] * octave, STEP * 0.95, 0.13, "pulse", 5.0);

  // melodi: her 2 barda bir uzun nota
  if (step % 16 === 8) {
    const lead = ch.notes[2] * (Math.floor(step / 16) % 2 ? 4 : 2);
    note(step, lead, STEP * 3, 0.1, "square", 1.6);
  }

  // davul
  if (inBar === 0 || inBar === 4) kick(step);
  if (inBar === 2 || inBar === 6) snare(step);
  hat(step, inBar % 2 === 1 ? 1 : 0.5);
}

/* ------------------------------- master --------------------------------- */
const fadeIn = Math.floor(0.02 * RATE);
const fadeOut = Math.floor(0.04 * RATE);
const total = Math.floor(DUR * RATE);
for (let i = 0; i < fadeIn; i++) buf[i] *= i / fadeIn;
for (let i = 0; i < fadeOut; i++) buf[total - 1 - i] *= i / fadeOut;

let peak = 0;
for (let i = 0; i < total; i++) peak = Math.max(peak, Math.abs(buf[i]));
const gain = peak > 0 ? 0.82 / peak : 1;

const data = Buffer.alloc(44 + total * 2);
data.write("RIFF", 0);
data.writeUInt32LE(36 + total * 2, 4);
data.write("WAVE", 8);
data.write("fmt ", 12);
data.writeUInt32LE(16, 16);
data.writeUInt16LE(1, 20);
data.writeUInt16LE(1, 22);
data.writeUInt32LE(RATE, 24);
data.writeUInt32LE(RATE * 2, 28);
data.writeUInt16LE(2, 32);
data.writeUInt16LE(16, 34);
data.write("data", 36);
data.writeUInt32LE(total * 2, 40);
for (let i = 0; i < total; i++) {
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, buf[i] * gain)) * 32767), 44 + i * 2);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, data);
console.log(`${OUT} yazildi: ${(data.length / 1024).toFixed(0)} KB, ${DUR.toFixed(1)} sn dongu`);
