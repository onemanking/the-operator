# Tool Mechanics Reference

This document captures the current prompt-tool behavior in the game and the
shared rules to follow when adding future tools. For the full current system
map, see [current-systems.md](current-systems.md).

## Overview

The game currently uses three prompt tools:

- `Search` runs as a radar pulse timing mode with a read-only scope display; the only interactive input is the `Sync Pulse` button, and successful locks use the selected word set during evaluation.
- `Compute` acts as a chargeable machine state that can stay armed after reaching full charge until the charge fully drains.
- `Safety Filter` scans the prompt for forbidden content and reveals the matched words through the scanner lane.

Tools should not read as flat menu toggles. Each one should feel like a distinct machine mode with its own sensory identity.

The design goal is that each tool has its own clear interaction pattern, its own HUD feedback, and its own evaluation rule.
That now also means each tool should ship with a readable audiovisual language, not only a rules explanation.

## Current Tool Set

The game currently uses three prompt tools:

## Active Utility Module

The live shift now also includes a dedicated active-utility module in the empty
right-side column between `TOOL CONTROL` and `ACTIVE UTILITY`.

- Utilities are still selected from the lower-right utility bay.
- Pressing the utility bay no longer applies the recovery effect instantly.
- The player must complete the utility-specific minigame in the vertical module
  before the effect is applied and the charge is consumed.
- The module auto-closes after a short success beat, so the utility reads like a
  real machine action rather than a permanent overlay.

### Coolant Purge

- Uses three hydraulic purge levers in a randomized per-run order.
- Each lever must be dragged down and held until its pressure gauge finishes
  venting.
- Completed levers stay latched only for a short decay window; if the window
  expires, that lever drops out and must be redone.
- Success vents heat immediately once all three levers are secured.

### Reality Patch

- Uses an oscilloscope screen and a single tuning knob.
- The player adjusts only the live waveform frequency while a fixed target trace
  stays visible behind it.
- When the two traces stay within tolerance long enough, the lock bar fills and
  the hallucination scrub is applied.
- Higher hallucination increases waveform jitter, making the alignment harder to
  hold.

### Signal Boost

- Uses a 3x3 signal-routing grid in the same vertical module.
- The player must draw a single orthogonal route from source to target while
  touching every required signal node.
- Releasing early, crossing a used cell, or finishing without all signal nodes
  causes a snap-back failure and forces a retry.
- Success restores user connection time immediately.

### Search Config

- Search now runs as a `Radar Pulse Synchronization` timing module in the vertical panel under `TOOL CONTROL`.
- The radar scope itself is display-only; the player presses `Sync Pulse` to trigger each timing attempt.
- Required search words are locked in sequentially, one word at a time.
- The active radar pulse loops on the current word until the player presses within the timing window as the pulse collapses into the center reticle.
- A successful press produces a signal-lock flash, stores that word as active search context, and advances to the next required word.
- A missed or mistimed press plays a desync beat, adds extra thermal load, and immediately retries the same word on the next pulse.
- Leaving the Search module open without pressing still adds passive thermal load over time.
- Closing Search no longer clears its progress for the current turn. Reopening the tool resumes from the next unfinished word.
- Search still contributes loadout heat through the locked normalized word set, and evaluation succeeds when that locked set contains every required search word.
- If the turn has no search targets, Search performs a single sweep and reports `NO SIGNATURES FOUND`.

### Compute Config

- Compute charges by repeated pulses.
- Charge decays over time when the player stops interacting.
- Once Compute reaches full charge one time, it becomes armed for commit evaluation.
- Armed Compute stays valid even if charge drops below the threshold, until charge reaches 0.
- When charge reaches 0, Compute is no longer considered active for commit evaluation.
- The HUD shows a compact indicator on the tool button and a dedicated compute panel when the tool is selected.

### Safety Filter

- The prompt is scanned against the active forbidden content categories.
- Matched words are revealed through the scanner lane, which is physically
  dragged across the prompt area.
- The scan has its own thermal cost and can reward tokens when the player blocks
  a content-policy violation with visible filtered words.
- The HUD uses a distinct red-brown scanner treatment so the player can read
  the mode without opening a tooltip.

## Shared HUD Rules

- Base heat preview should represent loadout cost from agents, skills, Search selection, and over-context penalties.
- Commit-action heat preview should appear only when hovering the relevant action button.
- All preview heat should use the same visual language unless a future tool intentionally needs a distinct affordance.
- Tool affordances should be readable at a glance: selected state, hover state, and armed/ready state should all be visually distinct.

## Shared Presentation Rules

- Every tool should communicate its state through motion, sound, and screen treatment, not only through labels or helper text.
- Prefer showing what the tool is doing through effect layers, animation, shader treatment, color shifts, and mechanical motion.
- Use text as secondary support only when the state would otherwise be unclear.
- If a tool has a special mode, the player should understand it from the screen behavior before reading any tooltip-style explanation.
- Tool feedback should be legible during live play on the terminal itself, not only in side panels or status text.
- Favor diegetic or machine-like feedback over abstract UI messaging. The tool should feel installed in the workstation.

## Audio And Visual Expectations

