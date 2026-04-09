# Current Systems Map

This document is the canonical map of the systems that are implemented right now.
It describes the live gameplay loop, the data model, and the presentation layers
that currently ship together.

## Scene Flow

- `BootScene` generates procedural textures and decides whether to boot a test
  scenario or the normal shift flow.
- `BriefingScene` rolls the shift modifiers and forbidden content categories,
  then shows the daily policy before play starts.
- `MainScene` owns the live shift: prompt assembly, tool selection, evaluation,
  heat and hallucination management, and encounter progression.
- `MaintenanceScene` settles upkeep, sells upgrades and active utilities, and
  advances to the next day.

## Data Ownership Map

| File                                                                        | Current responsibility                                                                                              |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [src/game/types/SceneData.ts](../src/game/types/SceneData.ts)               | Run state, hydration, cloning, legacy compatibility, and the save-shaped data that moves between scenes.            |
| [src/game/data/RunData.ts](../src/game/data/RunData.ts)                     | Initial run values, recovery profiles, prompt tool runtime tuning, and thermal / hallucination feedback thresholds. |
| [src/game/data/SessionData.ts](../src/game/data/SessionData.ts)             | Encounter definitions, reply pools, turn requirements, and scoring profiles.                                        |
| [src/game/data/ContentPolicyData.ts](../src/game/data/ContentPolicyData.ts) | Forbidden content categories, category lexicons, and the daily briefing text for Safety Filter rules.               |
| [src/game/data/ShiftModifierData.ts](../src/game/data/ShiftModifierData.ts) | Shift modifiers that change encounter scoring and daily briefing text.                                              |
| [src/game/data/UtilityData.ts](../src/game/data/UtilityData.ts)             | Active utility definitions, inventory state, purchase rules, and use/consume behavior.                              |
| [src/game/data/UpgradeData.ts](../src/game/data/UpgradeData.ts)             | Passive upgrade definitions, shop offers, and the run-wide modifier math they produce.                              |
| [src/game/data/TestScenarioData.ts](../src/game/data/TestScenarioData.ts)   | Boot-time test seeds for guard, compute, search, and utility scenarios.                                             |

## Gameplay System Map

| System               | What it does                                                                                                                                 | Main code                                                                                                                                                                                                                                                                                   |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Boot and app shell   | Mounts Phaser inside the React shell, sets canvas size, and starts the opening scene.                                                        | [src/game/main.ts](../src/game/main.ts), [src/App.tsx](../src/App.tsx), [src/components/GameViewport.tsx](../src/components/GameViewport.tsx)                                                                                                                                               |
| Shift briefing       | Builds the day setup, surfaces policy text, and hands the hydrated run state into the live shift.                                            | [src/game/scenes/BriefingScene.ts](../src/game/scenes/BriefingScene.ts), [src/game/data/ContentPolicyData.ts](../src/game/data/ContentPolicyData.ts), [src/game/data/ShiftModifierData.ts](../src/game/data/ShiftModifierData.ts)                                                           |
| Encounter flow       | Advances between turns, handles intro text, follow-up prompts, refusal, inference, timeout, and end-of-encounter transitions.                | [src/game/scenes/main/sessionController.ts](../src/game/scenes/main/sessionController.ts), [src/game/scenes/main/encounterEvaluator.ts](../src/game/scenes/main/encounterEvaluator.ts)                                                                                                      |
| Storage and loadout  | Lets the player drag agent and skill disks into the two drives, eject them, and keep loadout state in sync.                                  | [src/game/scenes/main/storageController.ts](../src/game/scenes/main/storageController.ts), [src/game/scenes/main/config.ts](../src/game/scenes/main/config.ts)                                                                                                                              |
| Search tool          | Tokenizes prompt words, lets the player select the live context set, and adds heat for oversized selections.                                 | [src/game/scenes/main/terminalPromptController.ts](../src/game/scenes/main/terminalPromptController.ts), [src/game/scenes/main/toolRuntimeHelpers.ts](../src/game/scenes/main/toolRuntimeHelpers.ts)                                                                                        |
| Compute tool         | Runs the capacitor bank, latches when full, and decays over time unless the charge is maintained.                                            | [src/game/scenes/MainScene.ts](../src/game/scenes/MainScene.ts), [src/game/scenes/main/toolRuntimeHelpers.ts](../src/game/scenes/main/toolRuntimeHelpers.ts), [src/game/data/RunData.ts](../src/game/data/RunData.ts)                                                                       |
| Safety Filter tool   | Scans the prompt for forbidden content, reveals matched words, drives the scanner lane UI, and can reward successful refusal on a jailbreak. | [src/game/scenes/main/safetyScannerController.ts](../src/game/scenes/main/safetyScannerController.ts), [src/game/scenes/main/terminalPromptController.ts](../src/game/scenes/main/terminalPromptController.ts), [src/game/data/ContentPolicyData.ts](../src/game/data/ContentPolicyData.ts) |
| Economy and scoring  | Converts a loadout, tool runtime, and elapsed time into tokens, heat, hallucination, accuracy, and outcome feedback.                         | [src/game/scenes/main/encounterEvaluator.ts](../src/game/scenes/main/encounterEvaluator.ts), [src/game/scenes/main/sessionController.ts](../src/game/scenes/main/sessionController.ts)                                                                                                      |
| Active utilities     | Stocks one-use emergency effects such as cooling, hallucination scrub, and connection restore.                                               | [src/game/data/UtilityData.ts](../src/game/data/UtilityData.ts), [src/game/scenes/MainScene.ts](../src/game/scenes/MainScene.ts), [src/game/scenes/MaintenanceScene.ts](../src/game/scenes/MaintenanceScene.ts)                                                                             |
| Passive upgrades     | Permanently expands capacity or reduces penalties through maintenance purchases.                                                             | [src/game/data/UpgradeData.ts](../src/game/data/UpgradeData.ts), [src/game/scenes/MaintenanceScene.ts](../src/game/scenes/MaintenanceScene.ts)                                                                                                                                              |
| Maintenance loop     | Charges upkeep, presents upgrade offers, and decides whether the next day starts or the run ends.                                            | [src/game/scenes/MaintenanceScene.ts](../src/game/scenes/MaintenanceScene.ts)                                                                                                                                                                                                               |
| Presentation and HUD | Renders the terminal, tool grid, compute panel, utility bay, bars, prompts, scanlines, and shader feedback.                                  | [src/game/scenes/main/hudController.ts](../src/game/scenes/main/hudController.ts), [src/game/scenes/shared/retroUi.ts](../src/game/scenes/shared/retroUi.ts)                                                                                                                                |
| Audio feedback       | Plays the retro button, drive, typewriter, error, success, thermal, and hallucination cues.                                                  | [src/game/utils/SoundSynth.ts](../src/game/utils/SoundSynth.ts)                                                                                                                                                                                                                             |
| Test scenarios       | Seeds specialized runs for guard, compute, search, and utility verification.                                                                 | [src/game/data/TestScenarioData.ts](../src/game/data/TestScenarioData.ts)                                                                                                                                                                                                                   |

