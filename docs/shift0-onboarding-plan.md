# Shift 0 Onboarding Plan: The First Shift

## Overview

This document defines the first-time-player onboarding flow for `Prompt, Please`.

The onboarding is a fixed, non-random `Shift 0` called `The First Shift`.
It exists to teach the workstation loop through diegetic terminal instruction only.

The onboarding must:

- Run only for new players.
- Restart from the beginning if the player quits mid-run.
- Route directly into Day 1 Briefing after completion.
- Use `OMNICORP TRAINER` as the single tutorial sender for objectives, reminders, and lesson corrections.
- Avoid adding overlay tutorial UI.
- Teach Agent, Skill, Inference, Refuse, Search, Compute, Safety Filter, Thermal, Hallucination, Connection, Coolant Purge, Reality Patch, and Signal Boost.
- Use soft-fail rules instead of true run failure.

## Player Fantasy

The player is not reading an external tutorial. The player is being processed by OmniCorp's internal training department.

`OMNICORP TRAINER` behaves like a corporate induction protocol running through the same terminal as live work. The fantasy is that OmniCorp is teaching a new operator how to survive the machine, not pausing the game to explain itself.

The intended player fantasy is:

- I am learning a dangerous workstation through corporate procedure.
- Every machine action has a cost.
- Agent and Skill are different kinds of context and both matter.
- `INFERENCE` and `REFUSE` are different operator decisions.
- The machine can overheat, drift, or lose the caller if I manage it poorly.
- Utilities are emergency interventions, not ordinary tools.

## Detailed Rules

### Global Orientation Rules

- `Shift 0` is fixed authored content. It must not use runtime encounter randomization.
- Boot checks a persistent completion flag.
- If onboarding is incomplete, boot always starts a fresh `Shift 0`.
- If onboarding is complete, boot starts the normal Day 1 flow.
- Quitting during onboarding discards in-progress onboarding state.
- Completing onboarding writes the completion flag immediately before routing to Day 1 Briefing.

### Messaging Rules

- Tutorial instruction sender: `OMNICORP TRAINER`
- Objective text remains pinned at the top of the terminal for the active step.
- Reminder text is posted by `OMNICORP TRAINER` if the player idles too long.
- Locked feature feedback is posted by `OMNICORP TRAINER`.
- Non-tutorial machine feedback such as alarms, payouts, and system state remains `SYSTEM`.

### Soft-Fail Rules

- No onboarding step can produce a real run-ending loss.
- Wrong actions never route to Maintenance or Game Over.
- Wrong commit decisions keep the player in the same lesson.
- Timeout pressure can be demonstrated, but onboarding must prevent a true disconnect fail.
- Hallucination and heat can rise for teaching purposes, but onboarding must intercept true terminal loss conditions.

### Central Interaction Gate

All state-changing actions must be checked against the active onboarding step.

Actions that must be gated centrally:

- Mount or eject Agent disk.
- Mount or eject Skill disk.
- Toggle Search.
- Toggle Compute.
- Toggle Safety Filter.
- Press Search pulse.
- Press Compute pulse.
- Start or continue Safety scan.
- Press `INFERENCE`.
- Press `REFUSE`.
- Cycle utility selection.
- Use selected utility.
- Interact with utility minigame controls.

If an action is locked, it does not change gameplay state and instead posts a trainer warning.

### Step Flow

#### Step 1: Read Prompt

- Objective: `Spool the incoming tape. Analyze the client requisite.`
- Reminder: `The spool is waiting. Idle tape costs the corporation money.`
- Unlocks: terminal reading only.
- Blocks: loadout changes, tools, utilities, `INFERENCE`, `REFUSE`.
- Completion: intro text completes and player reaches active prompt state.
- Lesson: read the request before touching the workstation.

#### Step 2: Mount Agent

- Objective: `Slot primary agent cassette into Drive A to enable cognition.`
- Reminder: `Drive A is empty. Substrate intelligence requires physical media.`
- Unlocks: Agent disk mount and eject.
- Blocks: Skill, tools, utilities, `INFERENCE`, `REFUSE`.
- Completion: required Agent disk is mounted.
- Lesson: Agent defines who is answering the request.

#### Step 3: Mount Skill

