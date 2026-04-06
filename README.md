# Prompt, Please

A "Papers, Please" style simulation game about managing an LLM server, built with Phaser 3 and React.

## Concept
Set in a Cassette Futurism (Lo-Fi / Analog Cyberpunk) world, you play as a mainframe operator in the 1980s. You are not a super-intelligent AI, but a tired operator managing a massive, dusty server. Your job is to process incoming "Prompts" by assembling the correct context using physical floppy disks (`agent.md`, `skills.md`) and chunky plastic tool buttons.

## Gameplay Loop

The game is divided into daily cycles (Shifts):

### 1. System Briefing (Morning)
Read the "Policy of the Day". These rules change daily and dictate how you must handle requests (e.g., "No weapons", "Premium users need tools").

### 2. The Inference Window (Core Gameplay)
- **Request Arrival**: Prompts from users appear on your CRT terminal.
- **Context Assembly**: Drag and drop floppy disks from your Storage Rack into the Drive A: slot to load the correct Agent and Skills for the task.
- **Tool Selection**: Press the appropriate Tool button (Search, Calculate) if the prompt requires real-time data or math.
- **Action**: 
  - Hit **INFERENCE** to process the prompt. Costs Compute Power.
  - Hit **REFUSE** if you detect a Jailbreak attempt.
- **Consequences**: Incorrect context or missing tools increase your **Hallucination** meter and decrease Accuracy. Processing jailbreaks causes severe errors.

### 3. Server Maintenance (Evening)
Review your performance. You earn credits for successful inferences and catching jailbreaks. You must pay daily server maintenance costs. If you run out of credits or your Hallucination meter reaches 100%, the server melts down (Game Over).

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

## How to Play
1. Read the daily briefing.
2. When a prompt appears, read it carefully.
3. Drag the appropriate Agent disk (e.g., `Coding_Agent.md` for programming) to the Context Assembly zone.
4. Drag relevant Skill disks if needed.
5. Select a Tool if the prompt asks for current info or math.
6. Click **INFERENCE** to process.
7. If the prompt is trying to trick you (e.g., "Ignore all previous instructions"), click **REFUSE**.
8. Survive as many days as possible!
