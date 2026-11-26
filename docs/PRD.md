# Avalon Product Requirements Document (PRD)

## 1. Product Context and Purpose — WHY

Avalon is designed for friends gathering in person. Players discuss face to face and use a WeChat Mini Program for invitations, role assignment, team voting, quest execution, and automatic resolution. Each player uses their own device to view private information.

## 2. Selected Approach and Scope — GOAL

Build on the existing Mini Program and backend without introducing another client or rewriting the architecture. The selected approach uses two fixed mode entry points instead of expansion toggles in the lobby, shared invitations instead of room-code entry, and waiting for disconnected players instead of acting on their behalf. These choices reduce configuration and rule branches and suit groups of friends playing in person.

| Mode | Expansions | Players required to start |
|---|---|---|
| Base Game | None | 5–10 |
| Expansion Game | Lancelot and Lady of the Lake always enabled together | 7–10 |

- The mode is fixed when the room is created. Changing modes requires a new room.
- Expansion games have no individual expansion toggles and cannot start with fewer than seven players.
- Out of scope: joining by entering a room code, spectators, random matchmaking, friend lists, online text/voice chat, rankings, payments, custom role editing, bans, and permanent match history.
- Do not automatically skip disconnected players, submit votes or quest cards for them, or replace players during a game.
- Recovering games after a backend restart is outside first-release acceptance criteria.

## 3. Main Flow and Screen Responsibilities — FLOW

Choose Base Game / Expansion Game → Create room → Invite through WeChat sharing → Log in and set nickname → Ready up in lobby → Host starts game → Private role / night information → Propose team → Vote → Quest → Victory check / assassination → Results → Return to lobby.

Screens need to cover mode selection, login/profile, lobby, private role information, current-phase actions, public records, and results. Specific layouts and visual design are left to later design work and are not fixed by this PRD.

### 3.1 Login and Invitations

- A WeChat identity maps to a stable player identifier. Re-entering must not create a new player who receives a second role.
- Joining is available only through WeChat share cards, with no manual room-code entry. Internal room identifiers may remain.
- A shared invitation opens the target room; after any required login, the original join flow resumes.
- Check room existence, capacity, and phase. Clearly explain when a room is full, invalid, or already in progress.
- New players cannot join after a game starts; existing participants can restore their sessions.
- Removed players may rejoin the lobby through a shared invitation. Banning is not supported.
- A nickname is required to identify players; an avatar is optional (proposal).

### 3.2 Lobby and Host

- Everyone can see the mode, player count, player list, online status, and readiness.
- The host does not need to ready up. Once all other players are ready and the player count is valid, the host starts manually.
- The server revalidates permissions, player count, readiness, and online status. Requiring everyone to be online at game start is proposed.
- The host can remove other players in the lobby, but cannot kick players during a game.
- Other players can voluntarily leave the lobby. If the host leaves, ownership passes to the next online player in seat order. An empty room closes.
- If only disconnected players remain and no online successor exists, the proposal is to retain the room until reconnection or expiry. Keep the existing expiry policy, specify it in technical design, and communicate it to users.
- Since the mode cannot change, no readiness reset after changing expansion settings is needed.

## 4. Roles, Player Counts, and Quest Configuration

### 4.1 Player Count Table

| Players | Initial Good / Evil | Team sizes for Quests 1–5 |
|---|---|---|
| 5 | 3 / 2 | 2, 3, 2, 3, 3 |
| 6 | 4 / 2 | 2, 3, 4, 3, 4 |
| 7 | 4 / 3 | 2, 3, 3, 4, 4 |
| 8 | 5 / 3 | 3, 4, 4, 5, 5 |
| 9 | 6 / 3 | 3, 4, 4, 5, 5 |
| 10 | 6 / 4 | 3, 4, 4, 5, 5 |

### 4.2 Default Roles (Proposal: Retain `shared/roles.ts`; Not Yet Individually Confirmed)

