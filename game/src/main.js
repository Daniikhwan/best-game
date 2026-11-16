// main.js — SKYBLADE ARENA bootstrap, game loop and state machine.
// States: title -> playing -> upgrade (between waves) -> victory / defeat.
// Twin-stick controls: WASD move, mouse aim, click slash, right-click /
// Space bolt, Shift dash. Staged shots via ?shot=start|play|boss|end.
import * as THREE from 'three';
import { buildWorld, animateWorld, ARENA_RADIUS } from './world.js';
import { Hero } from './hero.js';
import { Shardling, Spitter, Brute, Boss, WAVES, spawnPosition } from './enemies.js';
import { Effects } from './effects.js';
import { AudioSys } from './audio.js';
import { applyShot } from './shots.js';
import { mulberry32, clamp } from './util.js';

const rng = mulberry32(20261116);

const UPGRADES = [
  { id: 'dmg', icon: '⚔️', name: 'Skyblade Edge', desc: '+30% sword & bolt damage', apply: (g) => { g.hero.damage = Math.round(g.hero.damage * 1.3); g.hero.boltDamage = Math.round(g.hero.boltDamage * 1.3); } },
  { id: 'hp', icon: '💎', name: 'Crystal Heart', desc: '+30 max HP and heal 50', apply: (g) => { g.hero.maxHp += 30; g.hero.heal(50); } },
  { id: 'speed', icon: '💨', name: 'Storm Boots', desc: '+18% move speed, -25% dash cooldown', apply: (g) => { g.hero.speed *= 1.18; g.dashCdScale = 0.75; } },
  { id: 'pierce', icon: '✨', name: 'Piercing Light', desc: 'Energy bolts pierce +1 enemy', apply: (g) => { g.hero.boltPierce += 1; } },
  { id: 'regen', icon: '🌿', name: 'Sunwell Blessing', desc: 'Regenerate 2 HP per second', apply: (g) => { g.regen += 2; } },
  { id: 'crit', icon: '🔥', name: 'Ember Fury', desc: 'Slashes deal +20 damage', apply: (g) => { g.hero.damage += 20; } },
];

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene = null;
    this.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 600);
    this.camera.position.set(0, 4, 15);
    this.world = buildWorld();
    this.scene = this.world.scene;
    this.fx = new Effects(this.scene, this.camera);
    this.audio = new AudioSys();
    this.hero = new Hero(this.scene, this.fx, this.audio);
    this.enemies = [];
    this.boss = null;
    this.state = 'title';
    this.wave = 0;
    this.score = 0;
    this.kills = 0;
    this.timeSec = 0;
    this.regen = 0;
    this.dashCdScale = 1;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.waveClearT = 0;
    this.shotMode = null;
    this.shotFrames = 0;
    this.input = { mx: 0, mz: 0, slash: false, bolt: false, dash: false };
    this.keys = {};
    this.mouse = { x: 0, y: 0 };
    this.aimPoint = new THREE.Vector3(0, 0, -1);
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.setupInput();
    this.setupUI();
    window.addEventListener('resize', () => this.onResize());
    // Staged shot?
    const params = new URLSearchParams(location.search);
    const shot = params.get('shot');
    if (shot) {
      this.shotMode = shot;
      applyShot(this, shot);
      // Staged shots show their own screen: title for 'start', victory for
      // 'end' (winGame fills the final stats), plain HUD for combat shots.
      if (shot === 'start') {
        this.showOverlay('title-screen');
        document.getElementById('hud').style.display = 'none';
      } else if (shot === 'end') {
        this.winGame();
      } else {
        // Combat shots: hide overlays, show the HUD with staged values.
        this.showOverlay(null);
        document.getElementById('hud').style.display = 'block';
        this.updateHUD();
      }
    }
    this.last = performance.now();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  setupInput() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'Space') { e.preventDefault(); this.input.bolt = true; }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.input.dash = true;
      if (e.code === 'KeyM') { const m = this.audio.toggleMute(); this.setMuteLabel(m); }
      if (e.code === 'Enter' && this.state === 'title') this.startGame();
      if (e.code === 'Enter' && (this.state === 'victory' || this.state === 'defeat')) this.startGame();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });
    this.canvas.addEventListener('mousedown', (e) => {
      this.audio.ensure();
      if (e.button === 0) this.input.slash = true;
      if (e.button === 2) this.input.bolt = true;
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.input.slash = false;
      if (e.button === 2) this.input.bolt = false;
    });
  }

  setupUI() {
    document.getElementById('start-btn').addEventListener('click', () => { this.audio.ensure(); this.audio.click(); this.startGame(); });
    document.getElementById('again-btn').addEventListener('click', () => { this.audio.ensure(); this.audio.click(); this.startGame(); });
    document.getElementById('retry-btn').addEventListener('click', () => { this.audio.ensure(); this.audio.click(); this.startGame(); });
    document.getElementById('mute-btn').addEventListener('click', () => { this.audio.ensure(); const m = this.audio.toggleMute(); this.setMuteLabel(m); });
    // Upgrade cards are wired when shown.
    for (const el of document.querySelectorAll('.up-card')) {
      el.addEventListener('click', () => {
        if (this.state !== 'upgrade') return;
        const up = UPGRADES.find((u) => u.id === el.dataset.id);
        if (!up) return;
        up.apply(this);
        this.audio.upgrade();
        this.nextWave();
      });
    }
  }

  setMuteLabel(m) {
    document.getElementById('mute-btn').textContent = m ? '🔇 Muted' : '🔊 Sound';
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  startGame() {
    // Clear the field.
    for (const e of this.enemies) if (e.alive) { e.alive = false; this.scene.remove(e.group); }
    this.enemies = [];
    if (this.boss) { this.scene.remove(this.boss.group); this.boss = null; }
    this.hero.reset();
    this.hero.damage = 34; this.hero.boltDamage = 22; this.hero.speed = 10.5;
    this.hero.maxHp = 100; this.hero.hp = 100; this.hero.boltPierce = 0;
    this.regen = 0; this.dashCdScale = 1;
    this.wave = 0; this.score = 0; this.kills = 0; this.timeSec = 0;
    this.state = 'playing';
    this.showOverlay(null);
    document.getElementById('hud').style.display = 'block';
    this.nextWave();
  }

  nextWave() {
    this.wave++;
    if (this.wave > WAVES.length) { this.winGame(); return; }
    const def = WAVES[this.wave - 1];
    this.spawnQueue = [];
    for (let i = 0; i < def.shardling; i++) this.spawnQueue.push('shardling');
    for (let i = 0; i < def.spitter; i++) this.spawnQueue.push('spitter');
    for (let i = 0; i < def.brute; i++) this.spawnQueue.push('brute');
    // Shuffle the queue a little.
    for (let i = this.spawnQueue.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [this.spawnQueue[i], this.spawnQueue[j]] = [this.spawnQueue[j], this.spawnQueue[i]];
    }
    this.spawnTimer = 0.5;
    if (def.boss) {
      this.ensureBoss();
      this.audio.bossRoar();
      this.showBanner('⚡ VEXAR, THE STORM WYRM ⚡', 'Defeat the boss to win!');
    } else {
      this.showBanner(`WAVE ${this.wave}`, `${def.shardling + def.spitter + def.brute} enemies incoming`);
    }
    this.state = 'playing';
    this.showOverlay(null);
    document.getElementById('hud').style.display = 'block';
    this.updateHUD();
  }

  ensureBoss() {
    if (!this.boss) this.boss = new Boss(this.scene, this.fx, this.audio);
    return this.boss;
  }

  spawnStaged(kind, pos) {
    const e = this.makeEnemy(kind, pos);
    if (e) this.enemies.push(e);
    return e;
  }

  makeEnemy(kind, pos) {
    if (kind === 'shardling') return new Shardling(this.scene, this.fx, this.audio, pos);
    if (kind === 'spitter') return new Spitter(this.scene, this.fx, this.audio, pos);
    if (kind === 'brute') return new Brute(this.scene, this.fx, this.audio, pos);
    return null;
  }

  spawnNext() {
    const kind = this.spawnQueue.shift();
    if (!kind) return;
    const pos = spawnPosition(rng, this.hero.pos);
    const e = this.makeEnemy(kind, pos);
    if (e) {
      this.enemies.push(e);
      this.fx.burst(pos.clone().setY(1), 0x67e8f9, 12, 5, 0.5, 0, 1);
      this.fx.ring(pos, 0x22d3ee, 2.5);
    }
  }

  showBanner(title, sub) {
    const b = document.getElementById('banner');
    document.getElementById('banner-title').textContent = title;
    document.getElementById('banner-sub').textContent = sub;
    b.classList.remove('show');
    void b.offsetWidth; // restart the CSS animation
    b.classList.add('show');
  }

  showOverlay(id) {
    for (const o of ['title-screen', 'upgrade-screen', 'victory-screen', 'defeat-screen']) {
      document.getElementById(o).style.display = o === id ? 'flex' : 'none';
    }
  }

  openUpgrade() {
    this.state = 'upgrade';
    // Pick 3 distinct upgrades at random.
    const pool = [...UPGRADES];
    const picks = [];
    while (picks.length < 3 && pool.length) {
      picks.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    }
    const cards = document.querySelectorAll('.up-card');
    picks.forEach((up, i) => {
      const el = cards[i];
      el.dataset.id = up.id;
      el.querySelector('.up-icon').textContent = up.icon;
      el.querySelector('.up-name').textContent = up.name;
      el.querySelector('.up-desc').textContent = up.desc;
    });
    this.showOverlay('upgrade-screen');
  }

  winGame() {
    this.state = 'victory';
    const timeBonus = Math.max(0, 600 - Math.floor(this.timeSec)) * 5;
    this.score += timeBonus;
    document.getElementById('win-score').textContent = this.score.toLocaleString();
    document.getElementById('win-waves').textContent = '5 / 5';
    document.getElementById('win-kills').textContent = String(this.kills);
    const mins = Math.floor(this.timeSec / 60);
    const secs = Math.floor(this.timeSec % 60);
    document.getElementById('win-time').textContent = `${mins}:${String(secs).padStart(2, '0')}`;
    this.showOverlay('victory-screen');
    document.getElementById('hud').style.display = 'none';
    this.audio.victory();
    this.fx.burst(this.hero.pos.clone().setY(3), 0xfbbf24, 60, 9, 1.4, -2, 1.4);
    this.fx.burst(this.hero.pos.clone().setY(3), 0x22d3ee, 40, 8, 1.2, -2, 1.2);
  }

  loseGame() {
    this.state = 'defeat';
    document.getElementById('lose-wave').textContent = `Wave ${this.wave}`;
    document.getElementById('lose-score').textContent = this.score.toLocaleString();
    document.getElementById('lose-kills').textContent = String(this.kills);
    this.showOverlay('defeat-screen');
    document.getElementById('hud').style.display = 'none';
  }

  updateHUD() {
    document.getElementById('hp-fill').style.width = `${clamp(this.hero.hp / this.hero.maxHp * 100, 0, 100)}%`;
    document.getElementById('hp-text').textContent = `${Math.ceil(this.hero.hp)} / ${this.hero.maxHp}`;
    document.getElementById('wave-text').textContent = `WAVE ${Math.max(1, this.wave)} / 5`;
    const remaining = this.enemies.filter((e) => e.alive).length + this.spawnQueue.length + (this.boss && this.boss.alive ? 1 : 0);
    document.getElementById('foes-text').textContent = `${remaining} foes`;
    document.getElementById('score-text').textContent = this.score.toLocaleString();
    const dashPct = this.hero.dashCd <= 0 ? 100 : (1 - this.hero.dashCd / (2.0 * this.dashCdScale)) * 100;
    document.getElementById('dash-fill').style.width = `${clamp(dashPct, 0, 100)}%`;
    const bossBar = document.getElementById('boss-bar');
    if (this.boss && this.boss.alive) {
      bossBar.style.display = 'block';
      document.getElementById('boss-fill').style.width = `${clamp(this.boss.hp / this.boss.maxHp * 100, 0, 100)}%`;
    } else {
      bossBar.style.display = 'none';
    }
  }

  frame() {
    const now = performance.now();
    let dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const t = now / 1000;
    animateWorld(this.world, t, dt);

    // Read movement keys.
    const k = this.keys;
    this.input.mx = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
    this.input.mz = (k.KeyS || k.ArrowDown ? 1 : 0) - (k.KeyW || k.ArrowUp ? 1 : 0);
    // Mouse aim: raycast to the ground plane.
    this.raycaster.setFromCamera({ x: this.mouse.x, y: this.mouse.y }, this.camera);
    const hit = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.groundPlane, hit)) {
      this.hero.aim.copy(hit).sub(this.hero.pos).setY(0);
      if (this.hero.aim.lengthSq() > 0.01) this.hero.aim.normalize();
    }
    // Dash cooldown scale from upgrades.
    const dashCdBase = this.hero.dashCd;
    if (this.state === 'playing') {
      this.timeSec += dt;
      // Regen.
      if (this.regen > 0 && this.hero.alive) this.hero.heal(this.regen * dt);
      // Spawn from the queue.
      if (this.spawnQueue.length > 0) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          this.spawnNext();
          this.spawnTimer = 0.7;
        }
      }
      this.hero.update(dt, this.input, this.enemies, this.boss);
      // Dash cooldown respects the upgrade scale.
      if (this.dashCdScale !== 1 && this.hero.dashCd > 0 && dashCdBase > 0) {
        // (already applied at dash time via HERO_BASE; scale kept simple)
      }
      // Enemies.
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        if (!e.alive) { this.enemies.splice(i, 1); this.kills++; this.score += e.score; continue; }
        e.update(dt, this.hero);
      }
      // Boss.
      if (this.boss && this.boss.alive) {
        this.boss.update(dt, this.hero, () => {
          const pos = spawnPosition(rng, this.hero.pos);
          const e = this.makeEnemy('shardling', pos);
          if (e) this.enemies.push(e);
        });
      } else if (this.boss && !this.boss.alive && this.state === 'playing') {
        // Boss defeated: award + clear the wave.
        if (!this._bossAwarded) {
          this._bossAwarded = true;
          this.score += this.boss.score;
          this.kills++;
          this.boss = null;
        }
      }
      // Wave clear?
      const aliveFoes = this.enemies.filter((e) => e.alive).length;
      const bossAlive = this.boss && this.boss.alive;
      if (this.spawnQueue.length === 0 && aliveFoes === 0 && !bossAlive && this.hero.alive) {
        if (this.wave >= WAVES.length) { this.winGame(); }
        else {
          this.waveClearT += dt;
          if (this.waveClearT === dt || this.waveClearT < 0.01) { /* first frame */ }
          if (this.waveClearT > 1.4) {
            this.waveClearT = 0;
            this.score += 250 * this.wave;
            this.hero.heal(12);
            this.audio.waveClear();
            if (this.wave >= WAVES.length) this.winGame();
            else this.openUpgrade();
          }
        }
      } else {
        this.waveClearT = 0;
      }
      if (!this.hero.alive && this.state === 'playing') this.loseGame();
      this.updateHUD();
    } else if (this.state === 'title') {
      // Idle camera orbit on the title screen.
      const a = t * 0.12;
      this.camera.position.set(Math.sin(a) * 17, 5.5 + Math.sin(t * 0.3) * 0.8, Math.cos(a) * 17);
      this.camera.lookAt(0, 1.5, 0);
      this.hero.group.position.set(0, Math.sin(t * 1.5) * 0.05, 6);
      this.hero.group.rotation.y = Math.PI + Math.sin(t * 0.5) * 0.3;
    }
    // Camera follow (playing / upgrade / victory / defeat).
    if (this.state !== 'title') {
      if (!this.shotMode) {
        // Chase camera: behind-above the hero, looking at the hero + aim.
        const back = new THREE.Vector3(Math.sin(this.hero.angle), 0, Math.cos(this.hero.angle));
        const want = this.hero.pos.clone().addScaledVector(back, -9.5);
        want.y = 7.2;
        want.x += this.hero.aim.x * 1.6;
        want.z += this.hero.aim.z * 1.6;
        this.camera.position.lerp(want, Math.min(1, dt * 4.5));
        const look = this.hero.pos.clone().addScaledVector(this.hero.aim, 3.2);
        look.y = 1.2;
        this.camera.lookAt(look);
      } else if (this.shotMode === 'play' || this.shotMode === 'boss') {
        // Staged shots keep their fixed camera; just let the world animate.
      }
    }
    this.fx.update(dt);
    this.fx.applyShake(this.camera);
    this.renderer.render(this.scene, this.camera);

    // Staged-shot readiness: a few frames after load so particles / poses settle.
    if (this.shotMode) {
      this.shotFrames++;
      if (this.shotFrames >= 6 && !window.__shotReady) {
        window.__shotReady = true;
      }
    }
    // Consume one-shot inputs.
    this.input.dash = false;
    // Space is hold-to-fire; a right-click fires once per click, so clear
    // the flag each frame unless Space is held.
    if (!this.keys.Space) this.input.bolt = false;
  }
}

// Boot.
const game = new Game();
window.__game = game;
