## Plan: Roguelike Run Pivot

Pivot Prompt, Please from a linear one-prompt validation loop into a run-based roguelike structure by first introducing a shared RunState and a richer encounter model, then layering graded scoring, multi-turn encounters, maintenance upgrades, multi-agent capacity, and finally tiered content variation. The recommended approach is to preserve the current scene flow and playable build while replacing the foundations that currently force strict binary validation and fixed slot counts.

**Steps**

1. Phase 1 — Foundation: define a shared RunState and expand scene payloads so Briefing, Main, and Maintenance all read and write the same run-level state. This blocks all later phases.
2. Phase 1 — Foundation: replace the flat UserSession schema with an encounter-oriented authored data model that can represent multiple turns, required versus optional context, reward and penalty profiles, and future upgrade interactions. This blocks phases 2-5.
3. Phase 1 — Foundation: split judgment logic out of MainSceneSessionController into a dedicated evaluator module that returns a graded result instead of a pass/fail boolean. This blocks phases 2-5.
4. Phase 1 — Foundation: keep current content and current scene loop playable by mapping existing authored prompts into the new encounter schema before enabling roguelike-only features. This depends on steps 1-3.
5. Phase 2 — Encounter Depth: add multi-turn encounters so one user can ask 2-4 linked questions within a single encounter, with explicit encounter progress and per-turn rewards. This depends on step 4.
6. Phase 2 — Encounter Depth: change scoring to evaluate four dimensions: required coverage, efficiency, safety, and speed. Correct-but-overbuilt loadouts should reduce token payout or increase heat, while incorrect or conflicting context should increase hallucination. This depends on step 3 and should ship together with step 5.
7. Phase 2 — Encounter Depth: separate gameplay categories into prompt tools, active utilities, and passive upgrades. Prompt tools are validated by encounters, active utilities are player-triggered help during gameplay, and passive upgrades are purchased during rest and apply immediately for the rest of the run. This depends on steps 1-3.
8. Phase 3 — Upgrade Loop: convert MaintenanceScene into a choose-1-of-3 upgrade shop where passive upgrades apply immediately to RunState and active utilities or consumables, if included, are added to the player’s run inventory. This depends on steps 1, 4, and 7.
9. Phase 3 — Upgrade Loop: make storage and drive capacity data-driven so agent capacity can scale like skill capacity. Agent storage should be refactored to support multiple equipped agents, but encounter requirements should ramp more slowly than player capacity so upgrades feel empowering before they become mandatory. This depends on steps 1, 2, and 7.
10. Phase 4 — Difficulty Ramp: introduce tiered authored encounter pools and a required-context complexity ladder. Recommended order: 1 agent; 1 agent + 1 tool; 1 agent + 1-2 skills; 2 agents + 1 skill; 1 agent + 2-3 skills; 2 agents + 2 skills; then rare boss-tier encounters with multi-agent + multi-skill + tool. This depends on steps 5-9.
11. Phase 4 — Difficulty Ramp: add active utility design only after passive upgrades and encounter scoring are stable. Utilities should help planning or recovery, such as cooling, hallucination control, rerolls, or temporary token boosts, but must remain clearly separate from prompt tools in both data and UI. This depends on steps 7-10.
12. Phase 5 — Balance and Polish: tune token economy, upgrade costs, reward tiers, and penalty curves so over-context is an efficiency tax rather than a semantic failure, and so late-run complexity increases at roughly the same pace as player power. This depends on all prior steps.

**Execution Checklist**

- [x] 1. Shared RunState is the scene handoff model across Briefing, Main, and Maintenance.
- [x] 2. Flat UserSession content is wrapped by an encounter-oriented data model with turns, requirements, replies, and scoring profiles.
- [x] 3. Answer judgment is split into a dedicated evaluator module with graded outcomes.
- [x] 4. Existing content still runs through the current scene loop on top of the new model.
- [x] 5. Multi-turn encounters are implemented and can progress across linked user requests.
- [x] 6. Scoring now evaluates graded outcomes with efficiency and safety penalties instead of strict binary success only.
- [-] 7. Gameplay categories are separated.
  Current state: prompt tools, passive upgrades, and the first consumable active utility are live as distinct systems.
- [x] 8. MaintenanceScene is a choose-1-of-3 upgrade shop.
     Current state: passive upgrades and the first consumable utility purchase are live and apply to the current run immediately.
- [-] 9. Storage and capacity are data-driven for both skills and agents.
  Current state: skill capacity upgrades are live; multi-agent mounting foundation is live; the first true simultaneous dual-agent requirement encounter is live; broader authored coverage that leans on expanded agent capacity is still limited.
- [-] 10. Difficulty ramp and complexity ladder are in progress.
  Current state: random encounter draws, shift modifiers, and some multi-turn authored variety are live; the first thin day-3 pool is now authored to exercise dual-agent plus utility-pressure play, but broader tier coverage and full tuning are still pending.
- [x] 11. Active utilities are designed and implemented as a distinct support system.
- [ ] 12. Balance and polish pass is complete across token economy, upgrade pricing, and difficulty curves.

