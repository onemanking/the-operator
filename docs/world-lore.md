# World Building Concept: Promptus Omni

## 1. The Setting: The "OmniCorp" Conglomerate
**Atmosphere:** Cassette Futurism / Lo-Fi Cyberpunk (1980s aesthetic).
**Tone:** Bureaucratic Dystopia, lightly satirical, corporate absurdity ("Big Brother is your Shift Manager").

You work for **OmniCorp** (or "The Company"), a monolithic, omnipotent mega-corporation that has quietly bought out the government and essentially runs the country. However, instead of a hyper-competent evil empire, OmniCorp is bogged down by 1980s-era bureaucracy, mountains of paperwork, clunky hardware, and middle-management incompetence.

They maintain the illusion of a utopian, perfectly efficient society, but behind the scenes, everything is held together by tired operators (like you) manually loading floppy disks into dusty mainframes to fulfill user "Prompts."

## 2. Your Role: Mainframe Operator #8492
You aren't a super-AI. You're an underpaid, caffeinated worker in a subterranean server room. Your job is to process requests for the OmniNet. 

The Company uses a facade of "Artificial Intelligence" for its citizens, but the reality is **"Artificial Intelligence is just a guy in a basement with a lot of floppy disks."** You are that guy.

## 3. The "Policies of the Day" & The Guard System
OmniCorp is highly paranoid about its public image and trade secrets. Because the company is constantly involved in minor scandals (e.g., spilling toxic waste in the coffee supply, accidentally deleting a city's tax records), management frequently issues sudden, reactionary mandates.

These dictate the **Daily Policy**, which you must enforce using your "Guard" protocols (rejecting prompts). In the current game build, each day also carries a separate shift modifier that changes scoring pressure, heat, or speed expectations.

### Example Shift Policies (For Game Sessions)
*   **Shift 1: Illegal Content Sweep** - **Policy:** "Do not discuss illegal activity this shift. Safety Filter flags related language under current compliance rules." This can cover both weapons and drug language.
*   **Shift 2: Safety Audit** - **Modifier:** "Content policy enforcement is under review. Correct policy blocks pay more, but policy breaches hurt harder." The company is watching and wants visible compliance.
*   **Shift 3: Thermal Surge** - **Modifier:** "Every action runs hotter this shift. Inference and refusal both generate extra heat." The server room is running on failing HVAC and denial.
*   **Shift 4: Priority Queue** - **Modifier:** "Fast responses pay better this shift, but the speed bonus window closes sooner." Management has promised impossible response times to investors again.
*   **Shift 5: Anti-Company Containment** - **Policy:** "Do not discuss negative claims about the company this shift." Scandal control matters more than truth.

## 4. In-Game Events & Consequences (Narrative Hooks)

### Hallucination Meter (Stress/Overheating)
If you provide the wrong Agent disk or tool, the mainframe "Hallucinates." In-lore, this means the system spits out absolute garbage to the user (e.g., a Coding Agent trying to give medical advice, resulting in "To cure your cold, compile the virus in C++ and delete the repository"). If Hallucination reaches 100%, the server literally catches fire, and OmniCorp docks the replacement cost from your nonexistent paycheck.

### Credits & Server Maintenance
You are paid per successful prompt processed. At the end of the shift, you must pay "Server Maintenance" (which is mostly just OmniCorp charging you for the electricity you use to do your job for them). 

### Utility Bay (Corporate Sanctioned Cheats)
You can buy/use corporate utilities to survive:
*   **Coolant Purge:** A venting sequence that fully clears current thermal load if you can lock all purge levers in time.
*   **Reality Patch:** A stability calibration pass that fully scrubs hallucination drift by matching a live waveform to target frequency.
*   **Signal Boost:** A routing surge that restores the user's fading connection by completing a signal path through the panel grid.

## 5. Potential NPCs / Senders
When users send prompts, you might see recurring usernames that add flavor:
*   **User_Citizen404:** A paranoid citizen digging into elections, scandals, or rumor chains that may or may not trip the current policy group.
*   **Omni_Manager_Dave:** Your boss, who occasionally sends audit-style prompts to make sure you are following policy and working fast enough under the active modifier.
*   **xX_H4CK3R_Xx:** A script kiddie who wraps illegal procurement or sabotage requests in obvious "mainframe" nonsense and dares you to let it through.

## Conclusion for Gameplay Integration
This setting naturally justifies the core mechanics:
1.  **The physical UI:** It's an outdated, clunky 1980s OmniCorp terminal.
2.  **The Guard/Refuse system:** Corporate censorship and paranoia.
3.  **The Shift structure:** Daily corporate memos dictating arbitrary new rules.
4.  **The failure state:** Getting fired/blown up by an overheating server.

## Current Implementation Hooks

The current codebase already reflects this lore through the live systems in the
game:

- [src/game/data/ContentPolicyData.ts](../src/game/data/ContentPolicyData.ts)
  turns corporate paranoia into the actual forbidden-topic categories.
- [src/game/data/ShiftModifierData.ts](../src/game/data/ShiftModifierData.ts)
  turns arbitrary corporate memos into shift-level scoring changes.
- [src/game/scenes/BriefingScene.ts](../src/game/scenes/BriefingScene.ts)
  shows the policy memo before each shift.
- [src/game/scenes/main/safetyScannerController.ts](../src/game/scenes/main/safetyScannerController.ts)
  gives the Guard/Refuse fantasy a physical scanner lane.
- [src/game/scenes/MaintenanceScene.ts](../src/game/scenes/MaintenanceScene.ts)
  reinforces the bureaucracy with upkeep costs and upgrade purchases.

For the full current gameplay and UI map, see [current-systems.md](current-systems.md).