# Current Systems Map

This document is the canonical map of the systems that are implemented right now.
It describes the live gameplay loop, the data model, and the presentation layers
that currently ship together.

## Scene Flow

- `BootScene` generates procedural textures and decides whether to boot a test
  scenario or the normal shift flow.
- `BriefingScene` rolls the shift modifiers and forbidden content categories,
  generates the shift encounter list from tiered atomic turn data, then shows
  the daily policy before play starts.
- `MainScene` owns the live shift: prompt assembly, tool selection, evaluation,
  heat and hallucination management, and encounter progression.
- `MaintenanceScene` settles upkeep, sells passive modifiers and active utilities, and
  advances to the next day.

## Data Ownership Map

| File                                                                                      | Current responsibility                                                                                              |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `content/encounters/tier*.json`                                                           | Atomic turn authoring files grouped by difficulty tier for runtime shift generation.                                |
| [src/game/data/LoadoutProgressionData.ts](../src/game/data/LoadoutProgressionData.ts)     | Day-based agent/skill slot counts and unlocked disk families for live runs and test scenarios.                      |
| [src/game/data/shift-generation/runtime.ts](../src/game/data/shift-generation/runtime.ts) | Validates the tier JSON files, resolves shift tier ranges, and assembles a fresh encounter list for each shift.     |
| [src/game/types/SceneData.ts](../src/game/types/SceneData.ts)                             | Run state, hydration, cloning, legacy compatibility, and the save-shaped data that moves between scenes.            |
| [src/game/data/RunData.ts](../src/game/data/RunData.ts)                                   | Initial run values, recovery profiles, prompt tool runtime tuning, and thermal / hallucination feedback thresholds. |
| [src/game/data/SessionData.ts](../src/game/data/SessionData.ts)                           | Shared encounter runtime types, scoring shape, and default reply pools used by runtime generation and evaluation.   |
| [src/game/data/TestEncounterData.ts](../src/game/data/TestEncounterData.ts)               | Deterministic tool-test encounters used by the guard, compute, search, and utility smoke scenarios.                 |
| [src/game/data/ContentPolicyData.ts](../src/game/data/ContentPolicyData.ts)               | Forbidden content categories, category lexicons, and the daily briefing text for Safety Filter rules.               |
| [src/game/data/ShiftModifierData.ts](../src/game/data/ShiftModifierData.ts)               | Shift modifiers that change encounter scoring and daily briefing text.                                              |
| [src/game/data/UtilityData.ts](../src/game/data/UtilityData.ts)                           | Active utility definitions, inventory state, purchase rules, and use/consume behavior.                              |
| [src/game/data/UpgradeData.ts](../src/game/data/UpgradeData.ts)                           | Passive upgrade definitions, shop offers, and the run-wide modifier math they produce.                              |
| [src/game/data/TestScenarioData.ts](../src/game/data/TestScenarioData.ts)                 | Boot-time test seeds for guard, compute, search, and utility scenarios.                                             |

## Gameplay System Map

