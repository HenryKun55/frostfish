// Unified input: keyboard (WASD/arrows) + touch/mouse drag.
// Exposes a normalized movement vector {x, y} in range [-1, 1].

const keys = new Set();

// --- Keyboard ---
const KEY_MAP = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};

window.addEventListener('keydown', (e) => {
  const dir = KEY_MAP[e.code];
  if (dir) { keys.add(dir); e.preventDefault(); }
});
window.addEventListener('keyup', (e) => {
  const dir = KEY_MAP[e.code];
  if (dir) keys.delete(dir);
});

// --- Drag (touch + mouse) ---
// A virtual joystick: press anywhere, drag; vector points from press origin
// to current position, clamped to a max radius.
const drag = { active: false, ox: 0, oy: 0, x: 0, y: 0 };
const MAX_RADIUS = 70; // px until full speed

let onFirstInput = null;

function pointerDown(px, py) {
  drag.active = true;
  drag.ox = px; drag.oy = py;
  drag.x = px; drag.y = py;
  if (onFirstInput) { onFirstInput(); onFirstInput = null; }
}
function pointerMove(px, py) {
  if (!drag.active) return;
  drag.x = px; drag.y = py;
}
function pointerUp() {
  drag.active = false;
}

export function initInput(canvas, firstInputCallback) {
  onFirstInput = firstInputCallback;

  canvas.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    pointerDown(t.clientX, t.clientY);
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    const t = e.changedTouches[0];
    pointerMove(t.clientX, t.clientY);
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchend', pointerUp);
  canvas.addEventListener('touchcancel', pointerUp);

  canvas.addEventListener('mousedown', (e) => pointerDown(e.clientX, e.clientY));
  window.addEventListener('mousemove', (e) => pointerMove(e.clientX, e.clientY));
  window.addEventListener('mouseup', pointerUp);

  // Any key also counts as first input (to dismiss hint).
  window.addEventListener('keydown', () => {
    if (onFirstInput) { onFirstInput(); onFirstInput = null; }
  }, { once: false });
}

// Returns normalized movement vector for this frame.
export function getMoveVector() {
  let x = 0, y = 0;

  if (keys.has('left')) x -= 1;
  if (keys.has('right')) x += 1;
  if (keys.has('up')) y -= 1;
  if (keys.has('down')) y += 1;

  if (x !== 0 || y !== 0) {
    const len = Math.hypot(x, y);
    return { x: x / len, y: y / len };
  }

  if (drag.active) {
    const dx = drag.x - drag.ox;
    const dy = drag.y - drag.oy;
    const len = Math.hypot(dx, dy);
    if (len > 6) {
      const mag = Math.min(len, MAX_RADIUS) / MAX_RADIUS;
      return { x: (dx / len) * mag, y: (dy / len) * mag };
    }
  }

  return { x: 0, y: 0 };
}

// For drawing the virtual joystick overlay.
export function getDragState() {
  return drag;
}