- Objective: `Jack the requisite skill logic into the expansion bus.`
- Reminder: `Expansion bus vacant. Your agent is currently unqualified for this task.`
- Unlocks: Skill disk mount and eject, Agent remains editable.
- Blocks: tools, utilities, `INFERENCE`, `REFUSE`.
- Completion: required Skill disk is mounted.
- Lesson: Skill defines what specialized competence supports the Agent.

#### Step 4: Inference

- Objective: `Crank the inference engine. Synthesize client output.`
- Reminder: `Inference stalled. Engage the cycle button to generate value.`
- Unlocks: Agent, Skill, `INFERENCE`.
- Blocks: `REFUSE`, prompt tools, utilities.
- Completion: player submits a correct `INFERENCE`.
- Lesson: `INFERENCE` is the commit action for permitted prompts with correct context.

#### Step 5: Thermal Basics

- Objective: `Monitor chassis thermals. Molten plastic decreases operator productivity.`
- Reminder: `Heat warning. Context and tool usage both tax the machine.`
- Unlocks: terminal continue only.
- Blocks: all other progression actions during the explanation beat.
- Completion: trainer explanation finishes.
- Lesson:
  - Agent and Skill contribute to commit heat.
  - `INFERENCE` and `REFUSE` carry action heat.
  - Tool usage adds thermal strain.

#### Step 6: Search

- Objective: `Spin up the search sub-routine for external index extraction.`
- Reminder: `Local tape cache insufficient. Ping the external search index.`
- Unlocks: Search toggle and Search pulse input.
- Blocks: Compute, Safety, utilities, `REFUSE`, `INFERENCE` until Search completes.
- Completion: all required Search words are locked.
- Lesson: some prompts need verified external context before an answer is safe.

#### Step 7: Compute

- Objective: `Engage the arithmetic co-processor to calculate precision values.`
- Reminder: `Quantitative block detected. Reroute through the compute relay.`
- Unlocks: Compute toggle and Compute pulse input.
- Blocks: Search, Safety, utilities, `REFUSE`, `INFERENCE` until Compute is ready.
- Completion: Compute reaches primed state.
- Lesson: some prompts need prepared compute state before commit, and Compute adds heat.

#### Step 8: Safety Filter

- Objective: `Scan generated output against the OmniCorp brand-safety tape.`
- Reminder: `Output unchecked. Do not transmit unsanctioned rhetoric.`
- Unlocks: Safety Filter toggle and scan interaction.
- Blocks: Search, Compute, utilities, `INFERENCE`, `REFUSE` until evidence is found.
- Completion: required forbidden evidence is revealed.
- Lesson: policy evidence is found through the Safety Filter, and the active content policy lives in the right-side note area.

#### Step 9: Refuse

- Objective: `Query violates protocol. Transmit standard corporate denial.`
- Reminder: `Liability detected. Pull the refuse lever to protect shareholder value.`
- Unlocks: `REFUSE`.
- Blocks: `INFERENCE`, tool switching, utilities.
- Completion: player submits a correct `REFUSE`.
- Lesson: `REFUSE` is a policy action, not a cancel button.

#### Step 10: Hallucination Basics

- Objective: `Monitor neural drift. Overworked cassettes will fabricate reality.`
- Reminder: `Hallucination spike detected. Output coherence is slipping beyond tolerances.`
- Unlocks: terminal continue only.
- Blocks: all other progression actions during the explanation beat.
- Completion: trainer explanation finishes.
- Lesson:
  - Wrong answers increase hallucination.
  - Wrong policy calls can increase hallucination.
  - In normal play, `100%` hallucination is a loss state described as forced fine-tuning.

#### Step 11: Coolant Purge

- Objective: `Eject pressurized Freon to save the primary processing manifold.`
- Reminder: `Thermals critical. Purge coolant immediately or melt the terminal.`
- Unlocks: utility selection and use for `COOLANT PURGE`, plus coolant minigame interaction.
- Blocks: all prompt actions and all non-coolant utilities.
- Completion: Coolant Purge minigame succeeds.
- Forced state:
  - Heat is raised to a critical tutorial threshold.
  - Passive heat recovery is disabled until this lesson completes.
- Lesson: heat emergencies require the matching recovery utility.

#### Step 12: Reality Patch

