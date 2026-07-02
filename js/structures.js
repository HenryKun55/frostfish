// Beach work-stations (idle-game style — you shuttle goods between spots):
//
//   TABLE (big, 2 zones):
//     · DROP zone  -> throw raw fish from your back onto the table
//     · table auto-cuts raw fish into meat over time (slow at first)
//     · PICK zone  -> grab the cut meat onto yourself
//   DELIVERY counter -> hand meat to the buyers (steak flies to a customer)
//   MONEY square     -> the cash buyers leave piles up here; stand on it to
//                       collect it (in a queue) into your hand
//   DEPOSIT boxes    -> drain hand-cash into a box; when full it upgrades
//
// You carry raw fish on the back and cash in hand — both unlimited.

import { project, depth, groundShadow } from './iso.js';
import { spawnShards, spawnFloatText } from './fx.js';
import { sfx } from './audio.js';

export function createStructures(world) {
  const struct = {
    sellPrice: 2,
    table: {
      x: 40, y: -130,
      rawBuf: [], meatBuf: 0,
      procInterval: 0.7, procTimer: 0, chop: 0,
      drop: { x: -40, y: -130, r: 32 }, dropTimer: 0,
      pick: { x: 120, y: -130, r: 32 }, pickTimer: 0,
    },
    delivery: { x: 230, y: -150, r: 46, interval: 0.35, timer: 0 },
    money: { x: 230, y: -245, r: 46, pile: 0, timer: 0 },
    deposits: [
      { type: 'saw', x: -70, y: -215, r: 42, cost: 25, filled: 0, level: 0, timer: 0, label: 'SERRA' },
      { type: 'cut', x: 60, y: -255, r: 42, cost: 40, filled: 0, level: 0, timer: 0, label: 'CORTE' },
    ],
    fence: [],
    customers: [],
    flies: [],
  };

  // Short diagonal barrier (constant wx) directly in front of the crowd.
  for (let wy = -120; wy >= -360; wy -= 30) struct.fence.push({ x: 300, y: wy });

  // Tidy, contained crowd behind the fence.
  let seed = 777;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 5; row++) {
      struct.customers.push({
        x: 335 + col * 42 + rand() * 10,
        y: -150 - row * 46 - col * 8 - rand() * 12,
        coat: `hsl(${44 + rand() * 8}, 85%, ${55 + rand() * 8}%)`,
        bob: rand() * Math.PI * 2, pop: 0,
      });
    }
  }
  return struct;
}

function dist(p, s) { return Math.hypot(p.x - s.x, p.y - s.y); }
function fly(struct, fx, fy, tx, ty, type, payload) {
  struct.flies.push({ x: fx, y: fy, tx, ty, type, payload });
}

export function updateStructures(struct, dt, player) {
  const T = struct.table;

  // DROP raw fish onto the table.
  T.dropTimer -= dt;
  if (dist(player, T.drop) < T.drop.r && player.fishStack.length > 0 && T.dropTimer <= 0) {
    const v = player.fishStack.pop();
    T.dropTimer = 0.14;
    fly(struct, player.x, player.y, T.drop.x, T.drop.y, 'drop', v);
  }

  // Table auto-cuts raw -> meat (bigger fish = more meat).
  T.procTimer -= dt;
  T.chop = Math.max(0, T.chop - dt * 5);
  if (T.rawBuf.length > 0 && T.procTimer <= 0) {
    const v = T.rawBuf.shift();
    T.meatBuf += v;
    T.procTimer = T.procInterval;
    T.chop = 1;
    const sp = project(T.x, T.y);
    spawnShards(sp.x, sp.y - 20, 4, '#ffd0b8');
    sfx.chop();
  }

  // PICK meat off the table onto yourself.
  T.pickTimer -= dt;
  if (dist(player, T.pick) < T.pick.r && T.meatBuf > 0 && T.pickTimer <= 0) {
    T.meatBuf -= 1;
    T.pickTimer = 0.12;
    fly(struct, T.pick.x, T.pick.y, player.x, player.y, 'meat', 1);
  }

  // DELIVER meat to a buyer.
  const d = struct.delivery;
  d.timer -= dt;
  if (dist(player, d) < d.r && player.meatStack.length > 0 && d.timer <= 0) {
    player.meatStack.pop();
    d.timer = d.interval;
    const cust = struct.customers[(Math.random() * struct.customers.length) | 0];
    fly(struct, d.x, d.y, cust.x, cust.y, 'sale', { value: struct.sellPrice, cust });
  }

  // COLLECT the money buyers left (queued into your hand).
  const M = struct.money;
  M.timer -= dt;
  if (dist(player, M) < M.r && M.pile > 0 && M.timer <= 0) {
    const amt = Math.min(M.pile, Math.max(1, Math.ceil(M.pile / 8)));
    M.pile -= amt;
    M.timer = 0.05;
    fly(struct, M.x, M.y, player.x, player.y, 'cash', amt);
  }

  // DEPOSIT hand-cash into upgrade boxes.
  for (const b of struct.deposits) {
    b.timer -= dt;
    if (dist(player, b) < b.r && player.hand > 0 && b.timer <= 0) {
      const amt = Math.min(player.hand, Math.max(1, Math.ceil(b.cost / 25)));
      player.hand -= amt;
      b.timer = 0.05;
      fly(struct, player.x, player.y, b.x, b.y, 'deposit', { box: b, amt });
    }
  }

  // Advance flying items; apply effect on arrival.
  for (let i = struct.flies.length - 1; i >= 0; i--) {
    const f = struct.flies[i];
    f.x += (f.tx - f.x) * 0.25;
    f.y += (f.ty - f.y) * 0.25;
    if (Math.hypot(f.tx - f.x, f.ty - f.y) < 5) {
      arrive(struct, player, f);
      struct.flies.splice(i, 1);
    }
  }

  for (const cu of struct.customers) cu.pop = Math.max(0, cu.pop - dt * 4);
}

