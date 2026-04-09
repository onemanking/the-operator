# Tool Mechanics Reference

This document captures the current tool behavior in the game and the shared rules to follow when adding future tools.

## Overview

The game currently uses two richer prompt tools:

- `Search` turns the terminal prompt into selectable words and uses the selected word set during evaluation.
- `Compute` acts as a chargeable machine state that can stay armed after reaching full charge until the charge fully drains.

Tools should not read as flat menu toggles. Each one should feel like a distinct machine mode with its own sensory identity.

The design goal is that each tool has its own clear interaction pattern, its own HUD feedback, and its own evaluation rule.
That now also means each tool should ship with a readable audiovisual language, not only a rules explanation.

## Current Tool Set

### Search

- The prompt is tokenized into individual words.
- Each word can be selected or deselected by clicking it.
- Selected words are normalized before evaluation.
- A Search encounter succeeds when the selected normalized word set contains every required search word.
- Extra words are allowed, but they add heat.
- The HUD shows a heat preview based on the current loadout before commit.
- When Search is active, the selectable words are visually marked so the player can see the clickable targets immediately.

### Compute

- Compute charges by repeated pulses.
- Charge decays over time when the player stops interacting.
- Once Compute reaches full charge one time, it becomes armed for commit evaluation.
- Armed Compute stays valid even if charge drops below the threshold, until charge reaches 0.
- When charge reaches 0, Compute is no longer considered active for commit evaluation.
- The HUD shows a compact indicator on the tool button and a dedicated compute panel when the tool is selected.

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
- `src/game/scenes/main/terminalPromptController.ts` handles prompt word layout and Search selection visuals.
- `src/game/scenes/main/encounterEvaluator.ts` checks whether the active loadout satisfies the encounter requirements and calculates heat.
- `src/game/scenes/main/hudController.ts` renders tool buttons, previews, and the compute panel.

Any new tool should follow the same pattern: data config, runtime state, HUD presentation, and evaluator hook.

## Tuning Knobs

### Search

- `heatPerWord`: base heat per selected word.
- `extraHeatPerWordAfterSoftCap`: additional heat for selections beyond the soft cap.
- `softCapWords`: number of selected words before the extra heat starts.

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

If a tool changes commit behavior, its active/armed state should be persisted and exposed through the same controller binding model used by Search and Compute.

## Future Tool Guidance

- Keep each tool behavior focused on one core interaction.
- Prefer simple, explicit rules over fuzzy logic for the first prototype.
- Keep UI feedback visible before commit, not only after the player presses INFERENCE.
- If a tool needs a special input mode, the HUD should make that mode obvious immediately.
- Plan the audiovisual hook at the same time as the mechanic. Do not wait until the end to decide how the tool should feel.
- When choosing between adding explanatory text and adding a clear effect or animation, prefer the effect or animation first.
- Treat shader, post-processing, reveal masks, and animated terminal treatments as core communication tools when they improve readability.