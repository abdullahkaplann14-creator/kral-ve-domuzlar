// Headless Chrome smoke testi: giris ekrani, admin sifresi, cift ziplama,
// savas, hasar, 10 bolum gecisi ve zafer ekrani.
// Kullanim: node scripts/smoke.mjs [url] [cikti.png]
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = process.argv[2] ?? "http://localhost:5173/";
const OUT = process.argv[3] ?? "smoke.png";
const PORT = 9333;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shotPath = (suffix) => OUT.replace(/\.png$/, suffix + ".png");

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
const typeDigit = async (d) => {
  await key("keyDown", d, "Digit" + d, 48 + Number(d), d);
  await key("keyUp", d, "Digit" + d, 48 + Number(d));
};
const click = async (x, y) => {
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
};

const evalJS = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
  if (r.exceptionDetails) return { error: r.exceptionDetails.text };
  return r.result?.value;
};

const dump = async () =>
  JSON.parse(
    await evalJS(`(() => {
      const p = window.get ? get("player")[0] : null;
      return JSON.stringify({
        canvas: !!document.querySelector("canvas"),
        player: p ? { x: Math.round(p.pos.x), y: Math.round(p.pos.y) } : null,
        pigs: window.get ? get("enemy").map((e) => ({ x: Math.round(e.pos.x), y: Math.round(e.pos.y), dead: !!e.dead })) : [],
        coins: window.get ? get("coin").length : -1,
        hearts: window.get ? get("hudheart").length : -1,
        digits: window.get ? get("hudscore").map((s) => s.frame) : [],
        texts: window.get ? get("text").map((t) => t.text) : [],
        dbg: window.__dbg ? window.__dbg.state() : null,
      });
    })()`),
  );

const screenshot = async (suffix) => {
  const shot = await send("Page.captureScreenshot", { format: "png" });
  mkdirSync("screenshots", { recursive: true });
  writeFileSync(shotPath(suffix), Buffer.from(shot.data, "base64"));
};

const jumpHeight = async (double) => {
  await sleep(400);
  const y0 = await evalJS(`Math.round(get("player")[0].pos.y)`);
  let minY = y0;
  await key("keyDown", " ", "Space", 32, " ");
  if (double) {
    await sleep(240);
    await key("keyUp", " ", "Space", 32);
    await key("keyDown", " ", "Space", 32, " ");
    await sleep(140);
    await key("keyUp", " ", "Space", 32);
  }
  for (let i = 0; i < 18; i++) {
    await sleep(40);
    const y = await evalJS(`Math.round(get("player")[0].pos.y)`);
    if (y < minY) minY = y;
  }
  await key("keyUp", " ", "Space", 32);
  await sleep(500);
  return y0 - minY;
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

/* ------------------------- 1) giris ekrani ------------------------- */
await send("Page.navigate", { url: URL });
await sleep(2500);
const loginDump = await dump();
console.log("giris ekrani:", JSON.stringify({ texts: loginDump.texts, player: loginDump.player }));
await screenshot("-login");

/* --------------------- 2) sifre ile admin girisi -------------------- */
for (const d of "1234") await typeDigit(d);
await sleep(250);
console.log("sifre alani:", await evalJS(`JSON.stringify((get("text") || []).map(t => t.text).filter(t => t && t.length <= 4))`));
await tap("Enter", "Enter", 13);
await sleep(1200);
const adminDump = await dump();
console.log("admin giris:", JSON.stringify({ dbg: adminDump.dbg, texts: adminDump.texts.slice(0, 4), player: adminDump.player }));

/* ------------------------ 3) admin cift zipla ----------------------- */
const adminJump = await jumpHeight(true);
console.log(`admin ziplama: ${adminJump}px`);

/* --------------------- 4) normal oyna butonu ----------------------- */
await send("Page.navigate", { url: URL });
await sleep(2500);
// NORMAL OYNA butonu: mantiksal (428, 246) -> 1.5x olcek
await click(642, 369);
await sleep(1200);
const normalDump = await dump();
console.log("normal giris:", JSON.stringify({ dbg: normalDump.dbg, player: normalDump.player }));
const normalJump = await jumpHeight(false);
console.log(`normal ziplama: ${normalJump}px`);

/* --------------------- 5) oyun akisi ------------------------------ */
await key("keyDown", "ArrowRight", "ArrowRight", 39);
await sleep(650);
await tap(" ", "Space", 32, " ");
await sleep(420);
await key("keyUp", "ArrowRight", "ArrowRight", 39);
await sleep(300);
await screenshot("");
console.log("kosu:", JSON.stringify({ player: (await dump()).player }));

// testte diken kaynakli gurultuyu kaldir, domuzlari dondur
await evalJS(`get("hazard").forEach((h) => destroy(h))`);
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
    dbg: await evalJS(`JSON.stringify(window.__dbg.state())`),
  }),
);

await evalJS(`(() => {
  const p = get("player")[0];
  const e = get("enemy").find((e) => !e.dead);
  if (!p || !e) return false;
  p.pos = vec2(e.pos.x + 2, e.pos.y - 70);
  p.vel = vec2(0, 220);
  return true;
})()`);
await sleep(850);
const afterStomp = await dump();
console.log(
  "stomp:",
  JSON.stringify({
    pigsDead: afterStomp.pigs.filter((p) => p.dead).length,
    dbg: await evalJS(`JSON.stringify(window.__dbg.state())`),
    last: await evalJS(`JSON.stringify(window.__dbg.lastContact)`),
  }),
);
await evalJS(`get("enemy").forEach((e) => { if (e._savedSpeed) e.speed = e._savedSpeed; })`);

/* ------------------------- 6) hasar / game over -------------------- */
await evalJS(
  `(() => { if (!(get("hazard") || []).length) add([sprite("spike"), pos(300, 256), area({ shape: new Rect(vec2(6, 14), 20, 18) }), "hazard"]); return true; })()`,
);
const spike = JSON.parse(
  await evalJS(`(() => { const s = (get("hazard") || [])[0]; return s ? JSON.stringify({ x: Math.round(s.pos.x), y: Math.round(s.pos.y) }) : "null"; })()`),
);
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

/* ------------------------ 7) 10 bolum gecisi ---------------------- */
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
  console.log("oda", i, "->", JSON.stringify({ texts: d.texts, pigs: d.pigs.length, hearts: d.hearts }));
  if ([2, 5, 8, 10].includes(i)) await screenshot(`-oda${i}`);
  await evalJS(`window.__dbg.teleport(${door.x}, ${door.y})`);
  await sleep(800);
}
await sleep(600);
console.log("final:", JSON.stringify(await dump()));

await screenshot("-end");

if (logs.length) console.log("\n--- konsol ---\n" + logs.slice(-15).join("\n"));
if (errors.length) {
  console.log("\nFAIL: " + errors.length + " hata");
  console.log(errors.slice(0, 10).join("\n"));
} else {
  console.log("\nOK: konsol hatasi yok");
}

ws.close();
cleanup();
process.exit(errors.length ? 1 : 0);
