// 10 bolumluk seviye ureteci. Zorluk bolum numarasiyla artar:
// cukur sayisi, platform sayisi/genisligi, diken sayisi, dusman sayisi/hizi, kalp azligi.

const mulberry32 = (a) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export function makeLevel(n, ROWS, COLS) {
  const rnd = mulberry32(9001 + n * 137);
  const g = Array.from({ length: ROWS }, () => new Array(COLS).fill(" "));
  const set = (x, y, ch) => {
    if (x >= 0 && x < COLS && y >= 0 && y < ROWS) g[y][x] = ch;
  };
  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  /* --- cukurlar (3. bolumden itibaren) --- */
  const pits = [];
  const pitCount = n <= 2 ? 0 : Math.min(3, n - 2);
  let guard = 0;
  while (pits.length < pitCount && guard++ < 300) {
    const w = 2 + Math.floor(rnd() * 2) + (n >= 7 ? 1 : 0);
    const x = 10 + Math.floor(rnd() * Math.max(1, COLS - 24 - w));
    if (pits.some((p) => x < p.x + p.w + 7 && x + w + 7 > p.x)) continue;
    pits.push({ x, w });
  }
  const inPit = (x) => pits.some((p) => x >= p.x && x < p.x + p.w);

  /* --- zemin --- */
  for (let x = 0; x < COLS; x++) {
    if (inPit(x)) continue;
    for (let y = 9; y <= 11; y++) set(x, y, "#");
  }

  /* --- platformlar --- */
  const plats = [];
  const platCount = 3 + Math.min(5, Math.floor(n / 2));
  guard = 0;
  while (plats.length < platCount && guard++ < 400) {
    const w = 3 + Math.floor(rnd() * (n >= 6 ? 4 : 3));
    const row = 5 + Math.floor(rnd() * 3);
    const x = 4 + Math.floor(rnd() * Math.max(1, COLS - 12 - w));
    if (plats.some((p) => Math.abs(p.row - row) <= 1 && x < p.x + p.w + 2 && x + w + 2 > p.x))
      continue;
    if (pits.some((p) => x < p.x + p.w + 2 && x + w + 2 > p.x)) continue;
    plats.push({ x, w, row });
    for (let i = 0; i < w; i++) set(x + i, row, "=");
  }

  /* --- platform ustu altinlar --- */
  for (const p of plats) {
    const count = 1 + Math.floor(rnd() * 2);
    for (let i = 0; i < count; i++) {
      const x = p.x + 1 + Math.floor(rnd() * Math.max(1, p.w - 2));
      if (g[p.row - 1][x] === " ") set(x, p.row - 1, "$");
    }
  }

  /* --- zemindeki bos hucreler --- */
  const spots = [];
  for (let x = 4; x < COLS - 6; x++) {
    if (inPit(x)) continue;
    if (g[8][x] === " " && g[9][x] === "#") spots.push(x);
  }
  shuffle(spots);
  let idx = 0;
  const take = () => spots[idx++];

  /* --- dikenler (baslangica en az 3 tile mesafe) --- */
  const spikeCount = Math.min(7, n + 1);
  for (let i = 0; i < spikeCount && idx < spots.length; ) {
    const x = take();
    if (x < 14) continue;
    set(x, 8, "^");
    i++;
  }

  /* --- yerdeki altinlar --- */
  for (let i = 0; i < 4 && idx < spots.length; i++) set(take(), 8, "$");

  /* --- kalpler --- */
  const hearts = n <= 3 ? 2 : n <= 6 ? 1 : 0;
  for (let i = 0; i < hearts && idx < spots.length; i++) set(take(), 8, "H");

  /* --- dusmanlar --- */
  const enemySpots = [];
  for (const x of spots) if (g[8][x] === " ") enemySpots.push({ x, y: 8 });
  for (const p of plats) {
    for (let i = 1; i < p.w - 1; i++) {
      const x = p.x + i;
      if (g[p.row - 1][x] === " ") enemySpots.push({ x, y: p.row - 1 });
    }
  }
  shuffle(enemySpots);

  const pigCount = Math.min(9, 2 + Math.round(n * 0.9));
  const kingCount = n >= 5 ? Math.min(3, 1 + Math.floor((n - 5) / 2)) : 0;
  let placed = 0;
  for (const s of enemySpots) {
    if (placed >= pigCount + kingCount) break;
    if (s.x < 10 || g[s.y][s.x] !== " ") continue;
    set(s.x, s.y, placed >= pigCount ? "P" : "p");
    placed++;
  }

  /* --- kapi (sagda, zeminde) --- */
  for (let x = COLS - 4; x > COLS - 14; x--) {
    if (inPit(x)) continue;
    if (g[8][x] === " " && g[9][x] === "#") {
      set(x, 8, "D");
      break;
    }
  }

  return g;
}

export const createLevels = (count, ROWS, COLS) =>
  Array.from({ length: count }, (_, i) => makeLevel(i + 1, ROWS, COLS));