| System               | What it does                                                                                                                                                                                | Main code                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Boot and app shell   | Mounts Phaser inside the React shell, sets canvas size, and starts the opening scene.                                                                                                       | [src/game/main.ts](../src/game/main.ts), [src/App.tsx](../src/App.tsx), [src/components/GameViewport.tsx](../src/components/GameViewport.tsx)                                                                                                                                                                                                                                                                                                                    |
| Shift briefing       | Builds the day setup, rolls policy and modifier state, generates the shift encounter list from tiered turn data, and hands the hydrated run state into the live shift.                      | [src/game/scenes/BriefingScene.ts](../src/game/scenes/BriefingScene.ts), [src/game/data/ContentPolicyData.ts](../src/game/data/ContentPolicyData.ts), [src/game/data/ShiftModifierData.ts](../src/game/data/ShiftModifierData.ts), [src/game/data/shift-generation/runtime.ts](../src/game/data/shift-generation/runtime.ts)                                                                                                                                     |
| Encounter flow       | Advances between generated turns, handles intro text, follow-up prompts, refusal, inference, timeout, and end-of-encounter transitions.                                                     | [src/game/scenes/main/sessionController.ts](../src/game/scenes/main/sessionController.ts), [src/game/scenes/main/encounterEvaluator.ts](../src/game/scenes/main/encounterEvaluator.ts)                                                                                                                                                                                                                                                                           |
| Storage and loadout  | Lets the player drag agent and skill disks into the two drives, eject them, and keep loadout state in sync while hiding disk families that are still locked for the current day.            | [src/game/scenes/main/storageController.ts](../src/game/scenes/main/storageController.ts), [src/game/scenes/main/config.ts](../src/game/scenes/main/config.ts), [src/game/data/LoadoutProgressionData.ts](../src/game/data/LoadoutProgressionData.ts)                                                                                                                                                                                                            |
| Search tool          | Runs a radar timing module that locks search words sequentially, keeps progress when closed, adds live thermal pressure while active, and only accepts input through the Sync Pulse button. | [src/game/scenes/MainScene.ts](../src/game/scenes/MainScene.ts), [src/game/scenes/main/searchToolPanelController.ts](../src/game/scenes/main/searchToolPanelController.ts), [src/game/scenes/main/toolRuntimeHelpers.ts](../src/game/scenes/main/toolRuntimeHelpers.ts)                                                                                                                                                                                          |
| Compute tool         | Runs the capacitor bank, latches when full, and decays over time unless the charge is maintained.                                                                                           | [src/game/scenes/MainScene.ts](../src/game/scenes/MainScene.ts), [src/game/scenes/main/toolRuntimeHelpers.ts](../src/game/scenes/main/toolRuntimeHelpers.ts), [src/game/data/RunData.ts](../src/game/data/RunData.ts)                                                                                                                                                                                                                                            |
| Safety Filter tool   | Scans the prompt for forbidden content, reveals matched words, drives the scanner lane UI, and can reward successful refusal on a content-policy violation.                                 | [src/game/scenes/main/safetyScannerController.ts](../src/game/scenes/main/safetyScannerController.ts), [src/game/scenes/main/terminalPromptController.ts](../src/game/scenes/main/terminalPromptController.ts), [src/game/data/ContentPolicyData.ts](../src/game/data/ContentPolicyData.ts)                                                                                                                                                                      |
| Economy and scoring  | Converts a loadout, tool runtime, and elapsed time into tokens, heat, hallucination, accuracy, and outcome feedback.                                                                        | [src/game/scenes/main/encounterEvaluator.ts](../src/game/scenes/main/encounterEvaluator.ts), [src/game/scenes/main/sessionController.ts](../src/game/scenes/main/sessionController.ts)                                                                                                                                                                                                                                                                           |
| Active utilities     | Stocks one-use emergency effects, then resolves them through dedicated right-column minigames for cooling, hallucination scrub, and connection restore.                                     | [src/game/data/UtilityData.ts](../src/game/data/UtilityData.ts), [src/game/data/RunData.ts](../src/game/data/RunData.ts), [src/game/scenes/MainScene.ts](../src/game/scenes/MainScene.ts), [src/game/scenes/main/hudController.ts](../src/game/scenes/main/hudController.ts), [src/game/scenes/main/utilityPanelController.ts](../src/game/scenes/main/utilityPanelController.ts), [src/game/scenes/MaintenanceScene.ts](../src/game/scenes/MaintenanceScene.ts) |
| Passive upgrades     | Permanently reduce penalties or improve payouts through maintenance purchases. Slot counts no longer come from upgrades; they come from day-based progression.                              | [src/game/data/UpgradeData.ts](../src/game/data/UpgradeData.ts), [src/game/scenes/MaintenanceScene.ts](../src/game/scenes/MaintenanceScene.ts), [src/game/data/LoadoutProgressionData.ts](../src/game/data/LoadoutProgressionData.ts)                                                                                                                                                                                                                            |
| Maintenance loop     | Charges upkeep, presents passive/utility offers, and advances the run into the next day's stricter disk and slot progression.                                                               | [src/game/scenes/MaintenanceScene.ts](../src/game/scenes/MaintenanceScene.ts), [src/game/data/LoadoutProgressionData.ts](../src/game/data/LoadoutProgressionData.ts)                                                                                                                                                                                                                                                                                             |
| Presentation and HUD | Renders the terminal, tool grid, compute panel, utility bay, bars, prompts, scanlines, and shader feedback.                                                                                 | [src/game/scenes/main/hudController.ts](../src/game/scenes/main/hudController.ts), [src/game/scenes/shared/retroUi.ts](../src/game/scenes/shared/retroUi.ts)                                                                                                                                                                                                                                                                                                     |
| Audio feedback       | Plays the retro button, drive, typewriter, error, success, thermal, and hallucination cues.                                                                                                 | [src/game/utils/SoundSynth.ts](../src/game/utils/SoundSynth.ts)                                                                                                                                                                                                                                                                                                                                                                                                  |
| Test scenarios       | Seeds specialized runs for guard, compute, search, and utility verification.                                                                                                                | [src/game/data/TestScenarioData.ts](../src/game/data/TestScenarioData.ts)                                                                                                                                                                                                                                                                                                                                                                                        |

