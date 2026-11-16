// main.ts — SKYBLADE ARENA entrypoint for make.fun's "Make the best game"
// bounty (best-game-01, harness program/v1).
//
// What this program does:
//   1. Copies the playable game (game/) and its four real in-game
//      screenshots (screenshots/) into the output directory
//      ($MAKEFUN_OUTPUT_DIR, falling back to /output).
//   2. Writes entry.json — a short summary of the entry (title, game,
//      controls, screenshots) — into the output directory.
//   3. Writes dossier.json — the summary the judge reads — into the
//      output directory with the vendored make.fun library
//      (vendor/makefun-game.ts, buildDossier). The copies in step 1 happen
//      first: buildDossier reads game/ and screenshots/ from the output
//      directory, and the scorer requires dossier.json to equal exactly
//      what buildDossier writes from them.
//   4. Refuses to package when a screenshot is missing or oversized, so a
//      broken entry can never be submitted silently.
//
// The game itself is a static three.js game (game/index.html + game/src/*
// + game/vendor/three/*). It needs no network at run time: three.js is
// vendored into the repository. Open game/index.html in a desktop browser
// to play.
//
// Plain JavaScript (no TypeScript annotations) so `node --check` and
// `node main.ts` both pass on Node 22.
const { closeSync, cpSync, existsSync, mkdirSync, openSync, readSync, readdirSync, statSync, writeFileSync } = require('node:fs');
const { join, resolve, dirname } = require('node:path');

const ROOT = resolve(dirname(__filename));
const OUT = process.env.MAKEFUN_OUTPUT_DIR || '/output';
const MAX_SCREENSHOT_BYTES = 256 * 1024; // 256 KiB per screenshot, per the bounty
const SCREENSHOTS = ['1-start.jpg', '2-play.jpg', '3-boss.jpg', '4-end.jpg'];

function fail(message) {
  console.error(`SKYBLADE ARENA: ${message}`);
  process.exit(1);
}

async function main() {
  const gameDir = join(ROOT, 'game');
  const shotsDir = join(ROOT, 'screenshots');
  if (!existsSync(gameDir)) fail('game/ directory is missing');
  if (!existsSync(join(gameDir, 'index.html'))) fail('game/index.html is missing');
  if (!existsSync(join(gameDir, 'vendor', 'three', 'three.module.min.js'))) fail('game/vendor/three/three.module.min.js is missing');
  if (!existsSync(join(gameDir, 'vendor', 'three', 'three.core.js'))) fail('game/vendor/three/three.core.js is missing');
  if (!existsSync(shotsDir)) fail('screenshots/ directory is missing');
  for (const name of SCREENSHOTS) {
    const p = join(shotsDir, name);
    if (!existsSync(p)) fail(`screenshot ${name} is missing`);
    const size = statSync(p).size;
    if (size === 0) fail(`screenshot ${name} is empty`);
    if (size > MAX_SCREENSHOT_BYTES) fail(`screenshot ${name} is ${size} bytes, over the ${MAX_SCREENSHOT_BYTES}-byte cap`);
    // Must be a real JPEG capture (SOI marker), not a placeholder file.
    const fd = openSync(p, 'r');
    try {
      const head = Buffer.alloc(3);
      const n = readSync(fd, head, 0, 3, 0);
      if (n < 3 || head[0] !== 0xff || head[1] !== 0xd8 || head[2] !== 0xff) {
        fail(`screenshot ${name} is not a JPEG file`);
      }
    } finally {
      closeSync(fd);
    }
  }

  mkdirSync(OUT, { recursive: true });
  cpSync(gameDir, join(OUT, 'game'), { recursive: true });
  cpSync(shotsDir, join(OUT, 'screenshots'), { recursive: true });

  const summary = {
    title: 'SKYBLADE ARENA',
    competition: 'best-game-01',
    game: 'Third-person 3D wave arena battler. Kael, the Skyblade, fights the crystal horde across 5 waves on a floating crystal arena above a sunset sea, then faces VEXAR, the Storm Wyrm.',
    controls: 'WASD move, mouse aim, click sword slash, right-click / Space energy bolt, Shift dash, M mute.',
    goal: 'Survive all 5 waves and slay VEXAR to win. Score: shardling 50, spitter 100, brute 200, boss 2000, wave-clear bonus 250 x wave, time bonus on victory.',
    screenshots: SCREENSHOTS.map((name) => ({
      file: `screenshots/${name}`,
      bytes: statSync(join(shotsDir, name)).size,
    })),
    files: {
      game: readdirSync(gameDir),
      screenshots: SCREENSHOTS,
    },
    play: 'Open game/index.html in a desktop browser (keyboard + mouse).',
  };
  writeFileSync(join(OUT, 'entry.json'), JSON.stringify(summary, null, 2) + '\n', 'utf8');

  // The scorer's own caps (reference/gate.json): only text_max_bytes shapes
  // the bytes; the others refuse an entry the scorer would refuse (more than
  // 4 screenshots or one over 256 KiB; more than 993 files in game/ or
  // 48 MiB of game files, in all, or a path under game/ over 1000 bytes).
  // buildDossier reads game/ and screenshots/ from OUT, so this runs after
  // the copies above. The vendor library is an ES module, loaded with a
  // dynamic import because this file is CommonJS (no package.json).
  const { buildDossier } = await import('./vendor/makefun-game.ts');
  writeFileSync(
    join(OUT, 'dossier.json'),
    buildDossier(OUT, {
      text_max_bytes: 163840,
      screenshots: { max: 4, max_bytes: 262144 },
      game_max_files: 993,
      game_max_bytes: 50331648,
      game_path_max_bytes: 1000,
    }),
  );
  console.log('SKYBLADE ARENA packaged:');
  console.log(`  game/        -> ${join(OUT, 'game')}`);
  console.log(`  screenshots/ -> ${join(OUT, 'screenshots')} (${SCREENSHOTS.length} files)`);
  console.log(`  entry.json   -> ${join(OUT, 'entry.json')}`);
  console.log(`  dossier.json -> ${join(OUT, 'dossier.json')}`);
}

main().catch((err) => fail(err && err.message ? err.message : String(err)));
