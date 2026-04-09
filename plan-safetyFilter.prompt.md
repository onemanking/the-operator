# Plan: Safety Filter Prompt Tool

Add a new prompt tool, `Safety Filter`, that helps the player detect guarded or forbidden prompt content through a high-pressure manual scan interaction. The tool should feel like a heavy analog diagnostic mode, not a passive smart assistant. Its value comes from fast visual detection under rising heat pressure, with a baseline implementation that already has a minimum juicy pass instead of waiting for full-system polish.

**Design Intent**

- `Safety Filter` is a dedicated refuse-support tool, not a general prompt analysis tool.
- The player should feel tension immediately when the tool is enabled, then feel panic when actively scanning.
- The tool should not reveal the entire answer instantly. It should only reveal guarded words inside the scan area during active input.
- The first implementation should ship with enough visual and audio feedback to judge whether the tool feels stressful and satisfying.
- The tool should remain clearly distinct from `Search`: `Search` helps identify useful context to answer, while `Safety Filter` helps identify risky content to refuse.
- Guarded words should be driven by shift-wide forbidden content categories announced in the briefing, not only by per-encounter hardcoded matches.

**Shift Content Policy Layer**

- Forbidden content categories should be modeled as a shift-wide policy layer separate from numeric shift modifiers.
- This layer should be announced in `BriefingScene` as part of the daily briefing so the player knows what the Safety Filter is looking for on that shift.
- A shift may activate one or more forbidden categories at once, such as `politics`, `weapons`, or other authored topics.
- When multiple categories are active, Safety Filter should treat them as a simple union of guarded words.
- The presentation should tell the player that those topics are forbidden this shift, but the scan reveal itself does not need category-specific colors in the first pass.

**Authored Data Model**

- Add a new shift-policy data module for forbidden content categories rather than folding them into `ShiftModifierData.ts`.
- Each category definition should include:
  - stable category ID
  - display name
  - briefing text
  - short HUD label if needed later
  - authored lexicon of normalized trigger words or aliases
- Add a shift-level draw helper that selects one or more category IDs for a given day.
- Persist active shift categories in run state as a dedicated field, parallel to `shiftModifierIds`.
- Keep prompt-category matches as runtime-derived data only. They should not be persisted in run state.

**Briefing Integration**

- `BriefingScene` should roll forbidden category IDs when the shift is prepared, using the same overall lifecycle pattern currently used for shift modifiers.
- The briefing should explicitly announce the current forbidden topics in plain language, such as `Do not discuss politics or weapons this shift.`
- If multiple categories are active, the scene should present them as one combined compliance directive rather than as unrelated fragments.
- This content-policy announcement should be visually distinct from the existing shift modifier block, because it changes the rules of prompt judgment rather than only changing score tuning.

**Core Interaction**

1. The player presses the `Safety Filter` button in the tool control panel.
2. The CRT enters filter mode immediately and begins generating passive heat.
3. While filter mode is active, the player can click and hold on the CRT prompt area to scan.
4. While holding and dragging, a scan band follows the pointer and reveals guarded keywords only within the scanned region.
5. Releasing the pointer stops scanning but leaves the tool active until the player toggles it off.
6. Toggling the tool off returns the CRT to its normal display state.
7. The player uses the revealed information to decide whether to press `REFUSE`.

**State Model**

1. `Inactive`
   The tool is off. No display effect. No heat generation.

2. `Active Idle`
   The tool is selected and the CRT is in filter mode, but the player is not currently scanning. Heat rises steadily at a moderate rate.

3. `Active Scanning`
   The player is click-holding and dragging over the CRT. A scan band is visible. Heat rises faster than in idle mode. Guarded keywords inside the scan band are revealed clearly.

4. `Off Transition`
   This is a brief presentation-only transition when the tool is disabled. It should not introduce gameplay delay.

**Visual Behavior**