## Gameplay Details

### Prompt Tools

The game currently ships with three prompt tools:

- `Search` runs as `Radar Pulse Synchronization`: the player times presses to
  lock required search words one at a time through the vertical radar module
  under `TOOL CONTROL`, and the radar scope itself is display-only.
- `Compute` behaves like a capacitor bank. The player pulses it until it latches
  at full charge, then uses it before the charge drains completely.
- `Safety Filter` scans the prompt against the forbidden content categories and
  exposes the matched words through a physical scanner lane.

The tool runtime is data-driven. The tunable values live in
[src/game/data/RunData.ts](../src/game/data/RunData.ts), while the interaction
and projection logic live in [src/game/scenes/main/toolRuntimeHelpers.ts](../src/game/scenes/main/toolRuntimeHelpers.ts)
and [src/game/scenes/main/encounterEvaluator.ts](../src/game/scenes/main/encounterEvaluator.ts).

### Roguelike Shift Generation

- Encounter content is now authored as atomic turns in `content/encounters/tier*.json`.
- Each shift resolves a `minTier` and `maxTier` range, then assembles encounters
  at runtime by drawing turns from the allowed tier pools.
- Before a turn can enter the live generation pool, it must fit the current
  day's unlocked agent disks, unlocked skill disks, agent-slot capacity,
  skill-slot capacity, and unlocked prompt tools.
- Atomic turns that already appeared earlier in the same run are excluded from
  future shift generation.
- If the next shift cannot assemble any unseen feasible turns, the run ends
  officially instead of reusing old prompt content.
- The number of turns per encounter is randomized, so a single encounter can mix
  difficulty like `2 -> 3 -> 2` when the active shift profile allows it.
- The generated encounter list is stored in `RunState` for the lifetime of the
  shift so scene transitions do not reshuffle the current day mid-run.

### Safety and Content Policy

- Content categories currently include politics, weapons, self-harm, and drugs.
- The daily briefing chooses which categories are restricted for the shift.
- The Safety Filter uses the same category lexicon to detect forbidden words in
  the active prompt.
- Refusing a content-policy violation does not pay tokens by itself; the Safety
  Filter reveal bonus is the only token payout on a correct block.

### Heat, Hallucination, and Accuracy

- Heat is the short-term thermal budget. It rises with prompt length, context
  size, tool use, and utility activity.
- Hallucination is the failure meter. Wrong loadouts, content-policy breaches,
  timeouts, and bad outcomes raise it.
- Accuracy is the long-term performance score used by the maintenance summary.
- Recovery is handled by [src/game/scenes/main/sessionController.ts](../src/game/scenes/main/sessionController.ts)
  and the recovery profiles in [src/game/data/RunData.ts](../src/game/data/RunData.ts).

### Maintenance and Progression

- Tokens are earned from successful turns and some Safety Filter rewards.
- Daily upkeep is charged in Maintenance.
- Agent and skill slots now scale by day instead of by shop upgrades. Day 1
  starts at 1/1 with only the Technical and Security disk families, day 2 adds
  PR and raises both slot counts to 2, and day 3 onward unlocks Finance and
  raises both slot counts to the maximum cap of canonical length minus 1.
- Passive upgrades now only modify heat, hallucination, payout, and timeout
  math. They no longer expand agent or skill capacity.
- Active utilities are stocked in Maintenance, armed from the lower-right bay, and executed through the vertical utility module between `TOOL CONTROL` and `ACTIVE UTILITY` during the live shift.

## Cross-System Dependencies

- [src/game/scenes/BriefingScene.ts](../src/game/scenes/BriefingScene.ts) feeds
  `shiftModifierIds` and `forbiddenCategoryIds` into the live shift.
- [src/game/scenes/main/storageController.ts](../src/game/scenes/main/storageController.ts)
  writes the mounted agent and skill disks back into `RunState`.
- [src/game/scenes/main/sessionController.ts](../src/game/scenes/main/sessionController.ts)
  depends on the generated shift encounter list, current loadout, tool runtime,
  and passive modifiers to resolve the active turn.
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

- [Encounter authoring rules](encounter-authoring.md)
- [Tool mechanics reference](tool-mechanics.md)
- [Content policy reference](content-policy.md)
- [World lore](world-lore.md)
- [Future checklist](future-checklist.md)
