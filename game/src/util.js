// util.js — small shared helpers for SKYBLADE ARENA.
// Plain JavaScript, no dependencies. Deterministic seeded RNG so staged
// screenshots reproduce exactly.

// Mulberry32 — tiny fast seeded PRNG.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const TAU = Math.PI * 2;

// Ease-out cubic, for spawn/pop animations.
export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

// Make a radial-gradient canvas texture (used for the arena floor runes,
// glows and soft particle sprites). Returns a THREE.CanvasTexture — the
// caller imports three and passes it in to avoid a circular import.
export function makeRadialTexture(THREE, size, stops) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [offset, color] of stops) grad.addColorStop(offset, color);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Arena floor texture: dark slate with glowing concentric rings and runes.
export function makeFloorTexture(THREE, size = 1024) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const g = c.getContext('2d');
  const cx = size / 2, cy = size / 2;
  // Base slate.
  g.fillStyle = '#1b2233';
  g.fillRect(0, 0, size, size);
  // Subtle radial shading.
  const base = g.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
  base.addColorStop(0, 'rgba(70,90,130,0.55)');
  base.addColorStop(0.55, 'rgba(40,55,85,0.25)');
  base.addColorStop(1, 'rgba(10,14,24,0.0)');
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  // Stone tile seams (hex-ish grid of faint lines).
  g.strokeStyle = 'rgba(140,170,220,0.10)';
  g.lineWidth = 2;
  const step = size / 8;
  for (let i = 1; i < 8; i++) {
    g.beginPath(); g.moveTo(i * step, 0); g.lineTo(i * step, size); g.stroke();
    g.beginPath(); g.moveTo(0, i * step); g.lineTo(size, i * step); g.stroke();
  }
  // Glowing concentric rings.
  const rings = [
    [0.46, 'rgba(34,211,238,0.85)', 5],
    [0.40, 'rgba(34,211,238,0.28)', 3],
    [0.30, 'rgba(244,114,182,0.5)', 4],
    [0.16, 'rgba(251,191,36,0.65)', 4],
  ];
  for (const [r, color, w] of rings) {
    g.strokeStyle = color;
    g.lineWidth = w;
    g.beginPath(); g.arc(cx, cy, r * size, 0, Math.PI * 2); g.stroke();
  }
  // Rune ticks around the outer ring.
  g.strokeStyle = 'rgba(34,211,238,0.7)';
  g.lineWidth = 3;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const r1 = 0.465 * size, r2 = 0.495 * size;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    g.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
