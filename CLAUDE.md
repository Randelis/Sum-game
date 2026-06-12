# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Zombie Shooter" — a mobile-only, landscape-orientation, top-down wave survival shooter built with Phaser 3 + TypeScript + Vite, shipped as an installable PWA on GitHub Pages. There is no keyboard/mouse input path: the Phaser keyboard plugin is explicitly disabled in `src/main.ts`, and all controls are touch (virtual joystick + tap buttons).

## Commands

```bash
npm install          # install deps (phaser, typescript, vite only)
npm run dev          # Vite dev server on port 8080, host-exposed
npm run typecheck    # tsc --noEmit (strict mode) — the only verification gate
npm run build        # vite build → dist/
npm run preview      # serve the production build
```

There are no tests and no linter. `npm run typecheck` must pass; use it to verify changes.

## Repository layout — active vs. legacy

Only `src/`, `public/`, `index.html`, and `vite.config.js` are the live app. The repo root also contains **legacy files from the pre-TypeScript vanilla-canvas version: `game.js`, `sw.js`, `manifest.webmanifest`, `icon-*.png`**. These are not imported, not built, and not served by Vite — do not edit them when changing game behavior, and do not confuse root `sw.js` with the real service worker at `public/sw.js`.

## Architecture

Scene flow: `BootScene → PreloadScene → MenuScene → GameScene → GameOverScene` (registered in `src/main.ts`, fixed 1280×720 logical canvas scaled with `Phaser.Scale.FIT`).

`GameScene` (`src/scenes/GameScene.ts`) is the orchestrator. It owns all entity arrays, physics groups, and game state, and wires everything else together:

- **Systems** (`src/systems/`) are plain classes (not Phaser plugins) constructed with callback objects. E.g. `WaveSystem` receives `{ onWaveStart, onBossWave, spawnEnemy, showAnnounce }` and `CombatSystem` receives `{ onEnemyKilled, onBossKilled, ... }` — systems never reach back into the scene directly; they call back. Cross-cutting notifications use scene events: `this.events.emit('xpPickup', n)` and `'explosion'` are the two existing ones.
- **Entities** (`src/entities/`) wrap an arcade-physics sprite (`entity.sprite`) plus game logic; they are stored in plain arrays on `GameScene` and *also* added to physics groups for overlap detection. The player auto-fires at the nearest live enemy (target found in `GameScene.update`); the player never aims manually.
- **Data** (`src/data/`) is the balance layer: `WEAPONS`, `ENEMY_TYPES`, boss defs, upgrade defs, and random wave events are declarative tables of `*Def` interfaces. Gameplay tuning changes belong here, not in entity code. Weapons unlock by player level (`unlockedWeapons(level)`).
- **UI** (`src/ui/`) is rendered in-canvas with Phaser objects (no DOM UI): `MobileHud`, plus the `UpgradeMenu`/`WeaponPicker` overlays which set `GameScene._paused = true` while open and unpause via their selection callbacks.

### Assets are procedural

There are no image/audio asset files. All textures are generated at runtime in `PreloadScene._genTextures()` via `Graphics.generateTexture()` (texture size must exactly match the entity's physics body diameter — comments there call this out), and `AudioSystem` synthesizes SFX with WebAudio. To add a new enemy/pickup visual, add a generated texture, not a file.

## Performance conventions (mobile budget)

This codebase deliberately avoids per-frame allocation and Phaser conveniences that cost on phones — keep new code consistent with these patterns:

- Entity arrays are compacted **in place** during `GameScene.update` (write-index pattern), never `filter()`/`splice()` per frame; distance checks use squared distance.
- Bullets come from pre-populated pooled groups (`createMultiple` with `classType: Bullet`) capped by `MOBILE_LIMITS` in `src/utils/constants.ts`; `runChildUpdate` is off and bullet updates are looped manually.
- Hard caps live in `MOBILE_LIMITS` (max enemies, bullets, damage numbers). Respect them when spawning.
- Render depths come from the `DEPTH` table in `constants.ts`; world/camera tuning constants (`WORLD_W/H`, `CAMERA_ZOOM`, etc.) also live there.
- The frame delta is clamped (`Math.min(delta/1000, 0.05)`) to survive tab switches.

Code style: private class members are prefixed `_`; classes use explicit cleanup (`destroy()` removing every listener — see `MobileInputSystem` for the pattern, including the pointercancel/blur/visibilitychange handlers that prevent stuck-joystick bugs).

## Mobile/PWA gotchas

- `index.html` contains load-bearing inline script: dynamic PWA `<link>` injection (so Vite doesn't rewrite manifest/icon paths), a canvas-polling boot-status hider, a fatal-error overlay, and service-worker registration. The portrait-mode "rotate your device" prompt is pure CSS there.
- The real service worker is `public/sw.js`; bump its `CACHE_VERSION` when releasing, or installed PWAs keep serving stale builds.
- `src/main.ts` manually refreshes Phaser scale on `orientationchange`/`resize`/`visibilitychange` because mobile browsers resize without firing `resize`.
- Vite `base` is `'./'` (relative paths) — required for GitHub Pages subpath hosting. Keep new asset references relative.

## Deployment

`.github/workflows/deploy.yml` builds and deploys `dist/` to GitHub Pages on every push to `main` **and to any `claude/**` branch** (single shared `pages` concurrency group — a push to a feature branch replaces the live deployment).
