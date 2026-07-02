// Ice cubes with frozen fish, flowing down the diagonal river (+wx) out of the
// waterfall. Saws break them (harder the bigger the cube); bigger cubes hold
// bigger, more valuable fish. Fish pop out and are collected onto the back.

import { spawnShards, spawnFloatText } from './fx.js';
import { project, depth, groundShadow } from './iso.js';
import { sfx } from './audio.js';

// Fish tiers by cube size: [minSize, color, value]
const TIERS = [
  { color: '#9fd3c7', value: 1 }, // small
  { color: '#f08a6d', value: 2 }, // medium
  { color: '#e6c15a', value: 4 }, // big
];

export function createIceField(world) {
  return {
    world,
    cubes: [],
    pickups: [],
    time: 0,
    spawnCooldown: 0,
  };
}

// Very scarce and slow at the start; eases up gradually over time.
function targetCount(field) {
  return Math.min(6, 1 + Math.floor(field.time / 55));
}
function spawnInterval(field) {
  return Math.max(1.6, 4.2 - field.time / 45);
}

function spawnCube(field) {
  const world = field.world;
  const wyA = world.beachEdge + 22, wyB = world.riverEdge - 22;
  const wy = wyA + Math.random() * (wyB - wyA);

  // Mostly small; big cubes are rare.
  const roll = Math.random();
  const tierIdx = roll > 0.9 ? 2 : roll > 0.6 ? 1 : 0;
  const tier = TIERS[tierIdx];
  const size = [26, 34, 46][tierIdx] * (0.92 + Math.random() * 0.16);

  field.cubes.push({
    x: world.sourceX + 20 + Math.random() * 30,
    y: wy,
    size,
    hp: 2 + tierIdx * 2,          // bigger = harder to break
    maxHp: 2 + tierIdx * 2,
    vx: 16 + Math.random() * 10,  // slow drift downstream
    tier,
    shake: 0,
    hitTimer: 0,
    bobT: Math.random() * Math.PI * 2,
  });
}

export function updateIceField(field, dt, player, saws) {
  const world = field.world;
  field.time += dt;

  field.spawnCooldown -= dt;
  if (field.cubes.length < targetCount(field) && field.spawnCooldown <= 0) {
    spawnCube(field);
    field.spawnCooldown = spawnInterval(field);
  }

  for (let i = field.cubes.length - 1; i >= 0; i--) {
    const c = field.cubes[i];
    c.bobT += dt;
    c.shake = Math.max(0, c.shake - dt * 6);
    c.hitTimer = Math.max(0, c.hitTimer - dt);
    c.x += c.vx * dt;

    if (c.x > world.endX) { field.cubes.splice(i, 1); continue; }

    let hit = false;
    for (const s of saws) {
      if (Math.hypot(s.x - c.x, s.y - c.y) < s.r + c.size * 0.5) { hit = true; break; }
    }
    if (hit && c.hitTimer <= 0) {
      c.hp -= 1;
      c.shake = 1;
      c.hitTimer = 0.12;
      const sp = project(c.x, c.y);
      spawnShards(sp.x, sp.y - 6, 5, '#eaf7ff');
      sfx.hit();
      if (c.hp <= 0) { shatter(field, c); field.cubes.splice(i, 1); }
    }
  }

  // Pickups: pop out, magnet in, collect onto the back (no carry limit).
  const magnetR = 150, collectR = 50;
  for (let i = field.pickups.length - 1; i >= 0; i--) {
    const f = field.pickups[i];
    f.t += dt;
    f.vx *= 0.9; f.vy *= 0.9;
    f.x += f.vx * dt; f.y += f.vy * dt;

    const d = Math.hypot(player.x - f.x, player.y - f.y);
    if (f.t > 0.2 && d < collectR) {
      player.fishStack.push(f.value);
      const sp = project(player.x, player.y);
      spawnFloatText(sp.x, sp.y - 40, '+1', '#bff0ff');
      sfx.pickup();
      field.pickups.splice(i, 1);
      continue;
    }
    if (f.t > 0.2 && d < magnetR) {
      const pull = (1 - d / magnetR) * 900;
      f.x += (player.x - f.x) / (d || 1) * pull * dt;
      f.y += (player.y - f.y) / (d || 1) * pull * dt;
    }
    if (f.t > 16) field.pickups.splice(i, 1);
  }
}

function shatter(field, c) {
  const sp = project(c.x, c.y);
  spawnShards(sp.x, sp.y, 16, '#dff2ff');
  field.pickups.push({
    x: c.x, y: c.y,
    vx: (Math.random() - 0.5) * 40,
    vy: (Math.random() - 0.5) * 40,
    t: 0,
    value: c.tier.value,
    color: c.tier.color,
    wob: Math.random() * Math.PI * 2,
  });
}

export function collectIceSprites(field, out) {
  for (const c of field.cubes) {
    out.push({ y: depth(c.x, c.y), draw: (ctx) => {
      const jitter = c.shake ? (Math.random() - 0.5) * c.shake * 5 : 0;
      drawCube(ctx, c.x, c.y, c.size, c.tier.color, c.hp / c.maxHp, jitter);
    }});
  }
  for (const f of field.pickups) {
    f.wob += 0.2;
    out.push({ y: depth(f.x, f.y), draw: (ctx) => {
      const s = project(f.x, f.y);
      drawFish(ctx, s.x, s.y - 8 + Math.sin(f.wob) * 2, f.color, f.value);
    }});
  }
}

function drawCube(ctx, wx, wy, size, fishColor, hpFrac, jitter) {
  const p = project(wx, wy);
  const x = p.x + jitter, y = p.y;
  const w = size * 0.5, k = w * 0.5, h = size * 1.05;
  groundShadow(ctx, x, y, size * 0.55, size * 0.28, 0.18);

  ctx.save();
  ctx.translate(x, y);
  const botS = [0, 0], botE = [w, -k], botW = [-w, -k];
  const topS = [0, -h], topE = [w, -h - k], topN = [0, -h - 2 * k], topW = [-w, -h - k];
  const face = (pts, fill) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.5; ctx.stroke();
  };
  drawFish(ctx, 0, -h * 0.5 - k * 0.5, fishColor, size >= 40 ? 4 : size >= 30 ? 2 : 1);
  face([topW, topS, botS, botW], 'rgba(150,205,240,0.44)');
  face([topS, topE, botE, botS], 'rgba(120,185,225,0.48)');
  face([topW, topN, topE, topS], 'rgba(210,240,255,0.5)');
  ctx.beginPath(); ctx.moveTo(-w + 4, -k - 4); ctx.lineTo(0, -h + 4);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; ctx.stroke();
  const dmg = 1 - hpFrac;
  if (dmg > 0.01) {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.2;
    const n = Math.round(dmg * 4);
    for (let i = 0; i < n; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.6;
      ctx.beginPath(); ctx.moveTo(0, -h * 0.5);
      ctx.lineTo(Math.cos(a) * w * 0.8, -h * 0.5 + Math.sin(a) * h * 0.4);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawFish(ctx, x, y, color, value) {
  const s = 7 + Math.min(value, 4) * 1.6; // smaller fish overall
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-s * 0.9, 0); ctx.lineTo(-s * 1.4, -s * 0.4); ctx.lineTo(-s * 1.4, s * 0.4); ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
  ctx.beginPath(); ctx.arc(s * 0.5, -s * 0.1, s * 0.12, 0, Math.PI * 2);
  ctx.fillStyle = '#123'; ctx.fill();
  ctx.restore();
}