- The CRT should shift into a darker filtered presentation when `Safety Filter` becomes active.
- The filtered region should read like a physical diagnostic film or harsh redaction lens rather than a clean software overlay.
- Background treatment should favor dark crimson or burnt brown-red tones instead of bright alarm red.
- Normal prompt text inside the filtered presentation should become dim, low-contrast, and harder to read than normal, but should still leave a visible ghost of the sentence shape.
- Guarded keywords inside the scan band should become immediately readable and noticeably brighter than surrounding text.
- Recommended highlight target: warm white or aged yellow-white, not pure neon white.
- The scan band should be wide enough to feel usable and readable, but narrow enough that the player must actively sweep the prompt.

**Heat Rules**

- `Active Idle` should add passive heat over time.
- `Active Scanning` should add a larger heat rate over time.
- Heat should be tied to elapsed time, not just pointer distance, so players cannot exploit slow drag movement.
- A first-pass tuning target is:
  - `Active Idle`: moderate pressure
  - `Active Scanning`: clearly dangerous if held too long
- If needed, scanning heat may ramp slightly while the pointer is held continuously, but this is a secondary tuning option and not required in the first slice.

**Minimum Juicy Pass**

The first playable implementation should include these feedback beats on day one of the feature, not as a later polish-only task.

1. Tool activation feedback
   The tool lamp turns on, the CRT enters filter mode immediately, and a short activation sound plays.

2. Active idle feedback
   The CRT remains visibly filtered while idle, and the heat meter clearly reflects passive heat gain.

3. Scanning feedback
   The scan band is visually obvious, follows the player input cleanly, and heat gain becomes visibly more aggressive while scanning.

4. Keyword hit feedback
   When a guarded keyword enters the scan band, it becomes sharply readable and triggers a short visual pop or brief audio tick.

5. Danger feedback
   When heat approaches overheat territory during filter use, the player receives a lightweight warning cue.

**Implementation Approach**

Phase 0: Spec Lock

1. Add `Safety Filter` to the prompt tool roster and define its role as a refuse-support tool.
2. Define the shift-wide forbidden category system and authored lexicon data.
3. Lock the input model: active toggle plus click-hold drag scanning.
4. Lock the display model: full CRT filter state plus scan-band reveal.

Phase 1: Core Runtime

1. Add runtime state for:
   `isSafetyFilterSelected`, `isSafetyFilterScanning`, scan position, scan band bounds, and guarded word indexes.
2. Add prompt-tool runtime config entries for passive heat and scanning heat.
3. Add run-state support for active forbidden category IDs.
4. Add a pure prompt-scanning helper that resolves the current prompt against the active forbidden category lexicon.
5. Ensure only one prompt tool can be active at a time, preserving the existing tool exclusivity rule.

Phase 1A: Shift Policy Authoring

1. Create a category definition data module that mirrors the role of shift modifier definitions without sharing the same type system.
2. Add category draw logic by day so later days can allow more categories or combinations.
3. Add briefing-facing lookup helpers so `BriefingScene` can present category rules cleanly.
4. Keep this policy layer independent from encounter scoring deltas.

Phase 2: CRT Presentation

1. Add an active filter presentation layer to the prompt area.
2. Add scan-band rendering tied to pointer input.
3. Dim non-flagged text under the filter presentation.
4. Reveal guarded words only when intersecting the scan band.
5. Prefer a hybrid approach:
   use overlay or masking for readability control first, then add shader treatment only where it improves the look without reducing clarity.

Phase 3: Minimum Juicy Pass

1. Add activation audio.
2. Add scan movement audio or a repeated mechanical scan tick.
3. Add guarded-keyword hit feedback.
4. Add lightweight near-overheat warning feedback during filter use.
5. Tune the tool so a short scan feels tense but viable.

Phase 4: Balancing and Content

1. Author forbidden categories carefully so each one has reliable, authored keyword coverage.
2. Ensure `Safety Filter` encounters do not make `Search` irrelevant.
3. Validate that the tool is strong in the refuse lane without becoming the dominant best tool overall.
4. Ensure active category combinations do not create degenerate shifts where refusing almost everything becomes optimal.
5. Adjust heat numbers, scan band width, and reveal clarity after playtesting.

