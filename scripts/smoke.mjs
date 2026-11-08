// Headless Chrome smoke testi: konsol hatalarini toplar, tus basar, ekran goruntusu alir.
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
  { stdio: "ignore", detached: false },
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

const evalJS = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
  return r.result?.value;
};

await send("Runtime.enable");
await send("Log.enable");
await send("Page.enable");
await send("Page.navigate", { url: URL });
await sleep(2500);

const before = await evalJS(`(() => {
  const c = document.querySelector("canvas");
  return JSON.stringify({
    canvas: !!c,
    w: c ? c.width : 0,
    h: c ? c.height : 0,
    kaplay: typeof window.get === "function",
  });
})()`);
console.log("sayfa:", before);

// menuden oyuna gec
await key("keyDown", " ", "Space", 32, " ");
await key("keyUp", " ", "Space", 32);
await sleep(900);

// saga kos + zipla
const startX = await evalJS(`window.get && get("player")[0] ? get("player")[0].pos.x : -1`);
await key("keyDown", "ArrowRight", "ArrowRight", 39);
await sleep(700);
await key("keyDown", " ", "Space", 32, " ");
await sleep(90);
await key("keyUp", " ", "Space", 32);
await sleep(500);
await key("keyDown", " ", "Space", 32, " ");
await sleep(90);
await key("keyUp", " ", "Space", 32);
await sleep(500);
await key("keyUp", "ArrowRight", "ArrowRight", 39);

const state = await evalJS(`(() => {
  const p = window.get ? get("player")[0] : null;
  return JSON.stringify({
    scene: window.get ? (get("player").length ? "game" : "menu/gameover") : "?",
    playerX: p ? Math.round(p.pos.x) : null,
    playerY: p ? Math.round(p.pos.y) : null,
    fruits: window.get ? get("fruit").length : -1,
    solids: window.get ? get("solid").length : -1,
  });
})()`);
console.log("oyun:", state);
console.log("hareket:", startX, "->", JSON.parse(state).playerX);

await sleep(400);
const shot = await send("Page.captureScreenshot", { format: "png" });
mkdirSync("screenshots", { recursive: true });
writeFileSync(OUT, Buffer.from(shot.data, "base64"));
console.log("ekran goruntusu:", OUT);

// --- tehlike / can / game over testi ---
const hud = () =>
  evalJS(`JSON.stringify((window.get ? get("text") : []).map(o => o.text))`);
console.log("hud:", await hud());
for (let i = 0; i < 3; i++) {
  await evalJS(
    `(() => { const p = window.get ? get("player")[0] : null; if (p) p.pos = vec2(710, 176); return !!p; })()`,
  );
  await sleep(450);
  console.log("hud" + (i + 1) + ":", await hud());
  await sleep(1150);
}
await sleep(700);
console.log(
  "game over:",
  await evalJS(
    `JSON.stringify({ players: get("player").length, texts: get("text").map(o => o.text) })`,
  ),
);

if (logs.length) console.log("\n--- konsol ---\n" + logs.slice(-25).join("\n"));
if (errors.length) {
  console.log("\nFAIL: " + errors.length + " hata");
  console.log(errors.slice(0, 10).join("\n"));
} else {
  console.log("\nOK: konsol hatasi yok");
}

ws.close();
cleanup();
process.exit(errors.length ? 1 : 0);