- New tools should include a minimum audiovisual pass as part of the first playable implementation, not as optional polish.
- Audio should communicate at least activation, active loop or movement, successful detection or charge event, and danger or failure state.
- Visuals should communicate at least idle state, active state, interaction state, and successful result state.
- Effects should be tied to gameplay meaning. If an effect exists, it should help the player read timing, danger, precision, or payoff.
- Repeated tool interactions should have small variations in timing, pitch, intensity, or motion so they do not feel static.
- When possible, use the terminal canvas itself as the feedback surface rather than relying on extra explanatory text.

## Effect-First Guidance

- Prefer effect and animation over explanatory copy.
- Prefer scanner sweeps, glow, flicker, beam passes, mask reveals, distortion, pulse, charge buildup, recoil, and decay over static text banners.
- Prefer shader or post-processing treatment when it improves the tool fantasy and keeps the state readable.
- Prefer motion that implies mechanism: latch, sweep, charge, vent, lock, pulse, reset.
- Text should confirm or reinforce a state, not carry the full burden of explaining it.
- If a tool can be understood by watching it for one second, that is better than needing a sentence of instruction.

## Safety Filter Reference

- `Safety Filter` is the current reference for the desired direction.
- Its presentation works because the tool is explained primarily by behavior: filtered CRT treatment, moving scanner hardware, guarded-word reveal, heat pressure, and scan audio.
- Future tools should aim for the same principle: teach the player through effect, animation, and response, then use text only as support.

## Data and Runtime Dependencies

The current tool behavior is split across these systems:

- `src/game/data/RunData.ts` stores tunable values such as Search heat costs and Compute charge/decay numbers.
- `src/game/types/SceneData.ts` persists runtime state such as Compute charge and armed state.
- `src/game/scenes/MainScene.ts` owns the runtime truth for selected tools, selected words, Compute charge, and projected heat.
- `src/game/scenes/main/terminalPromptController.ts` handles prompt word layout plus Search target and locked-word highlights on the terminal.
- `src/game/scenes/main/searchToolPanelController.ts` renders the Search radar timing module and its sequential progress feedback.
- `src/game/scenes/main/safetyScannerController.ts` handles the scanner lane motion and Safety Filter reveal presentation.
- `src/game/scenes/main/encounterEvaluator.ts` checks whether the active loadout satisfies the encounter requirements and calculates heat.
- `src/game/scenes/main/hudController.ts` renders tool buttons, previews, and the compute panel.
- `src/game/data/ContentPolicyData.ts` defines the forbidden-topic categories that Safety Filter scans against.

Any new tool should follow the same pattern: data config, runtime state, HUD presentation, and evaluator hook.

## Tuning Knobs

### Search

- `heatPerWord`: base heat per selected word.
- `extraHeatPerWordAfterSoftCap`: additional heat for selections beyond the soft cap.
- `softCapWords`: number of selected words before the extra heat starts.
- `pulseMinDurationSeconds`: fastest allowed pulse cycle for late-word sync attempts.
- `pulseMaxDurationSeconds`: starting pulse cycle duration for the first required word.
- `pulseAccelerationPerWordSeconds`: speed increase applied as the player advances through the sequence.
- `timingToleranceSeconds`: grace window before and after center lock that still counts as success.
- `activePressHeat`: heat added on every Search press.
- `mistimedPressExtraHeat`: extra heat added when a Search press misses the lock window.
- `idleHeatPerSecond`: passive heat added while the Search module stays open and unfinished.
- `successFlashMs`: duration of the success lock beat before the next word begins.
- `errorFlashMs`: duration of the desync beat before the same word retries.
- `noTargetSweepDurationSeconds`: sweep duration for the `NO SIGNATURES FOUND` case.

### Compute

- `chargeThreshold`: charge needed to arm the tool.
- `chargePerTap`: base charge added per pulse.
- `minimumTapEfficiency`: lowest efficiency when the tool is near full.
- `tapResistanceExponent`: how quickly charging becomes harder near full.
- `decayPerSecond`: base decay rate while idle.
- `maxDecayMultiplier`: maximum decay multiplier at high charge.
- `decayExponent`: how strongly decay rises near full.
- `readyHoldMs`: how long full charge latches before decay resumes.

## New Tool Template

When adding a new tool, define these pieces early:

1. What state does the tool own in `MainScene` or `SceneData`?
2. What is the player-facing interaction pattern?
3. What is the commit-time evaluation rule?
4. What heat or cost does it add?
5. What audio identity communicates activation, interaction, success, and danger?
6. What visual identity communicates the tool through effect, animation, shader, or screen treatment?
7. What HUD affordance makes the tool readable at a glance?
8. How does the tool reset when the turn changes or the player cancels it?

If a tool changes commit behavior, its active or locked state should be persisted and exposed through the same controller binding model used by Search and Compute.

## Future Tool Guidance

- Keep each tool behavior focused on one core interaction.
- Prefer simple, explicit rules over fuzzy logic for the first prototype.
- Keep UI feedback visible before commit, not only after the player presses INFERENCE.
- If a tool needs a special input mode, the HUD should make that mode obvious immediately.
- Plan the audiovisual hook at the same time as the mechanic. Do not wait until the end to decide how the tool should feel.
- When choosing between adding explanatory text and adding a clear effect or animation, prefer the effect or animation first.
- Treat shader, post-processing, reveal masks, and animated terminal treatments as core communication tools when they improve readability.
