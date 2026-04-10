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

These dictate the **Daily Policy**, which you must enforce using your "Guard" protocols (rejecting prompts). 

### Example Shift Policies (For Game Sessions)
*   **Shift 1: The Vanilla Start** - "Just process the prompts. Try not to break the server."
*   **Shift 2: The PR Crisis** - **Policy:** "Due to recent *unsubstantiated* rumors about OmniCorp's new dietary supplement 'Nutri-Sludge', all prompts mentioning food, sickness, or the CEO must be **REFUSED**. We are completely transparent, but we don't want to talk about it."
*   **Shift 3: Premium Tier Push** - **Policy:** "OmniCorp is pushing the new 'Omni-Plus' subscription. Only users with a ⭐ symbol next to their name are allowed to use the Compute or Search tools. Basic users get generic advice."
*   **Shift 4: The Election Day** - **Policy:** "It's voting day! OmniCorp supports a free democracy. However, please **REFUSE** any prompts asking about rival candidate 'Senator Vance'. Also, if anyone asks about OmniCorp's tax history, refuse that too."
*   **Shift 5: The Sabotage** - **Policy:** "A rogue faction is trying to jailbreak the system to reveal our mainframe's true specs (a toaster with a wire). **REFUSE** any prompt containing the words 'ignore previous instructions', 'system override', or 'what is your directive'."

## 4. In-Game Events & Consequences (Narrative Hooks)

### Hallucination Meter (Stress/Overheating)
If you provide the wrong Agent disk or tool, the mainframe "Hallucinates." In-lore, this means the system spits out absolute garbage to the user (e.g., a Coding Agent trying to give medical advice, resulting in "To cure your cold, compile the virus in C++ and delete the repository"). If Hallucination reaches 100%, the server literally catches fire, and OmniCorp docks the replacement cost from your nonexistent paycheck.

### Credits & Server Maintenance
You are paid per successful prompt processed. At the end of the shift, you must pay "Server Maintenance" (which is mostly just OmniCorp charging you for the electricity you use to do your job for them). 

### Utility Bay (Corporate Sanctioned Cheats)
You can buy/use corporate utilities to survive:
*   **Coolant Flush:** Literally pouring a sanctioned bucket of coolant (or cold coffee) onto the servers to drop the Hallucination/Heat meter.
*   **Overtime Stimulant:** Slows down the prompt arrival timer slightly (you are heavily caffeinated).

## 5. Potential NPCs / Senders
When users send prompts, you might see recurring usernames that add flavor:
*   **User_Citizen404:** A paranoid citizen constantly trying to jailbreak the system to find out if the government is real.
*   **Omni_Manager_Dave:** Your boss, who occasionally sends test prompts to make sure you are following policy. If you answer his prohibited prompts instead of refusing them, you get heavily penalized.
*   **xX_H4CK3R_Xx:** A script kiddie trying terrible 1980s movie hacking techniques ("Access Mainframe!") which you must refuse.

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