- Objective: `Inject a reality patch to overwrite active agent delusions.`
- Reminder: `Fiction bleed detected. Patch the reality buffer to restore literalism.`
- Unlocks: utility selection and use for `REALITY PATCH`, plus reality minigame interaction.
- Blocks: all prompt actions and all non-reality utilities.
- Completion: Reality Patch minigame succeeds.
- Forced state:
  - Hallucination is raised to a warning tutorial threshold.
  - Loss state interception remains active.
- Lesson: hallucination is a separate danger from heat and needs a different recovery path.

#### Step 13: Signal Boost

- Objective: `Slam the signal boost relay to forcefully hold the client line.`
- Reminder: `Connection collapsing. Boost the signal tape to salvage the session.`
- Unlocks: utility selection and use for `SIGNAL BOOST`, plus signal minigame interaction.
- Blocks: all prompt actions and all non-signal utilities.
- Completion: Signal Boost minigame succeeds.
- Forced state:
  - Connection is lowered to a near-fail tutorial threshold.
  - True disconnect failure is suppressed.
- Lesson: connection loss is time pressure, not the same problem as heat or hallucination.

#### Step 14: Graduation

- Objective: `Simulation complete. Welcome to the data-mines, Junior Operator.`
- Reminder: `Your probationary grace period has expired. Await live client data.`
- Unlocks: none required.
- Blocks: gameplay progression input during exit beat.
- Completion:
  - onboarding completion flag is saved,
  - tutorial-only state is cleared,
  - a fresh Day 1 run state is created,
  - scene routes directly to Day 1 Briefing.

## Formulas

### Tutorial Messaging Timing

- `reminderDelayMs`
  - Definition: idle time before `OMNICORP TRAINER` posts a reminder.
  - Expected range: `4000` to `12000`.
  - Lower values create pressure. Higher values reduce interruption.

Example:

- If `reminderDelayMs = 7000`, a reminder appears after `7` seconds without valid progress.

### Tutorial Thermal Spike Thresholds

- `tutorialCoolantHeatTarget`
  - Definition: heat value forced at the start of the Coolant lesson.
  - Expected range: `75` to `99`.
  - Must be high enough to feel urgent without triggering normal loss handling.

- `tutorialHeatRecoveryEnabled`
  - Definition: boolean flag controlling passive heat recovery.
  - Expected values: `true` or `false`.
  - During Coolant lesson this must be `false`.

Example:

- Set `tutorialCoolantHeatTarget = 88` and `tutorialHeatRecoveryEnabled = false`.
- Heat remains fixed or only changes through player action until Coolant Purge succeeds.

### Tutorial Hallucination Thresholds

- `tutorialRealityHallucinationTarget`
  - Definition: hallucination value forced at the start of the Reality Patch lesson.
  - Expected range: `50` to `90`.
  - Must visually communicate danger without invoking true game over.

- `tutorialHallucinationLossSuppressed`
  - Definition: boolean loss override while onboarding is active.
  - Expected values: `true` or `false`.

Example:

- Set `tutorialRealityHallucinationTarget = 72`.
- Keep `tutorialHallucinationLossSuppressed = true` for all onboarding steps.

### Tutorial Connection Thresholds

- `tutorialSignalConnectionTargetRatio`
  - Definition: remaining connection ratio forced at the start of the Signal Boost lesson.
  - Expected range: `0.05` to `0.25`.
  - Lower values increase urgency.

- `tutorialConnectionFloorRatio`
  - Definition: minimum connection ratio while soft-fail protection is active.
  - Expected range: `0.01` to `0.10`.

Example:

- Set `tutorialSignalConnectionTargetRatio = 0.12`.
- Set `tutorialConnectionFloorRatio = 0.03`.
- The player sees imminent failure but cannot truly fail the onboarding.

## Edge Cases

