// The fisher: moves in world coords, drawn as an upright billboard in iso.
// Carries RAW fish stacked on the back, CUT meat stacked in front, and CASH
// in hand — all visible and uncapped (exponential growth).

import { project, projectVec, groundShadow } from './iso.js';

export function createPlayer(x, y) {
  return {
    x, y,
    radius: 18,
    speed: 235,
    facing: 1,
    // Saws: slow + few at the start; upgrades add count & spin speed.
    sawCount: 2,
    sawOrbit: 42,
    sawSpin: 0,
    sawSpinSpeed: 3.2,
    bob: 0,
    moving: false,
    // Carried goods (no caps).
    fishStack: [], // raw fish values
    meatStack: [], // cut meat portions
    hand: 0,       // cash carried in hand
  };
}

export function getSawPositions(p) {
  const out = [];
  for (let i = 0; i < p.sawCount; i++) {
    const a = p.sawSpin + (i / p.sawCount) * Math.PI * 2;
    out.push({ x: p.x + Math.cos(a) * p.sawOrbit, y: p.y + Math.sin(a) * p.sawOrbit, r: 16 });
  }
  return out;
}

export function updatePlayer(p, move, dt, world) {
  p.x += move.x * p.speed * dt;
  p.y += move.y * p.speed * dt;
  const b = world.play || world;
  p.x = Math.max(b.minX, Math.min(b.maxX, p.x));
  p.y = Math.max(b.minY, Math.min(b.maxY, p.y));

  p.moving = move.x !== 0 || move.y !== 0;
  if (p.moving) {
    const sv = projectVec(move.x, move.y);
    if (Math.abs(sv.x) > 0.02) p.facing = sv.x > 0 ? 1 : -1;
    p.bob += dt * 12;
  }
  p.sawSpin += p.sawSpinSpeed * (p.moving ? 1.5 : 1) * dt;
}

export function drawPlayer(ctx, p) {
  const base = project(p.x, p.y);
  ctx.save();
  ctx.translate(base.x, base.y);
  const bobY = p.moving ? Math.sin(p.bob) * 2.5 : 0;
  groundShadow(ctx, 0, 4, p.radius, p.radius * 0.55, 0.24);

  const saws = [];
  for (let i = 0; i < p.sawCount; i++) {
    const a = p.sawSpin + (i / p.sawCount) * Math.PI * 2;
    const off = projectVec(Math.cos(a) * p.sawOrbit, Math.sin(a) * p.sawOrbit);
    saws.push({ sx: off.x, sy: off.y - 6, spin: p.sawSpin * 2 + i });
  }
  for (const s of saws) if (s.sy < -6) drawSaw(ctx, s.sx, s.sy + bobY, s.spin);

  drawBackStack(ctx, p, bobY);   // raw fish on the back

  ctx.save();
  ctx.translate(0, bobY);
  ctx.scale(p.facing, 1);
  roundRect(ctx, -12, -10, 24, 24, 8); ctx.fillStyle = '#2f6fb0'; ctx.fill();
  ctx.beginPath(); ctx.arc(0, -13, 11, 0, Math.PI * 2); ctx.fillStyle = '#8fd0ff'; ctx.fill();
  ctx.beginPath(); ctx.arc(3, -12, 6.5, 0, Math.PI * 2); ctx.fillStyle = '#ffd9b3'; ctx.fill();
  ctx.restore();

  drawMeatStack(ctx, p, bobY);   // cut meat in front
  drawHandCash(ctx, p, bobY);    // cash in hand

  for (const s of saws) if (s.sy >= -6) drawSaw(ctx, s.sx, s.sy + bobY, s.spin);
  ctx.restore();
}

function drawBackStack(ctx, p, bobY) {
  const n = Math.min(p.fishStack.length, 8);
  for (let i = 0; i < n; i++) {
    const val = p.fishStack[p.fishStack.length - n + i] || 1;
    drawTinyFish(ctx, -13 - (i % 2) * 2, -6 - i * 6 + bobY, val);
  }
}

function drawMeatStack(ctx, p, bobY) {
  const n = Math.min(p.meatStack.length, 8);
  for (let i = 0; i < n; i++) {
    const y = -4 - i * 5 + bobY;
    const x = 13 + (i % 2) * 2;
    ctx.beginPath();
    ctx.ellipse(x, y, 6, 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#f2916f'; ctx.fill();
    ctx.strokeStyle = '#e07a55'; ctx.lineWidth = 1.5; ctx.stroke();
  }
}

function drawHandCash(ctx, p, bobY) {
  if (p.hand <= 0) return;
  const n = Math.min(1 + Math.floor(Math.log10(p.hand + 1) * 2), 6);
  for (let i = 0; i < n; i++) {
    const y = 8 - i * 3 + bobY;
    ctx.fillStyle = '#5fbf6a';
    roundRect(ctx, 8, y, 14, 6, 2); ctx.fill();
    ctx.strokeStyle = '#3f9a4a'; ctx.lineWidth = 1; ctx.stroke();
  }
}

function drawTinyFish(ctx, x, y, val) {
  const s = 6 + Math.min(val, 4) * 1.2;
  const col = val >= 4 ? '#e6c15a' : val >= 2 ? '#f08a6d' : '#9fd3c7';
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = col; ctx.fill();
  ctx.beginPath();
  ctx.moveTo(s * 0.9, 0); ctx.lineTo(s * 1.4, -s * 0.4); ctx.lineTo(s * 1.4, s * 0.4); ctx.closePath();
  ctx.fillStyle = col; ctx.fill();
  ctx.restore();
}

function drawSaw(ctx, x, y, spin) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  const r = 12;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = '#dfe8ee'; ctx.fill();
  ctx.strokeStyle = '#9fb2bf'; ctx.lineWidth = 3;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    ctx.lineTo(Math.cos(a) * (r + 4), Math.sin(a) * (r + 4));
    ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = '#5a6b76'; ctx.fill();
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
