export const CFG = {
  tileSize: 56,
  gridW: 14,
  gridH: 9,
  topBarH: 56,
  startMoney: 120,
  startLives: 15,
};

export const COLORS = {
  bg: 0x0b1020,
  tile: 0x141a2f,
  tile2: 0x11162a,
  path: 0x2a3458,
  pathEdge: 0x3a4775,
  tower: 0x58d7ff,
  tower2: 0xffb86b,
  enemy: 0xff4d6d,
  enemy2: 0xb8ff6b,
  bullet: 0xffffff,
  ui: 0xdce3ff,
  danger: 0xff6b6b,
};

export function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