**Immediate Next Checklist**

- [x] Author the first encounter set that benefits from dual-agent loadouts without requiring simultaneous multi-agent validation.
- [x] Add the first true multi-agent encounter requirements to the evaluator and authored content ladder.
- [x] Decide the first active utility format: consumable charges, persistent run unlock, or mixed model.
- [x] Implement one minimal active utility with clear UI separation from prompt tools.
- [x] Expand tier pools beyond the current day-1-heavy authored content so mid-run and late-run shifts actually ramp.
- [ ] Do a balance pass after the first active utility and multi-agent content slice both exist.

**Working Agreement**

- Update this plan's checklist and current-state notes after each completed implementation slice.
- Use the agent team to choose the next slice before broad refactors or new gameplay systems.
- For E2E verification, use built-in browser tools or runtime hooks to interact with the Phaser canvas.

**Current Sequencing Note**

- Systems-first mode is active: the first true multi-agent requirement slice and the first active utility slice are complete; broader difficulty-ramp expansion can resume in thin slices, but full tuning should still wait until more authored coverage exists.
- The first thin day-3 authored pool is live as a smoke-test slice; the next major step is a balance pass, not another new system.
- Until those systems are stable, only add thin-ramp smoke-test content that exercises the new mechanics without trying to fully tune the ladder.
- The first active utility target is `COOLANT PURGE`: a consumable, manually triggered heat dump that lives in run inventory, is purchased in Maintenance, and is activated from a dedicated MainScene utility control.

**Run Variation — How Each Run Differs**

Each run is different through four stacked sources of variance:

1. Encounter draw from tier pools
   Each tier (shift 1, 2, 3) has an authored pool of encounters larger than the number drawn per shift. A run draws N encounters per shift randomly from that pool, so the specific prompts, their order, and the combination of required context types will differ every run. The pool is authored (not algorithmically generated) to keep content quality high in v1.

2. Upgrade path divergence
   Each rest stop presents 3 randomly drawn upgrades from the available upgrade pool for that tier. The player picks 1. Because the draw is random and the player's choice is free, no two runs will have the same passive upgrade loadout, which changes how the player handles later encounters.

3. Shift modifiers
   BriefingScene shows a modifier or policy rule scoped to that shift, drawn randomly from a pool per tier. Examples: "All search tool results cost double heat this shift", "Jailbreak encounters award triple tokens this shift", "Agent capacity limit is reduced by 1 for this shift". These are authored per tier and drawn randomly, not computed.

4. Encounter content variation within a pool entry
   Individual encounter definitions can contain a reply pool and multiple userTurn variants so even when the same encounter is drawn in a later run, the exact wording, follow-up timing, or patience level may differ slightly.

What does NOT vary: the complexity ladder order, the number of shifts per run, and the base scene flow. Those stay fixed so the overall arc is predictable while content within it changes.

**Relevant files**

- `e:\VibeGameJame\prompt-please\src\game\types\SceneData.ts` — expand scene payloads from day/money/accuracy into a reusable RunState handoff model.
- `e:\VibeGameJame\prompt-please\src\game\data\SessionData.ts` — replace flat UserSession data with encounter definitions, tier pools, reply sets, and upgrade or utility data definitions.
- `e:\VibeGameJame\prompt-please\src\game\scenes\MainScene.ts` — keep as orchestration layer while switching to shared run data and richer controller boundaries.
- `e:\VibeGameJame\prompt-please\src\game\scenes\main\sessionController.ts` — reduce to pacing, chat progression, timeouts, and encounter lifecycle; remove direct answer judgment from this controller.
- `e:\VibeGameJame\prompt-please\src\game\scenes\main\storageController.ts` — make equipped agent and skill capacities data-driven and support multiple equipped agents.
- `e:\VibeGameJame\prompt-please\src\game\scenes\main\config.ts` — move fixed drive capacities toward run-driven config and define baseline rack or drive layouts that upgrades can extend.
- `e:\VibeGameJame\prompt-please\src\game\scenes\main\types.ts` — expand context-related types to represent multiple equipped agents, prompt tool categories, utilities, and encounter scoring output.
- `e:\VibeGameJame\prompt-please\src\game\scenes\BriefingScene.ts` — present tier or policy modifiers and hand off full run state into MainScene.
- `e:\VibeGameJame\prompt-please\src\game\scenes\MaintenanceScene.ts` — turn fixed end-of-day summary into a rest and upgrade phase with immediate passive upgrade application.
- `e:\VibeGameJame\prompt-please\README.md` — update the gameplay loop, maintenance phase expectations, and manual verification notes after the design stabilizes.

**Verification**

