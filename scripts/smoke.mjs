// Headless Chrome smoke testi: konsol hatalarini toplar, tus basar, durumu okur, ekran goruntusu alir.
// Kullanim: node scripts/smoke.mjs [url] [cikti.png]
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = process.argv[2] ?? "http://localhost:5173/";
const OUT = process.argv[3] ?? "smoke.png";
const PORT = 9333;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--autoplay-policy=no-user-gesture-required",
    "--enable-unsafe-swiftshader",
    "--use-angle=swiftshader",
    "--window-size=1100,760",
    "--user-data-dir=" + process.env.TEMP + "\\opencode\\chrome-smoke-" + process.pid,
    "about:blank",
  ],
  { stdio: "ignore" },
);

const cleanup = () => {
  try {
    chrome.kill();
  } catch {}
};
process.on("exit", cleanup);

let targets = null;
for (let i = 0; i < 40; i++) {
  try {
    targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    if (targets.some((t) => t.type === "page")) break;
  } catch {}
  await sleep(250);
}
if (!targets) {
  console.log("FAIL: Chrome CDP acilmadi");
  process.exit(1);
}

const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.onopen = res;
  ws.onerror = rej;
});

let id = 0;
const pending = new Map();
const logs = [];
const errors = [];

ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
    return;
  }
  if (msg.method === "Runtime.consoleAPICalled") {
    const text = msg.params.args.map((a) => a.value ?? a.description ?? "").join(" ");
    logs.push(`[${msg.params.type}] ${text}`);
    if (msg.params.type === "error") errors.push(text);
  }
  if (msg.method === "Runtime.exceptionThrown") {
    errors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
  }
  if (msg.method === "Log.entryAdded") {
    logs.push(`[log:${msg.params.entry.level}] ${msg.params.entry.text}`);
    if (msg.params.entry.level === "error") errors.push(msg.params.entry.text);
  }
};

const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const mid = ++id;
    pending.set(mid, { res, rej });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });

const key = async (type, k, code, vk, text) => {
  await send("Input.dispatchKeyEvent", {
    type,
    key: k,
    code,
    windowsVirtualKeyCode: vk,
    nativeVirtualKeyCode: vk,
    ...(text ? { text } : {}),
  });
};
const tap = async (k, code, vk, text) => {
  await key("keyDown", k, code, vk, text);
  await key("keyUp", k, code, vk);
};

const evalJS = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
  if (r.exceptionDetails) return { error: r.exceptionDetails.text };
  return r.result?.value;
};

await send("Runtime.enable");
await send("Log.enable");
await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 960,
  height: 540,
  deviceScaleFactor: 1,
  mobile: false,
});
await send("Page.navigate", { url: URL });
await sleep(2500);

const dump = async () =>
  JSON.parse(
    await evalJS(`(() => {
      const p = window.get ? get("player")[0] : null;
      return JSON.stringify({
        canvas: !!document.querySelector("canvas"),
        scene: p ? "game" : (window.get ? (get("text").length ? "menu/over" : "?") : "?"),
        player: p ? { x: Math.round(p.pos.x), y: Math.round(p.pos.y) } : null,
        pigs: window.get ? get("enemy").map((e) => ({ x: Math.round(e.pos.x), y: Math.round(e.pos.y), dead: !!e.dead })) : [],
        coins: window.get ? get("coin").length : -1,
        solids: window.get ? get("solid").length : -1,
        hearts: window.get ? get("hudheart").length : -1,
        digits: window.get ? get("hudscore").map((s) => s.frame) : [],
        texts: window.get ? get("text").map((t) => t.text) : [],
      });
    })()`),
  );

console.log("menu:", JSON.stringify(await dump()));

const menuShot = await send("Page.captureScreenshot", { format: "png" });
writeFileSync(OUT.replace(/\.png$/, "-menu.png"), Buffer.from(menuShot.data, "base64"));

// menuden oyuna gec
await tap(" ", "Space", 32, " ");
await sleep(900);
console.log("oyun basi:", JSON.stringify(await dump()));

// saga kos + zipla
await key("keyDown", "ArrowRight", "ArrowRight", 39);
await sleep(650);
await tap(" ", "Space", 32, " ");
await sleep(420);
await tap(" ", "Space", 32, " ");
await sleep(420);
await key("keyUp", "ArrowRight", "ArrowRight", 39);
await sleep(300);

const afterRun = await dump();
console.log("kosu sonrasi:", JSON.stringify({ player: afterRun.player, coins: afterRun.coins, pigs: afterRun.pigs.length }));

await sleep(200);
const shot = await send("Page.captureScreenshot", { format: "png" });
mkdirSync("screenshots", { recursive: true });
writeFileSync(OUT, Buffer.from(shot.data, "base64"));
console.log("ekran goruntusu:", OUT);

// --- ziplama testi (space basili tutulur) ---
await evalJS(`window.__dbg.teleport(64, 244)`);
await sleep(500);
const y0 = await evalJS(`Math.round(get("player")[0].pos.y)`);
await key("keyDown", " ", "Space", 32, " ");
let minY = y0;
for (let i = 0; i < 14; i++) {
  await sleep(50);
  const y = await evalJS(`Math.round(get("player")[0].pos.y)`);
  if (y < minY) minY = y;
}
await key("keyUp", " ", "Space", 32);
await sleep(500);
console.log(`ziplama: ${y0} -> ${minY} (${y0 - minY}px yukseklik)`);

