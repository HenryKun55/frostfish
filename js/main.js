// FrostFish — entry point. Sets up canvas, game loop, and wires modules.
// Milestone M0: moving fisher on the ice with spinning saws + follow camera.

import { initInput, getMoveVector } from './input.js';
import { createPlayer, updatePlayer, drawPlayer, getSawPositions } from './player.js';
import { createWorld, drawWorld, collectWorldSprites, rebuildGround } from './world.js';
import { createCamera, updateCamera, applyCamera } from './camera.js';
import { createIceField, updateIceField, collectIceSprites } from './ice.js';
import { createStructures, updateStructures, collectStructureSprites, drawStructureGround, drawStructureOverlay } from './structures.js';
import { updateFX, drawFX } from './fx.js';
import { project, screenToWorldVec, depth, ISO, setView } from './iso.js';
import { initAudio, toggleMute } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let viewW = 0, viewH = 0, dpr = 1;

// The game plays inside a centered PORTRAIT stage (phone-shaped). On a wide
// desktop window the rest is letterboxed; on a phone it fills the screen.
const STAGE_ASPECT = 9 / 16; // width / height
const stage = { x: 0, y: 0, w: 0, h: 0 };

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  viewW = window.innerWidth;
  viewH = window.innerHeight;
  canvas.width = Math.floor(viewW * dpr);
  canvas.height = Math.floor(viewH * dpr);
  canvas.style.width = viewW + 'px';
  canvas.style.height = viewH + 'px';

  // Fit the tallest portrait rectangle inside the window.
  let sh = viewH;
  let sw = sh * STAGE_ASPECT;
  if (sw > viewW) { sw = viewW; sh = sw / STAGE_ASPECT; }
  stage.w = sw; stage.h = sh;
  stage.x = (viewW - sw) / 2;
  stage.y = (viewH - sh) / 2;

  // Zoom so the portrait width frames the whole operation.
  cam.zoom = Math.max(0.7, Math.min(1.9, sw / 400));

  // Keep the HUD/hint inside the stage.
  layoutOverlays();
}
window.addEventListener('resize', resize);

function layoutOverlays() {
  const hud = document.getElementById('hud');
  const hintEl = document.getElementById('hint');
  if (hud) { hud.style.left = stage.x + 'px'; hud.style.width = stage.w + 'px'; hud.style.right = 'auto'; }
  if (hintEl) hintEl.style.bottom = (viewH - stage.y - stage.h + 14) + 'px';
}

// --- Game state ---
const world = createWorld();
const player = createPlayer(120, 20);
const iceField = createIceField(world);
const structures = createStructures(world);
const cam = createCamera();
{ const s = project(player.x, player.y); cam.x = s.x; cam.y = s.y; }
let time = 0; // seconds elapsed, for ambient animation

// Camera target in projected (screen) space.
const camTarget = { x: 0, y: 0 };

// HUD elements.
const hudMoney = document.getElementById('hud-money');
const hudFish = document.getElementById('hud-fish');
const hudMeat = document.getElementById('hud-meat');
function updateHUD() {
  hudMoney.textContent = `$ ${fmt(player.hand)}`;
  hudFish.textContent = `🐟 ${fmt(player.fishStack.length)}`;
  hudMeat.textContent = `🥩 ${fmt(player.meatStack.length)}`;
}

// Compact number formatting for exponential growth (1.2k, 3.4M, ...).
function fmt(n) {
  if (n < 1000) return `${n}`;
  const units = ['k', 'M', 'B', 'T'];
  let u = -1;
  while (n >= 1000 && u < units.length - 1) { n /= 1000; u++; }
  return `${n.toFixed(n < 10 ? 1 : 0)}${units[u]}`;
}

// --- Input ---
const hint = document.getElementById('hint');
initInput(canvas, () => {
  if (hint) hint.classList.add('fade');
  initAudio(); // start audio on first user gesture
});

// Mute toggle (button + 'M' key).
const muteBtn = document.getElementById('mute');
function refreshMute(m) { if (muteBtn) muteBtn.textContent = m ? '🔇' : '🔊'; }
if (muteBtn) muteBtn.addEventListener('click', () => { initAudio(); refreshMute(toggleMute()); });
window.addEventListener('keydown', (e) => { if (e.code === 'KeyM') { initAudio(); refreshMute(toggleMute()); } });

