# best-game

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/Daniikhwan/best-game/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/Daniikhwan/best-game/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**SKYBLADE ARENA** — a third-person 3D wave arena battler. Kael, the Skyblade, stands alone on a floating crystal arena above a sunset sea, fighting the crystal horde across 5 waves — then faces **VEXAR, the Storm Wyrm**. Survive all 5 waves. Slay the Wyrm. Take the sky.

- 5 waves: fast Shardlings, ranged Spitters, heavy Brutes, and the boss VEXAR (obsidian storm serpent with swoop, breath and summon attacks).
- Twin-stick combat: WASD move, mouse aim, click sword slash, right-click / Space energy bolt, Shift dash (brief invulnerability).
- Upgrades between waves (pick 1 of 3), HUD (HP, dash, wave, foes, score, boss bar), title / upgrade / victory / defeat screens, synthesized WebAudio SFX + ambient pad.
- Built with three.js (vendored, no network needed) in plain JavaScript.

## Run it

```sh
node serve.ts
# then open http://localhost:8080/ in a desktop browser (keyboard + mouse)
```

Or open `game/index.html` directly from a local static server. The entrypoint `main.ts` packages `game/` and the four real in-game screenshots in `screenshots/` into the output directory:

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=vnsny7za&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
