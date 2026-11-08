// Kings and Pigs paketini public/assets altina, kodun bekledigi isimlerle kopyalar.
// Kaynak: asset-havuzu/kings-and-pigs (ZIP'ten cikarilmis hali) veya Downloads'taki ZIP.
import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readSync,
  rmSync,
  statSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { basename, dirname, join } from "node:path";

const SRC = join("asset-havuzu", "kings-and-pigs");
const ZIP = join(process.env.USERPROFILE ?? ".", "Downloads", "Kings and Pigs.zip");
const OUT = join("public", "assets");

if (!existsSync(SRC)) {
  if (!existsSync(ZIP)) {
    console.error("Kings and Pigs kaynagi bulunamadi.");
    process.exit(1);
  }
  mkdirSync(SRC, { recursive: true });
  execFileSync(
    "powershell",
    ["-NoProfile", "-Command", `Expand-Archive -LiteralPath '${ZIP}' -DestinationPath '${SRC}' -Force`],
    { stdio: "inherit" },
  );
}

const pngSize = (p) => {
  const fd = openSync(p, "r");
  const b = Buffer.alloc(24);
  readSync(fd, b, 0, 24, 0);
  closeSync(fd);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
};

const spriteRoot = join(SRC, "Sprites");

const copyStrip = (from, to, frameW) => {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  const { w, h } = pngSize(to);
  const frames = Math.round(w / frameW);
  console.log(
    `${to.replace(/\\/g, "/").padEnd(34)} ${String(w + "x" + h).padEnd(9)} kare=${String(frames).padStart(2)} (${frameW}px)`,
  );
  return frames;
};

const copyOne = (from, to) => {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  const { w, h } = pngSize(to);
  console.log(`${to.replace(/\\/g, "/").padEnd(34)} ${w}x${h}`);
};

const anims = (dir, frameW, prefix, dest, keep) => {
  for (const f of readdirSync(dir)) {
    if (!f.toLowerCase().endsWith(".png")) continue;
    const key = basename(f, ".png").replace(/\(.*?\)/g, "").trim().toLowerCase().replace(/\s+/g, "_");
    if (keep && !keep.includes(key)) continue;
    copyStrip(join(dir, f), join(OUT, dest, `${key}.png`), frameW);
  }
};

console.log("--- King Human (78x58) ---");
anims(
  join(spriteRoot, "01-King Human"),
  78,
  "king",
  "king",
  ["idle", "run", "jump", "fall", "hit", "dead", "attack", "ground"],
);

console.log("\n--- Pig (34x28) ---");
anims(
  join(spriteRoot, "03-Pig"),
  34,
  "pig",
  "pig",
  ["idle", "run", "jump", "fall", "hit", "dead", "attack", "ground"],
);

console.log("\n--- King Pig (38x28) ---");
anims(
  join(spriteRoot, "02-King Pig"),
  38,
  "king_pig",
  "king_pig",
  ["idle", "run", "jump", "fall", "hit", "dead", "attack"],
);

console.log("\n--- Bomba atan domuz (26x26) ---");
anims(join(spriteRoot, "05-Pig Thowing a Bomb"), 26, "bomb_pig", "bomb_pig", [
  "idle",
  "run",
  "picking_bomb",
  "throwing_boom",
]);

console.log("\n--- UI / toplanabilirler ---");
const uiDir = join(spriteRoot, "12-Live and Coins");
for (const [file, out] of [
  ["Small Diamond (18x14).png", "ui/coin.png"],
  ["Big Diamond Idle (18x14).png", "ui/diamond.png"],
  ["Small Heart Idle (18x14).png", "ui/heart.png"],
  ["Live Bar.png", "ui/live_bar.png"],
  ["Numbers (6x8).png", "ui/numbers.png"],
]) {
  const p = join(uiDir, file);
  if (existsSync(p)) copyOne(p, join(OUT, out));
}

console.log("\n--- Tileset / dekor ---");
const tilesDir = join(spriteRoot, "14-TileSets");
for (const [file, out] of [
  ["Terrain (32x32).png", "tiles/terrain.png"],
  ["Decorations (32x32).png", "tiles/decor.png"],
]) {
  const p = join(tilesDir, file);
  if (existsSync(p)) {
    const size = pngSize(p);
    copyOne(p, join(OUT, out));
    console.log(`   grid: ${size.w / 32} x ${size.h / 32} kare`);
  }
}

console.log("\n--- Props ---");
for (const [dirName, file, out] of [
  ["08-Box", "Idle.png", "props/box.png"],
  ["09-Bomb", "Bomb On (52x56).png", "props/bomb.png"],
  ["09-Bomb", "Boooooom (52x56).png", "props/boom.png"],
  ["10-Cannon", "Idle.png", "props/cannon.png"],
  ["11-Door", "Idle.png", "props/door.png"],
  ["11-Door", "Opening (46x56).png", "props/door_open.png"],
]) {
  const p = join(spriteRoot, dirName, file);
  if (existsSync(p)) copyOne(p, join(OUT, out));
}

console.log("\nTamam. Kare sayilari yukarida; main.js bunlara gore guncellenmeli.");