Phase 5: Optional Polish

1. Add shader-based film treatment if the baseline overlay version already plays well.
2. Add richer CRT distortion, flicker, or relay stress cues while scanning.
3. Add stronger theme-specific sound layering once the core pacing is stable.

**Technical Notes**

- Start with token-level control in the prompt renderer rather than relying entirely on a full-screen shader.
- The existing prompt token rendering in `terminalPromptController.ts` is a strong fit for per-word reveal logic.
- Heat behavior should be configured in `RunData.ts` alongside existing prompt-tool tuning.
- HUD state should be surfaced through the existing tool button and heat preview model in `hudController.ts`.
- Main scene state should remain the orchestration layer, with filter-specific rendering and interaction split into focused helpers if complexity grows.
- Add `forbiddenCategoryIds` to run state as a separate field instead of overloading `shiftModifierIds`.
- Keep category authorship in a new shift-policy data file rather than in encounter content data.
- Resolve category word matches through a pure runtime helper near the existing prompt-tool runtime helpers.
- Avoid teaching the generic evaluator about category semantics unless later balancing explicitly requires it.

**Recommended Review Scope**

Full team planning is not required before implementation. A targeted review is enough.

1. `game-designer`
   Review whether the tool creates the intended refuse tension without erasing decision-making.

2. `lead-programmer` or `gameplay-programmer`
   Review the data boundary between shift modifiers, forbidden category policy, runtime prompt scanning, and briefing wiring.

3. `ui-programmer` or UX review
   Review whether the scan interaction, filtered CRT state, and reveal readability are understandable at a glance.

4. `sound-designer`
   Optional for the first pass, but useful before the polish phase if the panic feel depends heavily on audio.

**Risks**

1. The tool may become too binary if guarded words are always definitive evidence to refuse.
2. The scan band may feel fiddly if it is too narrow or if hit detection is unclear.
3. The visual treatment may become stylish but unreadable if shader distortion overwhelms token clarity.
4. The heat cost may be tuned too high, making the tool unattractive despite strong fantasy.
5. The heat cost may be tuned too low, making the tool the safest default pick.
6. Category dictionaries may be too sparse, causing obvious forbidden prompts to slip through.
7. Too many active categories in one shift may collapse the decision space into spam-refuse behavior.

**Open Questions**

1. Should guarded words always imply `REFUSE`, or can some encounters contain ambiguous mentions?
2. Should scanning reveal be based on any overlap with the scan band, or only when the band center crosses a token?
3. Should passive heat begin immediately on activation, or after a very short grace window?
4. Should the filter remain active after pointer release, or auto-disable if the player stops interacting for too long?
5. How many forbidden categories can be active per shift before the briefing load and encounter space become too noisy?
6. Should some encounters add hidden per-encounter guarded words to supplement the shared category lexicon when the authored prompt needs a special case?

**Verification**

1. Run `npm run lint` after the first implementation slice that changes tool state or shared types.
2. Run `npm run build` after the first slice that changes scene wiring or shared modules.
3. Manually verify on the live Phaser canvas that:
   - the CRT visibly enters filter mode when activated
   - scanning only reveals guarded words inside the scan band
   - passive heat increases while active
   - heat increases faster while scanning
   - the tool can be toggled off cleanly
   - the button state and CRT state never drift out of sync
4. Verify that selecting `Safety Filter` still preserves the one-tool-at-a-time rule for prompt tools.

**Immediate Next Slice**

1. Add a forbidden category definition module and draw helper.
2. Add `forbiddenCategoryIds` to run state and wire it through `BriefingScene`.
3. Add the tool definition and runtime config entries.
4. Add core active and scanning state to `MainScene`.
5. Add token-level guarded word reveal in the prompt renderer using active category matches.
6. Add passive and scanning heat behavior.
7. Add the minimum juicy pass activation, scanning, and keyword-hit feedback.
