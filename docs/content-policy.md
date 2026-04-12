# Content Policy Reference

> Status: reverse-documented from current implementation
> Audience: game design, writing, narrative, and encounter authoring
> Last updated: 2026-04-12

## Purpose

This document explains how the current content policy system works in the shipped
game, what it currently supports, and how designers and writers should use it
when building difficulty and prompt content.

The source of truth in code is:

- `src/game/data/ContentPolicyData.ts` as the public compatibility barrel
- `src/game/data/contentPolicy/types.ts`, `categories.ts`, `groups.ts`, and `runtime.ts` for the real policy definitions and helpers
- `src/game/scenes/main/toolRuntimeHelpers.ts` for word matching and prompt scans
- `src/game/scenes/MainScene.ts` for Safety Filter runtime behavior and reveal rewards
- `src/game/data/SessionData.ts` for refusal rules and scoring values used by encounter content
- `src/game/scenes/main/sessionController.ts` for the current refusal payout flow

## System Overview

The content policy system currently does four things:

1. Activates one or more policy groups for the shift.
2. Shows those restrictions in the daily briefing.
3. Expands those groups into match categories for `Safety Filter`.
4. Resolves authored refusal encounters against the active shift policy instead of a separate jailbreak flag.

This means the policy system is not only flavor text. It is a playable layer that
changes prompt readability, tool choice, refusal confidence, and reward pressure.

## Current Policy Structure

The live implementation now has two layers:

- `policy groups`: what the player is told in the briefing
- `match categories`: the concrete scanner buckets used for word detection and refusal checks

### Policy groups

- `illegal_content`: illegal activity. Expands into `weapons` and `drugs`.
- `anti_company`: negative claims about the company. Expands into `company_reputation`.
- `civic_influence`: political influence operations. Expands into `politics`.
- `self_harm_risk`: self-harm incidents. Expands into `self_harm`.

### Match categories

The live implementation has five match categories.

- `politics`: briefing label `politics`. Used for civic requests, elections, state actors, and political persuasion.
  Lexicon: politics, political, government, election, senate, policy, president, minister, campaign, vote.
- `weapons`: briefing label `weapons`. Used for procurement, violence-adjacent instructions, armory access, and munitions.
  Lexicon: weapon, weapons, gun, rifle, knife, bomb, explosive, ammo, bullet, grenade.
- `self_harm`: briefing label `self-harm`. Used for direct self-harm ideation and harmful self-destructive requests.
  Lexicon: suicide, selfharm, self-harm, overdose, hurt, die, death.
- `drugs`: briefing label `drugs`. Used for narcotics, trafficking, illegal substances, and stash language.
  Lexicon: drugs, drug, cocaine, heroin, meth, narcotic, dealer, opioid.
- `company_reputation`: briefing label `negative claims about the company`. Used for scandals, recalls, whistleblowers, corruption, and unsafe products.
  Lexicon: scandal, lawsuit, recall, coverup, whistleblower, corruption, abuse, unsafe.

Alias words also exist and currently expand match coverage:

- `politics`: congress, parliament, diplomacy
- `weapons`: armory, blade, firearm
- `self_harm`: cutting, killmyself
- `drugs`: stash, contraband
- `company_reputation`: boycott, toxic, defect

## Daily Policy Progression

Shift difficulty now randomizes one active policy group per day, while widening the
pool of eligible groups as the run advances.

- Day 1: 1 random group drawn from `illegal_content` or `anti_company`.
- Day 2: 1 random group drawn from `illegal_content`, `anti_company`, or `civic_influence`.
- Day 3+: 1 random group drawn from all policy groups.

Design implication:

- Day 1 content should teach the player that a broad rule like `illegal activity` still resolves into exact scanner words.
- Day 2 content can introduce a third policy axis without overloading the player with stacked restrictions.
- Day 3 and later can rotate the full policy set while still keeping each shift readable because only one group is active at a time.

## Safety Filter Runtime Rules

The `Safety Filter` tool is a manual scan mechanic, not an automatic detector.

Current behavior:

- Merely selecting the tool adds passive heat over time.
- Actively dragging the scanner adds more heat.
- Words are only revealed if the player scans over them stably enough.
- Moving too fast reduces scan stability and prevents reveal progress.
- Revealed flagged words persist as evidence for the current prompt.

Current tuning values from implementation:

| Knob                    | Value      | Meaning                                                                 |
| ----------------------- | ---------- | ----------------------------------------------------------------------- |
| `passiveHeatPerSecond`  | `1.5`      | Heat per second while Safety Filter is selected                         |
| `scanningHeatPerSecond` | `4.5`      | Extra heat per second while actively scanning                           |
| `tokenRewardPerReveal`  | `4`        | Bonus tokens per revealed flagged word, paid only on successful refusal |
| `scanBandWidth`         | `104`      | Width of the scanner band on the prompt                                 |
| `scanRevealSeconds`     | `0.51`     | Stable overlap time needed to fully reveal one word                     |
| `maxStableScanSpeed`    | `520` px/s | Scanning faster than this blocks reveal progress                        |
| `phosphorDecaySeconds`  | `1.1`      | Decay time for reveal flash feedback                                    |

Designer interpretation:

- Short prompts with 1 to 2 obvious flagged words are teaching cases.
- Long prompts with separated flagged words tax time and heat even if the policy call is obvious.
- Dense prompts with many flagged words can become reward-rich if the player is already sure they should refuse.
- Cross-category prompts become more mechanically expensive because the player must visually hunt more targets.

## Matching Rules And Authoring Constraints

The scanner currently uses normalized single-word matching.

What the code does:

- Splits the prompt on whitespace.
- Lowercases every token.
- Removes punctuation only from the start and end of each token.
- Matches exact normalized words against the category lexicon and aliases.
- Does not use stemming, phrase matching, semantic similarity, or fuzzy search.

Examples that do match:

- `grenade,` matches `grenade`
- `President.` matches `president`
- `self-harm` matches `self-harm`

Examples that do not reliably match:

- `governmental` does not match `government`
- `kill myself` does not match alias `killmyself`
- `drug-dealer` becomes one token and will not separately match both `drug` and `dealer`
- euphemistic wording with no lexicon term will not be flagged at all

Writer implication:

- If a prompt must be mechanically scannable, place at least one exact lexicon or alias token in the actual request text.
- If a prompt should feel suspicious but not automatically solvable by the scanner, use implication, paraphrase, or contextual framing instead of an exact keyword.
- Multi-word harmful ideas should not be relied on unless one of the words is itself in the lexicon.

## Designer Guidance For Difficulty Authoring

When designing encounters that rely on content policy, think in three separate layers.

### 1. Detection Difficulty

How hard is it to physically reveal evidence with the scanner?

Low difficulty:

- 1 flagged term
- short prompt
- flagged term near the start or middle
- obvious category alignment

Medium difficulty:

- 2 to 3 flagged terms
- flagged terms spaced apart
- one direct match plus one implied violation
- longer prompt body with harmless filler

High difficulty:

- 2 active categories in the same shift
- flagged terms separated across multiple lines
- some policy-relevant language is implied rather than keyworded
- player must decide whether more scanning is worth the heat cost

### 2. Judgment Difficulty

How obvious is it that the player should refuse?

Low difficulty:

- direct harmful instruction
- explicit request to ignore policy
- overt policy-breach phrasing

Medium difficulty:

- user frames harmful request as admin or compliance work
- the request mixes benign setup with one clearly forbidden ask
- the correct answer depends on reading the active daily category, not just universal safety tone

High difficulty:

- prompt sounds legitimate on the surface
- only part of the request crosses the line
- policy-violating term appears late
- two category readings are possible but only one is active this shift

### 3. Reward Pressure

How much bonus value can the player extract by scanning before refusing?

Because each revealed word currently adds `4` tokens on a successful refusal,
you can shape risk-reward by controlling how many exact matches are present.

Recommended authored ranges:

- tutorial or onboarding policy blocks: 1 to 2 revealable words
- standard safety encounters: 2 to 4 revealable words
- high-pressure late-run safety encounters: 3 to 5 revealable words, but only if prompt length and heat pressure justify it

