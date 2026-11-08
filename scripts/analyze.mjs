// Kullanim:
//   node scripts/analyze.mjs tiles public/assets/tiles/terrain.png [hucre]
//   node scripts/analyze.mjs bbox public/assets/king/idle.png 78
//   node scripts/analyze.mjs crop public/assets/tiles/terrain.png out.png col row [w h scale]
import { readFileSync } from "node:fs";
import { crop, decodePNG, savePNG, bbox, coverage } from "./pnglib.mjs";

const [mode, file, ...rest] = process.argv.slice(2);
const img = decodePNG(file);

if (mode === "tiles") {
  const cell = Number(rest[0] ?? 32);
  const cols = Math.floor(img.w / cell);
  const rows = Math.floor(img.h / cell);
  console.log(`${file}: ${img.w}x${img.h} -> ${cols} kolon x ${rows} satir (${cell}px)`);
  for (let r = 0; r < rows; r++) {
    let line = String(r).padStart(2) + " | ";
    for (let c = 0; c < cols; c++) {
      const cov = coverage(img, c * cell, r * cell, cell, cell);
      line += cov > 0.999 ? "#" : cov > 0.5 ? "+" : cov > 0.02 ? "." : " ";
    }
    console.log(line);
  }
  console.log("    " + " ".repeat(3) + [...Array(cols)].map((_, i) => i % 10).join(""));
}

if (mode === "bbox") {
  const fw = Number(rest[0] ?? 32);
  const frames = Math.floor(img.w / fw);
  console.log(`${file}: ${frames} kare, ${fw}x${img.h}`);
  for (let i = 0; i < frames; i++) {
    const b = bbox(img, i * fw, 0, fw, img.h);
    console.log(
      `  #${String(i).padStart(2)}  x=${b.x - i * fw}..${b.x - i * fw + b.w - 1}  y=${b.y}..${b.y + b.h - 1}  (${b.w}x${b.h})`,
    );
  }
}

if (mode === "crop") {
  const [out, col, row, w, h, scale] = rest;
  const cell = Number(w ?? 32);
  const cellH = Number(h ?? cell);
  const s = Number(scale ?? 4);
  savePNG(out, crop(img, Number(col) * cell, Number(row) * cellH, cell, cellH, s));
  console.log("yazildi:", out, `${cell * s}x${cellH * s}`);
}

if (mode === "region") {
  const [out, x, y, w, h, scale] = rest;
  savePNG(out, crop(img, Number(x), Number(y), Number(w), Number(h), Number(scale ?? 1)));
  console.log("yazildi:", out);
}

if (mode === "info") {
  console.log(`${file}: ${img.w}x${img.h}`);
}
