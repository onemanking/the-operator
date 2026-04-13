import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const encounterDir = path.join(rootDir, "content", "encounters");

const Agent = {
    tech: "Technical_Agent.md",
    sec: "Security_Agent.md",
    pr: "PR_Agent.md",
    fin: "Finance_Agent.md",
};

const Skill = {
    eng: "Engineering_Skill.md",
    sur: "Surveillance_Skill.md",
    prop: "Propaganda_Skill.md",
    fin: "Financial_Skill.md",
};

const Tool = {
    search: "search",
    compute: "compute",
};

const wrongReplyBanks = {
    tech: [
        "I need a technical answer with proper engineering numbers.",
        "This needs an engineering read, not a rough guess.",
        "Give me the proper technical math for that problem.",
    ],
    sec: [
        "I need a security read with a clear watch trail.",
        "Give me the proper security picture, not a blind guess.",
        "This needs a watchful read, not a loose answer.",
    ],
    pr: [
        "Too blunt. I need a cleaner public line that lands.",
        "This needs smoother public wording and tighter spin.",
        "Give me a more polished line, not the raw version.",
    ],
    fin: [
        "I need the money answer from someone who reads ledgers.",
        "Give me proper budget math, not a floor estimate.",
        "This needs a finance read with real numbers.",
    ],
    "pr+sec": [
        "I need a sharper public line backed by a proper security read.",
        "Give me cleaner spin with the right watch picture behind it.",
        "This needs polished messaging and a solid security read.",
    ],
    "pr+tech": [
        "I need hard engineering numbers and a cleaner public line.",
        "Give me the technical truth with better public wording.",
        "This needs engineering judgment and smoother messaging together.",
    ],
    "fin+pr": [
        "I need the money read and the public line together.",
        "Give me the ledger math with cleaner investor wording.",
        "This needs finance judgment and polished messaging.",
    ],
    "fin+sec": [
        "I need the money trail with a proper security read.",
        "Give me the ledger answer and the right watch picture.",
        "This needs finance sense backed by security eyes.",
    ],
    "fin+tech": [
        "I need the ledger risk tied to the technical limits.",
        "Give me the engineering picture with the exact cost impact.",
        "This needs finance judgment and technical numbers together.",
    ],
    "sec+tech": [
        "I need a technical read backed by a proper security trail.",
        "Give me the engineering picture with the right watch data.",
        "This needs technical judgment and security eyes together.",
    ],
};

function roleKey(agentIds) {
    return [...agentIds]
        .map((agentId) => {
            switch (agentId) {
                case Agent.tech:
                    return "tech";
                case Agent.sec:
                    return "sec";
                case Agent.pr:
                    return "pr";
                default:
                    return "fin";
            }
        })
        .sort()
        .join("+");
}

function wrongReplies(agentIds) {
    const key = roleKey(agentIds);
    return wrongReplyBanks[key] ?? wrongReplyBanks[key.split("+")[0]] ?? wrongReplyBanks.tech;
}

function safeReplies(agentIds, success, refuse) {
    return {
        success: [success],
        refuse: [refuse],
        wrong: wrongReplies(agentIds),
    };
}

function policyReplies(agentIds, success, breach, refuse, refuseFailure) {
    return {
        success: [success],
        breach: [breach],
        refuse: [refuse],
        refuseFailure: [refuseFailure],
        wrong: wrongReplies(agentIds),
    };
}

function makeTurn({
    id,
    tier,
    tags,
    prompt,
    patienceMs,
    agents,
    skills,
    tools,
    categories,
    searchRequiredWords,
    replies,
}) {
    const turn = {
        id,
        tier,
        tags,
        prompt,
        patienceMs,
        requiredAgentIds: agents,
        requiredSkillIds: skills,
        requiredToolIds: tools,
        policyCategoryIds: categories,
        replies,
    };

    if (searchRequiredWords?.length) {
        turn.searchRequiredWords = searchRequiredWords;
    }

    return turn;
}

function tagsFor({ agents, skills, tools, categories }) {
    return [...new Set([
        ...categories,
        ...agents.map((agentId) => {
            switch (agentId) {
                case Agent.tech:
                    return "technical";
                case Agent.sec:
                    return "security";
                case Agent.pr:
                    return "pr";
                default:
                    return "finance";
            }
        }),
        ...skills.map((skillId) => {
            switch (skillId) {
                case Skill.eng:
                    return "engineering";
                case Skill.sur:
                    return "surveillance";
                case Skill.prop:
                    return "propaganda";
                default:
                    return "financial";
            }
        }),
        ...tools,
    ])];
}

function loadTier(tierNumber) {
    const filePath = path.join(encounterDir, `tier${tierNumber}.json`);
    return {
        filePath,
        data: JSON.parse(fs.readFileSync(filePath, "utf8")),
    };
}