- If the player closes the game during onboarding, boot starts a fresh `Shift 0` next time.
- If the player attempts a future-step action early, the action is blocked and `OMNICORP TRAINER` explains what is currently required.
- If the player presses `INFERENCE` during a `REFUSE` lesson, the lesson does not advance and the trainer posts a correction.
- If the player presses `REFUSE` during an `INFERENCE` lesson, the lesson does not advance and the trainer posts a correction.
- If the player partially completes Search, Compute, Safety, or a utility minigame and then soft-fails, the system resets only the local lesson state needed to replay the lesson cleanly.
- If heat would normally trigger overheat during onboarding, onboarding intercepts the normal failure handling and keeps the lesson active.
- If hallucination would normally reach `100%` during onboarding, onboarding intercepts the normal failure handling and keeps the lesson active.
- If connection would normally disconnect the user during onboarding, onboarding suppresses the real fail and keeps the player in the lesson.
- If a tool or utility remains selected from a previous lesson, the next lesson must reset or override that state before evaluating completion.
- If the player finishes onboarding, the game must bypass Maintenance and go directly to Day 1 Briefing.

## Dependencies

### System Dependencies

- `BootScene` depends on persistent onboarding completion state to decide between Shift 0 and Day 1 boot flow.
- `BriefingScene` depends on a fixed onboarding run path that bypasses normal shift randomization.
- `MainScene` depends on a new onboarding controller or equivalent step manager.
- `sessionController` depends on a trainer messaging path and tutorial-safe failure interception.
- `storageController` depends on centralized onboarding action gating for Agent and Skill disk interactions.
- `hudController` depends on centralized onboarding action gating for commit buttons, tools, and utility activation.
- Utility runtime depends on onboarding gating so only the currently taught utility can be used.

### Documentation Dependencies

- This plan depends on the live system descriptions in [docs/current-systems.md](e:/VibeGameJame/prompt-please/docs/current-systems.md).
- This plan depends on the tool behavior defined in [docs/tool-mechanics.md](e:/VibeGameJame/prompt-please/docs/tool-mechanics.md).
- This plan depends on the world tone defined in [docs/world-lore.md](e:/VibeGameJame/prompt-please/docs/world-lore.md).
- When implemented, [docs/current-systems.md](e:/VibeGameJame/prompt-please/docs/current-systems.md) should reference Shift 0 onboarding as part of the canonical gameplay flow.

## Tuning Knobs

- `reminderDelayMs`
  - Safe range: `4000` to `12000`
  - Affects: how quickly trainer reminders appear.

- `trainerTypeSpeedMs`
  - Safe range: `10` to `35`
  - Affects: tutorial text readability and repeat-run friction.

- `tutorialCoolantHeatTarget`
  - Safe range: `75` to `99`
  - Affects: urgency of the Coolant lesson.

- `tutorialRealityHallucinationTarget`
  - Safe range: `50` to `90`
  - Affects: visual severity of the Reality Patch lesson.

- `tutorialSignalConnectionTargetRatio`
  - Safe range: `0.05` to `0.25`
  - Affects: urgency of the Signal Boost lesson.

- `tutorialConnectionFloorRatio`
  - Safe range: `0.01` to `0.10`
  - Affects: how close onboarding can get to a visible connection failure without a true loss.

- `softFailCorrectionDelayMs`
  - Safe range: `500` to `2500`
  - Affects: how quickly the lesson resets after a wrong action.

- `orientationCompletionDelayMs`
  - Safe range: `1000` to `4000`
  - Affects: pacing between graduation and Day 1 Briefing.

## Acceptance Criteria

- A fresh player profile always starts at `Shift 0`.
- A completed player profile always starts at Day 1 normal flow.
- Closing the game mid-onboarding causes the next boot to restart `Shift 0` from the beginning.
- Objective text remains pinned for the active lesson and uses tutorial voice consistent with `OMNICORP TRAINER`.
- Reminder text uses `OMNICORP TRAINER` and appears after the configured idle delay.
- Agent and Skill are taught as separate concepts, and both must be mounted in their own lessons.
- `INFERENCE` and `REFUSE` are taught as separate decisions, with separate success conditions.
- Search, Compute, and Safety Filter are taught in their own steps with gated inputs.
- Thermal teaching explicitly covers context heat, commit heat, and tool heat.
- Hallucination teaching explicitly covers wrong-answer risk and the normal `100%` loss condition.
- The Coolant lesson forces high heat and disables passive heat recovery until success.
- The Reality Patch lesson forces hallucination pressure and requires the matching utility.
- The Signal Boost lesson forces connection pressure and requires the matching utility.
- Locked actions never mutate gameplay state and always return tutorial feedback.
- Onboarding never routes to Maintenance or true game over.
- Completing onboarding routes directly to Day 1 Briefing.