1. After Phase 1, confirm existing content still plays end-to-end through Briefing, Main, and Maintenance with the new RunState and encounter schema in place.
2. After Phase 2, manually verify that one encounter can contain multiple user questions, that per-turn rewards resolve correctly, and that score feedback distinguishes missing requirements from inefficient over-context.
3. After Phase 3, manually verify that passive upgrades bought during rest apply immediately in the next encounter without requiring gameplay activation, and that prompt tools remain separate from utilities.
4. After Phase 3, manually verify storage behavior for upgraded capacities, especially multi-agent mounting and its display in the drive UI.
5. After Phase 4, manually verify the complexity ladder across a short run so required-context combinations increase in the intended order and do not spike too early.
6. Run `npm run lint` after each implementation phase that changes shared types or scene wiring.
7. Run `npm run build` after phases that change scene flow, shared modules, or data organization.
8. For any MainScene or MaintenanceScene HUD changes, open the live game and verify that new UI is visible, readable, not clipped or overlapping, and that its primary interaction still works on the Phaser canvas.
9. After each completed slice, update the execution checklist so plan status stays current before starting the next slice.

**Decisions**

- Keep the existing scene flow: BootScene -> BriefingScene -> MainScene -> MaintenanceScene.
- Passive upgrades are not tools and are not player-triggered during gameplay; they are purchased in the rest phase and apply immediately for the run.
- Prompt tools remain part of encounter validation, while active utilities are player support systems and must be modeled separately.
- Multi-agent requirements should exist, but difficulty should ramp into them gradually so added agent capacity initially feels like relief rather than immediate extra burden.
- Overusing correct context should be penalized through efficiency costs such as lower token rewards or increased heat, not by hallucination unless the context is actually wrong, conflicting, or unsafe.
- Roguelike v1 should use authored weighted encounter pools rather than fully procedural generation.

**Scope Boundaries**

- Included: RunState refactor, encounter data refactor, graded scoring, multi-turn users, maintenance upgrade selection, passive upgrades, active utilities, multi-agent capacity, tiered encounter progression, and balance tuning for the new loop.
- Excluded from the first implementation pass: permanent meta-progression across runs, branching map navigation, deep relic combo systems, and fully procedural content generation.

**Requirement Coverage**

1. Each run should feel different while difficulty ramps upward
   Covered. This is handled by tiered authored encounter pools, random encounter draw per shift, random upgrade choices, shift modifiers, and a fixed complexity ladder that ramps upward across the run.

2. One user can ask multiple questions in a row, scaling by difficulty
   Covered. Phase 2 adds multi-turn encounters with 2-4 linked questions inside one encounter and explicit encounter progress.

3. Successful prompt handling should award tokens immediately per question
   Covered. The plan moves rewards to per-turn or per-question token payouts instead of only end-of-day style rewards.

4. Mid-run break with 3 random upgrade choices, buy 1 using tokens
   Covered in structure, but checkpoint cadence is not fully locked yet. The plan already defines a choose-1-of-3 paid upgrade shop in MaintenanceScene; the remaining decision is whether this appears once mid-run plus end summary, or after every shift.

4.1. Difficulty should noticeably increase after the break
Covered. The plan ramps the post-rest tiers through authored encounter pools and the complexity ladder, with later tiers introducing denser context requirements.

5. As difficulty rises, more agent, skill, and prompt-tool complexity should appear
   Covered. The plan adds tiered required-context escalation and separates player-help utilities from encounter-validated prompt tools.

6. High difficulty should require combining multiple skill files, and sometimes multiple agents plus skills
   Covered. The complexity ladder explicitly includes multi-agent plus multi-skill combinations in later tiers, including rare boss-tier encounters.

7. Upgrade choices should make the run easier, not add more complexity pressure like agent or skill unlocks do
   Covered. Passive upgrades are defined as relief mechanics such as slot expansion or run advantages, while agent, skill, and prompt-tool complexity comes from encounter design and progression.

8. Passive upgrades must not behave like gameplay tools
   Covered and locked. Passive upgrades are purchased during rest and apply immediately for the run without manual activation in encounters.

9. The answer-checking model must evolve beyond strict 100 percent correctness once slot expansion exists
   Covered. The plan replaces binary validation with graded scoring across coverage, efficiency, safety, and speed.

10. Using correct context but too much of it should reduce rewards
    Covered. The current plan models over-context primarily as an efficiency penalty through lower token payout and potentially higher heat.

11. Using correct context but too much of it should also increase hallucination
    Not locked. The current plan intentionally does not guarantee this. Right now the recommendation is to reserve hallucination for wrong, conflicting, or unsafe context, because using too much correct context reads more like waste or overheating than hallucination. If desired, this can be changed, but it is a design decision rather than something the current plan has already committed to.

**Further Considerations**

1. Decide whether active utilities should be permanently unlocked within a run, consumable charges, or a mix. Recommendation: start with 1-2 consumable-style utilities after passive upgrades are stable.
2. Decide whether the maintenance phase appears after every shift or only at specific checkpoints. Recommendation: start with one guaranteed mid-run rest plus the end-of-run maintenance summary to keep pacing readable.
3. Decide whether accuracy remains a top-level score metric or is folded into encounter grading and end-of-run scoring. Recommendation: keep it for now as a summary stat, then revisit once graded scoring data exists.
