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

// --- kilic testi: oyuncuyu domuzun yanina koy, kilici dogrudan calistir ---
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
console.log(
  "stomp:",
  JSON.stringify({
    pigsDead: afterStomp.pigs.filter((p) => p.dead).length,
    dbg: await evalJS(`JSON.stringify(window.__dbg.state())`),
  }),
);

// --- oda gecisi testi: room 1 kapisina isinla ---
await evalJS(`window.__dbg.teleport(1786, 260)`);
await sleep(900);
const room2 = await dump();
console.log("oda gecisi:", JSON.stringify({ texts: room2.texts, coins: room2.coins, pigs: room2.pigs.length, hearts: room2.hearts }));
const shot2 = await send("Page.captureScreenshot", { format: "png" });
writeFileSync(OUT.replace(/\.png$/, "-room2.png"), Buffer.from(shot2.data, "base64"));

// --- tehlike / can testi (oda 2 dikenleri): 5 kez -> game over ---
for (let i = 0; i < 5; i++) {
  await evalJS(`window.__dbg.teleport(840, 290)`);
  await sleep(450);
  const d = await dump();
  console.log(`hazard ${i + 1}: can=${d.hearts}`);
  await sleep(1150);
}
await sleep(600);
console.log("son:", JSON.stringify(await dump()));

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
