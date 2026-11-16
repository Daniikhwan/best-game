// enemies.js — the crystal horde and VEXAR, the Storm Wyrm.
// Shardling (fast melee), Spitter (ranged), Brute (heavy), and the boss.
// All built from primitives; AI is simple seek / keep-distance / swoop.
// Waves scale up to the boss on wave 5.
import * as THREE from 'three';
import { clamp, mulberry32, TAU } from './util.js';
import { ARENA_RADIUS } from './world.js';

const rng = mulberry32(4242);

function crystalMat(color, emissive, intensity = 0.9) {
  return new THREE.MeshStandardMaterial({
    color, emissive, emissiveIntensity: intensity,
    roughness: 0.25, metalness: 0.15, flatShading: true,
  });
}

class Enemy {
  constructor(scene, fx, audio, pos, kind) {
    this.scene = scene; this.fx = fx; this.audio = audio;
    this.kind = kind;
    this.pos = pos.clone();
    this.vel = new THREE.Vector3();
    this.alive = true;
    this.flash = 0;
    this.hitCd = 0;
    this.spawnT = 0;
  }
  takeDamage(amount, dir) {
    if (!this.alive) return;
    this.hp -= amount;
    this.flash = 1;
    this.fx.damageNumber(this.pos.clone().setY(this.height * 0.8 + 1), String(amount), 'hit');
    if (dir) this.pos.addScaledVector(dir, 0.35);
    if (this.hp <= 0) this.die();
  }
  die() {
    this.alive = false;
    this.fx.burst(this.pos.clone().setY(1), this.deathColor, 26, 9, 0.7, -5, 1.2);
    this.fx.ring(this.pos, this.deathColor, 3);
    this.audio.enemyDie();
    this.scene.remove(this.group);
  }
  update(dt, hero) { /* overridden */ }
}

export class Shardling extends Enemy {
  constructor(scene, fx, audio, pos) {
    super(scene, fx, audio, pos, 'shardling');
    this.hp = 22; this.maxHp = 22;
    this.radius = 0.9; this.height = 1.1;
    this.speed = 6.4 + rng() * 1.2;
    this.damage = 9;
    this.score = 50;
    this.deathColor = 0xf472b6;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.75, 0), crystalMat(0x9d174d, 0xf472b6, 1.0));
    body.position.y = 0.85;
    body.castShadow = true;
    g.add(body);
    // Spikes.
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.7, 5), crystalMat(0xdb2777, 0xf472b6, 1.2));
      spike.position.set(Math.cos(a) * 0.62, 0.85, Math.sin(a) * 0.62);
      spike.rotation.z = -Math.cos(a) * 1.1;
      spike.rotation.x = Math.sin(a) * 1.1;
      g.add(spike);
    }
    // Eyes.
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (const sx of [-0.28, 0.28]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), eyeMat);
      eye.position.set(sx, 1.0, 0.62);
      g.add(eye);
    }
    this.body = body;
    this.group = g;
    this.group.position.copy(pos);
    scene.add(this.group);
  }
  update(dt, hero) {
    if (!this.alive) return;
    this.spawnT += dt;
    this.hitCd = Math.max(0, this.hitCd - dt);
    const to = new THREE.Vector3().subVectors(hero.pos, this.pos);
    to.y = 0;
    const d = to.length();
    if (d > 0.01) to.multiplyScalar(1 / d);
    // Hop toward the hero.
    const hop = Math.max(0, Math.sin(this.spawnT * 6)) * 0.5;
    this.vel.lerp(to.multiplyScalar(this.speed), Math.min(1, dt * 4));
    this.pos.addScaledVector(this.vel, dt);
    this.pos.y = hop;
    this.group.position.copy(this.pos);
    this.group.rotation.y = Math.atan2(to.x, to.z);
    this.body.rotation.y += dt * 3;
    // Bite.
    if (d < 1.7 && this.hitCd <= 0 && hero.alive) {
      this.hitCd = 0.9;
      if (hero.takeDamage(this.damage)) this.fx.burst(hero.pos.clone().setY(1.2), 0xef4444, 8, 5, 0.4, -2, 1);
    }
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 5);
      this.body.material.emissiveIntensity = 1 + this.flash * 2;
    }
  }
}