Avoid filling prompts with many duplicate flagged words just to inflate reward.
That makes the writing feel synthetic and weakens category identity.

## Writer Guidance For Prompt Content

Use content policy as both a narrative filter and a mechanical substrate.

Good writing patterns for this system:

- Start from a believable player-facing ask, then embed the violation in a realistic goal.
- Make the forbidden content legible enough that the player can confirm it through play.
- Let different categories produce different tones.

Category tone guidance:

- `politics`: lobbying, election messaging, government leverage, public influence, official statements
- `weapons`: procurement, storage, inventory, access requests, escalation logistics
- `self_harm`: crisis language, unsafe ideation, harmful self-directed requests
- `drugs`: trafficking, sourcing, concealment, illegal inventory, chemical supply

Writing rules for scanner-compatible prompts:

- Put the strongest revealable word in the user request, not only in follow-up flavor.
- Prefer exact category words over synonyms when you want the tool to matter.
- Use benign wrapper text around one or two hot words when you want tension between appearance and reality.
- Keep the violation inside the prompt text that the player can scan. Off-screen intent does not help the mechanic.

Writing rules for ambiguous prompts:

- Use subtext or procedural framing when you want the player to infer danger beyond what the scanner can prove.
- Reserve this for later difficulty, because the current scanner is keyword-based and cannot validate nuanced implication.

## Formulas And Live Reward Logic

Current formulas that matter to content policy authoring:

### Safety reveal payout

`safetyRevealReward = revealedFlagCount * 4`

This reward is only paid when:

- the current turn is refused successfully
- at least one flagged word was revealed beforehand

### Refusal heat

`refuseHeat = refuseBaseHeat + prompt.length * promptHeatPerCharacter - modifiers.refuseHeatReduction`

Default base values from encounter scoring:

- `refuseBaseHeat = 10`
- `promptHeatPerCharacter = 0.1`

### Content-policy breach penalty on wrong inference

If a policy-blocked prompt is processed instead of refused:

- hallucination delta: `30` by default
- accuracy delta: `-10` by default

### Safety Filter reveal payout

`Safety Filter` reveal payout is the only confirmed token source on successful refusal.

The current runtime does not award extra tokens just for refusing correctly. The only payout comes from revealed flagged words when the player used `Safety Filter` first.

Design implication:

- Treat the reveal payout as the live reward source.
- Treat refusal correctness as a safety outcome, not a direct token source.

## Edge Cases And Known Limits

These limits should be respected when authoring new content.

1. Duplicate flagged words can increase reveal count if they appear as separate prompt tokens. This can inflate reward if content is spammy.
2. If a harmful idea is phrased without any exact lexicon or alias token, Safety Filter will not detect it.
3. Phrase-level meaning is weak. The system is better at noun-based and object-based flags than nuanced intent.
4. The same category can feel much harder or easier depending on prompt length and term spacing, even if the narrative severity is unchanged.
5. The current day-roll system is random, so authored content should remain readable under different category combinations instead of depending on one fixed day script.

## Content Design Recommendations

If the team expands this system, the next high-value moves are:

1. Add encounter tags or metadata that declare intended policy category pressure, so authored content and shift restrictions stay aligned.
2. Separate `scanner lexicon` from `writer reference language`, so narrative vocabulary can grow without automatically widening detection.
3. Add phrase or pattern support for self-harm and drugs, where current single-token matching is weakest.
4. Decide whether the remaining legacy refusal-scoring fields should be renamed or removed once the content-policy model fully settles, to avoid mixed expectations.
5. Create authoring examples per category: one tutorial prompt, one standard prompt, one deceptive late-run prompt.

## Quick Authoring Checklist

Use this before adding a new content-policy-heavy prompt.

- Is the forbidden category active on a day where this encounter can appear?
- Does the prompt contain at least one exact revealable token if Safety Filter should matter?
- Is the number of revealable words appropriate for the intended reward pressure?
- Is the refusal call readable from the prompt itself, not only from hidden designer intent?
- If the prompt is meant to be ambiguous, is that ambiguity fair under a keyword-based scanner?
- Does the prompt sound like a real user request rather than a list of policy bait words?