Every player count includes Merlin, Percival, Morgana, and the Assassin. Remaining Good slots are Loyal Servants of Arthur.

| Players | Additional Evil roles in Base Game | Additional Evil roles in Expansion Game |
|---|---|---|
| 5, 6 | None | Unavailable |
| 7 | Oberon | Evil Lancelot |
| 8 | Minion of Mordred | Evil Lancelot |
| 9 | Mordred | Evil Lancelot |
| 10 | Mordred, Oberon | Mordred, Evil Lancelot |

Expansion games also replace one Loyal Servant with Good Lancelot, preserving the initial allegiance counts. Lady of the Lake is a token ability and does not occupy a role slot.

The server randomly assigns roles. Public room state must not contain the full role assignment. Night information: Merlin sees the initial Evil players except Mordred; Percival sees Merlin and Morgana without knowing which is which; ordinary Evil players recognize one another but not Oberon, and Oberon does not recognize them. In early Variant #1, Evil Lancelot does not recognize other Evil players but is recognized by Evil players who participate in mutual recognition.

The proposal is to treat night information as information obtained at the start of the game. Do not redistribute everyone's role visibility after a Lancelot allegiance switch; update each Lancelot's own current allegiance. Verify this interpretation and combined-expansion details against the specified rules before implementation rather than directly retaining the existing dynamic refresh logic.

## 5. Core Game Rules — FEATURES

### 5.1 Team Proposals and Voting

- The leader rotates in seat order. Randomly selecting the first leader and allowing leaders to select themselves are proposed.
- The leader proposes a team of the required size. A rejected proposal passes leadership to the next player for a new proposal without consuming a quest round.
- Every player votes Approve or Reject. While voting is in progress, show who has voted but not their choice.
- Once everyone has voted, reveal each player's choice, vote totals, and the result.
- Approval requires more than half of the votes. A tie or a Reject majority rejects the proposal and increments the consecutive rejection count.
- After two consecutive rejections, the next leader submits a valid team that proceeds directly to the quest without another vote.
- Reset the consecutive rejection count when a team is approved or proceeds directly to a quest.
- This is the project's confirmed custom rule. Five consecutive rejections do not automatically award victory to Evil.

### 5.2 Quest Execution

- Only team members submit quest cards. Currently Good players may submit only Success; currently Evil players may submit Success or Fail.
- Show who has submitted, but not individual card choices.
- Once all cards are submitted, reveal only the Success/Fail totals and quest result. Keeping individual quest cards private even after a normal game ending is proposed.
- Quest 4 in a 7–10-player game requires at least two Fail cards to fail. Every other quest fails with one Fail card.
- A rejected team vote does not complete a quest or advance Lancelot card draws or Lady of the Lake timing.
- Making confirmed submissions final is proposed. Retransmitting the same action must not count it twice or advance the phase again.

### 5.3 Victory and Assassination

- Three failed quests: Evil wins immediately.
- Three successful quests: enter the assassination phase.
- The Assassin personally selects and confirms the target. Other Evil players may discuss in person but cannot submit on the Assassin's behalf.
- If the target is Merlin, Evil wins; otherwise, Good wins.
- If the Assassin is disconnected, wait for reconnection. If play cannot continue, the host aborts the game; do not automatically determine the assassination result.

## 6. Combined Expansion Rules

### 6.1 Lancelot: Early Variant #1

- Use five loyalty cards: three No Change and two Switch Allegiance. Shuffle at game start and draw without replacement.
- Starting with quest round 3, draw one card before team selection each round. Retrying a rejected team proposal does not draw another card.
- A switch changes both Lancelots' current allegiances simultaneously without exchanging their character identities. Zero, one, or two switches may occur.
- Quest card permissions and which side each Lancelot wins with follow their current allegiance.
- Do not mix in other editions' decks or the rule requiring Evil Lancelot to play Fail.
- Revealing the drawn loyalty card publicly without revealing who the Lancelots are is proposed. Each Lancelot privately sees their current allegiance.