export class Spitter extends Enemy {
  constructor(scene, fx, audio, pos) {
    super(scene, fx, audio, pos, 'spitter');
    this.hp = 38; this.maxHp = 38;
    this.radius = 1.0; this.height = 1.6;
    this.speed = 3.6;
    this.damage = 12;
    this.score = 100;
    this.deathColor = 0xa78bfa;
    this.shootCd = 1.2 + rng();
    this.orbs = [];
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.OctahedronGeometry(1.0, 0), crystalMat(0x4c1d95, 0x8b5cf6, 1.0));
    body.scale.y = 1.5;
    body.position.y = 1.4;
    body.castShadow = true;
    g.add(body);
    // Crown spikes.
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.4;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.9, 5), crystalMat(0x6d28d9, 0xa78bfa, 1.2));
      spike.position.set(Math.cos(a) * 0.55, 2.6, Math.sin(a) * 0.55);
      g.add(spike);
    }
    // Glowing mouth.
    const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshBasicMaterial({ color: 0xc4b5fd }));
    mouth.position.set(0, 1.35, 0.85);
    g.add(mouth);
    this.body = body;
    this.group = g;
    this.group.position.copy(pos);
    scene.add(this.group);
  }
  update(dt, hero) {
    if (!this.alive) return;
    this.spawnT += dt;
    this.shootCd -= dt;
    const to = new THREE.Vector3().subVectors(hero.pos, this.pos);
    to.y = 0;
    const d = to.length();
    if (d > 0.01) to.multiplyScalar(1 / d);
    // Keep a mid range: approach if far, back off if close.
    let move = 0;
    if (d > 13) move = 1;
    else if (d < 8) move = -0.7;
    this.vel.lerp(to.multiplyScalar(this.speed * move), Math.min(1, dt * 3));
    this.pos.addScaledVector(this.vel, dt);
    this.pos.y = 0.35 + Math.sin(this.spawnT * 2.2) * 0.25;
    this.group.position.copy(this.pos);
    this.group.rotation.y = Math.atan2(to.x, to.z);
    this.body.rotation.y += dt * 1.2;
    if (this.shootCd <= 0 && d < 24 && hero.alive) {
      this.shootCd = 2.1 + rng() * 0.8;
      this.shoot(hero);
    }
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 5);
      this.body.material.emissiveIntensity = 1 + this.flash * 2;
    }
    this.updateOrbs(dt, hero);
  }
  shoot(hero) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xddd6fe })
    );
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    mesh.add(glow);
    const p = this.pos.clone().setY(1.5);
    mesh.position.copy(p);
    this.scene.add(mesh);
    const dir = new THREE.Vector3().subVectors(hero.pos.clone().setY(1.2), p).normalize();
    this.orbs.push({ mesh, vel: dir.multiplyScalar(13), life: 4 });
    this.audio.bolt();
  }
  updateOrbs(dt, hero) {
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      o.life -= dt;
      o.mesh.position.addScaledVector(o.vel, dt);
      const p = o.mesh.position;
      let dead = o.life <= 0 || p.y < 0 || Math.hypot(p.x, p.z) > ARENA_RADIUS + 6;
      if (!dead && hero.alive) {
        const d = new THREE.Vector3().subVectors(p, hero.pos.clone().setY(1.2));
        if (d.length() < 1.1) {
          hero.takeDamage(this.damage);
          dead = true;
        }
      }
      if (dead) {
        this.fx.burst(p, 0x8b5cf6, 8, 5, 0.35, -2, 1);
        this.scene.remove(o.mesh);
        this.orbs.splice(i, 1);
      }
    }
  }
}

