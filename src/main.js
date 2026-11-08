import kaplay from "kaplay";

kaplay({
  width: 640,
  height: 360,
  letterbox: true,
  pixelDensity: 1,
  antialias: false,
  background: [26, 30, 48],
});

const TILE = 32;
const SPEED = 230;
const JUMP_FORCE = 660;
const MAX_HEARTS = 3;

setGravity(2000);

/* ------------------------------ assetler ------------------------------ */
const strip = (tex, path, frames, anims) =>
  loadSprite(tex, path, { sliceX: frames, ...(anims ? { anims } : {}) });

strip("frog_idle", "assets/frog/idle.png", 11, {
  idle: { from: 0, to: 10, loop: true, speed: 12 },
});
strip("frog_run", "assets/frog/run.png", 12, {
  run: { from: 0, to: 11, loop: true, speed: 18 },
});
strip("frog_jump", "assets/frog/jump.png", 1);
strip("frog_fall", "assets/frog/fall.png", 1);
strip("frog_hit", "assets/frog/hit.png", 7, {
  hit: { from: 0, to: 6, loop: false, speed: 16 },
});

const FRUITS = ["apple", "banana", "cherries", "kiwi", "melon", "orange", "pineapple", "strawberry"];
for (const f of FRUITS) loadSprite("f_" + f, `assets/fruits/${f}.png`);

loadSprite("bg", "assets/bg/blue.png");
loadSprite("hills", "assets/bg/hills.png");
loadSprite("ground", "assets/ground.png");
loadSprite("dirt", "assets/dirt.png");
loadSprite("platform", "assets/platform.png");
loadSprite("spike", "assets/spike.png");

loadSound("jump", "assets/sfx/jump.wav");
loadSound("coin", "assets/sfx/coin.wav");
loadSound("hit", "assets/sfx/hit.wav");
loadSound("death", "assets/sfx/death.wav");

/* ------------------------------- harita ------------------------------- */
// 40 kolon x 10 satir. '#' zemin, '=' platform, '$' meyve, '^' diken
const MAP = [
  "                                        ",
  "                                        ",
  "                                        ",
  "         $        $           $         ",
  "        ====     ====         ====      ",
  "                                        ",
  "    $         $       ^   $             ",
  "########################################",
  "########################################",
  "########################################",
  "########################################",
  "########################################",
];
const COLS = MAP[0].length;
const ROWS = MAP.length;
const WORLD_W = COLS * TILE;

const at = (x, y) => (y < 0 || y >= ROWS || x < 0 || x >= COLS ? " " : MAP[y][x]);

/* -------------------------------- menu -------------------------------- */
scene("menu", () => {
  add([rect(width(), height(), rgb(20, 24, 38)), pos(0, 0)]);
  add([text("MEYVE KOSUSU", { size: 34 }), pos(width() / 2, 100), anchor("center")]);
  add([text("Meyveleri topla, dikenlerden kac", { size: 13 }), pos(width() / 2, 148), anchor("center")]);
  add([text("A / D veya OK TUSLARI  =  yuru", { size: 12 }), pos(width() / 2, 196), anchor("center")]);
  add([text("SPACE = zipla (basili tut = daha yuksek)", { size: 12 }), pos(width() / 2, 218), anchor("center")]);
  add([text("SPACE = basla", { size: 18 }), pos(width() / 2, 276), anchor("center")]);
  onKeyPress("space", () => go("game"));
});