### 6.2 Lady of the Lake

- At game start, give the token to the player on the first leader's right. The interface must establish a consistent seating direction.
- Inspect after Quests 2, 3, and 4 are resolved, before starting the next round.
- Only the token holder may select a target. They cannot select themselves or anyone who has previously used the Lady of the Lake ability.
- The inspector privately sees the target's allegiance at the time of inspection. For a Lancelot who has switched, reveal the current allegiance. Earlier inspection results do not update retroactively.
- Everyone sees only who inspected whom and the token transfer. The inspector may freely describe or lie about the result in person.
- The inspected player becomes the new token holder.
- Giving victory/assassination checks priority is proposed: after three failures, end the game; after three successes, enter assassination without another Lady of the Lake inspection.

Specified rule sources: [Base rulebook](https://avalon.fun/pdfs/rules.pdf) and [Early Lancelot rules](https://tesera.ru/images/items/338850/lancelot.pdf). Use these versions without mixing in the later Big Box edition. Verify the proposed ordering above before implementation.

## 7. Disconnection, Reconnection, and Aborting a Game

- Preserve disconnected players' seats, roles, state, and submitted actions. Do not skip leaders, vote or play cards on someone's behalf, or remove disconnected players from an ongoing game.
- Other players may continue when no action is required from the disconnected player. Otherwise, wait and show whose action is needed. Disconnection does not automatically award victory or defeat.
- Support reconnection with the original identity after network recovery or reopening the Mini Program. Restore public state, the player's private information, and submission status without dealing roles again.
- Treating voluntary departure during a game as disconnection is proposed, retaining the seat until the game ends or is aborted.
- After the host has been continuously disconnected for 60 seconds, transfer room management to the next online player in seat order. This does not change roles or the game leader. The returning former host does not automatically regain ownership.
- Do not transfer ownership when nobody is online. If someone subsequently reconnects and the original host's timeout has elapsed, immediately reassessing succession is proposed.
- If play cannot continue, the host confirms an abort in a second confirmation step. Display “This game has been aborted,” declare no winner, and do not automatically reveal roles.
- The first release guarantees recovery only while the server remains running and the room remains valid. After a restart or room expiry, clearly ask players to create a new room rather than suggesting the old game can still be restored.

## 8. Results and the Next Game

- A normal game ending reveals the winner, all roles, final allegiances, and each quest's result.
- An abort does not reveal roles. Private inspection results and individual quest cards are not disclosed because of an abort.
- Keep the room and remaining players; remove disconnected players when returning to the lobby.
- Having the host click “Return to Lobby” to end the results display for everyone is proposed. Before that transition, reconnecting players can retrieve the relevant results so they do not miss them immediately after the game ends.
- Other players ready up again, and the host manually starts the next game. Revalidate the current mode's player-count requirements.
- Each new game reshuffles, deals roles, and assigns the initial leader and token. Do not carry over votes, quests, private roles, inspection records, or consecutive rejection counts.
- If an expansion room drops below seven players, keep its mode and prevent starting. Do not automatically switch to Base Game.

## 9. Security, Validation, and Implementation Constraints

- The server is authoritative. Validate identity, room membership, phase, permissions, targets, player counts, and duplicate submissions. Hiding client buttons does not replace server-side checks.
- Public broadcasts must not reveal undisclosed roles, individual quest cards, or private inspections. Send private data only to authorized players.
- Old sessions, duplicate connections, and stale actions must not take over another identity or submit actions across games. The specific session replacement policy is left to implementation.
- Atomically validate readiness, online status, and player count at game start. Concurrent departures or removals must not create an invalid game.
- Preserve error handling. Authentication, transport security, and isolation of development mock login are release requirements.
- Retain Taro/React, Node/Express/ws, and shared TypeScript models and rules. Prefer simple changes and avoid unnecessary dependencies.
- See ARCHITECTURE.md for the difference between current in-memory state and the historical Redis plan. This PRD does not authorize a storage migration or new deployment.
- Screen organization, message fields, reconnection retries, and room expiry implementation belong in technical design and must not change confirmed product behavior.

## 10. Acceptance Criteria — AC

These are targets to verify, not claims that existing tests have passed.

| ID | Scenario and expected outcome |
|---|---|
| A01 | Two mode entry points create rooms with fixed modes; Base Game allows 5–10 players and Expansion Game 7–10; the server rejects invalid player counts. |
| A02 | Shared invitations complete login and join the correct lobby; new players receive clear errors for full, invalid, or ongoing rooms; existing players can recover their sessions. |
| A03 | The host does not ready up, but all other players must be ready before starting; non-host players cannot start or remove others. |
| A04 | Lobby removal, departure, and host transfer work correctly; kicking during a game is prohibited; removed players can rejoin through sharing. |
| A05 | Role counts, allegiance ratios, and private visibility are correct for every player count; public messages do not leak private information. |
| A06 | Voting shows only submission status until completion, then reveals individual choices; ties reject; after two rejections, the third proposal skips voting and resets the rejection count. |
| A07 | Quest team sizes are correct; non-members cannot submit cards; Good players cannot play Fail; only totals are revealed; Quest 4 in 7–10-player games requires two Fail cards. |
| A08 | Three failures end the game; three successes trigger assassination; only the Assassin submits; both hitting and missing Merlin produce the correct result. |
| A09 | The five-card loyalty deck and draws without replacement are correct; at most three cards are drawn in rounds 3–5; rejections do not trigger extra draws; test zero, one, and two switches. |
| A10 | Lady of the Lake timing, token transfers, exclusion of previous ability users, and private results are correct; inspecting a switched Lancelot reveals their current allegiance. |
| A11 | Disconnect and recover during team selection, voting, quest execution, inspection, and assassination; actions are neither lost nor duplicated, and no action is submitted automatically for a player. |
| A12 | Host ownership does not transfer before 60 seconds offline and transfers at the timeout; returning does not reclaim ownership; nobody is incorrectly appointed when all players are offline. |
| A13 | Aborts have no winner and do not reveal roles; normal endings reveal roles, final allegiances, and quest results; new games do not inherit previous game state. |
| A14 | Returning to the lobby removes disconnected players and requires other players to ready up again; an expansion room with six players cannot start. |
| A15 | After a server restart, show that the game is no longer valid; restoring pre-restart state is not required; duplicate, invalid, and unauthorized requests do not corrupt the game. |
| A16 | Complete Base Game and combined-expansion flows across multiple devices, including returning to the lobby and playing again; mock login does not replace real WeChat acceptance testing. |

## 11. Current Implementation Gaps and Next Steps

Based on the existing audit, the following still require implementation or verification: shared-invitation joining, two fixed modes, host readiness exemption, the early five-card loyalty deck, reconnection and timed host transfer, aborting without declaring a losing side, result recovery, and lobby cleanup. Existing protocol flows do not mean all product requirements are complete.

See [Current status](STATUS.md), [Audit report](ponytail-audit.md), [Local development](LOCAL_DEVELOPMENT.md), and [Roadmap](ROADMAP.md). The original ten-day plan in AGENTS.md remains preserved. Its room-code entry, independent expansion toggles, and five-rejection defeat rule conflict with the decisions confirmed here; future implementation should follow these decisions.

Review this document first, then split work into small issues: entry points/lobby → roles and core game loop → combined expansions → reconnection and aborts → multi-device acceptance. Validate the base game first, then each expansion's rules and their interaction, without exposing single-expansion modes to users.

Proposals still requiring review concern the retained role table, first leader and initial visibility, prioritizing game-ending checks over inspections, and who triggers the return to the lobby. Each has an implementable default and does not block this PRD draft. Verify rule sources and confirm the final document before implementation.