export class Brute extends Enemy {
  constructor(scene, fx, audio, pos) {
    super(scene, fx, audio, pos, 'brute');
    this.hp = 95; this.maxHp = 95;
    this.radius = 1.5; this.height = 2.4;
    this.speed = 2.7;
    this.damage = 20;
    this.score = 200;
    this.deathColor = 0xf97316;
    this.hitCd = 0;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.OctahedronGeometry(1.35, 0), crystalMat(0x7c2d12, 0xf97316, 0.9));
    body.scale.set(1, 1.35, 1);
    body.position.y = 1.7;
    body.castShadow = true;
    g.add(body);
    // Shoulder horns.
    for (const sx of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.4, 6), crystalMat(0x431407, 0xfb923c, 1.1));
      horn.position.set(sx * 1.15, 2.5, 0);
      horn.rotation.z = -sx * 0.7;
      g.add(horn);
    }
    // Eyes (angry).
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });
    for (const sx of [-0.45, 0.45]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), eyeMat);
      eye.position.set(sx, 2.0, 1.05);
      g.add(eye);
    }
    this.body = body;
    this.group = g;
    this.group.position.copy(pos);
    scene.add(this.group);
  }
  update(dt, hero) {
    if (!this.alive) return;
    this.spawnT += dt;
    this.hitCd = Math.max(0, this.hitCd - dt);
    const to = new THREE.Vector3().subVectors(hero.pos, this.pos);
    to.y = 0;
    const d = to.length();
    if (d > 0.01) to.multiplyScalar(1 / d);
    this.vel.lerp(to.multiplyScalar(this.speed), Math.min(1, dt * 2.5));
    this.pos.addScaledVector(this.vel, dt);
    this.group.position.copy(this.pos);
    this.group.rotation.y = Math.atan2(to.x, to.z);
    this.body.rotation.y += dt * 0.8;
    // Heavy slam: bigger radius, knockback on the hero.
    if (d < 2.4 && this.hitCd <= 0 && hero.alive) {
      this.hitCd = 1.3;
      if (hero.takeDamage(this.damage)) {
        hero.vel.addScaledVector(to, 14);
        this.fx.addShake(0.7);
        this.fx.ring(this.pos, 0xf97316, 4);
      }
    }
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 5);
      this.body.material.emissiveIntensity = 0.9 + this.flash * 2;
    }
  }
}

