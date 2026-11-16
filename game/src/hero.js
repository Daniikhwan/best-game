// hero.js — Kael, the Skyblade. Third-person hero: WASD to move, mouse to
// aim, click to slash, right-click / Space to fire an energy bolt, Shift to
// dash. Built from primitives with a glowing sword; no external models.
import * as THREE from 'three';
import { clamp, TAU } from './util.js';
import { ARENA_RADIUS } from './world.js';

export const HERO_BASE = {
  maxHp: 100,
  speed: 10.5,
  slashDamage: 34,
  slashRange: 3.4,
  slashArc: Math.PI * 0.75,
  boltDamage: 22,
  boltSpeed: 34,
  boltCooldown: 0.42,
  dashCooldown: 2.0,
  dashSpeed: 30,
  dashTime: 0.16,
};

export class Hero {
  constructor(scene, effects, audio) {
    this.scene = scene;
    this.fx = effects;
    this.audio = audio;
    this.hp = HERO_BASE.maxHp;
    this.maxHp = HERO_BASE.maxHp;
    this.damage = HERO_BASE.slashDamage;
    this.boltDamage = HERO_BASE.boltDamage;
    this.speed = HERO_BASE.speed;
    this.pos = new THREE.Vector3(0, 0, 8);
    this.vel = new THREE.Vector3();
    this.angle = Math.PI; // facing -z (toward arena center)
    this.aim = new THREE.Vector3(0, 0, -1);
    this.dashCd = 0;
    this.dashT = 0;
    this.dashDir = new THREE.Vector3();
    this.boltCd = 0;
    this.slashCd = 0;
    this.slashAnim = 0;
    this.invuln = 0;
    this.alive = true;
    this.bolts = [];
    this.boltPierce = 0;
    this.buildMesh();
  }

