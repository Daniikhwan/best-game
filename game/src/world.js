// world.js — SKYBLADE ARENA environment.
// A floating hexagonal crystal arena in a sunset sky: dark slate platform
// with glowing rune rings, crystal spires on the rim, drifting islands,
// a huge low sun and clouds below. All geometry is procedural three.js.
import * as THREE from 'three';
import { mulberry32, makeRadialTexture, makeFloorTexture, TAU } from './util.js';

export const ARENA_RADIUS = 26;

export function buildWorld() {
  const rng = mulberry32(1337);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x2a1e4d, 60, 220);

  // ---------- Renderer-side sky: big gradient dome ----------
  const skyGeo = new THREE.SphereGeometry(300, 32, 20);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x1a1040) },
      mid: { value: new THREE.Color(0x7c3aad) },
      low: { value: new THREE.Color(0xff8a4c) },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec3 vPos;
      uniform vec3 top; uniform vec3 mid; uniform vec3 low;
      void main() {
        float h = normalize(vPos).y;
        vec3 c = h > 0.25 ? mix(mid, top, smoothstep(0.25, 0.9, h))
                          : mix(low, mid, smoothstep(-0.08, 0.25, h));
        // Warm band hugging the horizon.
        c += vec3(0.35, 0.12, 0.0) * pow(max(0.0, 1.0 - abs(h + 0.02) * 6.0), 2.0);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  // ---------- Sun: glowing disc + halo ----------
  const sunGroup = new THREE.Group();
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(16, 48),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false })
  );
  sunDisc.position.set(-120, 26, -190);
  sunDisc.lookAt(0, 10, 0);
  sunGroup.add(sunDisc);
  const haloTex = makeRadialTexture(THREE, 256, [
    [0, 'rgba(255, 200, 110, 0.85)'],
    [0.4, 'rgba(255, 150, 80, 0.35)'],
    [1, 'rgba(255, 140, 70, 0)'],
  ]);
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(110, 110),
    new THREE.MeshBasicMaterial({ map: haloTex, transparent: true, depthWrite: false, fog: false })
  );
  halo.position.copy(sunDisc.position);
  halo.lookAt(0, 10, 0);
  sunGroup.add(halo);
  scene.add(sunGroup);

  // ---------- Lights ----------
  const sun = new THREE.DirectionalLight(0xffc37a, 2.4);
  sun.position.set(-60, 55, -70);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -45; sun.shadow.camera.right = 45;
  sun.shadow.camera.top = 45; sun.shadow.camera.bottom = -45;
  sun.shadow.camera.far = 260;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0x8a7bff, 0x2a1a3a, 0.85));
  const rim = new THREE.DirectionalLight(0x22d3ee, 0.7);
  rim.position.set(50, 30, 60);
  scene.add(rim);

  // ---------- Arena platform: hexagonal slab ----------
  const arena = new THREE.Group();
  const floorTex = makeFloorTexture(THREE, 1024);
  const slab = new THREE.Mesh(
    new THREE.CylinderGeometry(ARENA_RADIUS, ARENA_RADIUS * 0.82, 3.2, 6, 1),
    new THREE.MeshStandardMaterial({ color: 0x2a3350, roughness: 0.85, metalness: 0.15 })
  );
  slab.position.y = -1.6;
  slab.receiveShadow = true;
  arena.add(slab);
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(ARENA_RADIUS - 0.4, 48),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.7, metalness: 0.25, emissive: 0x0a2a33, emissiveIntensity: 0.35 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.02;
  floor.receiveShadow = true;
  arena.add(floor);
  // Glowing rim trim.
  const rimRing = new THREE.Mesh(
    new THREE.TorusGeometry(ARENA_RADIUS - 0.15, 0.28, 10, 64),
    new THREE.MeshStandardMaterial({ color: 0x0e7490, emissive: 0x22d3ee, emissiveIntensity: 1.6, roughness: 0.4 })
  );
  rimRing.rotation.x = Math.PI / 2;
  rimRing.position.y = 0.12;
  arena.add(rimRing);
  // Under-glow: a soft cyan disc beneath the platform.
  const underGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 90),
    new THREE.MeshBasicMaterial({ map: haloTex, transparent: true, opacity: 0.55, depthWrite: false })
  );
  underGlow.rotation.x = -Math.PI / 2;
  underGlow.position.y = -4.5;
  arena.add(underGlow);
  scene.add(arena);

  // ---------- Crystal spires on the rim ----------
  const spireMats = [
    new THREE.MeshStandardMaterial({ color: 0x155e75, emissive: 0x22d3ee, emissiveIntensity: 0.9, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.95 }),
    new THREE.MeshStandardMaterial({ color: 0x701a4d, emissive: 0xf472b6, emissiveIntensity: 0.9, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.95 }),
    new THREE.MeshStandardMaterial({ color: 0x7a5a10, emissive: 0xfbbf24, emissiveIntensity: 0.9, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.95 }),
  ];
  const spires = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2;
    const h = 7 + rng() * 7;
    const spire = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.6 + rng() * 0.9, 0),
      spireMats[i % 3]
    );
    spire.scale.set(1, h / 2.2, 1);
    spire.position.set(Math.cos(a) * (ARENA_RADIUS - 1.2), h / 2 + 0.4, Math.sin(a) * (ARENA_RADIUS - 1.2));
    spire.rotation.y = rng() * TAU;
    spire.castShadow = true;
    scene.add(spire);
    spires.push(spire);
    // Small point light at the tallest spires for a magic feel.
    if (i % 4 === 0) {
      const pl = new THREE.PointLight(i % 2 === 0 ? 0x22d3ee : 0xf472b6, 12, 22, 1.8);
      pl.position.set(spire.position.x, h + 1, spire.position.z);
      scene.add(pl);
    }
  }

  // ---------- Floating islands (background, bobbing) ----------
  const islands = [];
  const islandSpots = [
    [-58, -6, -70, 9], [62, -10, -55, 11], [-70, -14, 30, 8],
    [70, -8, 45, 10], [0, -18, -95, 12], [-38, -20, 80, 7], [48, -22, 85, 8],
  ];
  for (const [x, y, z, s] of islandSpots) {
    const g = new THREE.Group();
    const rock = new THREE.Mesh(
      new THREE.ConeGeometry(s, s * 1.1, 7),
      new THREE.MeshStandardMaterial({ color: 0x3a2f52, roughness: 0.95, flatShading: true })
    );
    rock.rotation.x = Math.PI;
    rock.position.y = -s * 0.3;
    g.add(rock);
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(s * 0.95, s * 0.8, 1.6, 7),
      new THREE.MeshStandardMaterial({ color: 0x2f6b4f, roughness: 0.9, flatShading: true })
    );
    top.position.y = s * 0.25;
    g.add(top);
    const cr = new THREE.Mesh(
      new THREE.OctahedronGeometry(s * 0.28, 0),
      spireMats[Math.floor(rng() * 3)]
    );
    cr.scale.y = 2.2;
    cr.position.y = s * 0.9;
    g.add(cr);
    g.position.set(x, y, z);
    g.userData.baseY = y;
    g.userData.phase = rng() * TAU;
    scene.add(g);
    islands.push(g);
  }

  // ---------- Clouds below (soft white blobs) ----------
  const clouds = [];
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xf3d9e8, transparent: true, opacity: 0.5, fog: true });
  for (let i = 0; i < 14; i++) {
    const a = rng() * TAU;
    const r = 55 + rng() * 90;
    const cl = new THREE.Group();
    const n = 3 + Math.floor(rng() * 3);
    for (let j = 0; j < n; j++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(4 + rng() * 5, 12, 8), cloudMat);
      s.position.set((j - n / 2) * 5 + rng() * 2, rng() * 1.5, rng() * 3);
      s.scale.y = 0.45;
      cl.add(s);
    }
    cl.position.set(Math.cos(a) * r, -16 - rng() * 14, Math.sin(a) * r);
    scene.add(cl);
    clouds.push(cl);
  }

  // ---------- Distant stars (tiny points high up) ----------
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(240 * 3);
  for (let i = 0; i < 240; i++) {
    const a = rng() * TAU;
    const e = 0.35 + rng() * 0.6;
    const r = 280;
    starPos[i * 3] = Math.cos(a) * Math.cos(e) * r;
    starPos[i * 3 + 1] = Math.sin(e) * r;
    starPos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 }));
  scene.add(stars);

  return { scene, spires, islands, clouds, sun, arena };
}

// Gentle ambient motion for islands/clouds/spires. dt in seconds.
export function animateWorld(w, t, dt) {
  for (const isl of w.islands) {
    isl.position.y = isl.userData.baseY + Math.sin(t * 0.35 + isl.userData.phase) * 1.1;
    isl.rotation.y += dt * 0.02;
  }
  for (let i = 0; i < w.clouds.length; i++) {
    const cl = w.clouds[i];
    cl.position.x += dt * (0.4 + (i % 3) * 0.2);
    if (cl.position.x > 160) cl.position.x = -160;
  }
  for (let i = 0; i < w.spires.length; i++) {
    const s = w.spires[i];
    const pulse = 0.75 + Math.sin(t * 1.4 + i * 1.7) * 0.25;
    s.material.emissiveIntensity = pulse;
  }
}
