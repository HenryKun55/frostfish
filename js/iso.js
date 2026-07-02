// Isometric projection with tunable YAW (board spin) + PITCH (camera tilt).
// Ground plane (wx, wy) is rotated by yaw, then foreshortened by sin(pitch).
// Live-tunable via setView(); the world rebuilds its ground on change.

export const ISO = {};
const S = 0.82; // overall scale (world unit -> screen px)

export function setView(yawDeg, pitchDeg) {
  const y = yawDeg * Math.PI / 180;
  const p = pitchDeg * Math.PI / 180;
  ISO.yawDeg = yawDeg;
  ISO.pitchDeg = pitchDeg;
  ISO.cos = Math.cos(y);
  ISO.sin = Math.sin(y);
  ISO.sp = Math.sin(p);
  ISO.S = S;
}

setView(120, 60); // starting point (tunable in-game)

// World point -> screen point.
export function project(wx, wy) {
  const rx = wx * ISO.cos - wy * ISO.sin;
  const ry = wx * ISO.sin + wy * ISO.cos;
  return { x: rx * ISO.S, y: ry * ISO.S * ISO.sp };
}

// World vector -> screen vector (linear part only).
export function projectVec(vx, vy) {
  const rx = vx * ISO.cos - vy * ISO.sin;
  const ry = vx * ISO.sin + vy * ISO.cos;
  return { x: rx * ISO.S, y: ry * ISO.S * ISO.sp };
}

// Screen vector -> world vector (invert projection, so screen-up = up-screen).
export function screenToWorldVec(dx, dy) {
  const rx = dx / ISO.S;
  const ry = dy / (ISO.S * ISO.sp);
  return { x: rx * ISO.cos + ry * ISO.sin, y: -rx * ISO.sin + ry * ISO.cos };
}

// Depth key (proportional to screen y) for painter's-algorithm sorting.
export function depth(wx, wy) {
  return wx * ISO.sin + wy * ISO.cos;
}

export function groundShadow(ctx, sx, sy, rx, ry, alpha = 0.2) {
  ctx.beginPath();
  ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(10,40,60,${alpha})`;
  ctx.fill();
}