  buildMesh() {
    const g = new THREE.Group();
    const armor = new THREE.MeshStandardMaterial({ color: 0x1f6f8b, roughness: 0.35, metalness: 0.65 });
    const trim = new THREE.MeshStandardMaterial({ color: 0x0e7490, emissive: 0x22d3ee, emissiveIntensity: 1.1, roughness: 0.3, metalness: 0.4 });
    const cloth = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.9 });
    // Legs.
    const legGeo = new THREE.BoxGeometry(0.26, 0.7, 0.26);
    this.legL = new THREE.Mesh(legGeo, armor);
    this.legL.position.set(-0.22, 0.35, 0);
    this.legR = new THREE.Mesh(legGeo, armor);
    this.legR.position.set(0.22, 0.35, 0);
    g.add(this.legL, this.legR);
    // Torso.
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.95, 0.5), armor);
    torso.position.y = 1.18;
    g.add(torso);
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.1), trim);
    chest.position.set(0, 1.3, 0.28);
    g.add(chest);
    // Cape.
    const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.1), new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.95, side: THREE.DoubleSide }));
    cape.position.set(0, 1.15, -0.32);
    cape.rotation.x = 0.18;
    g.add(cape);
    // Head + visor.
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 14), armor);
    head.position.y = 1.95;
    g.add(head);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.12, 0.12), trim);
    visor.position.set(0, 1.97, 0.3);
    g.add(visor);
    // Plume.
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.5, 8), new THREE.MeshStandardMaterial({ color: 0xf472b6, emissive: 0xf472b6, emissiveIntensity: 0.7 }));
    plume.position.set(0, 2.32, -0.05);
    plume.rotation.x = -0.4;
    g.add(plume);
    // Right arm + glowing sword.
    this.armR = new THREE.Group();
    this.armR.position.set(0.55, 1.55, 0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), armor);
    arm.position.y = -0.3;
    this.armR.add(arm);
    // Sword: hilt + bright blade.
    const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.3, 0.09), new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.6 }));
    hilt.position.y = -0.72;
    this.armR.add(hilt);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xbfefff, emissive: 0x67e8f9, emissiveIntensity: 2.2, roughness: 0.2 });
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.5, 0.02), bladeMat);
    blade.position.y = -1.55;
    this.armR.add(blade);
    const bladeTip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.28, 4), bladeMat);
    bladeTip.position.y = -2.42;
    bladeTip.rotation.x = Math.PI;
    this.armR.add(bladeTip);
    this.armR.rotation.x = 0.5;
    g.add(this.armR);
    // Left arm (small shield).
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.65, 0.22), armor);
    armL.position.set(-0.55, 1.25, 0);
    g.add(armL);
    const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 20), new THREE.MeshStandardMaterial({ color: 0x155e75, emissive: 0x22d3ee, emissiveIntensity: 0.55, roughness: 0.35, metalness: 0.6 }));
    shield.rotation.x = Math.PI / 2;
    shield.position.set(-0.62, 1.15, 0.22);
    g.add(shield);
    // Glow light that follows the hero.
    this.light = new THREE.PointLight(0x22d3ee, 9, 12, 1.8);
    this.light.position.y = 2.2;
    g.add(this.light);

    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.group = g;
    this.group.position.copy(this.pos);
    this.scene.add(this.group);
    // Slash arc visual (hidden until a slash).
    const arcGeo = new THREE.RingGeometry(0.6, 3.3, 32, 1, -HERO_BASE.slashArc / 2, HERO_BASE.slashArc);
    this.arcMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    this.arc = new THREE.Mesh(arcGeo, this.arcMat);
    this.arc.rotation.x = -Math.PI / 2;
    this.arc.position.y = 0.9;
    this.group.add(this.arc);
  }

  reset() {
    this.hp = this.maxHp;
    this.pos.set(0, 0, 8);
    this.vel.set(0, 0, 0);
    this.angle = Math.PI;
    this.alive = true;
    this.dashCd = 0; this.dashT = 0; this.boltCd = 0; this.slashCd = 0; this.invuln = 0;
    for (const b of this.bolts) this.scene.remove(b.mesh);
    this.bolts.length = 0;
    this.group.visible = true;
  }

  // input: {mx, mz, slash, bolt, dash} — mx/mz is the wish direction.
  update(dt, input, enemies, boss) {
    if (!this.alive) return;
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.boltCd = Math.max(0, this.boltCd - dt);
    this.slashCd = Math.max(0, this.slashCd - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.slashAnim = Math.max(0, this.slashAnim - dt * 4);

    // Aim: face the mouse aim direction.
    const targetAngle = Math.atan2(this.aim.x, this.aim.z);
    let d = targetAngle - this.angle;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    this.angle += clamp(d, -dt * 14, dt * 14);

    // Dash.
    if (input.dash && this.dashCd <= 0 && this.dashT <= 0) {
      this.dashT = HERO_BASE.dashTime;
      this.dashCd = HERO_BASE.dashCooldown;
      this.dashDir.copy(this.vel).normalize();
      if (this.dashDir.lengthSq() < 0.1) this.dashDir.set(Math.sin(this.angle), 0, Math.cos(this.angle));
      this.invuln = Math.max(this.invuln, 0.28);
      this.audio.dash();
      this.fx.burst(this.pos, 0x67e8f9, 14, 7, 0.4, 0, 1);
    }
    if (this.dashT > 0) {
      this.dashT -= dt;
      this.vel.copy(this.dashDir).multiplyScalar(HERO_BASE.dashSpeed);
    } else {
      const wish = new THREE.Vector3(input.mx, 0, input.mz);
      const len = wish.length();
      if (len > 0.01) wish.multiplyScalar(1 / Math.max(1, len));
      const accel = 55;
      this.vel.x += wish.x * accel * dt;
      this.vel.z += wish.z * accel * dt;
      // Friction.
      const f = Math.max(0, 1 - dt * 9);
      this.vel.x *= f; this.vel.z *= f;
      const sp = this.vel.length();
      if (sp > this.speed) this.vel.multiplyScalar(this.speed / sp);
    }
    this.pos.addScaledVector(this.vel, dt);
    // Keep inside the arena.
    const r = Math.hypot(this.pos.x, this.pos.z);
    const maxR = ARENA_RADIUS - 1.6;
    if (r > maxR) {
      this.pos.x *= maxR / r;
      this.pos.z *= maxR / r;
    }
    // Walk bob + leg swing.
    const moving = this.vel.length();
    const t = performance.now() / 1000;
    const bob = Math.sin(t * 14) * 0.06 * Math.min(1, moving / 6);
    this.group.position.set(this.pos.x, bob, this.pos.z);
    this.group.rotation.y = this.angle;
    this.legL.rotation.x = Math.sin(t * 14) * 0.6 * Math.min(1, moving / 6);
    this.legR.rotation.x = -Math.sin(t * 14) * 0.6 * Math.min(1, moving / 6);
    this.armR.rotation.x = 0.5 - this.slashAnim * 2.4;
    this.arcMat.opacity = this.slashAnim * 0.75;
    this.arc.rotation.z = -this.slashAnim * 1.2;
    // Invulnerability blink.
    this.group.visible = this.invuln > 0 ? (Math.floor(t * 14) % 2 === 0) : true;

    // Slash.
    if (input.slash && this.slashCd <= 0) this.doSlash(enemies, boss);
    // Bolt.
    if (input.bolt && this.boltCd <= 0) this.fireBolt();
    this.updateBolts(dt, enemies, boss);
  }

  doSlash(enemies, boss) {
    this.slashCd = 0.34;
    this.slashAnim = 1;
    this.audio.slash();
    const range = HERO_BASE.slashRange;
    const half = HERO_BASE.slashArc / 2;
    const fx = new THREE.Vector3(Math.sin(this.angle), 0, Math.cos(this.angle));
    let hitAny = false;
    const tryHit = (target, hp) => {
      const to = new THREE.Vector3().subVectors(target.pos, this.pos);
      to.y = 0;
      const dist = to.length();
      if (dist > range + (target.radius || 1)) return;
      const ang = Math.abs(Math.atan2(to.x, to.z) - this.angle);
      const a = ang > Math.PI ? TAU - ang : ang;
      if (a > half + 0.25) return;
      hitAny = true;
      target.takeDamage(this.damage, to.normalize());
    };
    for (const e of enemies) if (e.alive) tryHit(e, e.hp);
    if (boss && boss.alive) tryHit(boss, boss.hp);
    if (hitAny) this.audio.hit();
    // Slash whoosh particles along the arc.
    for (let i = 0; i < 10; i++) {
      const a = this.angle - half + (i / 9) * HERO_BASE.slashArc;
      const p = new THREE.Vector3(this.pos.x + Math.sin(a) * 2.2, 1.1, this.pos.z + Math.cos(a) * 2.2);
      this.fx.burst(p, 0xa5f3fc, 1, 1.5, 0.3, 0, 1);
    }
  }

  fireBolt() {
    this.boltCd = HERO_BASE.boltCooldown;
    this.audio.bolt();
    const dir = new THREE.Vector3(Math.sin(this.angle), 0, Math.cos(this.angle));
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    mesh.add(core);
    const p = this.pos.clone().addScaledVector(dir, 1.2);
    p.y = 1.4;
    mesh.position.copy(p);
    this.scene.add(mesh);
    this.bolts.push({ mesh, vel: dir.multiplyScalar(HERO_BASE.boltSpeed), life: 1.6, pierce: this.boltPierce });
    this.fx.burst(p, 0x22d3ee, 5, 3, 0.3, 0, 1);
  }

  updateBolts(dt, enemies, boss) {
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.life -= dt;
      b.mesh.position.addScaledVector(b.vel, dt);
      const p = b.mesh.position;
      let dead = b.life <= 0 || Math.hypot(p.x, p.z) > ARENA_RADIUS + 4 || p.y < -2;
      if (!dead) {
        const hitList = [];
        for (const e of enemies) if (e.alive) hitList.push(e);
        if (boss && boss.alive) hitList.push(boss);
        for (const t of hitList) {
          const d = new THREE.Vector3().subVectors(p, t.pos);
          d.y = 0;
          if (d.length() < (t.radius || 1) + 0.6) {
            const dir = b.vel.clone().normalize();
            t.takeDamage(this.boltDamage, dir);
            this.audio.hit();
            this.fx.burst(p, 0x67e8f9, 10, 6, 0.4, -2, 1);
            if (b.pierce > 0) { b.pierce--; } else { dead = true; }
            break;
          }
        }
      }
      if (dead) {
        this.scene.remove(b.mesh);
        this.bolts.splice(i, 1);
      }
    }
  }

  takeDamage(amount) {
    if (!this.alive || this.invuln > 0) return false;
    this.hp -= amount;
    this.invuln = 0.55;
    this.audio.hurt();
    this.fx.addShake(0.5);
    this.fx.burst(this.pos.clone().setY(1.4), 0xef4444, 16, 7, 0.5, -4, 1);
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.group.visible = false;
      this.fx.burst(this.pos.clone().setY(1.2), 0x22d3ee, 60, 12, 1.1, -4, 1.4);
      this.fx.burst(this.pos.clone().setY(1.2), 0xf472b6, 40, 9, 0.9, -3, 1.2);
      this.fx.ring(this.pos, 0x22d3ee, 7);
      this.audio.defeat();
    }
    return true;
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }
}
