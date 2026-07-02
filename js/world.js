// World layout in TRUE isometric. Everything lives in world coords (wx, wy):
//   - a diagonal ICE RIVER (band across wy) flows toward +wx, out of a misty
//     waterfall at low wx (upper-left of screen).
//   - a snowy FOREST on one side of the river, a sandy BEACH on the other
//     (where the cutting pad, upgrade pads, fence and crowd live).
// The ground is a pre-rendered isometric diamond-tile floor.

import { project, depth, groundShadow } from './iso.js';

const TILE = 64;

export function createWorld() {
  const world = {
    sourceX: -260, endX: 820,     // river runs along +wx
    beachEdge: -80, riverEdge: 80, // wy < beachEdge = beach; [beachEdge,riverEdge] = water; > = forest
    tilesX: [-360, 900], tilesY: [-380, 320],
    trees: [],
    froth: [],
  };

  // Playable bounds (world coords): fish in the river, deliver on the beach,
  // can't wander into the forest or past the fence.
  world.play = { minX: -110, maxX: 265, minY: -275, maxY: 75 };

  let seed = 20260702;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

  // Pines in the forest band (wy > riverEdge).
  for (let i = 0; i < 46; i++) {
    world.trees.push({
      x: world.tilesX[0] + rand() * (world.tilesX[1] - world.tilesX[0]),
      y: world.riverEdge + 40 + rand() * 240,
      s: 0.7 + rand() * 0.8,
    });
  }
  // Waterfall froth across the river mouth.
  for (let i = 0; i < 20; i++) {
    world.froth.push({
      off: rand() * 40,
      wy: world.beachEdge + 10 + rand() * (world.riverEdge - world.beachEdge - 20),
      r: 5 + rand() * 10,
      ph: rand() * Math.PI * 2,
    });
  }

  world.ground = buildGround(world);
  return world;
}

// Re-render the iso tile floor (call after changing the view angles).
export function rebuildGround(world) {
  world.ground = buildGround(world);
}

function buildGround(world) {
  const [wxMin, wxMax] = world.tilesX;
  const [wyMin, wyMax] = world.tilesY;
  const corners = [project(wxMin, wyMin), project(wxMax, wyMin), project(wxMin, wyMax), project(wxMax, wyMax)];
  const xs = corners.map(c => c.x), ys = corners.map(c => c.y);
  const bx0 = Math.min(...xs) - 40, by0 = Math.min(...ys) - 40;
  const bx1 = Math.max(...xs) + 40, by1 = Math.max(...ys) + 40;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(bx1 - bx0); cv.height = Math.ceil(by1 - by0);
  const g = cv.getContext('2d');
  g.translate(-bx0, -by0);

  for (let i = Math.floor(wxMin / TILE); i <= Math.ceil(wxMax / TILE); i++) {
    for (let j = Math.floor(wyMin / TILE); j <= Math.ceil(wyMax / TILE); j++) {
      const cyw = (j + 0.5) * TILE;
      const alt = (i + j) & 1;
      let fill;
      if (cyw < world.beachEdge) fill = alt ? '#ecd6a8' : '#e2c996';        // beach
      else if (cyw <= world.riverEdge) fill = alt ? '#8fc6ef' : '#5c9fd6';  // water
      else fill = alt ? '#eaf4fd' : '#dfeafb';                              // forest snow

      const A = project(i * TILE, j * TILE);
      const B = project((i + 1) * TILE, j * TILE);
      const C = project((i + 1) * TILE, (j + 1) * TILE);
      const D = project(i * TILE, (j + 1) * TILE);
      g.beginPath();
      g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); g.lineTo(C.x, C.y); g.lineTo(D.x, D.y);
      g.closePath();
      g.fillStyle = fill;
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.09)';
      g.lineWidth = 1;
      g.stroke();
    }
  }
  return { canvas: cv, x: bx0, y: by0 };
}

export function drawWorld(ctx, world, time) {
  ctx.drawImage(world.ground.canvas, world.ground.x, world.ground.y);

  // Flowing streaks along +wx in the water band.
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 3;
  for (let wy = world.beachEdge + 12; wy <= world.riverEdge - 12; wy += 24) {
    for (let n = 0; n < 9; n++) {
      const span = world.endX - world.sourceX;
      const wx = world.sourceX + ((time * 55 + n * 128 + wy * 5) % span);
      const a = project(wx, wy), b = project(wx + 28, wy);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }

  // Waterfall froth at the source.
  for (const f of world.froth) {
    const s = project(world.sourceX + f.off, f.wy + Math.sin(time * 2 + f.ph) * 3);
    ctx.beginPath();
    ctx.arc(s.x, s.y, f.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fill();
  }
}

function drawTree(ctx, t) {
  const s = project(t.x, t.y);
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.scale(t.s, t.s);
  groundShadow(ctx, 0, 4, 24, 9, 0.22);
  ctx.fillStyle = '#8a5a34';
  ctx.fillRect(-5, -6, 10, 16);
  for (let i = 0; i < 3; i++) {
    const y = -10 - i * 22;
    const w = 32 - i * 8;
    ctx.beginPath();
    ctx.moveTo(0, y - 26); ctx.lineTo(-w, y); ctx.lineTo(w, y); ctx.closePath();
    ctx.fillStyle = '#dff0fb'; ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, y - 26); ctx.lineTo(-w * 0.5, y - 8); ctx.lineTo(w * 0.5, y - 8); ctx.closePath();
    ctx.fillStyle = '#ffffff'; ctx.fill();
  }
  ctx.restore();
}

// Expose the tree drawer so trees can be depth-sorted with other sprites.
export function collectWorldSprites(world, out) {
  for (const t of world.trees) out.push({ y: depth(t.x, t.y), draw: (ctx) => drawTree(ctx, t) });
}