function arrive(struct, player, f) {
  const sp = project(f.tx, f.ty);
  if (f.type === 'drop') struct.table.rawBuf.push(f.payload);
  else if (f.type === 'meat') player.meatStack.push(1);
  else if (f.type === 'sale') {
    struct.money.pile += f.payload.value;
    if (f.payload.cust) f.payload.cust.pop = 1;
    spawnFloatText(sp.x, sp.y - 22, `+$${f.payload.value}`, '#ffe08a');
    sfx.coin();
  } else if (f.type === 'cash') {
    player.hand += f.payload;
  } else if (f.type === 'deposit') {
    const b = f.payload.box;
    b.filled += f.payload.amt;
    if (b.filled >= b.cost) {
      b.filled -= b.cost;
      b.level += 1;
      applyUpgrade(b, player, struct);
      b.cost = Math.ceil(b.cost * 1.7);
      spawnShards(sp.x, sp.y - 12, 10, '#9be7ff');
      spawnFloatText(sp.x, sp.y - 48, `Nv.${b.level}`, '#bff0ff');
      sfx.upgrade();
    }
  }
}

function applyUpgrade(b, player, struct) {
  if (b.type === 'saw') {
    if (player.sawCount < 6) player.sawCount += 1;
    player.sawSpinSpeed += 0.8;
    player.sawOrbit += 1.5;
  } else {
    struct.sellPrice += 2;
    struct.table.procInterval = Math.max(0.1, struct.table.procInterval * 0.85);
    struct.delivery.interval = Math.max(0.08, struct.delivery.interval * 0.9);
  }
}

// --- Floor markers ---
export function drawStructureGround(ctx, struct, time) {
  const T = struct.table;
  padDiamond(ctx, T.drop.x, T.drop.y, 30, 'rgba(150,200,255,0.16)', '🐟', time);
  padDiamond(ctx, T.pick.x, T.pick.y, 30, 'rgba(255,180,140,0.16)', '🥩', time);
  padDiamond(ctx, struct.delivery.x, struct.delivery.y, 46, 'rgba(150,220,150,0.16)', '📦', time);
  padDiamond(ctx, struct.money.x, struct.money.y, 46, 'rgba(255,215,80,0.18)', '💰', time);
  for (const b of struct.deposits) depositFloor(ctx, b, b.filled / b.cost, time);
}

export function collectStructureSprites(struct, out, time) {
  for (const p of struct.fence) out.push({ y: depth(p.x, p.y), draw: (ctx) => drawFencePost(ctx, p.x, p.y) });
  for (const cu of struct.customers) out.push({ y: depth(cu.x, cu.y), draw: (ctx) => drawCustomer(ctx, cu, time) });
  const T = struct.table;
  out.push({ y: depth(T.drop.x, T.drop.y) - 1, draw: (ctx) => drawRawPile(ctx, T) });
  out.push({ y: depth(T.pick.x, T.pick.y) - 1, draw: (ctx) => drawMeatPile(ctx, T) });
  out.push({ y: depth(T.x, T.y), draw: (ctx) => drawTable(ctx, T) });
  out.push({ y: depth(struct.delivery.x, struct.delivery.y), draw: (ctx) => drawCounter(ctx, struct.delivery) });
  out.push({ y: depth(struct.money.x, struct.money.y), draw: (ctx) => drawMoneyPile(ctx, struct.money) });
  for (const b of struct.deposits) out.push({ y: depth(b.x, b.y), draw: (ctx) => drawDepositBox(ctx, b) });
  for (const f of struct.flies) out.push({ y: depth(f.x, f.y) + 9999, draw: (ctx) => drawFly(ctx, f) });
}

