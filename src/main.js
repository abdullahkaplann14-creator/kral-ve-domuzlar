import kaplay from "kaplay";

kaplay({
  width: 640,
  height: 360,
  letterbox: true,
  pixelDensity: 1,
  antialias: false,
  background: [20, 16, 28],
});

/* ------------------------------- sabitler ------------------------------ */
const TILE = 32;
const ZOOM = 1.5;
const SPEED = 215;
const JUMP_FORCE = 700;
const MAX_HEARTS = 5;
const KING_FEET = 44; // kral sprite'inda ayaklarin frame icindeki y'si
const COLS = 60;
const ROWS = 12;

setGravity(2200);
setCamScale(ZOOM);

/* ------------------------------- assetler ------------------------------ */
const strip = (tex, path, frames, anims) =>
  loadSprite(tex, path, { sliceX: frames, ...(anims ? { anims } : {}) });

// Kral (78x58)
strip("king_idle", "assets/king/idle.png", 11, { idle: { from: 0, to: 10, loop: true, speed: 10 } });
strip("king_run", "assets/king/run.png", 8, { run: { from: 0, to: 7, loop: true, speed: 12 } });
strip("king_jump", "assets/king/jump.png", 1);
strip("king_fall", "assets/king/fall.png", 1);
strip("king_attack", "assets/king/attack.png", 3, {
  attack: { from: 0, to: 2, loop: false, speed: 14 },
});

// Domuz (34x28) / Kral domuz (38x28)
strip("pig_idle", "assets/pig/idle.png", 11, { idle: { from: 0, to: 10, loop: true, speed: 8 } });
strip("pig_run", "assets/pig/run.png", 6, { run: { from: 0, to: 5, loop: true, speed: 10 } });
strip("pig_dead", "assets/pig/dead.png", 4, { dead: { from: 0, to: 3, loop: false, speed: 10 } });

strip("kingpig_idle", "assets/king_pig/idle.png", 12, { idle: { from: 0, to: 11, loop: true, speed: 8 } });
strip("kingpig_run", "assets/king_pig/run.png", 6, { run: { from: 0, to: 5, loop: true, speed: 10 } });
strip("kingpig_dead", "assets/king_pig/dead.png", 4, { dead: { from: 0, to: 3, loop: false, speed: 10 } });

// UI / toplanabilirler
loadSprite("coin", "assets/ui/coin.png", {
  sliceX: 8,
  anims: { spin: { from: 0, to: 7, loop: true, speed: 12 } },
});
loadSprite("heart", "assets/ui/heart.png", {
  sliceX: 8,
  anims: { beat: { from: 0, to: 7, loop: true, speed: 8 } },
});
loadSprite("num", "assets/ui/numbers.png", { sliceX: 10 });

// Sahne
loadSprite("bg", "assets/bg/castle.png");
loadSprite("pillars", "assets/bg/pillars.png");
loadSprite("ground", "assets/ground.png");
loadSprite("dirt", "assets/dirt.png");
loadSprite("platform", "assets/platform.png");
loadSprite("spike", "assets/spike.png");
loadSprite("door", "assets/props/door.png");

loadSound("jump", "assets/sfx/jump.wav");
loadSound("coin", "assets/sfx/coin.wav");
loadSound("hit", "assets/sfx/hit.wav");
loadSound("slash", "assets/sfx/slash.wav");
loadSound("stomp", "assets/sfx/stomp.wav");
loadSound("death", "assets/sfx/death.wav");

/* ------------------------------- odalar -------------------------------- */
function makeRoom(build) {
  const g = Array.from({ length: ROWS }, () => new Array(COLS).fill(" "));
  const put = (x, y, ch) => {
    if (y >= 0 && y < ROWS && x >= 0 && x < COLS) g[y][x] = ch;
  };
  const api = {
    ground(x, y, w, h = 1) {
      for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) put(x + dx, y + dy, "#");
    },
    plat(x, y, w) {
      for (let dx = 0; dx < w; dx++) put(x + dx, y, "=");
    },
    coin(x, y) {
      put(x, y, "$");
    },
    heart(x, y) {
      put(x, y, "H");
    },
    pig(x, y) {
      put(x, y, "p");
    },
    kingpig(x, y) {
      put(x, y, "P");
    },
    spike(x, y) {
      put(x, y, "^");
    },
    door(x, y) {
      put(x, y, "D");
    },
  };
  build(api);
  return g;
}

