# Prompt, Please

A "Papers, Please" style simulation game about managing an LLM server, built with Phaser 3 and React.

## Concept
Set in a Cassette Futurism (Lo-Fi / Analog Cyberpunk) world, you play as a mainframe operator in the 1980s. You are not a super-intelligent AI, but a tired operator managing a massive, dusty server. Your job is to process incoming "Prompts" by assembling the correct context using physical floppy disks (`agent.md`, `skills.md`) and chunky plastic tool buttons.

## Gameplay Loop

The game is divided into daily cycles (Shifts):

### 1. System Briefing (Morning)
Read the "Policy of the Day" and shift modifier. These rules change daily and dictate how you must handle requests and what kind of pressure the server is under (e.g., "No weapons", "Strict Routing", "Thermal Surge"). When the briefing is assembled, the game also generates that shift's encounter list at runtime from tiered atomic turn data.

### 2. The Inference Window (Core Gameplay)
- **Request Arrival**: Prompts from users appear on your CRT terminal.
- **Context Assembly**: Drag and drop floppy disks from your Storage Rack into the Drive A: slot to load the correct Agent and Skills for the task.
- **Tool Selection**: Arm the needed Prompt Tools in the top-right control grid if the prompt requires real-time data, compute charge, or policy scanning. Tools can stay active together, and each active tool shows its own ready state on the button and panel.
- **Utility Management**: Trigger stocked active utilities from the lower-right utility bay when you need emergency recovery effects. The effect only applies after you clear that utility's minigame in the dedicated utility module.
- **Action**: 
  - Hit **INFERENCE** beneath the terminal to process the prompt. This generates heat based on the prompt, context, active tools, and shift modifiers.
  - Hit **REFUSE** beneath the terminal if the request breaks the active content policy.
- **Consequences**: Incorrect context, missed tool setup, timeouts, and bad policy calls increase your **Hallucination** meter and can lower Accuracy.

### 3. Server Maintenance (Evening)
Review your performance. You earn credits for successful inferences and correct policy refusals, then pay daily server maintenance costs. If you run out of credits or your Hallucination meter reaches 100%, the server melts down (Game Over).

## Art Direction
- **Cassette Futurism**: Faded beige/brown colors, chunky plastic bezels, amber monochrome text, and green phosphor CRT screens with scanlines.
- **Tactile UI**: Dragging floppy disks, pressing physical-looking buttons.
- **Audio**: Synthesized retro bleeps, typewriter sounds, and disk insertion noises using the Web Audio API.

## Technologies Used
- **React**: Application wrapper and UI container.
- **Phaser 3**: Core game engine for rendering, physics (drag & drop), and game loop.
- **Tailwind CSS**: Styling the React wrapper.
- **Vite**: Build tool and development server.
- **Web Audio API**: Custom `SoundSynth` class for procedural retro sound effects.

## Code Architecture
- **React Shell**: `App.tsx` and `src/components/GameViewport.tsx` only mount and destroy the Phaser game.
- **Scene Flow**: `BootScene -> BriefingScene -> MainScene -> MaintenanceScene`.
- **MainScene Composition**: `src/game/scenes/MainScene.ts` is an orchestration layer that wires focused modules under `src/game/scenes/main/`.
- **Runtime State**: `MainScene.ts` currently owns shift/session/context state and passes focused bindings into scene modules.
- **Controllers**:
  - `hudController.ts` renders terminal/HUD elements from state.
  - `storageController.ts` owns disk drives, storage rack, and tool-selection interactions.
  - `sessionController.ts` owns session flow, response handling, and progression.
- **Encounter Runtime Contracts**: `src/game/data/SessionData.ts` now only defines the shared encounter types, scoring shape, and default reply pools used by the runtime.
- **Procedural Shift Content**: `content/encounters/tier*.json` stores atomic turn data by difficulty tier, and `src/game/data/shift-generation/runtime.ts` assembles those turns into a fresh shift encounter list at runtime.
- **Deterministic Tool Tests**: `src/game/data/TestEncounterData.ts` stores the fixed encounters used by the guard, compute, search, and utility smoke scripts.
- **Systems Map**: [docs/current-systems.md](docs/current-systems.md) is the canonical map of the current gameplay, UI, data, and scene systems.
- **Tool Mechanics Reference**: [docs/tool-mechanics.md](docs/tool-mechanics.md) captures the current Search/Compute/Safety behavior and the shared rules to follow when adding future tools.
- **Content Policy Reference**: [docs/content-policy.md](docs/content-policy.md) explains the live forbidden-category system, Safety Filter behavior, and writing/balance guidance for policy-driven prompts.

## Development Verification
- Run `npm run lint` after code changes and `npm run build` after structural or bundling changes.
- When HUD/UI is added or updated, also run the game in a browser and verify the actual Phaser canvas output.
- Browser UI smoke check should confirm the updated HUD/UI is visible, aligned, not clipped or overlapping unexpectedly, and that the main related interaction still works.
- For scene-specific UI, verify the scene state that exposes the changed HUD before considering the work complete.

## Tool Test Scripts
- Run `npm run dev:test:guard` to boot directly into a content-policy guard scenario on port 3000.
- Run `npm run dev:test:compute` to boot directly into a compute-focused scenario on port 3000.
- Run `npm run dev:test:search` to boot directly into a search-focused scenario on port 3000.
- Run `npm run dev:test:utility` to boot directly into a utility-suite scenario on port 3000.
- Each script skips the briefing scene and opens straight into `MainScene` with the correct encounter queued, `General_Agent.md` already mounted, and the matching prompt tool pre-selected when that scenario uses one.
- Test scenarios are only available through these scripts and their Vite mode environment variables; opening the game with a URL query no longer changes the scenario.

## How to Play
1. Read the daily briefing.
2. When a prompt appears, read it carefully.
3. Drag the appropriate Agent disk (e.g., `Coding_Agent.md` for programming) to the Context Assembly zone.
4. Drag relevant Skill disks if needed.
5. Arm the required Prompt Tools if the prompt asks for current info, compute charge, or policy scanning.
6. Use the lower-right utility bay only when you need a stocked emergency utility.
7. Click **INFERENCE** to process.
8. If the prompt breaks the active content policy, click **REFUSE**.
9. Survive as many days as possible!