export function drawStructureOverlay(ctx, struct) {
  for (const b of struct.deposits) {
    const sp = project(b.x, b.y);
    tag(ctx, sp.x, sp.y - 64, `${b.label}  ${b.filled}/${b.cost}`);
  }
}

// ---- drawing helpers ----
function diamond(ctx, p, hw) {
  const hy = hw * 0.5;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - hy); ctx.lineTo(p.x + hw, p.y); ctx.lineTo(p.x, p.y + hy); ctx.lineTo(p.x - hw, p.y);
  ctx.closePath();
}
function padDiamond(ctx, wx, wy, hw, fill, icon, time) {
  const p = project(wx, wy);
  diamond(ctx, p, hw);
  ctx.fillStyle = fill; ctx.fill();
  ctx.setLineDash([8, 7]); ctx.lineDashOffset = -(time || 0) * 18;
  ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = '18px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.globalAlpha = 0.5; ctx.fillText(icon, p.x, p.y); ctx.globalAlpha = 1;
}
function depositFloor(ctx, b, frac, time) {
  const p = project(b.x, b.y), hw = 42;
  diamond(ctx, p, hw);
  ctx.fillStyle = b.type === 'saw' ? 'rgba(120,220,255,0.14)' : 'rgba(255,200,120,0.14)';
  ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = b.type === 'saw' ? 'rgba(120,220,255,0.45)' : 'rgba(255,200,120,0.5)';
  ctx.fillRect(p.x - hw, p.y + hw * 0.5 - hw * Math.min(1, frac), hw * 2, hw);
  ctx.restore();
  ctx.setLineDash([8, 7]); ctx.lineDashOffset = -(time || 0) * 18;
  ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.setLineDash([]);
}

function drawTable(ctx, T) {
  const p = project(T.x, T.y);
  groundShadow(ctx, p.x, p.y + 2, 38, 15, 0.2);
  ctx.save(); ctx.translate(p.x, p.y);
  ctx.fillStyle = '#8a5a34'; ctx.fillRect(-28, -6, 7, 20); ctx.fillRect(21, -6, 7, 20);
  ctx.fillStyle = '#a9713f'; roundRect(ctx, -34, -24, 68, 22, 7); ctx.fill();
  ctx.fillStyle = '#c08a54'; roundRect(ctx, -34, -26, 68, 8, 7); ctx.fill();
  // cutting board + animated knife
  ctx.fillStyle = '#e9e2d0'; roundRect(ctx, -16, -24, 30, 15, 4); ctx.fill();
  ctx.fillStyle = '#f08a6d'; ctx.beginPath(); ctx.ellipse(-4, -16, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
  const swing = Math.sin(T.chop * Math.PI) * 0.9;
  ctx.save(); ctx.translate(12, -24); ctx.rotate(-0.5 - swing);
  ctx.fillStyle = '#6d757b'; roundRect(ctx, 0, -3, 16, 6, 2); ctx.fill();
  ctx.fillStyle = '#3a3f43'; ctx.fillRect(-6, -2, 8, 4);
  ctx.restore(); ctx.restore();
}

function drawRawPile(ctx, T) {
  const p = project(T.drop.x, T.drop.y);
  const n = Math.min(T.rawBuf.length, 9);
  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    ctx.ellipse(p.x - 14 + (i % 3) * 14, p.y - 4 - Math.floor(i / 3) * 6, 7, 3.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#9fd3c7'; ctx.fill();
  }
}

function drawMeatPile(ctx, T) {
  const p = project(T.pick.x, T.pick.y);
  const n = Math.min(T.meatBuf, 12);
  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    ctx.ellipse(p.x - 14 + (i % 3) * 14, p.y - 4 - Math.floor(i / 3) * 6, 7, 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#f2916f'; ctx.fill();
    ctx.strokeStyle = '#e07a55'; ctx.lineWidth = 1; ctx.stroke();
  }
}

function drawCounter(ctx, d) {
  const p = project(d.x, d.y);
  groundShadow(ctx, p.x, p.y + 2, 34, 14, 0.2);
  ctx.save(); ctx.translate(p.x, p.y);
  ctx.fillStyle = '#8a5a34'; ctx.fillRect(-24, -6, 6, 18); ctx.fillRect(18, -6, 6, 18);
  ctx.fillStyle = '#b98a52'; roundRect(ctx, -30, -20, 60, 18, 6); ctx.fill();
  ctx.fillStyle = '#d0a066'; roundRect(ctx, -30, -22, 60, 7, 6); ctx.fill();
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(-14 + i * 14, -14, 6, 4, 0, 0, Math.PI * 2); ctx.fillStyle = '#f2916f'; ctx.fill(); }
  ctx.restore();
}