const ROOMS = [
  makeRoom((b) => {
    b.ground(0, 9, 60, 3);
    b.plat(7, 7, 6);
    b.plat(17, 6, 5);
    b.plat(26, 7, 4);
    b.plat(34, 6, 6);
    b.plat(44, 7, 5);

    b.coin(9, 6);
    b.coin(10, 6);
    b.coin(19, 5);
    b.coin(20, 5);
    b.coin(28, 6);
    b.coin(36, 5);
    b.coin(37, 5);
    b.coin(38, 5);
    b.coin(46, 6);
    b.coin(3, 8);
    b.coin(24, 8);
    b.coin(52, 8);

    b.heart(21, 8);

    b.pig(8, 6);
    b.pig(27, 8);
    b.pig(35, 5);
    b.pig(51, 8);

    b.spike(31, 8);
    b.spike(42, 8);

    b.door(56, 8);
  }),
  makeRoom((b) => {
    b.ground(0, 9, 24, 3);
    b.ground(30, 9, 30, 3);
    b.ground(24, 11, 6, 1); // cukurun tabani (dikenli)

    b.plat(6, 6, 4);
    b.plat(13, 7, 4);
    b.plat(25, 8, 4);
    b.plat(35, 6, 5);
    b.plat(45, 7, 4);

    b.coin(7, 5);
    b.coin(8, 5);
    b.coin(14, 6);
    b.coin(15, 6);
    b.coin(26, 7);
    b.coin(27, 7);
    b.coin(36, 5);
    b.coin(37, 5);
    b.coin(38, 5);
    b.coin(46, 6);
    b.coin(4, 8);
    b.coin(32, 8);

    b.heart(16, 8);

    b.pig(10, 8);
    b.pig(28, 7);
    b.pig(35, 5);
    b.kingpig(49, 8);

    b.spike(25, 10);
    b.spike(26, 10);
    b.spike(27, 10);

    b.door(56, 8);
  }),
];

const WORLD_W = COLS * TILE;
const WORLD_H = ROWS * TILE;

/* ------------------------- oyun durumu (odalar arasi) ------------------- */
const gameState = { room: 0, score: 0, hearts: MAX_HEARTS };

const startGame = () => {
  gameState.room = 0;
  gameState.score = 0;
  gameState.hearts = MAX_HEARTS;
  go("game");
};

/* --------------------------------- menu -------------------------------- */
scene("menu", () => {
  add([sprite("bg", { width: 1280, height: 360 }), pos(0, -40), z(-100)]);
  add([rect(width(), height(), rgb(14, 10, 22)), pos(0, 0), opacity(0.55), z(-50)]);
  add([text("KRAL VE DOMUZLAR", { size: 36 }), pos(width() / 2, 96), anchor("center"), z(10)]);
  add([text("Kale domuzlardan temizlenmeli.", { size: 13 }), pos(width() / 2, 142), anchor("center"), z(10)]);
  add([text("A / D veya OK  =  yuru", { size: 12 }), pos(width() / 2, 186), anchor("center"), z(10)]);
  add([text("SPACE = zipla      X = kilic", { size: 12 }), pos(width() / 2, 208), anchor("center"), z(10)]);
  add([text("SPACE = basla", { size: 20 }), pos(width() / 2, 268), anchor("center"), z(10)]);
  onKeyPress("space", () => startGame());
});

