# Project Guidelines

## Architecture

- This project is a React 19 + Phaser 3 hybrid. React is only the application shell and mount point; Phaser scenes own gameplay and most UI.
- Keep the scene flow linear unless the task requires a routing change: BootScene -> BriefingScene -> MainScene -> MaintenanceScene.
- Pass game state between scenes through scene.start(sceneName, data) and typed init(data) methods. Reuse shared scene data types from src/game/types.
- Prefer extracting reusable Phaser helpers, config, and types into focused modules instead of growing scene classes.
- MainScene should stay as an orchestration layer. Runtime responsibilities should be split across focused modules such as hudController, storageController, and sessionController.
- When extracting additional MainScene logic, prefer reducing long getter/setter binding chains and keep cross-module responsibilities explicit.

## Build And Test

- Install dependencies with npm install.
- Start local development with npm run dev.
- Run TypeScript validation with npm run lint before finishing code changes.
- Run npm run build when changing structure, bundling, or shared modules.
- When changing Phaser HUD/UI, run the game in a browser and use browser tools to verify the updated scene visually on the live canvas before finishing.
- Browser-based HUD/UI verification must check that new or changed elements are visible, not unintentionally overlapping or clipped, and that the primary related interaction still works.
- When changing gameplay, run the game in a browser and verify the expected behavior manually before finishing. This may include checking that new or changed mechanics work as intended and that existing mechanics are not broken.
- There is no automated test suite yet; do not claim runtime behavior was tested unless you ran it manually.

## Conventions

- Keep React components thin. Do not move Phaser gameplay flow into React unless the task explicitly changes the app architecture.
- Scene classes should focus on orchestration. Shared UI helpers belong in src/game/scenes/shared, boot-time generated assets in src/game/scenes/boot, and scene-specific config/types beside the scene under src/game/scenes.
- Follow the existing retro UI patterns and shared helpers in [src/game/scenes/shared/retroUi.ts](src/game/scenes/shared/retroUi.ts).
- Keep session and content data centralized in [src/game/data/SessionData.ts](src/game/data/SessionData.ts) unless a broader data-model refactor is part of the task.
- Use the existing SoundSynth singleton for retro audio cues rather than introducing a second audio path.
- Preserve the fixed 1024x768 Phaser canvas unless the task explicitly targets responsive resizing.

## Documentation

- Use [README.md](README.md) as the source of truth for game concept, gameplay loop, and art direction.
- Use the existing area instructions in [.github/instructions](.github/instructions) when a task touches gameplay, UI, tests, data, shaders, or other specialized areas.
- Link to existing docs and instruction files instead of duplicating large design explanations in code comments or new instruction files.
- Update README.md when scene architecture, workflow expectations, or manual verification requirements change in a user-visible way.

## Pitfalls

- npm run lint is only a type check; it will not catch gameplay regressions.
- npm run lint and npm run build will not catch Phaser HUD/UI layout regressions; browser verification is required for visual changes.
- Web Audio can stay suspended until user interaction, so avoid assuming audio starts automatically.
- Hardcoded session arrays currently drive gameplay progression; treat changes there as gameplay changes, not just copy edits.