/* --------------------------------- oyun -------------------------------- */
scene("game", () => {
  let score = 0;
  let hearts = MAX_HEARTS;
  let invuln = 0;
  let facing = 1;

  // parallax katmanlari
  const bg = add([sprite("bg", { width: 960, height: 360 }), pos(0, 0), z(-100)]);
  const hills = add([sprite("hills", { width: 960, height: 360 }), pos(0, 0), z(-90)]);
  bg.onUpdate(() => {
    bg.pos.x = getCamPos().x * 0.5 - 160;
  });
  hills.onUpdate(() => {
    hills.pos.x = getCamPos().x * 0.75 - 240;
  });

  /* ---- level uretimi ---- */
  function addSolid(x0, y0, tiles, visual) {
    const w = tiles * TILE;
    // sadece carpisma: gorunmez govde, ek yerlerinde takilma olmaz
    add([
      pos(x0 * TILE, y0 * TILE),
      area({ shape: new Rect(vec2(0, 0), w, TILE) }),
      body({ isStatic: true }),
      "solid",
    ]);
    for (let i = 0; i < tiles; i++) {
      const cx = x0 + i;
      const tex = visual === "ground" ? (at(cx, y0 - 1) === "#" ? "dirt" : "ground") : visual;
      add([sprite(tex), pos(cx * TILE, y0 * TILE), z(1)]);
    }
  }

  for (let y = 0; y < ROWS; y++) {
    let x = 0;
    while (x < COLS) {
      const ch = MAP[y][x];
      if (ch === "#" || ch === "=") {
        let x2 = x;
        while (x2 < COLS && MAP[y][x2] === ch) x2++;
        addSolid(x, y, x2 - x, ch === "#" ? "ground" : "platform");
        x = x2;
      } else x++;
    }
  }

  function addFruit(x, y, kind) {
    const f = add([sprite("f_" + kind), pos(x * TILE + 4, y * TILE + 2), area(), z(5), "fruit"]);
    f.baseY = f.pos.y;
    f.onUpdate(() => {
      f.pos.y = f.baseY + Math.sin(time() * 4 + x) * 3;
    });
  }

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const ch = MAP[y][x];
      if (ch === "$") addFruit(x, y, FRUITS[(x + y) % FRUITS.length]);
      if (ch === "^") {
        add([sprite("spike"), pos(x * TILE, y * TILE), area({ shape: new Rect(vec2(6, 12), 20, 20) }), z(3), "hazard"]);
      }
    }
  }
  /* ---- oyuncu ---- */
  const SPAWN = vec2(64, 96);
  const player = add([
    sprite("frog_idle", { anim: "idle" }),
    pos(SPAWN),
    area({ shape: new Rect(vec2(4, 4), 24, 28) }),
    body({ jumpForce: JUMP_FORCE }),
    z(10),
    "player",
  ]);

  player.onUpdate(() => {
    const cx = Math.max(width() / 2, Math.min(WORLD_W - width() / 2, player.pos.x + 40));
    setCamPos(cx, height() / 2);
  });

  /* ---- animasyon ---- */
  const ANIMS = {
    idle: () => sprite("frog_idle", { anim: "idle" }),
    run: () => sprite("frog_run", { anim: "run" }),
    jump: () => sprite("frog_jump"),
    fall: () => sprite("frog_fall"),
  };
  let curAnim = "idle";
  function setAnim(name) {
    if (curAnim === name) return;
    curAnim = name;
    player.use(ANIMS[name]());
    player.flipX = facing < 0;
  }

  /* ---- HUD ---- */
  const scoreText = add([text("MEYVE: 0", { size: 18 }), pos(12, 10), z(100), fixed()]);
  const heartText = add([text("", { size: 18 }), pos(12, 34), z(100), fixed()]);
  function updateHud() {
    scoreText.text = "MEYVE: " + score;
    heartText.text = "CAN: " + Math.max(0, hearts);
  }
  updateHud();

  /* ---- juice ---- */
  function pop(p) {
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI * 2 * i) / 10;
      add([
        pos(p.clone()),
        rect(3, 3, rgb(255, 232, 130)),
        move(vec2(Math.cos(a), Math.sin(a)), 120 + (i % 3) * 40),
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
        rect(3, 3, rgb(220, 235, 245)),
        move(vec2(i % 2 ? 1 : -1, -0.4), 60 + i * 12),
        opacity(1),
        lifespan(0.25, { fade: 0.15 }),
        z(20),
      ]);
    }
  }

  /* ---- hasar ---- */
  function hurt() {
    if (invuln > 0) return;
    hearts--;
    updateHud();
    shake(12);
    play("hit", { volume: 0.45 });
    if (hearts <= 0) {
      play("death", { volume: 0.5 });
      go("gameover", score);
      return;
    }
    invuln = 1.2;
    player.pos = SPAWN.clone();
    player.vel = vec2(0, 0);
  }

  player.onCollide("hazard", hurt);
  player.onCollide("fruit", (f) => {
    score += 10;
    updateHud();
    pop(f.pos);
    play("coin", { volume: 0.4 });
    destroy(f);
  });

  /* ---- hareket ---- */
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
      play("jump", { volume: 0.35 });
    }

    if (!wasGrounded && player.isGrounded()) dust(player.pos.add(4, 28));
    wasGrounded = player.isGrounded();

    if (!player.isGrounded()) setAnim(player.vel.y < 0 ? "jump" : "fall");
    else if (dir !== 0) setAnim("run");
    else setAnim("idle");

    invuln = Math.max(0, invuln - dt());
    player.opacity = invuln > 0 && Math.floor(time() * 20) % 2 === 0 ? 0.35 : 1;

    if (player.pos.y > ROWS * TILE + 120) hurt();
  });

  onKeyPress("space", () => {
    jumpBuffer = 0.12;
  });
  onKeyPress("up", () => {
    jumpBuffer = 0.12;
  });
  onKeyRelease("space", () => {
    if (player.vel.y < 0) player.vel.y *= 0.45;
  });
  onKeyRelease("up", () => {
    if (player.vel.y < 0) player.vel.y *= 0.45;
  });
});

/* ------------------------------ game over ------------------------------ */
scene("gameover", (score = 0) => {
  add([rect(width(), height(), rgb(16, 18, 28)), pos(0, 0)]);
  add([text("OYUN BITTI", { size: 32 }), pos(width() / 2, 110), anchor("center")]);
  add([text("Meyve: " + score, { size: 20 }), pos(width() / 2, 164), anchor("center")]);
  add([text("SPACE = tekrar dene", { size: 14 }), pos(width() / 2, 230), anchor("center")]);
  onKeyPress("space", () => go("game"));
});

go("menu");