/* --------------------------------- oyun -------------------------------- */
scene("game", () => {
  setCamScale(ZOOM);
  const room = ROOMS[gameState.room];
  let score = gameState.score;
  let hearts = gameState.hearts;
  let invuln = 0;
  let facing = 1;

  /* --- parallax --- */
  const bg = add([sprite("bg", { width: 1280, height: 360 }), pos(0, 0), z(-100)]);
  const pillars = add([sprite("pillars", { width: 1280, height: 360 }), pos(0, 0), z(-90)]);
  bg.onUpdate(() => {
    bg.pos.x = getCamPos().x * 0.5 - 107;
  });
  pillars.onUpdate(() => {
    pillars.pos.x = getCamPos().x * 0.75 - 160;
  });

  /* --- level --- */
  const at = (x, y) => (y < 0 || y >= ROWS || x < 0 || x >= COLS ? " " : room[y][x]);

  function addSolid(x0, y0, tiles, visual) {
    const w = tiles * TILE;
    add([
      pos(x0 * TILE, y0 * TILE),
      area({ shape: new Rect(vec2(0, 0), w, TILE) }),
      body({ isStatic: true }),
      "solid",
    ]).w = w;
    for (let i = 0; i < tiles; i++) {
      const cx = x0 + i;
      const tex = visual === "ground" ? (at(cx, y0 - 1) === "#" ? "dirt" : "ground") : "platform";
      add([sprite(tex), pos(cx * TILE, y0 * TILE), z(1)]);
    }
  }

  for (let y = 0; y < ROWS; y++) {
    let x = 0;
    while (x < COLS) {
      const ch = room[y][x];
      if (ch === "#" || ch === "=") {
        let x2 = x;
        while (x2 < COLS && room[y][x2] === ch) x2++;
        addSolid(x, y, x2 - x, ch === "#" ? "ground" : "platform");
        x = x2;
      } else x++;
    }
  }

  const solitsUnder = (x, y) =>
    get("solid").find((s) => x >= s.pos.x && x <= s.pos.x + s.w && Math.abs(s.pos.y - y) < 6);

  /* --- toplanabilirler --- */
  function addCoin(tx, ty) {
    const c = add([
      sprite("coin", { anim: "spin" }),
      pos(tx * TILE + 7, ty * TILE + 9),
      area(),
      z(6),
      "coin",
    ]);
    c.baseY = c.pos.y;
    c.onUpdate(() => {
      c.pos.y = c.baseY + Math.sin(time() * 4 + tx) * 2;
    });
  }

  function addHeart(tx, ty) {
    add([sprite("heart", { anim: "beat" }), pos(tx * TILE + 7, ty * TILE + 9), area(), z(6), "heart"]);
  }

  function addSpike(tx, ty) {
    add([
      sprite("spike"),
      pos(tx * TILE, ty * TILE),
      area({ shape: new Rect(vec2(6, 14), 20, 18) }),
      z(4),
      "hazard",
    ]);
  }

  function addDoor(tx, ty) {
    add([sprite("door"), pos(tx * TILE - 7, (ty + 1) * TILE - 56), area(), z(4), "door"]);
  }

  function addPig(tx, ty, king) {
    const tex = king ? "kingpig" : "pig";
    const w = king ? 38 : 34;
    const e = add([
      sprite(tex + "_idle", { anim: "idle" }),
      pos(tx * TILE + (TILE - w) / 2, ty * TILE + 4),
      area({ shape: new Rect(vec2(king ? 12 : 10, 9), king ? 16 : 19, 19) }),
      body(),
      z(9),
      "enemy",
    ]);
    e.tex = tex;
    e.dead = false;
    e.dir = Math.random() < 0.5 ? -1 : 1;
    e.speed = king ? 34 : 46;

    const feet = ty * TILE + TILE;
    const platform = solitsUnder(e.pos.x + w / 2, feet);
    const center = e.pos.x;
    e.minX = platform ? Math.max(platform.pos.x + 2, center - 110) : center - 70;
    e.maxX = platform ? Math.min(platform.pos.x + platform.w - w - 2, center + 110) : center + 70;
    if (e.maxX < e.minX) {
      e.minX = center - 40;
      e.maxX = center + 40;
    }

    let cur = "idle";
    const setAnim = (name) => {
      if (cur === name) return;
      cur = name;
      e.use(sprite(tex + "_" + name, name === "attack" ? undefined : { anim: name }));
      e.flipX = e.dir < 0;
    };

    e.onUpdate(() => {
      if (e.dead) return;
      if (e.pos.x <= e.minX) e.dir = 1;
      else if (e.pos.x >= e.maxX) e.dir = -1;
      e.move(e.dir * e.speed, 0);
      e.flipX = e.dir < 0;
      setAnim("run");
    });
    return e;
  }

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const ch = room[y][x];
      if (ch === "$") addCoin(x, y);
      else if (ch === "H") addHeart(x, y);
      else if (ch === "p") addPig(x, y, false);
      else if (ch === "P") addPig(x, y, true);
      else if (ch === "^") addSpike(x, y);
      else if (ch === "D") addDoor(x, y);
    }
  }

  /* --- oyuncu --- */
  const SPAWN = vec2(64, 9 * TILE - KING_FEET);
  const player = add([
    sprite("king_idle", { anim: "idle" }),
    pos(SPAWN),
    area({ shape: new Rect(vec2(9, 16), 37, 28) }),
    body({ jumpForce: JUMP_FORCE }),
    z(10),
    "player",
  ]);

  /* --- kamera --- */
  const HALF_W = width() / 2 / ZOOM;
  const HALF_H = height() / 2 / ZOOM;
  setCamPos(HALF_W, 240);
  player.onUpdate(() => {
    const cam = getCamPos();
    const tx = Math.max(HALF_W, Math.min(WORLD_W - HALF_W, player.pos.x + 40));
    const ty = Math.max(HALF_H, Math.min(WORLD_H - HALF_H, player.pos.y + 30));
    const k = 1 - Math.exp(-10 * dt());
    setCamPos(cam.x + (tx - cam.x) * k, cam.y + (ty - cam.y) * k);
  });

  /* --- animasyon --- */
  const ANIMS = {
    idle: () => sprite("king_idle", { anim: "idle" }),
    run: () => sprite("king_run", { anim: "run" }),
    jump: () => sprite("king_jump"),
    fall: () => sprite("king_fall"),
    attack: () => sprite("king_attack", { anim: "attack" }),
  };
  let curAnim = "idle";
  function setAnim(name) {
    if (curAnim === name) return;
    curAnim = name;
    player.use(ANIMS[name]());
    player.flipX = facing < 0;
  }

  /* --- HUD --- */
  const heartIcons = [];
  function renderHearts() {
    for (const h of heartIcons) destroy(h);
    heartIcons.length = 0;
    for (let i = 0; i < hearts; i++) {
      heartIcons.push(
        add([
          sprite("heart", { frame: 0 }),
          pos(12 + i * 42, 10),
          scale(2),
          z(100),
          fixed(),
          "hudheart",
        ]),
      );
    }
  }

  const scoreSprites = [];
  function renderScore() {
    for (const s of scoreSprites) destroy(s);
    scoreSprites.length = 0;
    const str = String(score).padStart(4, "0");
    const x0 = width() - 16 - str.length * 16;
    [...str].forEach((ch, i) => {
      const frame = ch === "0" ? 9 : Number(ch) - 1; // sayfa 1..9,0 sirasinda
      scoreSprites.push(
        add([
          sprite("num", { frame }),
          pos(x0 + i * 16, 12),
          scale(2),
          z(100),
          fixed(),
          "hudscore",
        ]),
      );
    });
  }

  add([sprite("coin", { frame: 0 }), pos(width() - 16 - 4 * 16 - 26, 10), scale(2), z(100), fixed()]);
  add([
    text("ODA " + (gameState.room + 1) + "/" + ROOMS.length, { size: 12 }),
    pos(width() / 2, 12),
    anchor("top"),
    z(100),
    fixed(),
  ]);
  renderHearts();
  renderScore();

  /* --- juice --- */
  function pop(p, col = [255, 210, 140]) {
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI * 2 * i) / 10;
      add([
        pos(p.clone()),
        rect(3, 3, rgb(col[0], col[1], col[2])),
        move(vec2(Math.cos(a), Math.sin(a)), 110 + (i % 3) * 40),
        opacity(1),
        lifespan(0.35, { fade: 0.2 }),
        z(20),
      ]);
    }
  }

  function dust(p) {
    for (let i = 0; i < 6; i++) {
      add([
        pos(p.clone()),
        rect(3, 3, rgb(150, 120, 160)),
        move(vec2(i % 2 ? 1 : -1, -0.4), 50 + i * 10),
        opacity(1),
        lifespan(0.25, { fade: 0.15 }),
        z(20),
      ]);
    }
  }

  /* --- savas --- */
  let atkTimer = 0;
  let atkCd = 0;

  function killEnemy(e, how) {
    if (e.dead) return;
    e.dead = true;
    e.unuse("body");
    e.unuse("area");
    e.dir = e.flipX ? -1 : 1;
    e.use(sprite(e.tex + "_dead", { anim: "dead" }));
    e.flipX = e.dir < 0;
    score += how === "stomp" ? 20 : 25;
    renderScore();
    pop(e.pos.add(10, 14), how === "stomp" ? [255, 190, 120] : [255, 140, 140]);
    play(how === "stomp" ? "stomp" : "slash", { volume: 0.5 });
    wait(0.9, () => destroy(e));
  }

  function attack() {
    if (atkCd > 0 || atkTimer > 0) return;
    atkCd = 0.42;
    atkTimer = 0.22;
    curAnim = "attack";
    player.use(sprite("king_attack", { anim: "attack" }));
    player.flipX = facing < 0;
    play("slash", { volume: 0.35 });
    wait(0.08, () => {
      const cx = player.pos.x + (facing > 0 ? 62 : 16);
      const cy = player.pos.y + 30;
      for (const e of get("enemy")) {
        if (e.dead) continue;
        if (Math.abs(e.pos.x + 17 - cx) < 48 && Math.abs(e.pos.y + 14 - cy) < 36) killEnemy(e, "attack");
      }
    });
  }

  /* --- hasar --- */
  function hurt() {
    if (invuln > 0) return;
    hearts--;
    renderHearts();
    shake(14);
    play("hit", { volume: 0.5 });
    if (hearts <= 0) {
      play("death", { volume: 0.5 });
      gameState.score = score;
      go("gameover", score);
      return;
    }
    invuln = 1.3;
    player.pos = SPAWN.clone();
    player.vel = vec2(0, 0);
  }

  /* --- carpisma yardimcilari (isinlanma sonrasi da guvenli) --- */
  const box = (o, w, h, ox, oy) => ({ x: o.pos.x + ox, y: o.pos.y + oy, w, h });
  const playerBox = () => box(player, 37, 28, 9, 16);
  const overlaps = (a, b) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  function checkPlayerContacts() {
    const pb = playerBox();

    for (const s of get("hazard")) {
      if (overlaps(pb, box(s, 20, 18, 6, 14))) {
        hurt();
        return;
      }
    }

    for (const e of get("enemy")) {
      if (e.dead) continue;
      const king = e.tex === "kingpig";
      const eb = box(e, king ? 16 : 19, 19, king ? 12 : 10, 9);
      if (!overlaps(pb, eb)) continue;
      if (player.vel.y > 80 && pb.y + pb.h < eb.y + 14) {
        killEnemy(e, "stomp");
        player.vel.y = -430;
        shake(5);
      } else {
        hurt();
      }
      return;
    }
  }

  player.onCollide("coin", (c) => {
    score += 10;
    renderScore();
    pop(c.pos.add(4, 2), [150, 210, 245]);
    play("coin", { volume: 0.35 });
    destroy(c);
  });

  player.onCollide("heart", (h) => {
    hearts = Math.min(MAX_HEARTS, hearts + 1);
    renderHearts();
    pop(h.pos.add(4, 2), [255, 120, 140]);
    play("coin", { volume: 0.35 });
    destroy(h);
  });

  player.onCollide("door", () => {
    gameState.score = score;
    gameState.hearts = hearts;
    if (gameState.room + 1 < ROOMS.length) {
      gameState.room++;
      go("game");
    } else {
      go("win", score);
    }
  });

  /* --- hareket --- */
  let coyote = 0;
  let jumpBuffer = 0;
  let wasGrounded = true;

  onUpdate(() => {
    const dir =
      (isKeyDown("right") || isKeyDown("d") ? 1 : 0) - (isKeyDown("left") || isKeyDown("a") ? 1 : 0);

    player.move(dir * SPEED, 0);
    if (dir !== 0) {
      facing = dir;
      player.flipX = dir < 0;
    }

    if (player.isGrounded()) coyote = 0.1;
    else coyote = Math.max(0, coyote - dt());
    jumpBuffer = Math.max(0, jumpBuffer - dt());

    if (jumpBuffer > 0 && coyote > 0) {
      player.jump(JUMP_FORCE);
      jumpBuffer = 0;
      coyote = 0;
      play("jump", { volume: 0.3 });
    }

    if (!wasGrounded && player.isGrounded()) dust(player.pos.add(14, KING_FEET));
    wasGrounded = player.isGrounded();

    atkTimer = Math.max(0, atkTimer - dt());
    atkCd = Math.max(0, atkCd - dt());

    if (atkTimer <= 0) {
      if (!player.isGrounded()) setAnim(player.vel.y < 0 ? "jump" : "fall");
      else if (dir !== 0) setAnim("run");
      else setAnim("idle");
    }

    invuln = Math.max(0, invuln - dt());
    player.opacity = invuln > 0 && Math.floor(time() * 20) % 2 === 0 ? 0.35 : 1;

    checkPlayerContacts();

    if (player.pos.y > WORLD_H + 120) hurt();
  });

  const jumpPress = () => {
    jumpBuffer = 0.12;
  };
  onKeyPress("space", jumpPress);
  onKeyPress("up", jumpPress);
  onKeyPress("w", jumpPress);
  const jumpRelease = () => {
    if (player.vel.y < 0) player.vel.y *= 0.45;
  };
  onKeyRelease("space", jumpRelease);
  onKeyRelease("up", jumpRelease);
  onKeyRelease("w", jumpRelease);

  onKeyPress("x", attack);
  onKeyPress("j", attack);

  // test / hata ayiklama kancasi (agent dongusu icin)
  window.__dbg = {
    attack,
    hurt,
    state: () => ({ score, hearts, room: gameState.room, atkCd }),
    teleport: (x, y) => {
      player.pos = vec2(x, y);
      player.vel = vec2(0, 0);
    },
  };
});

/* ------------------------------ game over ------------------------------ */
scene("gameover", (score = 0) => {
  add([rect(width(), height(), rgb(14, 10, 22)), pos(0, 0)]);
  add([text("KRAL DUSTU", { size: 34 }), pos(width() / 2, 110), anchor("center")]);
  add([text("Toplanan altin: " + score, { size: 16 }), pos(width() / 2, 164), anchor("center")]);
  add([text("SPACE = tekrar dene", { size: 14 }), pos(width() / 2, 232), anchor("center")]);
  onKeyPress("space", () => startGame());
});

/* --------------------------------- kazandi ------------------------------ */
scene("win", (score = 0) => {
  add([rect(width(), height(), rgb(14, 10, 22)), pos(0, 0)]);
  add([text("KALE TEMIZLENDI!", { size: 30 }), pos(width() / 2, 104), anchor("center")]);
  add([text("Toplanan altin: " + score, { size: 16 }), pos(width() / 2, 156), anchor("center")]);
  add([text("SPACE = bastan oyna", { size: 14 }), pos(width() / 2, 226), anchor("center")]);
  onKeyPress("space", () => startGame());
});

go("menu");
