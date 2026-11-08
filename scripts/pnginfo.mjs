import { openSync, readSync, closeSync } from "node:fs";
const files = process.argv.slice(2);
for (const p of files) {
  const fd = openSync(p, "r");
  const b = Buffer.alloc(33);
  readSync(fd, b, 0, 33, 0);
  closeSync(fd);
  console.log(p, "w=" + b.readUInt32BE(16), "h=" + b.readUInt32BE(20), "depth=" + b[24], "colorType=" + b[25]);
}
