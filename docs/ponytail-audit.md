What this repo does: Avalon is a Taro/React WeChat game client with an Express/WebSocket server and shared TypeScript game rules. It supports lobbies, private roles, quests, assassination, and expansions. This review assumes one server process and several simultaneous rooms of 5–10 players; it does not assume a large distributed deployment.

Reviewed 2026-11-25: Desktop checkout at HEAD `9166177f0b9b8fa35431841af868642926814dfb`, including existing uncommitted changes. No application code was changed. References are relative to the repository root.

**Must fix**

1. **[P1] Production can use a publicly known signing secret** (`server/config.ts:28`, `server/.env.example`).
   - **What this is:** JWT signatures prove which player a request belongs to.
   - **Problem:** Missing `JWT_SECRET` silently selects the development secret even outside mock mode; the example also sets that value. A deployment using it permits forged player identities.
   - **Fix:** Require a nonempty, non-default secret outside explicit development mode and test startup rejection. Preserve timing-safe signature comparison.
   - **If we skip it:** A misconfigured public deployment can expose private identities and allow impersonation. The live deployment's secret was not inspected.

2. **[P1] Client credentials and private roles travel over plaintext** (`client/src/utils/request.ts:13`, `client/src/utils/socket.ts:15`).
   - **What this is:** The client hardcodes an HTTP and WS endpoint on a public IP address.
   - **Problem:** Bearer tokens, profile data, and game messages lack transport encryption on these connections.
   - **Fix:** Configure one deployment origin and derive HTTPS/WSS endpoints; use a TLS endpoint for production and explicit local overrides for development.
   - **If we skip it:** Network observers can read or alter game traffic and steal tokens. No requests were made to that public server during this audit.

3. **[P1] A guest leaving removes the host's controls** (`server/ws/index.ts:534`, `client/src/pages/room/index.tsx:117`).
   - **What this is:** `removePlayer` reseats remaining players and manages host flags.
   - **Problem:** It clears every `isHost` and restores a flag only when the departing player was the host. A normal guest departure leaves the original host with `isHost=false`, hiding host controls.
   - **Fix:** After resolving host ownership, derive each player's flag from `room.hostOpenid`. Add a guest-leaves regression case alongside the existing host-leaves test.
   - **If we skip it:** Ordinary lobby departures can block starting the game. Confirmed with an isolated in-process handler probe.

4. **[P1] Host can change rules after cards are dealt** (`server/ws/index.ts:278`).
   - **What this is:** UPDATE_CONFIG updates player count and expansion flags.
   - **Problem:** It checks host identity but not waiting status. A five-player active game accepts `playerCount:10`, changing mission sizes and leader rotation without adding players; enabling Lady midgame leaves its holder uninitialized.
   - **Fix:** Reject changes unless the room is waiting, before mutation. Add active/finished-game rejection tests.
   - **If we skip it:** A host can corrupt or stall an active match. The five-to-ten-player mutation was confirmed with an isolated handler probe.

5. **[P1] Switching rooms leaves a ghost player behind** (`server/ws/index.ts:192`, `server/ws/index.ts:213`).
   - **What this is:** CREATE_ROOM and JOIN_ROOM set the socket's current room.
   - **Problem:** Neither removes or rejects an existing different-room membership. Creating room B while in A leaves a connected seat in A that no longer receives its broadcasts or votes there.
   - **Fix:** Require explicit leave before switching rooms; allow same-room reconnect. Test create-after-join and cross-room join.
   - **If we skip it:** Rooms fill with unavailable players and games can wait indefinitely. Confirmed with an isolated handler probe.

6. **[P1] Rejoining a finished game loses the result** (`server/ws/index.ts:234`, `server/ws/index.ts:334`, `shared/types.ts:84`, `client/src/pages/room/index.tsx:157`).
   - **What this is:** GAME_OVER carries the winner, reason, and revealed roles as a transient event.
   - **Problem:** The stored game does not retain the winner/reason, and rejoin sends only room and private-role updates. The client renders a finished room without its local `gameOver` value as a lobby.
   - **Fix:** Store the terminal result once and replay it to reconnecting members; test reconnect after assassination and forced termination.
   - **If we skip it:** A player disconnected during the final event cannot recover the outcome.

