// Pixel Adventure 1 ZIP'ini asset-havuzu'na acar, gorselleri public/assets'e
// plandaki isimlerle kopyalar, kare sayilarini PNG genisliginden olcup
// src/main.js icindeki sliceX degerlerini otomatik gunceller.
//
// Kullanim:
//   node scripts/import-pa1.mjs                  (Downloads'ta PA1 zip'i arar)
//   node scripts/import-pa1.mjs "C:\yol\paket.zip"
import { execFileSync } from "node:child_process";
import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  readSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";

const DL = join(process.env.USERPROFILE ?? ".", "Downloads");
const POOL = join("asset-havuzu", "pixel-adventure-1");
const OUT = join("public", "assets");

/* --------------------------- zip bul / ac --------------------------- */
const findZip = () => {
  if (process.argv[2]) return process.argv[2];
  const cands = readdirSync(DL)
    .filter((f) => /\.zip$/i.test(f) && /pixel/i.test(f) && /adventure/i.test(f))
    .map((f) => ({
      path: join(DL, f),
      t: statSync(join(DL, f)).mtimeMs,
    }))
    .sort((a, b) => b.t - a.t);
  return cands[0]?.path;
};

const zip = findZip();
if (!zip || !existsSync(zip)) {
  console.error(
    "\nPixel Adventure 1 ZIP bulunamadi.\n" +
      "Indir: https://pixelfrog-assets.itch.io/pixel-adventure-1\n" +
      "Sonra: npm run import:pa1\n",
  );
  process.exit(1);
}
console.log("ZIP:", zip);

rmSync(POOL, { recursive: true, force: true });
mkdirSync(POOL, { recursive: true });
execFileSync(
  "powershell",
  ["-NoProfile", "-Command", `Expand-Archive -LiteralPath '${zip}' -DestinationPath '${POOL}' -Force`],
  { stdio: "inherit" },
);

/* ----------------------------- yardimcilar ---------------------------- */
const pngSize = (p) => {
  const fd = openSync(p, "r");
  const b = Buffer.alloc(24);
  readSync(fd, b, 0, 24, 0);
  closeSync(fd);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
};

const walkDirs = (root, out = []) => {
  for (const e of readdirSync(root)) {
    const p = join(root, e);
    if (statSync(p).isDirectory()) {
      out.push(p);
      walkDirs(p, out);
    }
  }
  return out;
};

const findDir = (root, re) => walkDirs(root).find((d) => re.test(basename(d)));

// "Run (32x32).png" -> "run", "Double Jump (32x32).png" -> "double_jump"
const animKey = (file) =>
  basename(file, ".png")
    .replace(/\(.*?\)/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

const copy = (from, to) => {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  return to;
};

const report = [];
const copyStrip = (from, to, frameW) => {
  copy(from, to);
  const { w, h } = pngSize(from);
  const frames = Math.round(w / frameW);
  report.push({ file: to.replace(/\\/g, "/"), size: `${w}x${h}`, frames, frameW });
  return frames;
};

/* ------------------------------- iskelet ------------------------------ */
const mainChars = findDir(POOL, /main characters/i);
const frogDir = mainChars && findDir(mainChars, /ninja frog/i);
const itemsDir = findDir(POOL, /^items$/i);
const fruitsDir = itemsDir && findDir(itemsDir, /fruits/i);
const bgDir = findDir(POOL, /^background$/i);
const terrainDir = findDir(POOL, /terrain/i);
const trapsDir = findDir(POOL, /traps/i);

if (!frogDir) {
  console.error("Ninja Frog klasoru bulunamadi. ZIP yapisi beklenenden farkli.");
  process.exit(1);
}

/* -------------------------------- frog -------------------------------- */
const frogFrames = {};
const FROG_KEEP = ["idle", "run", "jump", "fall", "hit"];
for (const f of readdirSync(frogDir)) {
  if (!f.toLowerCase().endsWith(".png")) continue;
  const key = animKey(f);
  if (key === "double_jump") {
    copy(join(frogDir, f), join(OUT, "frog", "double_jump.png"));
    continue;
  }
  if (!FROG_KEEP.includes(key)) continue;
  frogFrames[key] = copyStrip(join(frogDir, f), join(OUT, "frog", `${key}.png`), 32);
}
console.log("frog kareleri:", frogFrames);

/* ------------------------------- meyveler ----------------------------- */
const fruitNames = [];
if (fruitsDir) {
  for (const f of readdirSync(fruitsDir)) {
    if (!f.toLowerCase().endsWith(".png")) continue;
    let name = animKey(f); // "bananas" -> "bananas"
    if (name === "bananas") name = "banana";
    copy(join(fruitsDir, f), join(OUT, "fruits", `${name}.png`));
    fruitNames.push(name);
  }
  console.log("meyveler:", fruitNames.join(", "));
}

/* ------------------------------ arka plan ----------------------------- */
if (bgDir) {
  for (const f of readdirSync(bgDir)) {
    if (!f.toLowerCase().endsWith(".png")) continue;
    const key = animKey(f);
    if (key === "blue") copy(join(bgDir, f), join(OUT, "bg", "blue.png"));
  }
}

/* ------------------------------- terrain ------------------------------ */
let terrainSheet = null;
if (terrainDir) {
  const t = readdirSync(terrainDir).find((f) => /terrain/i.test(f) && f.endsWith(".png"));
  if (t) {
    terrainSheet = join(OUT, "terrain.png");
    copy(join(terrainDir, t), terrainSheet);
    console.log("terrain sheet:", terrainSheet, pngSize(terrainSheet));
  }
}

/* --------------------------------- tuzak ------------------------------- */
if (trapsDir) {
  for (const d of [trapsDir, ...walkDirs(trapsDir)]) {
    for (const f of readdirSync(d)) {
      if (!f.toLowerCase().endsWith(".png")) continue;
      const prefix = basename(d).toLowerCase().replace(/\s+/g, "_");
      const name = f.replace(/\s*\(.*?\)/g, "").replace(/\s+/g, "_").toLowerCase();
      copy(join(d, f), join(OUT, "traps", `${prefix}_${name}`));
    }
  }
}

/* -------------------------- main.js sliceX patch ----------------------- */
const mainPath = join("src", "main.js");
let code = readFileSync(mainPath, "utf8");
for (const [key, frames] of Object.entries(frogFrames)) {
  const re = new RegExp(`(strip\\("frog_${key}"[^)]*?, )\\d+`);
  code = code.replace(re, `$1${frames}`);
}
if (fruitNames.length) {
  code = code.replace(
    /const FRUITS = \[[^\]]*\];/,
    `const FRUITS = [${fruitNames.map((n) => `"${n}"`).join(", ")}];`,
  );
}
writeFileSync(mainPath, code);

/* -------------------------------- rapor -------------------------------- */
console.log("\n--- kopyalanan sprite seritleri ---");
for (const r of report) {
  console.log(
    `${r.file.padEnd(38)} ${r.size.padEnd(9)} kare=${String(r.frames).padStart(2)} (${r.frameW}px)`,
  );
}
console.log(`\nsrc/main.js guncellendi. ${frogFrames.idle ?? "?"} idle, ${frogFrames.run ?? "?"} run karesi.`);
console.log("Sonraki adim: npm run dev");
