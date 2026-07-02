// Camera follows a target smoothly and centers it on screen.

export function createCamera() {
  return { x: 0, y: 0, zoom: 1 };
}

export function updateCamera(cam, target, dt) {
  // Smooth follow (exponential ease, framerate independent).
  const k = 1 - Math.pow(0.0001, dt);
  cam.x += (target.x - cam.x) * k;
  cam.y += (target.y - cam.y) * k;
}

// Apply camera transform, centering the view at (cx, cy) screen coords.
// Call inside ctx.save()/restore().
export function applyCamera(ctx, cam, cx, cy) {
  ctx.translate(cx, cy);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);
}