// --- Live camera-angle tuner (yaw = board spin, pitch = tilt) ---
// [ ] adjust pitch, ; ' adjust yaw. Values shown in #debug.
const debugEl = document.getElementById('debug');
function showAngles() {
  if (!debugEl) return;
  debugEl.style.display = 'block';
  debugEl.textContent = `yaw ${Math.round(ISO.yawDeg)}°  ·  pitch ${Math.round(ISO.pitchDeg)}°  ([ ] pitch, ; ' yaw)`;
}
window.addEventListener('keydown', (e) => {
  let yaw = ISO.yawDeg, pitch = ISO.pitchDeg, changed = true;
  switch (e.code) {
    case 'BracketLeft': pitch -= 2; break;
    case 'BracketRight': pitch += 2; break;
    case 'Semicolon': yaw -= 2; break;
    case 'Quote': yaw += 2; break;
    default: changed = false;
  }
  if (!changed) return;
  pitch = Math.max(10, Math.min(89, pitch));
  setView(yaw, pitch);
  rebuildGround(world);
  showAngles();
});

resize();

// --- Loop ---
let last = performance.now();
function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05; // clamp big pauses

  update(dt);
  render();

  requestAnimationFrame(frame);
}

function update(dt) {
  time += dt;
  // Screen-space input -> world-space movement (so up = up-screen).
  const sm = getMoveVector();
  let move = { x: 0, y: 0 };
  const mag = Math.hypot(sm.x, sm.y);
  if (mag > 0) {
    const w = screenToWorldVec(sm.x, sm.y);
    const wl = Math.hypot(w.x, w.y) || 1;
    move = { x: w.x / wl * mag, y: w.y / wl * mag };
  }
  updatePlayer(player, move, dt, world);
  updateIceField(iceField, dt, player, getSawPositions(player));
  updateStructures(structures, dt, player);
  updateFX(dt);
  const s = project(player.x, player.y);
  camTarget.x = s.x;
  camTarget.y = s.y;
  updateCamera(cam, camTarget, dt);
  updateHUD();
}

function render() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Letterbox background (outside the phone stage).
  ctx.fillStyle = '#0b1a26';
  ctx.fillRect(0, 0, viewW, viewH);

  // Clip everything to the portrait stage.
  ctx.save();
  const rad = 18;
  roundRect(ctx, stage.x, stage.y, stage.w, stage.h, rad);
  ctx.clip();

  // Sky fill inside the stage (shows above the world border).
  ctx.fillStyle = '#bfe6ff';
  ctx.fillRect(stage.x, stage.y, stage.w, stage.h);

  ctx.save();
  applyCamera(ctx, cam, stage.x + stage.w / 2, stage.y + stage.h / 2);

  drawWorld(ctx, world, time);
  drawStructureGround(ctx, structures, time);

  // Depth-sorted sprites (cubes, pickups, player) so nearer ones draw on top.
  const sprites = [];
  collectWorldSprites(world, sprites);
  collectIceSprites(iceField, sprites);
  collectStructureSprites(structures, sprites, time);
  sprites.push({ y: depth(player.x, player.y), draw: (c) => drawPlayer(c, player) });
  sprites.sort((a, b) => a.y - b.y);
  for (const s of sprites) s.draw(ctx);

  drawFX(ctx);
  drawStructureOverlay(ctx, structures);

  ctx.restore(); // camera

  // Misty fog at the top of the stage: hides where the river comes from.
  const fogH = stage.h * 0.18;
  const fog = ctx.createLinearGradient(0, stage.y, 0, stage.y + fogH);
  fog.addColorStop(0, 'rgba(233,246,255,0.98)');
  fog.addColorStop(0.6, 'rgba(233,246,255,0.6)');
  fog.addColorStop(1, 'rgba(233,246,255,0)');
  ctx.fillStyle = fog;
  ctx.fillRect(stage.x, stage.y, stage.w, fogH);

  ctx.restore(); // clip

  // Phone frame outline.
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 2;
  roundRect(ctx, stage.x + 1, stage.y + 1, stage.w - 2, stage.h - 2, rad);
  ctx.stroke();
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

requestAnimationFrame(frame);
