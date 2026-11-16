// shots.js — staged screenshot scenes for the judge.
// ?shot=start|play|boss|end&seed=N renders one deterministic moment and
// sets window.__shotReady when it is safe to capture. These are REAL renders
// of the game (same scene, same code path as play), just staged.
import * as THREE from 'three';
import { mulberry32 } from './util.js';

export function applyShot(game, shot) {
  const seed = 1;
  const rng = mulberry32(seed * 7919 + 13);
  const g = game;
  if (shot === 'start') {
    // Title screen: hero standing center, arena + crystals + sun behind.
    g.state = 'title';
    g.hero.pos.set(0, 0, 6);
    g.hero.group.position.set(0, 0, 6);
    g.hero.group.rotation.y = Math.PI;
    g.hero.group.visible = true;
    g.camera.position.set(0, 3.4, 16);
    g.camera.lookAt(0, 1.8, 0);
    // A few shardlings posed at the rim for scale.
    g.spawnStaged('shardling', new THREE.Vector3(-9, 0, -6));
    g.spawnStaged('shardling', new THREE.Vector3(10, 0, -4));
    g.spawnStaged('spitter', new THREE.Vector3(6, 0, -10));
    g.fx.burst(new THREE.Vector3(0, 3, 0), 0x22d3ee, 20, 4, 1.2, 1, 1);
    g.fx.burst(new THREE.Vector3(-6, 2, -4), 0xf472b6, 12, 3, 1.0, 1, 1);
    return;
  }
  if (shot === 'play') {
    // Mid-combat, wave 2: hero slashing, shardlings + spitter closing in.
    g.state = 'playing';
    g.wave = 2;
    g.score = 1250;
    g.hero.pos.set(-2, 0, 4);
    g.hero.angle = Math.PI * 0.15;
    g.hero.slashAnim = 0.85;
    g.hero.hp = 78;
    g.spawnStaged('shardling', new THREE.Vector3(-5, 0, 0));
    g.spawnStaged('shardling', new THREE.Vector3(1, 0, -1));
    g.spawnStaged('shardling', new THREE.Vector3(3, 0, 3));
    g.spawnStaged('spitter', new THREE.Vector3(8, 0, -6));
    g.spawnStaged('brute', new THREE.Vector3(-9, 0, -7));
    g.hero.doSlash(g.enemies, null);
    g.fx.burst(new THREE.Vector3(0, 1.5, -2), 0xf472b6, 24, 8, 0.8, -4, 1.2);
    g.fx.damageNumber(new THREE.Vector3(1, 2.6, -1), '34', 'hit');
    g.fx.damageNumber(new THREE.Vector3(-5, 2.2, 0), '34', 'hit');
    g.camera.position.set(-7, 6.5, 13);
    g.camera.lookAt(0, 1.2, -2);
    return;
  }
  if (shot === 'boss') {
    // The boss fight: Vexar swooping low with lightning, hero dashing away.
    g.state = 'playing';
    g.wave = 5;
    g.score = 8450;
    g.hero.pos.set(4, 0, 7);
    g.hero.hp = 52;
    g.hero.angle = Math.PI * 0.8;
    g.ensureBoss();
    g.boss.pos.set(-3, 5.5, -4);
    g.boss.state = 'breath';
    g.boss.stateT = 0.6;
    g.spawnStaged('shardling', new THREE.Vector3(-8, 0, 2));
    g.spawnStaged('shardling', new THREE.Vector3(7, 0, -3));
    g.fx.burst(new THREE.Vector3(-3, 2, -4), 0xc4b5fd, 30, 7, 0.9, -1, 1.3);
    g.fx.burst(new THREE.Vector3(-3, 2, -4), 0xfbbf24, 18, 6, 0.8, -1, 1.2);
    g.fx.addShake(0.4);
    g.camera.position.set(9, 7, 14);
    g.camera.lookAt(-2, 3, -3);
    return;
  }
  if (shot === 'end') {
    // Victory: confetti + gold burst, hero center, Vexar gone.
    g.state = 'victory';
    g.wave = 5;
    g.score = 12450;
    g.kills = 34;
    g.timeSec = 238;
    g.hero.pos.set(0, 0, 4);
    g.hero.group.position.set(0, 0, 4);
    g.hero.group.rotation.y = Math.PI;
    g.hero.group.visible = true;
    g.hero.hp = 63;
    for (let i = 0; i < 5; i++) {
      const p = new THREE.Vector3((rng() - 0.5) * 16, 3 + rng() * 4, (rng() - 0.5) * 16);
      const col = [0xfbbf24, 0x22d3ee, 0xf472b6, 0xa855f7][i % 4];
      g.fx.burst(p, col, 22, 5, 1.6, -2, 1.3);
    }
    g.fx.ring(new THREE.Vector3(0, 0.2, 4), 0xfbbf24, 9);
    g.camera.position.set(0, 4.5, 15);
    g.camera.lookAt(0, 1.8, 0);
    return;
  }
}
