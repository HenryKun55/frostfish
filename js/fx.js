// Lightweight particle system for juice: ice shards, splashes, pickups.

const parts = [];

export function spawnShards(x, y, count = 8, color = '#dff2ff') {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 40 + Math.random() * 120;
    parts.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 40,
      g: 260,
      life: 0.4 + Math.random() * 0.35,
      t: 0,
      size: 2 + Math.random() * 4,
      color,
      kind: 'shard',
    });
  }
}

// A small number/text that floats up and fades (e.g. "+1").
export function spawnFloatText(x, y, text, color = '#ffffff') {
  parts.push({
    x, y, vx: 0, vy: -46, g: 0,
    life: 0.9, t: 0, text, color, kind: 'text',
  });
}

export function updateFX(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.t += dt;
    if (p.t >= p.life) { parts.splice(i, 1); continue; }
    p.vy += p.g * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
}

export function drawFX(ctx) {
  for (const p of parts) {
    const k = 1 - p.t / p.life;
    ctx.globalAlpha = Math.max(0, k);
    if (p.kind === 'text') {
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(6,30,45,0.6)';
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + k * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}