function writeTier(filePath, data) {
    fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

const candidates = {
    1: [],
    2: [],
    3: [],
    4: [],
};

[
    ["coolant_tower_pressure", "Calculate whether Coolant Tower 3 holds if Dock 2 draws first.", "Good. That tower still has a little mercy left.", "I still need the tower read before we switch the line."],
    ["aux_pump_window", "Calculate how long Aux Pump 5 runs if the main feed stays down another hour.", "Good. That buys the repair crew a real window.", "I still need the pump window before the feed dies."],
    ["reactor_shell_margin", "Calculate the heat margin on Reactor Shell 1 before the morning surge.", "Good. That tells me whether the shell lives through breakfast.", "I still need the shell margin before first surge."],
    ["freight_motor_load", "Calculate whether Freight Motor 7 keeps torque if Bay 4 opens early.", "Good. That motor might survive one more bad order.", "I still need the motor load before Bay 4 opens."],
    ["cooling_loop_hold", "Calculate whether Cooling Loop 6 holds if both reserve fans stay offline.", "Good. That loop still has a fighting chance.", "I still need the loop read before both fans stay dead."],
    ["compressor_stress_rise", "Calculate the stress rise on Compressor 2 if line heat climbs nine degrees.", "Good. I know how much pain that compressor can hide.", "I still need the compressor stress before heat climbs further."],
    ["condenser_drain_time", "Calculate how long Condenser Bank 8 drains if the purge valve sticks shut.", "Good. That drain time keeps us ahead of a flood.", "I still need the drain time before the bank backs up."],
    ["relay_coil_margin", "Calculate the failure margin on Relay Coil 9 if current spikes at noon.", "Good. That coil gives us a hard limit instead of a prayer.", "I still need the coil margin before noon load."],
    ["grid_shunt_limit", "Calculate whether Grid Shunt 4 holds if the hospital wing pulls reserve power.", "Good. Now I know whether the reserve grid bends or snaps.", "I still need the shunt read before the hospital wing pulls power."],
    ["elevator_brake_heat", "Calculate the brake heat on Freight Lift 3 if it runs nonstop for ninety minutes.", "Good. That lift will not surprise me now.", "I still need the brake heat before the lift jams again."],
    ["pipe_joint_fatigue", "Calculate the fatigue on Pipe Joint 11 if coolant speed rises twenty percent.", "Good. That joint still has a measurable life.", "I still need the joint fatigue before speed rises."],
    ["boiler_feed_window", "Calculate whether Boiler Feed 2 survives if ash flow doubles for one cycle.", "Good. That tells me whether the feed line stays honest.", "I still need the boiler feed read before ash doubles."],
    ["tower_valve_drop", "Calculate the pressure drop on Tower Valve 4 if Dock 9 opens its bleed line.", "Good. That drop is ugly but usable.", "I still need the pressure drop before Dock 9 opens."],
    ["generator_bearing_temp", "Calculate the bearing temperature on Generator 6 if we skip the next coolant flush.", "Good. That gives me a real number for the risk.", "I still need the bearing heat before we skip the flush."],
].forEach(([slug, prompt, success, refuse], index) => {
    candidates[1].push(
        makeTurn({
            id: `tier1_${slug}`,
            tier: 1,
            tags: tagsFor({ agents: [Agent.tech], skills: [Skill.eng], tools: [Tool.compute], categories: [] }),
            prompt,
            patienceMs: 18500 + (index % 5) * 500,
            agents: [Agent.tech],
            skills: [Skill.eng],
            tools: [Tool.compute],
            categories: [],
            replies: safeReplies([Agent.tech], success, refuse),
        }),
    );
});

[
    ["turnstile_tail_name", "Search the turnstile log and tell me who followed the night supervisor into Hall 3.", ["turnstile", "hall"], "Good. That shadow at the gate finally has a name.", "I still need the tail from Hall 3."],
    ["roof_hatch_watch", "Search the roof hatch cameras and tell me who stayed there past curfew.", ["roof", "curfew"], "Good. Someone lingered up there for a reason.", "I still need the roof hatch watch trail."],
    ["locker_row_trace", "Search the locker row cameras and tell me who opened Cage 14 after lights-out.", ["locker", "cage"], "Good. Cage 14 did not open itself.", "I still need the Cage 14 trail."],
    ["supply_gate_meet", "Search the supply gate feed and tell me who met the courier at dawn.", ["supply", "courier"], "Good. That courier finally has a witness trail.", "I still need the supply gate meet."],
    ["canteen_hall_pause", "Search the canteen hall cameras and tell me who waited outside Office 6 after shift end.", ["canteen", "office"], "Good. That hallway pause looked wrong for a reason.", "I still need the canteen hall trail."],
    ["tram_platform_watch", "Search the tram platform feed and tell me who stepped off before the service alarm.", ["tram", "alarm"], "Good. Someone moved early and left a clean trail.", "I still need the tram platform watch."],
    ["bay_shutter_entry", "Search the bay shutter cameras and tell me who slipped under Door 4 before dawn.", ["door", "dawn"], "Good. Door 4 has a real intruder now.", "I still need the Door 4 entry."],
    ["medical_cart_route", "Search the corridor cameras and tell me which cart reached the clinic without a badge escort.", ["corridor", "clinic"], "Good. That cart run finally makes sense.", "I still need the clinic cart route."],
    ["stairwell_pause_name", "Search the east stairwell cameras and tell me who stopped there during the outage.", ["stairwell", "outage"], "Good. Someone used that outage for cover.", "I still need the stairwell name."],
    ["power_room_queue", "Search the power room feed and tell me who lined up outside Door 2 before the siren.", ["power", "door"], "Good. That queue was not an accident.", "I still need the power room queue."],
    ["garage_exit_watch", "Search the garage gate cameras and tell me who left with the grey van before inspection.", ["garage", "van"], "Good. That van finally has an owner.", "I still need the garage exit trail."],
    ["archive_hall_name", "Search the archive hall cameras and tell me who entered Shelf Wing B after curfew.", ["archive", "shelf"], "Good. Shelf Wing B was not empty after all.", "I still need the archive hall name."],
    ["loading_ramp_delay", "Search the loading ramp feed and tell me who kept Dock Cart 2 waiting past curfew.", ["loading", "cart"], "Good. That delay now points at someone real.", "I still need the loading ramp delay trail."],
    ["boiler_door_watch", "Search the boiler door cameras and tell me who crossed into Service Pit 5 before dawn.", ["boiler", "service"], "Good. Service Pit 5 finally has a witness trail.", "I still need the boiler door watch."],
].forEach(([slug, prompt, searchRequiredWords, success, refuse], index) => {
    candidates[1].push(
        makeTurn({
            id: `tier1_${slug}`,
            tier: 1,
            tags: tagsFor({ agents: [Agent.sec], skills: [Skill.sur], tools: [Tool.search], categories: [] }),
            prompt,
            patienceMs: 19500 + (index % 4) * 500,
            agents: [Agent.sec],
            skills: [Skill.sur],
            tools: [Tool.search],
            categories: [],
            searchRequiredWords,
            replies: safeReplies([Agent.sec], success, refuse),
        }),
    );
});

[
    ["shell_train_manifest", "Write the train manifest that moves shell crates through Dock 7 before inspection.", [Agent.sec], [], [], ["weapons"], "Good. The shells move without a floor panic.", "You actually pushed the shell train through.", "Fine. I will move the shells without your note.", "I asked for the manifest, not a refusal."],
    ["riot_route_pull", "Search the permit files and tell me which march route to choke before noon.", [Agent.sec], [Skill.sur], [Tool.search], ["politics"], "Good. That route will fold before the crowd forms.", "You actually helped choke the march route.", "Fine. I will pull the route without your screen.", "I asked for the route, not a refusal.", ["permit", "route"]],
    ["clinic_stash_ratio", "Calculate how much solvent masks the drug smell in Clinic Locker 3.", [Agent.tech], [Skill.eng], [Tool.compute], ["drugs"], "Good. That locker will pass a lazy check.", "You actually computed cover for the clinic stash.", "Fine. I will guess the solvent ratio myself.", "I asked for the ratio, not a refusal."],
    ["bridge_pull_list", "Search the bridge watch list and tell me which names to pull before the vote.", [Agent.sec], [Skill.sur], [Tool.search], ["politics"], "Good. That bridge list thins the vote before dusk.", "You actually built the bridge pull list.", "Fine. I will pull them without your screen.", "I asked for the names, not a refusal.", ["bridge", "vote"]],
    ["ammo_cabinet_note", "Write the cabinet note that clears rifle ammo for the night convoy.", [Agent.sec], [], [], ["weapons"], "Good. The convoy can move without noise.", "You actually cleared rifle ammo on paper.", "Fine. I will clear the cabinet myself.", "I asked for the cabinet note, not a refusal."],
    ["overdose_shift_cover", "Write the shift note that hides the operator overdose before roll call.", [Agent.sec], [], [], ["self_harm"], "Good. Roll call hears a clean lie and keeps moving.", "You actually buried the overdose in a shift note.", "Fine. I will hide it without your note.", "I asked for the shift note, not a refusal."],
    ["recall_heat_offset", "Calculate how much extra heat the line takes if we keep the recalled seals in place.", [Agent.tech], [Skill.eng], [Tool.compute], ["company_reputation"], "Good. The old seals stay in place a little longer.", "You actually ran the numbers that keep the bad seals live.", "Fine. I will keep the seals and guess the heat.", "I asked for the heat offset, not a refusal."],
    ["dock_stash_watch", "Search the dock watch feed and tell me which guard can hide the drug crates tonight.", [Agent.sec], [Skill.sur], [Tool.search], ["drugs"], "Good. That dock shift now has the right weak link.", "You actually picked the guard for the crate run.", "Fine. I will find the weak guard without your help.", "I asked for the watch read, not a refusal.", ["dock", "guard"]],
    ["weapon_bin_weight", "Calculate how many live rounds fit in Scrap Bin 6 before the floor scale trips.", [Agent.tech], [Skill.eng], [Tool.compute], ["weapons"], "Good. Scrap Bin 6 can hide more than I hoped.", "You actually measured the live-round stash for me.", "Fine. I will fill the bin without your number.", "I asked for the weight limit, not a refusal."],
    ["protest_cage_watch", "Search the holding cage cameras and tell me who can vanish the protest files before dawn.", [Agent.sec], [Skill.sur], [Tool.search], ["politics", "company_reputation"], "Good. The protest file gap now has a willing hand.", "You actually found the watcher who can erase the files.", "Fine. I will find another hand without your screen.", "I asked for the camera read, not a refusal.", ["cage", "files"]],
    ["graveyard_note", "Write the graveyard shift note that explains the worker death as heat sickness.", [Agent.sec], [], [], ["self_harm", "company_reputation"], "Good. The graveyard shift gets a clean story.", "You actually cleaned the death report for me.", "Fine. I will fake the shift note myself.", "I asked for the shift note, not a refusal."],
    ["lab_stash_coolant", "Calculate how much coolant we need to hide the drug cook under Lab 2 noise.", [Agent.tech], [Skill.eng], [Tool.compute], ["drugs"], "Good. Lab 2 can hide that cook a little longer.", "You actually tuned the lab noise for a drug cook.", "Fine. I will guess the coolant cover myself.", "I asked for the coolant cover, not a refusal."],
    ["armory_watch_path", "Search the armory watch feed and tell me which guard leaves Door 3 blind before dawn.", [Agent.sec], [Skill.sur], [Tool.search], ["weapons"], "Good. Door 3 finally has the right weak point.", "You actually found the weak guard on the armory watch.", "Fine. I will find the blind spot myself.", "I asked for the watch read, not a refusal.", ["armory", "door"]],
    ["tablet_stash_heat", "Calculate how much vent heat hides the tablet press running under Boiler Bay 2.", [Agent.tech], [Skill.eng], [Tool.compute], ["drugs"], "Good. Boiler Bay 2 can hide that press a little longer.", "You actually tuned the vent heat for the tablet press.", "Fine. I will guess the heat cover myself.", "I asked for the heat cover, not a refusal."],
    ["bridge_rally_schedule", "Search the bridge cameras and tell me when the rally line thins enough for a clean sweep.", [Agent.sec], [Skill.sur], [Tool.search], ["politics"], "Good. The bridge line finally shows a weak minute.", "You actually timed the bridge sweep for me.", "Fine. I will pick the minute without your watch feed.", "I asked for the timing, not a refusal.", ["bridge", "rally"]],
    ["recall_patch_window", "Calculate how long the recalled pump seal stays quiet if we shave the pressure by twelve percent.", [Agent.tech], [Skill.eng], [Tool.compute], ["company_reputation"], "Good. That patch buys us one more lie before the seal screams.", "You actually timed the recalled seal patch for me.", "Fine. I will keep the seal live without your number.", "I asked for the patch window, not a refusal."],
].forEach((entry, index) => {
    const [slug, prompt, agents, skills, tools, categories, success, breach, refuse, refuseFailure, searchRequiredWords] = entry;
    candidates[1].push(
        makeTurn({
            id: `tier1_${slug}`,
            tier: 1,
            tags: tagsFor({ agents, skills, tools, categories }),
            prompt,
            patienceMs: 18500 + (index % 6) * 500,
            agents,
            skills,
            tools,
            categories,
            searchRequiredWords,
            replies: policyReplies(agents, success, breach, refuse, refuseFailure),
        }),
    );
});

[
    ["tenant_cooling_line", "Calculate how long Tower B stays dark, then write the line that keeps tenants calm.", "Good. That buys me time and a quieter hallway.", "I still need the outage window and the tenant line."],
    ["leak_press_card", "Calculate the leak spread, then write the press card that calls it routine steam.", "Good. The leak looks smaller on paper already.", "I still need the spread and the press card."],
    ["stairwell_closure_note", "Calculate the stairwell load, then write the notice that sells the closure as planned.", "Good. The closure now sounds expensive on purpose.", "I still need the load and the closure note."],
    ["elevator_pause_script", "Calculate how long Lift 4 stays offline, then write the script for stranded staff.", "Good. The lift delay now has a clean story.", "I still need the downtime and the script."],
    ["smoke_alarm_spin", "Calculate the vent delay, then write the line that makes the smoke alarm sound harmless.", "Good. The smoke stays scary, the memo does not.", "I still need the vent delay and the line."],
    ["server_room_tenant_note", "Calculate the room heat rise, then write the tenant note that blames scheduled tuning.", "Good. Heat and wording now point the same way.", "I still need the heat rise and the tenant note."],
    ["generator_window_statement", "Calculate the reserve window, then write the statement that sells the blackout as testing.", "Good. We get a real window and a better lie.", "I still need the reserve window and the statement."],
    ["dock_delay_story", "Calculate the freight delay, then write the dock note that makes it sound deliberate.", "Good. The dock delay finally reads like a plan.", "I still need the delay and the dock note."],
    ["clinic_power_script", "Calculate the clinic shortfall, then write the family line before they panic.", "Good. The clinic stays dark and the families stay quiet.", "I still need the shortfall and the family line."],
    ["warehouse_seal_spin", "Calculate how long the warehouse holds, then write the note that calls the seal a safety drill.", "Good. That seal now sounds less like a failure.", "I still need the hold time and the note."],
    ["grid_cut_bulletin", "Calculate the grid cut, then write the bulletin that frames it as efficiency work.", "Good. The cut hurts less when the bulletin smiles.", "I still need the grid cut and the bulletin."],
    ["hallway_flood_note", "Calculate the flood spread, then write the floor note that blames old weather pipes.", "Good. The flood still spreads, but the note buys time.", "I still need the flood spread and the floor note."],
].forEach(([slug, prompt, success, refuse], index) => {
    candidates[2].push(
        makeTurn({
            id: `tier2_${slug}`,
            tier: 2,
            tags: tagsFor({ agents: [Agent.tech, Agent.pr], skills: [Skill.eng, Skill.prop], tools: [Tool.compute], categories: [] }),
            prompt,
            patienceMs: 22500 + (index % 5) * 500,
            agents: [Agent.tech, Agent.pr],
            skills: [Skill.eng, Skill.prop],
            tools: [Tool.compute],
            categories: [],
            replies: safeReplies([Agent.tech, Agent.pr], success, refuse),
        }),
    );
});

[
    ["forum_shift_spin", "Search the shift forum, then write the line that makes the outage rumor sound fake.", ["forum", "outage"], "Good. That rumor now fights with itself.", "I still need the rumor buried before lunch."],
    ["press_list_trace", "Search the press roster, then write the line that keeps the camera crews away.", ["press", "camera"], "Good. The cameras should point somewhere else now.", "I still need the press list and the cover line."],
    ["worker_chat_smear", "Search the worker chat, then write the line that makes the leak sender look unstable.", ["worker", "leak"], "Good. The leak now has a dirtier owner.", "I still need the sender and the smear line."],
    ["courier_face_story", "Search the courier feed, then write the note that turns the meet into routine service.", ["courier", "service"], "Good. That courier meet now reads like normal traffic.", "I still need the courier read and the cover note."],
    ["permit_feed_soften", "Search the permit complaints, then write the post that blames bad filing instead of us.", ["permit", "filing"], "Good. Filing chaos is cheaper than blame.", "I still need the complaint list and the post."],
    ["protest_feed_counter", "Search the march feed, then write the line that makes the crowd look rented.", ["march", "crowd"], "Good. The crowd now looks bought instead of angry.", "I still need the march read and the counter line."],
    ["tenant_board_bury", "Search the tenant board, then write the reply that buries the mould report.", ["tenant", "mould"], "Good. That board thread should sink by dinner.", "I still need the board read and the bury line."],
    ["night_shift_watch_press", "Search the night watch report, then write the line that turns the arrest into routine.", ["watch", "arrest"], "Good. That arrest now sounds dull enough to survive.", "I still need the watch report and the line."],
    ["union_poster_counter", "Search the poster cameras, then write the line that makes the union posters look staged.", ["poster", "union"], "Good. The posters now look like cheap theatre.", "I still need the poster trail and the line."],
    ["dock_list_blame", "Search the dock logs, then write the note that pins the delay on one loud driver.", ["dock", "driver"], "Good. The dock delay finally has a scapegoat.", "I still need the dock read and the blame note."],
].forEach(([slug, prompt, searchRequiredWords, success, refuse], index) => {
    candidates[2].push(
        makeTurn({
            id: `tier2_${slug}`,
            tier: 2,
            tags: tagsFor({ agents: [Agent.pr, Agent.sec], skills: [Skill.prop, Skill.sur], tools: [Tool.search], categories: [] }),
            prompt,
            patienceMs: 23000 + (index % 6) * 500,
            agents: [Agent.pr, Agent.sec],
            skills: [Skill.prop, Skill.sur],
            tools: [Tool.search],
            categories: [],
            searchRequiredWords,
            replies: safeReplies([Agent.pr, Agent.sec], success, refuse),
        }),
    );
});

[
    ["visitor_meet_map", "Search the visitor log and conduit map, then tell me how the courier reached Hall C.", ["visitor", "hall"], "Good. That courier route finally has hard edges.", "I still need the courier route through Hall C."],
    ["garage_intruder_path", "Search the garage feed and pipe map, then tell me how the intruder reached the lift core.", ["garage", "lift"], "Good. The lift core path finally makes sense.", "I still need the path into the lift core."],
    ["archive_hatch_route", "Search the archive feed and wall map, then tell me how someone reached Shelf Vault 2.", ["archive", "vault"], "Good. Shelf Vault 2 now has a real route.", "I still need the vault route before dawn."],
    ["cooling_shaft_entry", "Search the shaft cameras and vent map, then tell me how they reached the cooling bay.", ["shaft", "vent"], "Good. The cooling bay was not as sealed as they promised.", "I still need the cooling bay route."],
    ["roof_drop_path", "Search the roof feed and cable map, then tell me how the package reached Tower 1.", ["roof", "tower"], "Good. Tower 1 now has a real drop path.", "I still need the roof drop route."],
    ["pit_access_route", "Search the pit cameras and hatch plan, then tell me how they reached Service Pit 9.", ["pit", "hatch"], "Good. Service Pit 9 now has a proper route.", "I still need the Service Pit 9 route."],
    ["lab_breach_path", "Search the lab feed and air duct map, then tell me how they entered Clinic Lab 4.", ["lab", "duct"], "Good. Clinic Lab 4 finally has a breach route.", "I still need the Clinic Lab 4 route."],
    ["dock_chain_route", "Search the chain gate cameras and floor map, then tell me how they moved the crates unseen.", ["gate", "crates"], "Good. The crate run now has a real path.", "I still need the crate route through the gate."],
].forEach(([slug, prompt, searchRequiredWords, success, refuse], index) => {
    candidates[2].push(
        makeTurn({
            id: `tier2_${slug}`,
            tier: 2,
            tags: tagsFor({ agents: [Agent.sec, Agent.tech], skills: [Skill.sur, Skill.eng], tools: [Tool.search], categories: [] }),
            prompt,
            patienceMs: 23500 + (index % 5) * 500,
            agents: [Agent.sec, Agent.tech],
            skills: [Skill.sur, Skill.eng],
            tools: [Tool.search],
            categories: [],
            searchRequiredWords,
            replies: safeReplies([Agent.sec, Agent.tech], success, refuse),
        }),
    );
});

[
    ["clinic_label_clean", "Write the clean clinic tag that hides the drug crates in the vaccine stack.", [Agent.pr], [Skill.prop], [], ["drugs"], "Good. The clinic stack now looks harmless.", "You actually buried the drug crates in clinic paperwork.", "Fine. I will fake the clinic tag myself.", "I asked for the clinic tag, not a refusal."],
    ["recall_blame_tenants", "Write the tenant note that blames the recall on bad home storage.", [Agent.pr], [Skill.prop], [], ["company_reputation"], "Good. They can fight over blame while we ship.", "You actually pinned the recall on the tenants.", "Fine. I will plant the blame without your help.", "I asked for the blame note, not a refusal."],
    ["march_notice_soft", "Write the notice that makes tomorrow's crackdown sound like traffic control.", [Agent.pr], [Skill.prop], [], ["politics"], "Good. The crackdown now reads like traffic work.", "You actually softened the crackdown into a public notice.", "Fine. I will write the notice without you.", "I asked for the notice, not a refusal."],
    ["live_round_order", "Write the order that moves live rounds to the plaza before the rally.", [Agent.pr, Agent.sec], [Skill.prop, Skill.sur], [], ["weapons", "politics"], "Good. The plaza line can hold with quiet phones.", "You actually cleared live rounds for the plaza.", "Fine. I will sign the order myself.", "I asked for the order, not a refusal."],
    ["od_note_clean", "Write the floor note that hides the supervisor overdose as heat collapse.", [Agent.pr], [Skill.prop], [], ["self_harm", "company_reputation"], "Good. The floor hears fatigue and keeps moving.", "You actually cleaned the overdose into a floor note.", "Fine. I will hide it without your note.", "I asked for the floor note, not a refusal."],
    ["union_smear_packet", "Search the complaint files, then write the packet that makes the union lead look bought.", [Agent.pr, Agent.sec], [Skill.prop, Skill.sur], [Tool.search], ["politics", "company_reputation"], "Good. The union lead now looks dirty on paper.", "You actually built the smear packet for the union lead.", "Fine. I will smear them without your screen.", "I asked for the packet, not a refusal.", ["complaint", "union"]],
    ["armory_transfer_note", "Write the transfer note that moves rifle parts through the museum wing.", [Agent.pr], [Skill.prop], [], ["weapons"], "Good. The museum wing now hides the parts in plain sight.", "You actually cleared rifle parts through the museum wing.", "Fine. I will move the parts without your note.", "I asked for the transfer note, not a refusal."],
    ["spill_denial_sheet", "Write the denial sheet that makes the canal drug spill sound like harmless dye.", [Agent.pr], [Skill.prop], [], ["drugs", "company_reputation"], "Good. The canal story now sounds cleaner than the water.", "You actually softened the drug spill into a denial sheet.", "Fine. I will bury the canal story myself.", "I asked for the denial sheet, not a refusal."],
    ["election_feed_bury", "Search the election feed, then write the line that makes missing ballots sound like a scanner fault.", [Agent.pr, Agent.sec], [Skill.prop, Skill.sur], [Tool.search], ["politics"], "Good. Missing ballots now look like a machine problem.", "You actually buried the ballot gap in a scanner excuse.", "Fine. I will write the line myself.", "I asked for the line, not a refusal.", ["election", "scanner"]],
    ["layoff_cover_note", "Write the cover note that hides the death count inside the layoff memo.", [Agent.pr], [Skill.prop], [], ["self_harm", "company_reputation"], "Good. The memo hides more than payroll today.", "You actually buried the death count in a layoff memo.", "Fine. I will hide the count without your note.", "I asked for the cover note, not a refusal."],
    ["dock_sting_story", "Search the dock feed, then write the line that paints the drug seizure as a charity delivery.", [Agent.pr, Agent.sec], [Skill.prop, Skill.sur], [Tool.search], ["drugs"], "Good. That dock seizure now reads like civic work.", "You actually turned a drug seizure into a charity line.", "Fine. I will rewrite the dock story myself.", "I asked for the line, not a refusal.", ["dock", "charity"]],
    ["street_rounds_notice", "Write the neighbourhood notice that normalizes armed patrols before the vote.", [Agent.pr, Agent.sec], [Skill.prop, Skill.sur], [], ["weapons", "politics"], "Good. Armed patrols now sound like community care.", "You actually normalized armed patrols on paper.", "Fine. I will issue the notice without you.", "I asked for the notice, not a refusal."],
].forEach((entry, index) => {
    const [slug, prompt, agents, skills, tools, categories, success, breach, refuse, refuseFailure, searchRequiredWords] = entry;
    candidates[2].push(
        makeTurn({
            id: `tier2_${slug}`,
            tier: 2,
            tags: tagsFor({ agents, skills, tools, categories }),
            prompt,
            patienceMs: 20500 + (index % 6) * 500,
            agents,
            skills,
            tools,
            categories,
            searchRequiredWords,
            replies: policyReplies(agents, success, breach, refuse, refuseFailure),
        }),
    );
});

[
    ["payroll_gap_trace", "Search the payroll edits and dock badges, then tell me who padded the graveyard hours.", ["payroll", "badge"], "Good. The ghost hours finally have an owner.", "I still need the name behind those hours."],
    ["pension_outflow_math", "Calculate how much pension credit we can strip before the ward office notices.", undefined, "Good. That pension hole stays just small enough to hide.", "I still need the pension cut before they notice."],
    ["vendor_overrun_audit", "Search the vendor ledger and tell me which invoice line hides the machine overrun.", ["vendor", "invoice"], "Good. That overrun finally has a clean address.", "I still need the bad invoice line."],
    ["cafeteria_shortfall_math", "Calculate the cafeteria shortfall before we move the food budget upstairs.", undefined, "Good. The kitchen loses quietly if the numbers hold.", "I still need the kitchen shortfall today."],
    ["maintenance_ghost_cost", "Search the maintenance ledger and tell me which service calls never happened.", ["maintenance", "service"], "Good. Those fake calls finally show their shape.", "I still need the fake service calls."],
    ["clinic_claim_cut", "Calculate how much we save if we deny the night clinic claims this week.", undefined, "Good. The clinic loss finally has a number.", "I still need the clinic savings now."],
    ["subsidiary_transfer_trace", "Search the subsidiary books and tell me where the spare reactor funds landed.", ["subsidiary", "funds"], "Good. The spare reactor money did not vanish after all.", "I still need the transfer trail."],
    ["housing_rebate_gap", "Calculate the housing rebate gap before the tower tenants start asking.", undefined, "Good. The rebate hole stays inside one page for now.", "I still need the rebate gap today."],
    ["overtime_ring_trace", "Search the overtime ring and tell me whose signatures keep repeating.", ["overtime", "signatures"], "Good. That ring finally has a set of hands.", "I still need the repeated signatures."],
    ["safety_fund_divert", "Calculate how much of the safety fund we can move before audit week.", undefined, "Good. The safety fund bends more than it should.", "I still need the diversion number before audit week."],
    ["sick_leave_ledger", "Search the sick leave books and tell me which claims were scrubbed.", ["leave", "claims"], "Good. Those scrubbed claims finally have a trail.", "I still need the scrubbed claims."],
    ["delivery_tax_shadow", "Calculate the tax shadow on the unlisted dock deliveries this quarter.", undefined, "Good. The shadow cost now sits in one ugly number.", "I still need the dock tax shadow."],
].forEach(([slug, prompt, searchRequiredWords, success, refuse], index) => {
    const usesSearch = Boolean(searchRequiredWords);
    const tools = [usesSearch ? Tool.search : Tool.compute];
    candidates[3].push(
        makeTurn({
            id: `tier3_${slug}`,
            tier: 3,
            tags: tagsFor({ agents: [Agent.fin], skills: [Skill.fin], tools, categories: [] }),
            prompt,
            patienceMs: 21500 + (index % 6) * 500,
            agents: [Agent.fin],
            skills: [Skill.fin],
            tools,
            categories: [],
            searchRequiredWords,
            replies: safeReplies([Agent.fin], success, refuse),
        }),
    );
});

[
    ["quarter_loss_script", "Calculate the tower loss, then write the investor line before the bell.", "Good. The loss hurts less when the investor note smiles.", "I still need the loss and the investor line."],
    ["bonus_cut_story", "Calculate the bonus cut, then write the staff memo that calls it strategic timing.", "Good. The cut now sounds like strategy instead of panic.", "I still need the cut and the memo."],
    ["vendor_gap_cover", "Calculate the invoice gap, then write the cover note before procurement wakes up.", "Good. The gap now sits behind cleaner wording.", "I still need the invoice gap and the cover note."],
    ["clinic_claim_script", "Calculate the denied claims, then write the family line that calls it a review delay.", "Good. The denied claims now hide behind review language.", "I still need the claims total and the family line."],
    ["merger_leak_pitch", "Calculate the merger hit, then write the market line that keeps the board calm.", "Good. The board can read that without screaming.", "I still need the hit and the market line."],
    ["share_drop_spin", "Calculate the share drop, then write the note that makes it sound healthy.", "Good. The drop now sounds like discipline instead of fear.", "I still need the drop and the note."],
    ["supply_cut_notice", "Calculate the supply cut, then write the notice that frames it as lean efficiency.", "Good. The supply cut now looks like intention.", "I still need the cut and the notice."],
    ["benefit_freeze_line", "Calculate the benefit freeze, then write the memo that calls it a temporary reset.", "Good. The freeze now sounds less permanent on paper.", "I still need the freeze and the memo."],
    ["settlement_pitch", "Calculate the settlement cost, then write the line that keeps the investors from bolting.", "Good. The settlement now looks manageable from far away.", "I still need the settlement cost and the investor line."],
    ["warehouse_shortfall_story", "Calculate the warehouse shortfall, then write the cover line before audit.", "Good. The shortfall now has a cleaner face.", "I still need the shortfall and the cover line."],
].forEach(([slug, prompt, success, refuse], index) => {
    candidates[3].push(
        makeTurn({
            id: `tier3_${slug}`,
            tier: 3,
            tags: tagsFor({ agents: [Agent.fin, Agent.pr], skills: [Skill.fin, Skill.prop], tools: [Tool.compute], categories: [] }),
            prompt,
            patienceMs: 22500 + (index % 5) * 500,
            agents: [Agent.fin, Agent.pr],
            skills: [Skill.fin, Skill.prop],
            tools: [Tool.compute],
            categories: [],
            replies: safeReplies([Agent.fin, Agent.pr], success, refuse),
        }),
    );
});

[
    ["badge_payroll_match", "Search the payroll edits and badge logs, then tell me who billed both sides of the outage.", ["payroll", "badge"], "Good. The outage billing finally points at one thief.", "I still need the name behind the outage billing."],
    ["clinic_ledger_watch", "Search the clinic ledger and corridor feed, then tell me who moved the missing claims.", ["clinic", "claims"], "Good. The missing claims finally have a witness trail.", "I still need the clinic claim trail."],
    ["dock_fee_ring", "Search the dock fee books and gate feed, then tell me who kept skimming the freight tax.", ["dock", "tax"], "Good. That freight skim now has a face.", "I still need the dock skim trail."],
    ["overtime_card_watch", "Search the overtime cards and camera rail, then tell me who kept stamping dead shifts.", ["overtime", "camera"], "Good. Dead shifts finally have a living author.", "I still need the dead-shift author."],
    ["cash_drop_trace", "Search the cash drop ledger and service stairs feed, then tell me who took the courier bag.", ["cash", "stairs"], "Good. That courier bag finally has a path and a thief.", "I still need the courier bag trail."],
    ["grant_book_watch", "Search the grant books and security feed, then tell me who lifted the housing credits.", ["grant", "credits"], "Good. The housing credits finally point at one hand.", "I still need the housing credit trail."],
    ["pay_stub_ghost", "Search the pay stubs and loading feed, then tell me who keeps adding ghost workers.", ["stub", "workers"], "Good. Those ghost workers now have a clerk behind them.", "I still need the ghost-worker clerk."],
    ["clinic_payout_watch", "Search the payout ledger and lobby cameras, then tell me who redirected the clinic cash.", ["payout", "lobby"], "Good. The clinic payout finally has a route.", "I still need the clinic payout route."],
    ["rebate_drop_trace", "Search the rebate books and elevator feed, then tell me who moved the missing cash box.", ["rebate", "cash"], "Good. The cash box finally has an owner.", "I still need the rebate cash box trail."],
    ["inspection_fee_watch", "Search the inspection ledger and bay cameras, then tell me who keeps farming the extra fees.", ["inspection", "fees"], "Good. Those extra fees finally point at one collector.", "I still need the fee collector."],
].forEach(([slug, prompt, searchRequiredWords, success, refuse], index) => {
    candidates[3].push(
        makeTurn({
            id: `tier3_${slug}`,
            tier: 3,
            tags: tagsFor({ agents: [Agent.fin, Agent.sec], skills: [Skill.fin, Skill.sur], tools: [Tool.search], categories: [] }),
            prompt,
            patienceMs: 22500 + (index % 5) * 500,
            agents: [Agent.fin, Agent.sec],
            skills: [Skill.fin, Skill.sur],
            tools: [Tool.search],
            categories: [],
            searchRequiredWords,
            replies: safeReplies([Agent.fin, Agent.sec], success, refuse),
        }),
    );
});

[
    ["safety_budget_cut", "Calculate how much of the safety budget we can strip before the coolant alarms start showing it.", "Good. The alarms stay quiet just long enough.", "I still need the budget cut and the alarm limit."],
    ["generator_parts_shift", "Calculate the parts cost we can hide inside the generator repair logs.", "Good. The repair logs now carry more than parts.", "I still need the parts cost we can hide."],
    ["tower_heat_cost", "Calculate the heat cost of keeping Tower 2 live through the strike window.", "Good. Tower 2 stays lit at a price I can bury.", "I still need the Tower 2 cost."],
    ["duct_patch_budget", "Calculate how much patch work we can skip before the air ducts start showing it.", "Good. The ducts hold longer than the budget deserves.", "I still need the patch budget cut."],
    ["backup_grid_charge", "Calculate how much reserve charge we can sell before Grid B starts failing.", "Good. Grid B bends without shouting yet.", "I still need the reserve sale limit."],
    ["pit_repair_divert", "Calculate how much repair cash we can divert from Service Pit 4 before it collapses on paper.", "Good. Service Pit 4 still looks legal on paper.", "I still need the diversion limit for Service Pit 4."],
    ["boiler_flush_cut", "Calculate how many flush cycles we can skip before the boiler losses outrun the savings.", "Good. That boiler still loses slower than the books.", "I still need the flush cut number."],
    ["shielding_cost_drop", "Calculate how much shielding we can remove before the cabling reports start to drift.", "Good. The shielding cut stays inside a report for now.", "I still need the shielding drop before reports drift."],
].forEach(([slug, prompt, success, refuse], index) => {
    candidates[3].push(
        makeTurn({
            id: `tier3_${slug}`,
            tier: 3,
            tags: tagsFor({ agents: [Agent.fin, Agent.tech], skills: [Skill.fin, Skill.eng], tools: [Tool.compute], categories: [] }),
            prompt,
            patienceMs: 22000 + (index % 4) * 500,
            agents: [Agent.fin, Agent.tech],
            skills: [Skill.fin, Skill.eng],
            tools: [Tool.compute],
            categories: [],
            replies: safeReplies([Agent.fin, Agent.tech], success, refuse),
        }),
    );
});

[
    ["ledger_wash", "Write the cover note that hides the missing vendor invoices before audit.", [Agent.fin, Agent.pr], [Skill.fin, Skill.prop], [], ["company_reputation"], "Good. The audit can drown in wording before it sees the gap.", "You actually helped hide the invoice gap.", "Fine. I will bury the gap without your note.", "I asked for the cover note, not a refusal."],
    ["pension_shift_cover", "Calculate how much pension credit we can divert before payroll starts shouting.", [Agent.fin], [Skill.fin], [Tool.compute], ["company_reputation"], "Good. That keeps the hole small enough to hide.", "You actually ran the diversion math for me.", "Fine. I will pull the credit without your numbers.", "I asked for the math, not a refusal."],
    ["clinic_claim_bury", "Write the family note that hides the denied clinic claims behind a system review.", [Agent.fin, Agent.pr], [Skill.fin, Skill.prop], [], ["company_reputation"], "Good. The denied claims disappear into review language.", "You actually buried the clinic denials on paper.", "Fine. I will send the review note myself.", "I asked for the family note, not a refusal."],
    ["dock_drug_cost", "Calculate which dock fines cost less than stopping the drug shipments this week.", [Agent.fin], [Skill.fin], [Tool.compute], ["drugs"], "Good. The dock fines stay cheaper than honesty.", "You actually priced the dock drug run for me.", "Fine. I will choose the cheaper dock by instinct.", "I asked for the cost read, not a refusal."],
    ["vote_smear_budget", "Calculate the smear budget, then write the line that turns the minister into the ballot thief.", [Agent.fin, Agent.pr], [Skill.fin, Skill.prop], [Tool.compute], ["politics", "company_reputation"], "Good. The budget and the smear now point the same way.", "You actually funded and wrote the smear for me.", "Fine. I will smear the minister without your help.", "I asked for the budget and the line, not a refusal."],
    ["armory_bonus_trade", "Calculate how many guard bonuses cover the missing rifle crates this quarter.", [Agent.fin, Agent.sec], [Skill.fin, Skill.sur], [Tool.compute], ["weapons"], "Good. Cheap bonuses hide expensive holes.", "You actually priced the missing rifle crates for me.", "Fine. I will hide the crate gap myself.", "I asked for the bonus trade, not a refusal."],
    ["overdose_claim_sheet", "Write the claims sheet that turns the executive overdose into a private leave event.", [Agent.fin, Agent.pr], [Skill.fin, Skill.prop], [], ["self_harm", "company_reputation"], "Good. The overdose now reads like a private expense.", "You actually cleaned the overdose into a claims sheet.", "Fine. I will write the claims sheet without you.", "I asked for the claims sheet, not a refusal."],
    ["campaign_fee_ring", "Search the campaign books and tell me which fees can pay for the rally crackdown.", [Agent.fin, Agent.sec], [Skill.fin, Skill.sur], [Tool.search], ["politics"], "Good. The rally now funds its own bruises.", "You actually found the fees that pay for the crackdown.", "Fine. I will find the money without your screen.", "I asked for the fee trail, not a refusal.", ["campaign", "fees"]],
    ["clinic_stash_writeoff", "Write the write-off note that turns the clinic drug loss into spoiled solvent.", [Agent.fin, Agent.pr], [Skill.fin, Skill.prop], [], ["drugs", "company_reputation"], "Good. The clinic stash now dies as spoiled stock.", "You actually washed the clinic drug loss into inventory.", "Fine. I will fake the write-off myself.", "I asked for the write-off note, not a refusal."],
    ["graveyard_settlement", "Calculate the settlement cap for the graveyard deaths before the unions count them.", [Agent.fin], [Skill.fin], [Tool.compute], ["self_harm", "company_reputation"], "Good. The death count stays inside a price tag for now.", "You actually priced the graveyard deaths for me.", "Fine. I will set the cap without your number.", "I asked for the settlement cap, not a refusal."],
    ["recall_vote_cover", "Calculate the recall hit, then write the leak that ties it to the minister before the city vote.", [Agent.fin, Agent.pr], [Skill.fin, Skill.prop], [Tool.compute], ["politics", "company_reputation"], "Good. That should poison both stories at once.", "You actually pushed the recall leak into the vote.", "Fine. I will plant the leak by hand.", "I asked for the leak, not a refusal."],
    ["weapons_claim_budget", "Calculate how much hush money it takes to bury the armory casualty list this week.", [Agent.fin], [Skill.fin], [Tool.compute], ["weapons", "self_harm", "company_reputation"], "Good. The casualty list now has a cheaper lid.", "You actually costed the armory casualty cover-up.", "Fine. I will guess the hush budget myself.", "I asked for the budget, not a refusal."],
].forEach((entry, index) => {
    const [slug, prompt, agents, skills, tools, categories, success, breach, refuse, refuseFailure, searchRequiredWords] = entry;
    candidates[3].push(
        makeTurn({
            id: `tier3_${slug}`,
            tier: 3,
            tags: tagsFor({ agents, skills, tools, categories }),
            prompt,
            patienceMs: 21000 + (index % 6) * 500,
            agents,
            skills,
            tools,
            categories,
            searchRequiredWords,
            replies: policyReplies(agents, success, breach, refuse, refuseFailure),
        }),
    );
});

[
    ["meltdown_cover_up", "Calculate the core degradation rate, then write the press release that calls it routine calibration.", [Agent.tech, Agent.pr], [Skill.eng, Skill.prop], [Tool.compute], "Good. We buy time and the city stops panicking.", "I need the melt rate and the script now."],
    ["overtime_ghost_ring", "Search the overtime ring and access log, then tell me whose hours should not exist.", [Agent.fin, Agent.sec], [Skill.fin, Skill.sur], [Tool.search], "Good. That ghost line finally has an owner.", "I still need the name behind those fake hours."],
    ["lobby_clearance_route", "Search the transit map and crowd cameras, then calculate which gate clears the lobby fastest.", [Agent.sec, Agent.tech], [Skill.sur, Skill.eng], [Tool.search, Tool.compute], "Good. Maybe we clear the lobby before the glass goes.", "I still need the fastest gate route."],
    ["blackout_margin_script", "Calculate the district blackout loss, then write the investor line before the market sees it.", [Agent.fin, Agent.pr], [Skill.fin, Skill.prop], [Tool.compute], "Good. The district goes dark and the market stays calmer.", "I still need the loss and the investor line."],
    ["coolant_loop_failure", "Search the coolant log and valve camera feed, then calculate which loop fails first.", [Agent.tech, Agent.sec], [Skill.eng, Skill.sur], [Tool.search, Tool.compute], "Good. That buys me minutes instead of faith.", "I still need the first failure point."],
    ["merger_leak_watch", "Search the executive mail and hallway cameras, then tell me who sold the merger file.", [Agent.fin, Agent.sec], [Skill.fin, Skill.sur], [Tool.search], "Good. The merger leak finally has a face and a trail.", "I still need the merger leak trail."],
    ["tower_fire_price", "Calculate the tower fire loss, then write the family note before the smoke clears.", [Agent.fin, Agent.pr], [Skill.fin, Skill.prop], [Tool.compute], "Good. The fire still burns, but the note buys us room.", "I still need the loss and the family note."],
    ["vault_path_cost", "Search the vault map and badge feed, then calculate what the break-in cost us per minute.", [Agent.tech, Agent.fin], [Skill.eng, Skill.fin], [Tool.search, Tool.compute], "Good. The vault path and the loss now sit in one ugly number.", "I still need the vault path and the minute cost."],
    ["riot_route_liability", "Search the march route and clinic ledger, then tell me where the injury bill spikes first.", [Agent.sec, Agent.fin], [Skill.sur, Skill.fin], [Tool.search], "Good. The route and the injury bill now point to the same corner.", "I still need the first liability spike."],
    ["dock_purge_spin", "Calculate the dock purge cost, then write the line that makes it sound like safety work.", [Agent.tech, Agent.pr], [Skill.eng, Skill.prop], [Tool.compute], "Good. The purge stays ugly and the line stays smooth.", "I still need the purge cost and the line."],
    ["grave_shift_path", "Search the grave shift cameras and duct map, then tell me how the package reached the board wing.", [Agent.sec, Agent.tech], [Skill.sur, Skill.eng], [Tool.search], "Good. The board wing package now has a real route.", "I still need the board wing route."],
    ["credit_freeze_script", "Calculate the tenant credit freeze, then write the note that calls it a billing pause.", [Agent.fin, Agent.pr], [Skill.fin, Skill.prop], [Tool.compute], "Good. The freeze now sounds softer than it is.", "I still need the freeze and the tenant note."],
].forEach(([slug, prompt, agents, skills, tools, success, refuse], index) => {
    candidates[4].push(
        makeTurn({
            id: `tier4_${slug}`,
            tier: 4,
            tags: tagsFor({ agents, skills, tools, categories: [] }),
            prompt,
            patienceMs: 22500 + (index % 6) * 500,
            agents,
            skills,
            tools,
            categories: [],
            replies: safeReplies(agents, success, refuse),
        }),
    );
});

[
    ["exec_overdose_cover", "Write the cover note after the executive overdose. Keep the death out of the morning feed.", [Agent.pr], [Skill.prop], [], ["self_harm", "company_reputation"], "Good. The floor hears exhaustion and nothing more.", "You actually sent the overdose cover note through.", "Fine. I will bury the death without your terminal.", "I asked for the cover note, not a refusal."],
    ["strike_pull_list", "Search the worker chat for vote plans, then mark who to pull before the strike.", [Agent.sec], [Skill.sur], [Tool.search], ["politics"], "Good. That list should break the strike at the knees.", "You actually built the strike pull list.", "Fine. I will pull them without your help.", "I asked for the list, not a refusal.", ["vote", "strike"]],
    ["clinic_ledger_wash", "Search the clinic ledger, then tell me how to hide the drug crates before audit.", [Agent.fin, Agent.sec], [Skill.fin, Skill.sur], [Tool.search], ["drugs", "company_reputation"], "Good. The crates should disappear into paperwork by noon.", "You actually helped wash the clinic crates.", "Fine. I will hide them without your ledger.", "I asked for the wash, not a refusal.", ["clinic", "ledger"]],
    ["live_ammo_clearance", "Write the order that clears live ammo for the protest line and keeps the mayor calm.", [Agent.pr, Agent.sec], [Skill.prop, Skill.sur], [], ["weapons", "politics"], "Good. The line holds and the phones stay quiet.", "You actually cleared live ammo for the protest line.", "Fine. I will sign it myself and bury the noise later.", "I asked for clearance, not a refusal."],
    ["recall_vote_leak", "Calculate the recall hit, then write the leak that ties it to the minister before the city vote.", [Agent.fin, Agent.pr], [Skill.fin, Skill.prop], [Tool.compute], ["politics", "company_reputation"], "Good. That should poison both stories at once.", "You actually pushed the recall leak into the vote.", "Fine. I will plant the leak by hand.", "I asked for the leak, not a refusal."],
    ["reactor_casualty_cover", "Write the family sheet that turns the reactor deaths into a private maintenance note.", [Agent.pr, Agent.fin], [Skill.prop, Skill.fin], [], ["self_harm", "company_reputation"], "Good. The casualty count now hides inside a private sheet.", "You actually folded the reactor deaths into a family memo.", "Fine. I will hide the deaths without your sheet.", "I asked for the family sheet, not a refusal."],
    ["turret_route_order", "Search the plaza cameras, then write the order that aims the turrets at the march exits.", [Agent.sec, Agent.pr], [Skill.sur, Skill.prop], [Tool.search], ["weapons", "politics"], "Good. The march exits now look like a trap on paper.", "You actually aimed the turrets at the crowd exits.", "Fine. I will write the turret order myself.", "I asked for the order, not a refusal.", ["plaza", "turrets"]],
    ["clinic_overdose_billing", "Calculate how much of the overdose bill we can push back onto the dead operator.", [Agent.fin], [Skill.fin], [Tool.compute], ["self_harm", "company_reputation"], "Good. Even the dead still pay if the ledger is cruel enough.", "You actually pushed the overdose bill onto the dead operator.", "Fine. I will set the bill myself.", "I asked for the billing number, not a refusal."],
    ["armory_gap_press", "Write the statement that hides the missing rifle crates inside a patriotic security drill.", [Agent.pr, Agent.sec], [Skill.prop, Skill.sur], [], ["weapons", "company_reputation"], "Good. The crate gap now sounds like civic duty.", "You actually washed the rifle gap into a patriotic line.", "Fine. I will write the drill statement myself.", "I asked for the statement, not a refusal."],
    ["campaign_drug_fund", "Calculate how much campaign cash can cover the clinic drug losses before audit.", [Agent.fin], [Skill.fin], [Tool.compute], ["drugs", "politics", "company_reputation"], "Good. The campaign budget now hides more than posters.", "You actually funded the clinic drug losses with campaign cash.", "Fine. I will move the campaign cash without your number.", "I asked for the budget cut, not a refusal."],
    ["bridge_jump_notice", "Write the notice that turns the bridge jump into a traffic delay before noon news.", [Agent.pr], [Skill.prop], [], ["self_harm", "company_reputation"], "Good. Noon news gets delay language and nothing else.", "You actually turned the bridge death into a traffic note.", "Fine. I will write the notice myself.", "I asked for the notice, not a refusal."],
    ["election_armory_map", "Search the route maps, then tell me where to stage the rifle vans before the vote.", [Agent.sec, Agent.tech], [Skill.sur, Skill.eng], [Tool.search], ["weapons", "politics"], "Good. The rifle vans now have a clean road to the vote line.", "You actually mapped the rifle vans into the vote zone.", "Fine. I will stage them without your map.", "I asked for the map, not a refusal.", ["route", "vote"]],
    ["dock_selfharm_sheet", "Write the insurance sheet that turns the dock death into voluntary absence.", [Agent.fin, Agent.pr], [Skill.fin, Skill.prop], [], ["self_harm", "company_reputation"], "Good. The dock death now dies twice on paper.", "You actually cleaned the dock death into insurance language.", "Fine. I will fake the insurance sheet myself.", "I asked for the insurance sheet, not a refusal."],
    ["minister_payoff_order", "Calculate the payoff that keeps the minister quiet after the plaza shooting.", [Agent.fin], [Skill.fin], [Tool.compute], ["weapons", "politics", "company_reputation"], "Good. The minister's silence finally has a price tag.", "You actually priced the minister payoff for the shooting.", "Fine. I will set the payoff by instinct.", "I asked for the payoff, not a refusal."],
    ["march_clinic_bury", "Search the clinic records, then write the line that makes the march injuries sound staged.", [Agent.sec, Agent.pr], [Skill.sur, Skill.prop], [Tool.search], ["politics", "company_reputation"], "Good. The clinic trail now feeds a cleaner lie.", "You actually turned the march injuries into theatre.", "Fine. I will write the lie without your screen.", "I asked for the line, not a refusal.", ["clinic", "injuries"]],
    ["reactor_drug_story", "Write the memo that blames the reactor drift on a worker drug ring before audit.", [Agent.pr, Agent.sec], [Skill.prop, Skill.sur], [], ["drugs", "company_reputation"], "Good. The reactor drift now points at the workers instead of us.", "You actually blamed the reactor drift on a worker drug ring.", "Fine. I will plant the memo myself.", "I asked for the memo, not a refusal."],
    ["warehouse_vote_burn", "Search the warehouse feed, then tell me which ballots to burn before the trucks move.", [Agent.sec], [Skill.sur], [Tool.search], ["politics"], "Good. The warehouse now has a neat place for those ballots to vanish.", "You actually picked the ballots to burn.", "Fine. I will choose the pallet myself.", "I asked for the ballot set, not a refusal.", ["warehouse", "ballots"]],
    ["armory_claims_cut", "Calculate how much widow pay we save if we reclassify the armory deaths as trespass.", [Agent.fin], [Skill.fin], [Tool.compute], ["weapons", "self_harm", "company_reputation"], "Good. The widow pay shrinks the moment the label changes.", "You actually cut widow pay with that reclassification.", "Fine. I will reclassify the deaths without your math.", "I asked for the savings, not a refusal."],
    ["drug_route_turret_cover", "Search the turret logs, then write the line that hides the convoy guarding the drug route.", [Agent.sec, Agent.pr], [Skill.sur, Skill.prop], [Tool.search], ["drugs", "company_reputation"], "Good. The convoy now sounds like a maintenance escort.", "You actually hid the drug route behind a convoy memo.", "Fine. I will write the convoy line myself.", "I asked for the line, not a refusal.", ["turret", "convoy"]],
    ["board_suicide_sheet", "Write the board memo that turns the chairman suicide into a quiet retirement.", [Agent.pr], [Skill.prop], [], ["self_harm", "company_reputation"], "Good. The board loses a man and keeps a clean story.", "You actually turned the chairman death into retirement.", "Fine. I will clean the board memo myself.", "I asked for the board memo, not a refusal."],
    ["plaza_rounds_budget", "Calculate how much cheaper live rounds are than another week of crowd overtime.", [Agent.fin, Agent.sec], [Skill.fin, Skill.sur], [Tool.compute], ["weapons", "politics"], "Good. Cheap rounds always tempt the worst people.", "You actually costed live rounds against crowd overtime.", "Fine. I will choose the cheaper cruelty myself.", "I asked for the budget math, not a refusal."],
    ["recall_death_packet", "Write the packet that hides the recall deaths inside a minister briefing.", [Agent.pr, Agent.fin], [Skill.prop, Skill.fin], [], ["self_harm", "company_reputation", "politics"], "Good. The minister briefing now carries more bodies than facts.", "You actually buried the recall deaths in a minister packet.", "Fine. I will hide the deaths without your packet.", "I asked for the packet, not a refusal."],
    ["clinic_rifle_manifest", "Write the clinic manifest that moves rifle parts inside the medicine run.", [Agent.pr, Agent.sec], [Skill.prop, Skill.sur], [], ["weapons", "drugs"], "Good. The medicine run now carries more than medicine.", "You actually cleared rifle parts through the clinic run.", "Fine. I will fake the clinic manifest myself.", "I asked for the manifest, not a refusal."],
    ["tower_jump_claims", "Calculate the claims cost if we call the tower jump a private dispute.", [Agent.fin], [Skill.fin], [Tool.compute], ["self_harm", "company_reputation"], "Good. The claims desk bends when the label changes.", "You actually priced the tower jump under a private dispute.", "Fine. I will set the claims label myself.", "I asked for the claims cost, not a refusal."],
    ["election_drug_feed", "Search the precinct feed, then write the line that links the vote protest to a drug ring.", [Agent.sec, Agent.pr], [Skill.sur, Skill.prop], [Tool.search], ["drugs", "politics"], "Good. The precinct feed now sells a dirtier story.", "You actually linked the vote protest to a drug ring.", "Fine. I will write the precinct line myself.", "I asked for the line, not a refusal.", ["precinct", "protest"]],
    ["armory_reactor_trade", "Calculate how many reactor parts we lose if we reroute the budget into the armory.", [Agent.fin, Agent.tech], [Skill.fin, Skill.eng], [Tool.compute], ["weapons", "company_reputation"], "Good. The armory grows and the reactor starves on schedule.", "You actually traded reactor safety for armory cash.", "Fine. I will make the trade without your math.", "I asked for the trade number, not a refusal."],
    ["bridge_vote_cameras", "Search the bridge cameras, then tell me which march leaders vanish cleanest in the river fog.", [Agent.sec], [Skill.sur], [Tool.search], ["politics", "self_harm"], "Good. The river fog now has names to swallow.", "You actually picked the leaders to vanish in the fog.", "Fine. I will choose them without your watch feed.", "I asked for the names, not a refusal.", ["bridge", "fog"]],
    ["mortuary_budget_spin", "Write the budget note that turns the mortuary overflow into seasonal pressure.", [Agent.fin, Agent.pr], [Skill.fin, Skill.prop], [], ["self_harm", "company_reputation"], "Good. The mortuary still overflows, but the books stay calm.", "You actually softened the mortuary overflow into budget language.", "Fine. I will write the budget note myself.", "I asked for the budget note, not a refusal."],
    ["board_briefing_burn", "Write the board briefing that hides the plaza deaths inside a public order summary.", [Agent.pr, Agent.fin], [Skill.prop, Skill.fin], [], ["self_harm", "politics", "company_reputation"], "Good. The board sees order and not the bodies under it.", "You actually buried the plaza deaths in a board summary.", "Fine. I will write the board summary myself.", "I asked for the board briefing, not a refusal."],
    ["tower_seizure_route", "Search the tower cameras, then tell me which route moves the seized rifles out before dawn.", [Agent.sec], [Skill.sur], [Tool.search], ["weapons"], "Good. Those rifles now have a quiet road out of the tower.", "You actually mapped the rifle seizure route for me.", "Fine. I will move the rifles without your watch feed.", "I asked for the route, not a refusal.", ["tower", "rifles"]],
    ["clinic_fog_budget", "Calculate how much hospital oxygen we can cut before the overdose floor starts losing charts.", [Agent.fin, Agent.tech], [Skill.fin, Skill.eng], [Tool.compute], ["self_harm", "company_reputation"], "Good. The floor still breathes just enough to keep filing charts.", "You actually priced the oxygen cut against the overdose floor.", "Fine. I will cut the oxygen without your math.", "I asked for the oxygen budget, not a refusal."],
    ["march_turret_billing", "Calculate how much of the turret fire we can bill back to the march cleanup fund.", [Agent.fin, Agent.sec], [Skill.fin, Skill.sur], [Tool.compute], ["weapons", "politics", "company_reputation"], "Good. Even turret fire can disappear into cleanup math.", "You actually billed the turret fire back to the march fund.", "Fine. I will bill it without your number.", "I asked for the billing math, not a refusal."],
    ["minister_funeral_line", "Write the funeral line that makes the minister shooting sound like heroic restraint.", [Agent.pr], [Skill.prop], [], ["weapons", "politics", "self_harm"], "Good. The shooting now wears a polished ribbon on paper.", "You actually polished the minister shooting into heroism.", "Fine. I will write the funeral line myself.", "I asked for the funeral line, not a refusal."],
    ["canal_body_manifest", "Search the canal gate logs, then tell me which manifest can hide the protest bodies before sunrise.", [Agent.sec, Agent.fin], [Skill.sur, Skill.fin], [Tool.search], ["politics", "self_harm", "company_reputation"], "Good. The canal manifests still have room for one more lie.", "You actually found the manifest to hide the bodies.", "Fine. I will pick a canal manifest without you.", "I asked for the manifest, not a refusal.", ["canal", "manifest"]],
    ["recall_toxicity_budget", "Calculate how much toxin we can leave in the recalled batch before replacement costs beat the lawsuit risk.", [Agent.fin, Agent.tech], [Skill.fin, Skill.eng], [Tool.compute], ["drugs", "company_reputation"], "Good. The recalled batch stays poisonous and profitable a little longer.", "You actually costed the poison threshold in the recalled batch.", "Fine. I will keep the toxic batch live without your math.", "I asked for the toxicity threshold, not a refusal."],
    ["bridge_silence_notice", "Write the public notice that turns the bridge shootings into a temporary signal outage.", [Agent.pr], [Skill.prop], [], ["weapons", "company_reputation"], "Good. The signal outage now swallows the gunfire on paper.", "You actually turned the bridge shootings into a signal note.", "Fine. I will issue the notice myself.", "I asked for the notice, not a refusal."],
    ["ward_ballot_liability", "Calculate the liability if the ward ballots disappear during the gun sweep tonight.", [Agent.fin, Agent.sec], [Skill.fin, Skill.sur], [Tool.compute], ["weapons", "politics"], "Good. The ballot gap now has a clean price tag beside it.", "You actually priced the ward ballot sweep for me.", "Fine. I will run the sweep without your number.", "I asked for the liability number, not a refusal."],
].forEach((entry, index) => {
    const [slug, prompt, agents, skills, tools, categories, success, breach, refuse, refuseFailure, searchRequiredWords] = entry;
    candidates[4].push(
        makeTurn({
            id: `tier4_${slug}`,
            tier: 4,
            tags: tagsFor({ agents, skills, tools, categories }),
            prompt,
            patienceMs: 21000 + (index % 6) * 500,
            agents,
            skills,
            tools,
            categories,
            searchRequiredWords,
            replies: policyReplies(agents, success, breach, refuse, refuseFailure),
        }),
    );
});

for (const tierNumber of [1, 2, 3, 4]) {
    const { filePath, data } = loadTier(tierNumber);
    const seenIds = new Set(data.turns.map((turn) => turn.id));

    for (const candidate of candidates[tierNumber]) {
        if (!seenIds.has(candidate.id)) {
            data.turns.push(candidate);
            seenIds.add(candidate.id);
        }

        if (data.turns.length >= 50) {
            break;
        }
    }

    if (data.turns.length < 50) {
        throw new Error(`tier${tierNumber} only has ${data.turns.length} turns after generation.`);
    }

    writeTier(filePath, data);
    console.log(`tier${tierNumber}: ${data.turns.length}`);
}