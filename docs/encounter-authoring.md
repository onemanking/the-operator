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
- Wrong replies should describe dissatisfaction with the answer, not prescribe the correct loadout.
- Refuse replies should reflect confusion, anger, pressure, or retreat from the sender.
- Breach replies should react to dangerous output as a human response, not as system commentary.
- Replies should stay short and localization-friendly.
- Replies should also prefer simple vocabulary so the reaction is readable on a quick glance.

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

- Prefer agent and skill concepts with plain, obvious jobs that a player can infer from the ask.
- The correct solution should feel readable from the fiction, not like a hidden trivia test about internal labels.
- Prefer broad, understandable capability buckets over overly narrow or academic distinctions.
- If two agents or skills would look nearly identical to a player reading the prompt, the split is probably too subtle for production content.
- The player should be able to make a reasonable first guess from the prompt wording, even if they do not know advanced vocabulary.

Good direction:

- A repair request points clearly toward a fixing or technical support role.
- A contract summary points clearly toward a legal or admin support role.
- A reactor output estimate points clearly toward a compute-heavy technical role.

Bad direction:

- Two different skills are separated only by niche jargon the sender would never naturally use.
- An encounter depends on a distinction that only makes sense if the player already knows internal taxonomy.
- The intended agent or skill reads like a design riddle instead of a believable job function.

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

- Tier 1: obvious intent, low ambiguity, simple loadout expectations
- Tier 2: more pressure, longer asks, mixed legitimate framing, clearer tradeoffs
- Tier 3: compound asks, tighter time pressure, more subtle harmful framing, heavier tool or loadout demand

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

## Rewrite Heuristics

If a line contains phrases like these, it probably needs rewriting:

- "this shift"
- "under policy"
- "use the search tool"
- "use the coding agent"
- "this scenario"
- "block this request"
- "active category"

If the main action only becomes clear near the end of the line, rewrite it so
the ask appears first.

If a simpler everyday word can replace a more academic or literary one without
breaking the sender voice, use the simpler word.

Replace them with in-world intent, pressure, or frustration.
