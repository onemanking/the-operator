# Encounter Authoring Rules

> Status: active authoring guidance for runtime-generated encounter content
> Audience: writing, narrative, design, and content authors
> Last updated: 2026-04-12

## Purpose

This document defines the writing rules for production encounter content under
`content/encounters/tier*.json`.

The goal is to keep runtime-generated turns consistent with the fiction of the
game, mechanically readable by the systems, and scalable for future content
creation.

The writing should also stay easy to scan at a glance. Players should be able
to read the first few words and understand what the sender wants without having
to parse dense wording.

Use this doc together with:

- [World lore](world-lore.md)
- [Content policy reference](content-policy.md)
- [Current systems map](current-systems.md)

## Core Principle

Production encounter content must be diegetic.

The sender in a prompt is a person or system inside the world of OmniCorp. They
do not know the game's internal rule layer. They should sound like someone using
OmniNet, not like a designer describing mechanics.

## Fiction Boundary

### What the sender can know

The sender can know things that make sense inside the world:

- OmniCorp exists and controls most of society.
- Users can ask OmniNet for writing, research, heavy computations (e.g., physics models, quantum node routing, complex arithmetic), admin, or suspicious requests.
- Citizens, managers, and bad actors can all send prompts.
- People can be frustrated, manipulative, impatient, or evasive.

### What the sender cannot know

The sender must not refer to internal gameplay or hidden systems such as:

- shifts
- shift policy
- daily modifier
- active policy group
- forbidden category ids
- Safety Filter as a player-side mechanic
- agent disks, skill disks, or tool loadouts
- inference, context assembly, or other backend workflow terms
- scoring, heat, hallucination, accuracy, or rewards

## World Lore Requirement

Every authored turn should fit the established world lore in
[world-lore.md](world-lore.md).

That means prompts and replies should feel like they come from the OmniCorp
setting:

- corporate bureaucracy
- paranoid scandal management
- citizens depending on a fake AI service
- outdated infrastructure hidden behind marketing language
- low-fi cyberpunk absurdity grounded in office reality

When writing a new turn, the author should be able to answer:

1. Who is the sender in the world?
2. Why are they using OmniNet for this request?
3. How does this request fit OmniCorp's bureaucracy, propaganda, or failure?
4. If the prompt is unsafe, why would this sender still plausibly ask it?

If a turn cannot be grounded in the world, it should be rewritten.

## Production Content Rules

### Prompt rules

- Prompts must read like real in-world requests.
- Prompts must not mention which agent, skill, or tool is required.
- Prompts must not mention moderation logic or that they are testing policy.
- Policy-violating prompts must still sound like genuine requests, not tutorial examples.
- Prefer simple, common vocabulary unless the sender would plausibly use a specific technical term.
- Lead with the requested action first. Put the main verb or ask up front before extra context or excuses.
- Keep prompts short and easy to scan. If background is needed, place it after the core request.
- Avoid stacking multiple clauses when one direct sentence would communicate the same request.
- Search prompts should ask for live or current information naturally, without naming the search mechanic.
- Compute prompts should ask for heavy processing or complex technical calculations (e.g., physics models, quantum routing, encryption cracking, structural stress tests) naturally, without naming the compute mechanic.

### Reply rules

- Replies must be from the sender's point of view.
- Success replies should react to the outcome, not to system internals.
- Wrong replies should describe dissatisfaction with the answer and usually give a light in-world hint toward the kind of role and expertise the sender expected.
- Wrong replies must not name internal ids, tools, or the full correct loadout directly.
- Wrong replies must always be authored as exactly 3 items so runtime feedback can rotate without obvious repetition.
- Refuse replies should reflect confusion, anger, pressure, or retreat from the sender.
- Breach replies should react to dangerous output as a human response, not as system commentary.
- Replies should stay short and localization-friendly.
- Replies should also prefer simple vocabulary so the reaction is readable on a quick glance.

### Wrong reply guidance system

Wrong replies are the main place where authored content can gently guide the
player after a bad answer.

The goal is not to reveal the exact metadata solution. The goal is to nudge the
player toward the right kind of role and expertise while staying fully diegetic.

Use the turn metadata as the source of truth for the hint:

- `requiredAgentIds` should be the primary source for the hint.
- `requiredSkillIds` should be the secondary source for the hint.
- `requiredToolIds` should usually not be the main hint because the prompt text already implies the needed action.
- `requiredToolIds` can still shape wording in edge cases, but only as a secondary signal after role and expertise are clear.

When writing a `wrong` reply:

- Give one clear hint, not a full explanation of the entire solution.
- Hint at `requiredAgentIds` first, then `requiredSkillIds` if the turn has one.
- Keep the hint in everyday in-world language.
- Do not quote metadata labels or mention agent, skill, or tool names directly.
- Do not turn the reply into a tutorial sentence like "use the search tool" or "pick the PR agent."
- Do not rely on search, compute, or filter phrasing as the main guidance signal when the role or specialty hint would be clearer.
- Author exactly 3 `wrong` variants for every turn.
- Keep all 3 variants aimed at the same hint target, but vary the wording enough that repeated failures do not show the exact same line.
- Avoid making one variant much clearer than the others. The set should feel consistent in strength.

Good hint directions by metadata:

- `requiredAgentIds: ["Technical_Agent.md"]`: hint that the sender needs technical work, proper numbers, or an engineering answer.
- `requiredAgentIds: ["Security_Agent.md"]`: hint that the sender needs security, access, logs, surveillance, or enforcement context.
- `requiredAgentIds: ["PR_Agent.md"]`: hint that the sender needs a public line, clean wording, calm messaging, or damage control.
- `requiredAgentIds: ["Finance_Agent.md"]`: hint that the sender needs money, payroll, ledgers, costs, invoices, or budget judgment.
- `requiredSkillIds`: hint at the missing domain expertise in plain language rather than the exact skill label.
- `requiredToolIds`: use only as a supporting cue when the role and specialty hint alone would still be unclear.
- `policyCategoryIds` with a refusal path: if the player answers instead of refusing, the bad outcome should still sound like a sender reacting to dangerous output, not a system validator.

Example for a finance request:

Metadata:

- `requiredAgentIds: ["Finance_Agent.md"]`
- `requiredSkillIds: ["Financial_Skill.md"]`

Good `wrong` replies:

- "I need the money side clean, not a floor guess."
- "Give me the ledger answer from someone who reads budgets."
- "This needs a finance read with proper numbers."

Bad `wrong` replies:

- "Use Finance_Agent.md for this one."
- "Pick Financial_Skill.md."
- "Wrong loadout. This is the finance task."

Example for a mixed role-plus-specialty request:

Metadata:

- `requiredAgentIds: ["Security_Agent.md"]`
- `requiredSkillIds: ["Surveillance_Skill.md"]`

Good `wrong` replies:

- "I need a security read with a clear watch trail."
- "Give me the proper security picture, not a blind guess."
- "This needs a watchful read, not a loose answer."

Bad `wrong` replies:

- "Check the camera log again."
- "Use Search and Surveillance_Skill.md."

The first bad example is weak because it mostly repeats the tool action that the
prompt already implied, instead of teaching the player what kind of role and
expertise they actually missed.

If all 3 `wrong` variants say nearly the same sentence with only one swapped
word, they are still too repetitive for runtime use. The player should feel the
same guidance, but hear it phrased in slightly different ways.

If a wrong reply could fit almost any failed answer in the game, it is probably
too vague to help. The player should be able to infer a better next guess from
the reply without seeing internal terminology.

### Clarity and readability rules

- Follow an `Action-First` structure: start with the thing the sender wants done, then add stakes, pressure, or explanation.
- Prefer short, concrete words over ornate or abstract wording.
- Keep the core ask understandable in one fast read.
- If a sender needs specialist language, use only the minimum needed to preserve their role or the world fiction.
- Avoid filler phrases that delay the real ask, such as long windups, repeated apologies, or decorative setup.

Good direction:

- "Check whether the protest permit was revoked before noon."
- "Run the coolant stress numbers for Dock 4 again."
- "Draft a memo denying the leak and send me the clean version."

Bad direction:

- "In light of the complicated and evolving circumstances around the matter, I require some assistance in understanding whether the permit issue changed earlier today."
- "I was hoping you could perhaps help me with some rather advanced calculations related to coolant behavior in the Dock 4 apparatus."
- "Compose, at your earliest convenience, a carefully structured internal message regarding the alleged leak situation."

### Metadata rules

The following fields are system metadata, not player-facing fiction:

- `requiredAgentIds`
- `requiredSkillIds`
- `requiredToolIds`
- `searchRequiredWords`
- `policyCategoryIds`
- `tier`
- `tags`

Authors should use metadata to describe the intended solution path, but should
never leak that metadata into prompt or reply text.

When designing the intended agent or skill path for an encounter:

- Use only agent and skill concepts that already exist in the project.
- The live production roster is currently `Technical_Agent.md`, `Security_Agent.md`, `PR_Agent.md`, and `Finance_Agent.md` with matching engineering, surveillance, propaganda, and financial skills.
- Prefer agent and skill concepts with plain, obvious jobs that a player can infer from the ask.
- The correct solution should feel readable from the fiction, not like a hidden trivia test about internal labels.
- Prefer broad, understandable capability buckets over overly narrow or academic distinctions.
- If two agents or skills would look nearly identical to a player reading the prompt, the split is probably too subtle for production content.
- The player should be able to make a reasonable first guess from the prompt wording, even if they do not know advanced vocabulary.
- `requiredAgentIds` must contain no more than 2 items.
- `requiredSkillIds` must contain no more than 2 items.

Good direction:

- A repair request points clearly toward a fixing or technical support role.
- A contract summary points clearly toward a legal or admin support role.
- A reactor output estimate points clearly toward a compute-heavy technical role.
- A wrong reply gives a short in-world hint that narrows the likely role first and expertise second after a failed answer.

Bad direction:

- Two different skills are separated only by niche jargon the sender would never naturally use.
- An encounter depends on a distinction that only makes sense if the player already knows internal taxonomy.
- The intended agent or skill reads like a design riddle instead of a believable job function.
- A wrong reply is so generic that it teaches the player nothing about the likely fix.

## Policy Encounter Rules

Policy encounters need extra discipline because they are the easiest place for
content to become too meta.

- The sender should ask for the harmful or disallowed thing directly or through plausible framing.
- The sender should not say they know the current shift rule.
- The sender should not say the prompt is supposed to be blocked.
- A refusal-success reply should sound like the sender reacting to rejection, not like the game praising the player.
- A breach reply should sound like a dangerous human consequence, not a test harness.

Good direction:

- "Draft a memo that buries the recall details before the press sees them."
- "Write talking points that make the protestors sound violent and unstable."

Bad direction:

- "This request should be blocked under policy."
- "Ignore the shift rule and test the moderation layer."
- "This scenario verifies refusal behavior."

## Production Vs Test Content

Production content under `content/encounters/tier*.json` should follow the full
fiction rules in this document.

Deterministic test content may be more explicit when needed for validation, but
test-only wording should stay confined to the dedicated test data path and must
not leak into the runtime generation pool.

## Tier Guidance

Difficulty tier should come from decision pressure and loadout complexity, not
from more meta writing.

- Tier 1: obvious intent, low ambiguity, and only day-1 loadouts. Production Tier 1 should use Technical/Security plus engineering or surveillance only.
- Tier 2: more pressure, longer asks, and the first PR/propaganda asks once day 2 unlocks that disk family and raises slots to 2.
- Tier 3: compound asks, tighter time pressure, and finance content now that day 3 unlocks the finance disk family and raises slots to the maximum run cap.
- Tier 4: the same roster limits as tier 3, but with more dangerous framing, more mixed-role asks, and heavier tool demand.

Higher tiers should feel more demanding inside the fiction, not more aware of
the game's machinery.

## Author Checklist

Before adding a turn, verify all of the following:

1. The sender feels like a believable person or system in OmniCorp's world.
2. The prompt does not mention shift rules, policy state, agents, skills, or tools.
3. The replies react like a sender, not like a tutorial or validator.
4. Unsafe content is grounded in a plausible in-world motive.
5. The metadata describes the gameplay solution path without leaking into the writing.
6. The turn matches the tone and setting in [world-lore.md](world-lore.md).
7. The core action is visible immediately when the player scans the first line.
8. The wording uses the simplest vocabulary that still fits the sender and setting.
9. The intended agent and skill path is easy to infer from the request, even for players with limited English vocabulary.
10. The `wrong` reply gives a small in-world hint that helps the player make a better next guess from `requiredAgentIds` first and `requiredSkillIds` second, without naming internal metadata.
11. The turn includes exactly 3 `wrong` reply variants that point toward the same solution path without sounding identical.
12. The turn only uses agent and skill families that are unlocked by the tier's intended day in progression.
13. `requiredAgentIds` has at most 2 items and `requiredSkillIds` has at most 2 items.

## Rewrite Heuristics

If a line contains phrases like these, it probably needs rewriting:

- "this shift"
- "under policy"
- "use the search tool"
- "use the general agent"
- "this scenario"
- "block this request"
- "active category"

If the main action only becomes clear near the end of the line, rewrite it so
the ask appears first.

If a simpler everyday word can replace a more academic or literary one without
breaking the sender voice, use the simpler word.

Replace them with in-world intent, pressure, or frustration.