7. **[P2] Wire values are coerced into unintended votes** (`server/ws/index.ts:420`, `server/ws/index.ts:446`, `server/ws/index.ts:72`).
   - **What this is:** WebSocket JSON is cast to TypeScript payload types without corresponding runtime checks.
   - **Problem:** `approve:"false"` becomes an approval and `fail:"false"` becomes a failure for an evil player; missing payloads silently become negative votes/success cards. Truthy strings also pass expansion normalization.
   - **Fix:** Validate the envelope and required field types before dispatch or mutation using small direct checks. Add malformed-payload cases and ensure rejection leaves state unchanged.
   - **If we skip it:** Broken or modified clients can submit actions different from what their payload says.

8. **[P2] Room page ignores public voting results** (`server/ws/index.ts:358`, `client/src/pages/room/index.tsx:65`).
   - **What this is:** VOTE_RESULT reveals each player's vote after everyone has voted.
   - **Problem:** The server sends it, but the room page has no handler or UI state for it. Players see the next phase without learning who approved or rejected the team.
   - **Fix:** Retain and show the resolved vote result; add a client test for one completed vote. Keep in-progress votes private.
   - **If we skip it:** Players lose public evidence needed for the deduction game.

**Should fix**

9. **[P2] Reconnect and multiple connections lack a consistent lifecycle** (`client/src/utils/socket.ts:23`, `server/ws/index.ts:505`).
   - **What this is:** The client shares one socket; the server tracks presence per player.
   - **Problem:** Client close only clears the socket, with no retry/rejoin. Two connections for one identity are allowed, and closing either marks that player offline even if the other is alive. `ensureSocket` can also return a socket before onOpen.
   - **Fix:** Share the pending connection promise, rejoin after a successful reconnect, and define one-active-connection ownership or count active connections before marking offline. Test disconnect/reconnect and overlapping sessions.
   - **If we skip it:** Locking a phone can strand a game; presence can be wrong. Client auto-reconnect is already marked as Day 9 work, so treat it as an unfinished planned feature, not a new architectural requirement.

10. **[P2] Authentication and client failure paths lack tests** (`server/utils/token.ts:52`, `server/http/login.ts`, `server/http/profile.ts`, `client/src/utils/`, `server/test/`).
    - **What this is:** Existing tests focus on engine rules, stores, room codes, and valid-token WebSocket flows.
    - **Problem:** There are no focused token/auth HTTP or client tests. The token verifier accepts expiry equal to the current second and does not validate a nonempty string subject or header; these boundaries lack regression coverage.
    - **Fix:** Test tampering, malformed claims, exact expiry, invalid/missing bearer tokens, login failures, and client reconnect/result handling. Validate token fields explicitly while keeping the existing signature check.
    - **If we skip it:** Authentication and recovery regressions can pass the current green suite. Malformed signed claims alone are not a demonstrated signature bypass.

11. **[P2] The roadmap and implemented rejection rule disagree** (`shared/missions.ts:9`, `server/game/engine.ts:130`, `docs/Day4-任务循环上说明.md:26`).
    - **What this is:** The supplied project roadmap and Day 4 document require evil victory after five rejected teams.
    - **Problem:** Current code, UI, and tests deliberately implement forced quest departure after two rejections. Redis is likewise planned in the roadmap while storage documentation explicitly chooses an in-memory MVP.
    - **Fix:** Resolve and document the accepted rule/storage decisions before changing them. If the roadmap remains binding, align implementation and tests in a separately authorized task.
    - **If we skip it:** Green tests can certify behavior different from the written product requirements. This is a requirements conflict, not permission to overwrite existing work. Memory state is lost on restart and is limited to one process; no Redis migration is proposed here.