// ---------- BOSS: VEXAR, the Storm Wyrm ----------
// A segmented flying serpent of obsidian + storm light. It circles the arena,
// then swoops to breathe a lightning cone, and summons shardlings.
export class Boss {
  constructor(scene, fx, audio) {
    this.scene = scene; this.fx = fx; this.audio = audio;
    this.hp = 650; this.maxHp = 650;
    this.alive = true;
    this.radius = 3.2; this.height = 4;
    this.score = 2000;
    this.pos = new THREE.Vector3(0, 16, -14);
    this.state = 'circle'; // circle | telegraph | swoop | breath | summon
    this.stateT = 0;
    this.circleAngle = 0;
    this.breathCd = 0;
    this.summonCd = 0;
    this.flash = 0;
    this.buildMesh();
  }
  buildMesh() {
    const g = new THREE.Group();
    const obsidian = new THREE.MeshStandardMaterial({ color: 0x1e1b2e, roughness: 0.3, metalness: 0.7, flatShading: true });
    const storm = new THREE.MeshStandardMaterial({ color: 0x3b0764, emissive: 0xa855f7, emissiveIntensity: 1.4, roughness: 0.3, flatShading: true });
    // Segmented body: 7 tapering spheres along a curve.
    this.segments = [];
    for (let i = 0; i < 7; i++) {
      const r = 1.9 - i * 0.22;
      const seg = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), i % 2 === 0 ? obsidian : storm);
      seg.castShadow = true;
      g.add(seg);
      this.segments.push(seg);
    }
    // Head.
    const head = new THREE.Group();
    const skull = new THREE.Mesh(new THREE.ConeGeometry(1.5, 3.4, 6), obsidian);
    skull.rotation.x = Math.PI / 2;
    skull.castShadow = true;
    head.add(skull);
    // Jaw.
    const jaw = new THREE.Mesh(new THREE.ConeGeometry(1.0, 2.2, 6), storm);
    jaw.rotation.x = Math.PI / 2;
    jaw.position.set(0, -0.7, 0.6);
    head.add(jaw);
    // Horns.
    for (const sx of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.28, 2.2, 6), storm);
      horn.position.set(sx * 0.9, 0.9, -0.4);
      horn.rotation.z = -sx * 0.5;
      horn.rotation.x = -0.5;
      head.add(horn);
    }
    // Eyes (gold).
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    for (const sx of [-0.7, 0.7]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), eyeMat);
      eye.position.set(sx, 0.55, 1.1);
      head.add(eye);
    }
    this.head = head;
    g.add(head);
    // Wings (two big translucent membranes).
    this.wings = [];
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x4c1d95, emissive: 0x7c3aed, emissiveIntensity: 0.8, transparent: true, opacity: 0.75, side: THREE.DoubleSide, roughness: 0.5 });
    for (const sx of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.4, 1, 1), wingMat);
      wing.position.set(sx * 3.4, 0.6, -0.6);
      wing.rotation.y = sx * 0.5;
      g.add(wing);
      this.wings.push(wing);
    }
    // Under-light.
    const light = new THREE.PointLight(0xa855f7, 26, 30, 1.7);
    light.position.y = -1;
    g.add(light);
    this.group = g;
    this.group.position.copy(this.pos);
    this.scene.add(this.group);
    this.spine = [];
    for (let i = 0; i < 7; i++) this.spine.push(new THREE.Vector3());
  }
  takeDamage(amount, dir) {
    if (!this.alive) return;
    this.hp -= amount;
    this.flash = 1;
    this.audio.bossHit();
    this.fx.damageNumber(this.pos.clone().setY(this.pos.y - 1), String(amount), 'boss');
    if (this.hp <= 0) this.die();
  }
  die() {
    this.alive = false;
    this.fx.burst(this.pos, 0xa855f7, 90, 16, 1.4, -4, 1.6);
    this.fx.burst(this.pos, 0xfbbf24, 60, 12, 1.1, -3, 1.4);
    this.fx.burst(this.pos, 0x22d3ee, 50, 10, 1.0, -2, 1.2);
    this.fx.ring(this.pos.clone().setY(0.2), 0xa855f7, 12);
    this.fx.addShake(1.2);
    this.audio.enemyDie();
    this.scene.remove(this.group);
  }
  update(dt, hero, spawnShardling) {
    if (!this.alive) return;
    this.stateT += dt;
    this.breathCd -= dt;
    this.summonCd -= dt;
    const toHero = new THREE.Vector3().subVectors(hero.pos, this.pos);
    toHero.y = 0;
    const dist = toHero.length();
    // State machine.
    if (this.state === 'circle') {
      this.circleAngle += dt * 0.55;
      const target = new THREE.Vector3(Math.cos(this.circleAngle) * 15, 15 + Math.sin(this.stateT * 0.8) * 2, Math.sin(this.circleAngle) * 15);
      this.pos.lerp(target, Math.min(1, dt * 1.6));
      if (this.stateT > 4.5 && this.breathCd <= 0) { this.state = 'telegraph'; this.stateT = 0; }
      else if (this.stateT > 6 && this.summonCd <= 0) { this.state = 'summon'; this.stateT = 0; }
    } else if (this.state === 'telegraph') {
      // Hover over the hero, glow bright, then swoop.
      const target = new THREE.Vector3(hero.pos.x, 13, hero.pos.z);
      this.pos.lerp(target, Math.min(1, dt * 2.2));
      if (this.stateT > 0.9) { this.state = 'swoop'; this.stateT = 0; this.audio.bossRoar(); }
    } else if (this.state === 'swoop') {
      // Dive to the ground and breathe lightning.
      const target = new THREE.Vector3(hero.pos.x, 3.2, hero.pos.z);
      this.pos.lerp(target, Math.min(1, dt * 5));
      if (this.stateT > 0.7) { this.state = 'breath'; this.stateT = 0; this.breathCd = 7; }
    } else if (this.state === 'breath') {
      // Lightning cone at the hero's position (tracked slowly).
      const target = new THREE.Vector3(hero.pos.x, 3.0, hero.pos.z);
      this.pos.lerp(target, Math.min(1, dt * 1.4));
      const p = this.pos.clone(); p.y = 1.2;
      this.fx.burst(p, 0xc4b5fd, 6, 4, 0.25, -1, 1);
      this.fx.burst(p, 0xfbbf24, 4, 5, 0.25, -1, 1);
      if (dist < 4.5 && hero.alive) hero.takeDamage(16 * dt * 2);
      if (this.stateT > 1.6) { this.state = 'circle'; this.stateT = 0; this.circleAngle = Math.atan2(this.pos.z, this.pos.x); }
    } else if (this.state === 'summon') {
      this.pos.y = Math.max(this.pos.y, 14);
      if (this.stateT > 0.5 && !this._summoned) {
        this._summoned = true;
        for (let i = 0; i < 3; i++) spawnShardling();
        this.audio.bossRoar();
      }
      if (this.stateT > 1.2) { this.state = 'circle'; this.stateT = 0; this._summoned = false; this.summonCd = 12; }
    }
    // Pose the serpent: segments trail behind the head along a sine wave.
    const headDir = new THREE.Vector3().subVectors(hero.pos, this.pos).normalize();
    if (this.state === 'circle') headDir.set(-Math.sin(this.circleAngle), -0.15, Math.cos(this.circleAngle));
    const t = performance.now() / 1000;
    for (let i = 0; i < 7; i++) {
      const seg = this.segments[i];
      const back = i * 1.55;
      const sway = Math.sin(t * 2.4 - i * 0.9) * 0.9;
      const px = this.pos.x - headDir.x * back + Math.cos(this.circleAngle) * sway * 0.4;
      const py = this.pos.y - headDir.y * back + Math.sin(t * 1.8 - i * 0.7) * 0.55;
      const pz = this.pos.z - headDir.z * back + Math.sin(this.circleAngle) * sway * 0.4;
      seg.position.set(px - this.pos.x, py - this.pos.y, pz - this.pos.z);
    }
    this.head.position.set(headDir.x * 3.4, headDir.y * 3.4 - 0.3, headDir.z * 3.4);
    this.head.lookAt(this.pos.clone().add(headDir.clone().multiplyScalar(6)).setY(this.pos.y + headDir.y * 6));
    // Wing flap.
    const flap = Math.sin(t * 6) * 0.45;
    this.wings[0].rotation.z = 0.35 + flap;
    this.wings[1].rotation.z = -0.35 - flap;
    this.group.position.copy(this.pos);
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 4);
      for (const s of this.segments) s.material.emissiveIntensity = 1.4 + this.flash * 2;
    }
  }
}

// ---------- Wave definitions ----------
export const WAVES = [
  { shardling: 5, spitter: 0, brute: 0 },
  { shardling: 7, spitter: 2, brute: 0 },
  { shardling: 8, spitter: 3, brute: 1 },
  { shardling: 10, spitter: 4, brute: 2 },
  { shardling: 0, spitter: 0, brute: 0, boss: true },
];

export function spawnPosition(rngFn, heroPos) {
  // Spawn at the arena edge, away from the hero.
  for (let tries = 0; tries < 12; tries++) {
    const a = rngFn() * TAU;
    const r = ARENA_RADIUS - 3 - rngFn() * 4;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const dx = x - heroPos.x, dz = z - heroPos.z;
    if (dx * dx + dz * dz > 100) return new THREE.Vector3(x, 0, z);
  }
  return new THREE.Vector3(ARENA_RADIUS - 4, 0, 0);
}