// --- testte diken kaynakli gurultuyu kaldir ---
await evalJS(`get("hazard").forEach((h) => destroy(h))`);

// --- kilic testi: domuzlari dondur, kilici dogrudan calistir ---
await evalJS(`get("enemy").forEach((e) => { e._savedSpeed = e.speed; e.speed = 0; })`);
const before = await dump();
await evalJS(`(() => {
  const p = get("player")[0];
  const e = get("enemy").find((e) => !e.dead);
  if (!p || !e) return false;
  p.pos = vec2(e.pos.x - 62, e.pos.y - 4);
  p.vel = vec2(0, 0);
  window.__dbg.attack();
  return true;
})()`);
await sleep(600);
const afterAttack = await dump();
console.log(
  "kilic:",
  JSON.stringify({
    pigsBefore: before.pigs.filter((p) => !p.dead).length,
    pigsDead: afterAttack.pigs.filter((p) => p.dead).length,
    digits: afterAttack.digits,
    dbg: await evalJS(`JSON.stringify(window.__dbg.state())`),
  }),
);

// --- stomp testi: domuzun ustune birak ---
console.log(
  "stomp oncesi:",
  await evalJS(`(() => { const p = get("player")[0]; const e = get("enemy").find(e => !e.dead); return JSON.stringify({p: p && [Math.round(p.pos.x), Math.round(p.pos.y)], e: e && [Math.round(e.pos.x), Math.round(e.pos.y)]}); })()`),
);
await evalJS(`(() => {
  const p = get("player")[0];
  const e = get("enemy").find((e) => !e.dead);
  if (!p || !e) return false;
  p.pos = vec2(e.pos.x + 2, e.pos.y - 70);
  p.vel = vec2(0, 220);
  return true;
})()`);
await sleep(250);
console.log(
  "stomp 250ms:",
  await evalJS(`(() => { const p = get("player")[0]; const e = get("enemy").find(e => !e.dead); return JSON.stringify({p: p && [Math.round(p.pos.x), Math.round(p.pos.y), Math.round(p.vel.y)], e: e && [Math.round(e.pos.x), Math.round(e.pos.y)]}); })()`),
);
await sleep(600);
const afterStomp = await dump();
await evalJS(`get("enemy").forEach((e) => { if (e._savedSpeed) e.speed = e._savedSpeed; })`);
console.log(
  "stomp:",
  JSON.stringify({
    pigsDead: afterStomp.pigs.filter((p) => p.dead).length,
    dbg: await evalJS(`JSON.stringify(window.__dbg.state())`),
    last: await evalJS(`JSON.stringify(window.__dbg.lastContact)`),
  }),
);

// --- tehlike testi: ilk dikeni bul, 5 kez ustune git -> game over ---
await evalJS(
  `(() => { if (!(get("hazard") || []).length) add([sprite("spike"), pos(300, 256), area({ shape: new Rect(vec2(6, 14), 20, 18) }), "hazard"]); return true; })()`,
);
const spike = JSON.parse(
  await evalJS(`(() => { const s = (get("hazard") || [])[0]; return s ? JSON.stringify({ x: Math.round(s.pos.x), y: Math.round(s.pos.y) }) : "null"; })()`),
);
console.log("diken:", JSON.stringify(spike));
for (let i = 0; i < 5; i++) {
  if (spike) await evalJS(`window.__dbg.teleport(${spike.x + 6}, ${spike.y - 40})`);
  await sleep(500);
  const d = await dump();
  console.log(`hazard ${i + 1}: can=${d.hearts}`);
  await sleep(1200);
}
await sleep(700);
const over = await dump();
console.log("game over:", JSON.stringify({ texts: over.texts, player: over.player }));

// --- yeniden basla: 10 bolumu kapidan gecerek bitir ---
await tap(" ", "Space", 32, " ");
await sleep(900);
for (let i = 1; i <= 10; i++) {
  const d = await dump();
  const door = JSON.parse(
    await evalJS(`(() => { const d = (get("door") || [])[0]; return d ? JSON.stringify({ x: Math.round(d.pos.x + 22), y: Math.round(d.pos.y + 20) }) : "null"; })()`),
  );
  if (!door) {
    console.log("oda", i, ": kapi yok");
    break;
  }
  console.log(
    "oda",
    i,
    "->",
    JSON.stringify({ texts: d.texts, pigs: d.pigs.length, coins: d.coins, hearts: d.hearts }),
  );
  if ([2, 5, 8, 10].includes(i)) {
    const shotN = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(OUT.replace(/\.png$/, `-oda${i}.png`), Buffer.from(shotN.data, "base64"));
  }
  await evalJS(`window.__dbg.teleport(${door.x}, ${door.y})`);
  await sleep(800);
}
await sleep(600);
console.log("final:", JSON.stringify(await dump()));

const errShot = await send("Page.captureScreenshot", { format: "png" });
writeFileSync(OUT.replace(/\.png$/, "-end.png"), Buffer.from(errShot.data, "base64"));

if (logs.length) console.log("\n--- konsol ---\n" + logs.slice(-20).join("\n"));
if (errors.length) {
  console.log("\nFAIL: " + errors.length + " hata");
  console.log(errors.slice(0, 10).join("\n"));
} else {
  console.log("\nOK: konsol hatasi yok");
}

ws.close();
cleanup();
process.exit(errors.length ? 1 : 0);