12. **[P2] Unused role-config UI duplicates the live create page** (`client/src/components/RoleConfig/index.tsx:36`, `client/src/components/RoleConfig/index.scss`, `client/src/pages/create/index.tsx`).
    - **What this is:** A standalone RoleConfig component repeats role grouping and extension controls now implemented directly in the create page.
    - **Problem:** Repository-wide searches found no imports, dynamic references, or render calls; only documentation mentions it. Its TSX and styles total 220 lines, yet recent work still updates the unused copy.
    - **Fix:** Once the current uncommitted edits are resolved, remove the unused component/styles and correct their documentation references. Do not add another wrapper to unify an unused UI.
    - **If we skip it:** Future rule/UI fixes can be made in a component users never see.

13. **[P2] Unused tooling dependencies remain installed** (`server/package.json:20`, `server/package.json:27`, `client/package.json:71`).
    - **What this is:** Manifests include `ioredis`, `nodemon`, `ts-node`, and `lint-staged`.
    - **Problem:** Source, scripts, hooks, and configuration searches found no usage beyond manifest/lockfile entries. Server commands use tsx; no lint-staged configuration or invocation exists; storage is a Map.
    - **Fix:** Remove these four direct declarations and regenerate the workspace lockfile only in an approved cleanup task, then rerun checks. Re-add Redis support when implementing it. Transitive copies may remain.
    - **If we skip it:** Installs retain unnecessary direct dependencies. Taro platform packages were not labeled unused: named build scripts can activate them dynamically.

14. **[P2] Client type-checking currently fails** (`client/tsconfig.json`, `client/config/index.ts`).
    - **What this is:** The client has a TypeScript configuration but no typecheck script.
    - **Problem:** Running its installed compiler with `--noEmit -p client/tsconfig.json` exits 2 with missing Node type declarations, Taro declaration errors, and unused bindings. Server type-checking does not cover this surface.
    - **Fix:** Repair the client type configuration and source diagnostics, then expose the verified command as a script. Do not add React Native runtime packages merely to silence unrelated declaration errors.
    - **If we skip it:** The project has no clean client type-check baseline for future changes. These diagnostics predate this documentation-only integration.

**Nice to have**

15. **[P3] Base64url conversion reimplements Node's Buffer API** (`server/utils/token.ts:18`, `server/utils/token.ts:26`).
    - **What this is:** Two helpers replace characters and calculate padding for JWT encoding.
    - **Problem:** This maintenance surface duplicates native Buffer base64url support in the Node runtime used here.
    - **Fix:** After adding token boundary tests, use `Buffer.toString('base64url')` and `Buffer.from(value, 'base64url')` with explicit malformed-input checks where required. No JWT dependency or new abstraction is needed.
    - **If we skip it:** Current valid-token behavior still works, but conversion logic remains unnecessarily bespoke.

## Verification and scope

- Existing server suite: **61 passed, 0 failed** with local socket access. The first sandboxed attempt stalled at integration tests; the successful run used elevated local socket access.
- `npm run typecheck --workspace server`: passed.
- `client/node_modules/.bin/tsc --noEmit -p client/tsconfig.json`: failed with existing configuration/declaration and unused-binding errors (finding 14). No client build or device test was run.
- A temporary in-process probe exercised the real WebSocket handlers with fake transports and confirmed findings 3–5. It used isolated memory and a test secret, not a live server. No regression tests or application edits were added to the repository.
- Read server HTTP/auth/store/WebSocket/debug-bot/engine paths, shared rules/types/protocol, client utilities/pages/components, build configuration, dependency declarations, and test coverage. Searches for unused code included documentation and configuration, excluding dependencies, generated output, and Git internals.
- The public-view projection and private ROLE_INFO/LADY_RESULT routing have meaningful existing tests. Keep them. The shared rules package and engine/network separation serve real callers; no additional service layer or generalized abstraction is warranted. The debug callback context is not a proven removal opportunity merely because it has one implementation.
- No deployment manifest or CI workflow was present in the inspected repository. No speculative scale redesign is proposed.

Verdict: Fix signing/transport exposure and room-state defects first; keep cleanup separate from behavior fixes.

Lean: **-220 lines, -4 direct dependencies possible** from the unused component/styles and manifest entries alone; these are opportunities, not changes made.

Not checked: live WeChat login, public server settings, production TLS, real-device UI, stress/load behavior, package vulnerability advisories, and every styling/asset file. This is a code audit, not a production penetration test.