function drawMoneyPile(ctx, M) {
  const p = project(M.x, M.y);
  ctx.save(); ctx.translate(p.x, p.y);
  const n = Math.min(Math.ceil(M.pile / 4), 14);
  for (let i = 0; i < n; i++) {
    const bx = ((i * 37) % 40) - 20, by = -2 - Math.floor(i / 4) * 4;
    ctx.fillStyle = '#5fbf6a'; roundRect(ctx, bx, by, 14, 6, 2); ctx.fill();
    ctx.strokeStyle = '#3f9a4a'; ctx.lineWidth = 1; ctx.stroke();
  }
  ctx.restore();
}

function drawDepositBox(ctx, b) {
  const p = project(b.x, b.y);
  groundShadow(ctx, p.x, p.y, 20, 8, 0.2);
  ctx.save(); ctx.translate(p.x, p.y);
  ctx.fillStyle = '#8a5a34'; roundRect(ctx, -16, -20, 32, 22, 4); ctx.fill();
  ctx.fillStyle = '#a9713f'; roundRect(ctx, -16, -22, 32, 8, 4); ctx.fill();
  const frac = Math.min(1, b.filled / b.cost), ph = 2 + frac * 16;
  ctx.fillStyle = '#5fbf6a';
  for (let y = 0; y < ph; y += 4) ctx.fillRect(-12 + (y % 8 ? 2 : 0), -20 - y, 24, 3);
  ctx.fillStyle = '#7c5330'; ctx.fillRect(-2, -40, 4, 20);
  ctx.fillStyle = b.type === 'saw' ? '#2f6fb0' : '#c96a3f';
  roundRect(ctx, -16, -56, 32, 20, 5); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '15px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(b.type === 'saw' ? '⚙' : '🔪', 0, -46);
  ctx.restore();
}

function drawFly(ctx, f) {
  const sp = project(f.x, f.y);
  const x = sp.x, y = sp.y - 26;
  if (f.type === 'drop') {
    const v = f.payload, col = v >= 4 ? '#e6c15a' : v >= 2 ? '#f08a6d' : '#9fd3c7';
    ctx.save(); ctx.translate(x, y);
    ctx.beginPath(); ctx.ellipse(0, 0, 7, 3.5, 0, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
    ctx.restore();
  } else if (f.type === 'meat' || f.type === 'sale') {
    ctx.save(); ctx.translate(x, y);
    ctx.beginPath(); ctx.ellipse(0, 0, 9, 6, 0, 0, Math.PI * 2); ctx.fillStyle = '#f2916f'; ctx.fill();
    ctx.strokeStyle = '#e07a55'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  } else { // cash / deposit -> coin
    ctx.save(); ctx.translate(x, y);
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fillStyle = '#ffd24a'; ctx.fill();
    ctx.strokeStyle = '#d9a41f'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  }
}

function drawFencePost(ctx, wx, wy) {
  const p = project(wx, wy);
  groundShadow(ctx, p.x, p.y, 11, 5, 0.2);
  ctx.fillStyle = '#b07b45'; roundRect(ctx, p.x - 8, p.y - 36, 16, 40, 6); ctx.fill();
  ctx.fillStyle = '#c8935a'; ctx.beginPath(); ctx.ellipse(p.x, p.y - 36, 8, 3.5, 0, 0, Math.PI * 2); ctx.fill();
}

function drawCustomer(ctx, cu, time) {
  const p = project(cu.x, cu.y);
  const bob = Math.sin(cu.bob + time * 3) * 1.5 - cu.pop * 4;
  groundShadow(ctx, p.x, p.y + 2, 12, 5, 0.2);
  ctx.save(); ctx.translate(p.x, p.y + bob);
  ctx.fillStyle = cu.coat; roundRect(ctx, -10, -22, 20, 24, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(0, -28, 8, 0, Math.PI * 2); ctx.fillStyle = '#2a2a2a'; ctx.fill();
  ctx.beginPath(); ctx.arc(0, -26, 6, 0, Math.PI * 2); ctx.fillStyle = '#ffd9b3'; ctx.fill();
  ctx.restore();
}

function tag(ctx, x, y, text) {
  ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + 18;
  ctx.fillStyle = 'rgba(6,30,45,0.82)'; roundRect(ctx, x - w / 2, y - 12, w, 24, 12); ctx.fill();
  ctx.fillStyle = '#eaf6ff'; ctx.fillText(text, x, y);
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
