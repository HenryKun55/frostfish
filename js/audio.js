// Tiny 16-bit-style synth. Pure WebAudio (no files) so it ships on GitHub Pages.
// SFX + a gentle chiptune loop. AudioContext must start on a user gesture.

let actx = null, master = null, muted = false, musicTimer = null, step = 0;

export function initAudio() {
  if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  actx = new AC();
  master = actx.createGain();
  master.gain.value = muted ? 0 : 0.3;
  master.connect(actx.destination);
  startMusic();
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.3;
  return muted;
}

// One oscillator blip with an exponential decay envelope.
function blip(freq, dur, type = 'square', vol = 0.3, when = 0, slideTo = null) {
  if (!actx) return;
  const t = actx.currentTime + when;
  const o = actx.createOscillator();
  const g = actx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

export const sfx = {
  hit()     { blip(400 + Math.random() * 80, 0.05, 'square', 0.10); },
  shatter() { blip(320, 0.2, 'sawtooth', 0.16, 0, 120); blip(680, 0.12, 'square', 0.08); },
  pickup()  { blip(700, 0.09, 'square', 0.13, 0, 1050); },
  chop()    { blip(180, 0.05, 'square', 0.12); },
  coin()    { blip(880, 0.06, 'square', 0.14); blip(1320, 0.09, 'square', 0.14, 0.06); },
  upgrade() { [523, 659, 784, 1046].forEach((f, i) => blip(f, 0.11, 'square', 0.16, i * 0.07)); },
};

// A slow pentatonic arp + bass loop.
function startMusic() {
  if (musicTimer) return;
  const scale = [523.25, 587.33, 659.25, 783.99, 880.0];
  const bass = [130.81, 130.81, 164.81, 196.0];
  const eighth = 60 / 92 / 2; // seconds
  musicTimer = setInterval(() => {
    if (!actx || muted) { step++; return; }
    if (step % 4 === 0) blip(bass[(step / 4) % bass.length], eighth * 3.4, 'triangle', 0.06);
    const n = scale[(step * 3) % scale.length];
    blip(n, eighth * 0.85, 'square', 0.035);
    step++;
  }, eighth * 1000);
}
