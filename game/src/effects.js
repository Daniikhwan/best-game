// effects.js — particles, floating damage numbers, screen shake.
// A single pooled THREE.Points system (no per-hit allocations) plus a small
// pool of HTML damage-number divs projected from 3D positions.
import * as THREE from 'three';
import { makeRadialTexture } from './util.js';

const MAX_PARTICLES = 900;

export class Effects {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.shake = 0;
    // Particle pool.
    this.pos = new Float32Array(MAX_PARTICLES * 3);
    this.col = new Float32Array(MAX_PARTICLES * 3);
    this.vel = new Float32Array(MAX_PARTICLES * 3);
    this.life = new Float32Array(MAX_PARTICLES);
    this.maxLife = new Float32Array(MAX_PARTICLES);
    this.grav = new Float32Array(MAX_PARTICLES);
    this.size = new Float32Array(MAX_PARTICLES);
    this.cursor = 0;
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const tex = makeRadialTexture(THREE, 64, [
      [0, 'rgba(255,255,255,1)'],
      [0.4, 'rgba(255,255,255,0.6)'],
      [1, 'rgba(255,255,255,0)'],
    ]);
    this.mat = new THREE.PointsMaterial({
      size: 0.55, map: tex, vertexColors: true, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    // Park all particles far below the arena.
    for (let i = 0; i < MAX_PARTICLES; i++) this.pos[i * 3 + 1] = -999;
    scene.add(this.points);
    // Damage-number pool (HTML divs).
    this.layer = document.getElementById('fx-layer');
    this.nums = [];
    for (let i = 0; i < 24; i++) {
      const el = document.createElement('div');
      el.className = 'dmg-num';
      el.style.display = 'none';
      this.layer.appendChild(el);
      this.nums.push({ el, life: 0, max: 0, pos: new THREE.Vector3(), vy: 0 });
    }
    this.numCursor = 0;
    this._v = new THREE.Vector3();
  }

  burst(p, color, count, speed, life = 0.6, gravity = -6, size = 1) {
    const c = new THREE.Color(color);
    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % MAX_PARTICLES;
      this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
      const a = Math.random() * Math.PI * 2;
      const b = Math.random() * Math.PI - Math.PI / 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.vel[i * 3] = Math.cos(a) * Math.cos(b) * s;
      this.vel[i * 3 + 1] = Math.sin(b) * s + speed * 0.35;
      this.vel[i * 3 + 2] = Math.sin(a) * Math.cos(b) * s;
      this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
      this.life[i] = this.maxLife[i] = life * (0.6 + Math.random() * 0.7);
      this.grav[i] = gravity;
      this.size[i] = size;
    }
  }

  // A short-lived expanding ring (shockwave) at a position.
  ring(p, color, maxR = 4) {
    const geo = new THREE.RingGeometry(0.1, 1, 40);
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(p);
    m.position.y = Math.max(0.15, p.y);
    m.rotation.x = -Math.PI / 2;
    this.scene.add(m);
    const start = performance.now();
    const tick = () => {
      const t = (performance.now() - start) / 450;
      if (t >= 1) { this.scene.remove(m); geo.dispose(); mat.dispose(); return; }
      const s = 0.5 + t * maxR;
      m.scale.set(s, s, 1);
      mat.opacity = 0.9 * (1 - t);
      requestAnimationFrame(tick);
    };
    tick();
  }

  damageNumber(p, text, kind = 'hit') {
    const n = this.nums[this.numCursor];
    this.numCursor = (this.numCursor + 1) % this.nums.length;
    n.el.textContent = text;
    n.el.className = 'dmg-num ' + kind;
    n.el.style.display = 'block';
    n.pos.copy(p);
    n.life = n.max = 0.85;
    n.vy = 2.4;
  }

  addShake(amount) {
    this.shake = Math.min(1.2, this.shake + amount);
  }

  update(dt) {
    // Particles.
    let any = false;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.pos[i * 3 + 1] = -999; continue; }
      this.vel[i * 3 + 1] += this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.05 && this.grav[i] < 0) {
        this.pos[i * 3 + 1] = 0.05;
        this.vel[i * 3 + 1] *= -0.35;
      }
      const f = this.life[i] / this.maxLife[i];
      this.col[i * 3] *= 1; // color stays; fade via shrinking below (alpha not per-point)
      void f;
    }
    if (any) {
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.color.needsUpdate = true;
    }
    // Damage numbers.
    const w = window.innerWidth, h = window.innerHeight;
    for (const n of this.nums) {
      if (n.life <= 0) { n.el.style.display = 'none'; continue; }
      n.life -= dt;
      n.pos.y += n.vy * dt;
      n.vy *= 0.94;
      this._v.copy(n.pos).project(this.camera);
      const x = (this._v.x * 0.5 + 0.5) * w;
      const y = (-this._v.y * 0.5 + 0.5) * h;
      n.el.style.left = x + 'px';
      n.el.style.top = y + 'px';
      n.el.style.opacity = String(Math.max(0, n.life / n.max));
      if (n.life <= 0) n.el.style.display = 'none';
    }
    // Shake decay.
    this.shake = Math.max(0, this.shake - dt * 2.2);
  }

  // Apply the current shake to the camera (call after camera is positioned).
  applyShake(camera) {
    if (this.shake <= 0.001) return;
    const s = this.shake * this.shake * 0.55;
    camera.position.x += (Math.random() - 0.5) * s;
    camera.position.y += (Math.random() - 0.5) * s;
    camera.position.z += (Math.random() - 0.5) * s;
  }
}
