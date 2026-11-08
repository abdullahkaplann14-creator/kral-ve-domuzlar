// Asset havuzunu denetler: PNG boyutu + kac kare oldugunu soyler.
// Kullanim: node scripts/assets.mjs [klasor]   (varsayilan: public/assets)
import { openSync, readSync, closeSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const pngSize = (p) => {
  const fd = openSync(p, "r");
  const b = Buffer.alloc(24);
  readSync(fd, b, 0, 24, 0);
  closeSync(fd);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
};

const walk = (dir) => {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.toLowerCase().endsWith(".png")) {
      const { w, h } = pngSize(p);
      const frames = h === 32 && w > 32 ? w / 32 : 1;
      console.log(
        `${String(w).padStart(4)}x${String(h).padEnd(4)} kare=${String(frames).padStart(2)}  ${p}`,
      );
    }
  }
};

walk(process.argv[2] ?? "public/assets");