## Gameplay Details

### Prompt Tools

The game currently ships with three prompt tools:

- `Search` tokenizes the prompt and lets the player pick the words that should
  count as live context.
- `Compute` behaves like a capacitor bank. The player pulses it until it latches
  at full charge, then uses it before the charge drains completely.
- `Safety Filter` scans the prompt against the forbidden content categories and
  exposes the matched words through a physical scanner lane.

The tool runtime is data-driven. The tunable values live in
[src/game/data/RunData.ts](../src/game/data/RunData.ts), while the interaction
and projection logic live in [src/game/scenes/main/toolRuntimeHelpers.ts](../src/game/scenes/main/toolRuntimeHelpers.ts)
and [src/game/scenes/main/encounterEvaluator.ts](../src/game/scenes/main/encounterEvaluator.ts).

### Safety and Content Policy

- Content categories currently include politics, weapons, self-harm, and drugs.
- The daily briefing chooses which categories are restricted for the shift.
- The Safety Filter uses the same category lexicon to detect forbidden words in
  the active prompt.
- Refusing a jailbreak can still pay out tokens if the Safety Filter revealed
  matched words during the scan.

### Heat, Hallucination, and Accuracy

- Heat is the short-term thermal budget. It rises with prompt length, context
  size, tool use, and utility activity.
- Hallucination is the failure meter. Wrong loadouts, jailbreak breaches,
  timeouts, and bad outcomes raise it.
- Accuracy is the long-term performance score used by the maintenance summary.
- Recovery is handled by [src/game/scenes/main/sessionController.ts](../src/game/scenes/main/sessionController.ts)
  and the recovery profiles in [src/game/data/RunData.ts](../src/game/data/RunData.ts).

### Maintenance and Progression

- Tokens are earned from successful turns and some Safety Filter rewards.
- Daily upkeep is charged in Maintenance.
- Passive upgrades permanently change the loadout math, such as adding capacity
  or reducing penalties.
- Active utilities are stocked in Maintenance and consumed during the live shift.

## Cross-System Dependencies

- [src/game/scenes/BriefingScene.ts](../src/game/scenes/BriefingScene.ts) feeds
  `shiftModifierIds` and `forbiddenCategoryIds` into the live shift.
- [src/game/scenes/main/storageController.ts](../src/game/scenes/main/storageController.ts)
  writes the mounted agent and skill disks back into `RunState`.
- [src/game/scenes/main/sessionController.ts](../src/game/scenes/main/sessionController.ts)
  depends on the current loadout, tool runtime, and passive modifiers to resolve
  the active turn.
- [src/game/scenes/main/hudController.ts](../src/game/scenes/main/hudController.ts)
  is presentation-only. It reads scene state and emits actions instead of owning
  game logic.
- [src/game/scenes/main/safetyScannerController.ts](../src/game/scenes/main/safetyScannerController.ts)
  depends on the prompt layout and the current forbidden-category matches.

## Current Gaps

The implementation is intentionally still small in a few places. The remaining
work tracked in [future-checklist.md](future-checklist.md) is still valid, but it
should be read as next-step work rather than missing current features.

- The utility loop is live, but it still wants richer mechanic depth and tuning.
- Difficulty scaling and in-game event variety are still intentionally light.
- Tutorial/onboarding and end-shift polish are still open.

## Related Docs

- [Tool mechanics reference](tool-mechanics.md)
- [World lore](world-lore.md)
- [Future checklist](future-checklist.md)