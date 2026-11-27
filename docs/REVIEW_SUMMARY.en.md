# Avalon — Codebase Review Summary

Report date: 2026-11-26. Runtime checks performed: 2026-11-25.
Scope: the local working tree, including existing uncommitted changes. This was a review and baseline verification, not a refactoring or release-readiness task.

## 1. Local execution

- Backend started successfully on port 3100 with mock login.
- WeChat mini-program build passed. The simulator completed test login, room creation, bot filling, role reveal, and entry into the game screen.
- A separate five-client WebSocket smoke test completed three successful quests and assassination of Merlin, ending the game.
- Server tests: **61 passed, 0 failed**. Server type-check: **passed**.
- Client type-check: **failed** on existing declaration/configuration and unused-binding errors.
- H5 startup: **failed**, missing `@vitejs/plugin-legacy`.

**Qualification:** client endpoints are hardcoded to a remote server. Local UI verification used a temporary copy of generated files with HTTP/WS endpoints replaced by localhost. Repository source was unchanged. This proves local mock operation with the documented workaround, not an out-of-the-box setup. Real WeChat authentication, clean installation, multi-device UI, and production deployment were not verified. The test backend is no longer running.

## 2. Structure and dependencies

| Workspace | Responsibility | Main tools |
|---|---|---|
| `client/` | WeChat pages, game UI, HTTP/Socket client | Taro 4.2, React 18, Vite |
| `server/` | Authentication, HTTP/WS handlers, game engine, storage | Express 5, ws, dotenv, tsx, Node crypto and node:test |
| `shared/` | Types, events, role/mission rules, public-state projection | Shared TypeScript source |

Rooms and profiles use in-process Maps. Redis is **not connected**, despite the installed `ioredis` dependency. Restarting the server loses state. Ponytail development, review, and audit skills are installed at project level.

## 3. REST APIs and WebSocket events

REST endpoints reviewed: `GET /health`, `POST /api/login`, `GET /api/me`, and `GET/POST /api/profile`. Identity and profile routes require a bearer token. Local checks covered mock login, profile read/write, missing authentication, and invalid input.

WebSocket messages use `{ type, payload }` and authenticate the connection with a token.

- Client events: `create_room`, `join_room`, `leave_room`, `update_config`, `toggle_ready`, `start_game`, `propose_team`, `vote`, `quest_action`, `lady_inspect`, `assassinate`, `ping`, `debug_fill_bots`, `debug_set_roles`.
- Server events: `welcome`, `room_update`, `game_started`, `role_info`, `phase_change`, `vote_result`, `quest_result`, `lady_result`, `game_over`, `error`, `pong`.

Public room updates exclude private roles. Role information is sent individually; Lady of the Lake results go only to the inspecting player. All events were reviewed in code, but not every event was exercised through the UI.

## 4. Bugs and technical debt

Prioritized follow-up work:

1. **Security/configuration:** remove the production fallback JWT secret; replace hardcoded plaintext client endpoints with environment-specific configuration; enforce development-only mock behavior.
2. **Room correctness:** preserve the host flag when a guest leaves; reject configuration changes during games; prevent ghost membership when switching rooms; restore terminal results on reconnect.
3. **Reliability/testing:** implement client reconnect, display voting results, validate payload types strictly, repair client type-checking, and add targeted regression tests.
4. **Cleanup:** review unused `RoleConfig` UI and direct dependencies `ioredis`, `nodemon`, `ts-node`, and `lint-staged`. No removals were made.

The implemented two-rejection forced-quest rule conflicts with the original five-rejection evil-win plan. Resolve the product rule before changing code. Basic gameplay and expansions exist; their presence does not imply complete acceptance testing.

## 5. Environment configuration

Reviewed `PORT`, `MOCK_LOGIN`, `WX_APPID`, `WX_SECRET`, `JWT_SECRET`, and `TOKEN_TTL`. The local backend configuration was populated, the token lifetime was positive, and the local signing secret was not the known development default. Secret values were not published; real WeChat credentials were not validated.

`server/.env` is Git-ignored. Frontend `.env.*` files do not currently configure API endpoints. The code still permits an unsafe signing-secret fallback, and numeric configuration validation is incomplete.

## 6. Local development instructions

Verified environment: macOS, Node 24.3.0, npm 11.4.2, WeChat Devtools 2.01.2510290. Existing dependencies were used; fresh installation was not tested.

1. Install workspace dependencies with `npm install` at the repository root when needed.
2. Create `server/.env` from `server/.env.example` only if absent; set a private signing secret. Do not overwrite existing credentials.
3. Start the backend from `server/`: `MOCK_LOGIN=true PORT=3100 npm run dev`.
4. From the repository root, run `npm run build:weapp --workspace client`.
5. Follow the temporary local-endpoint copy procedure in [Local Development](LOCAL_DEVELOPMENT.md), then import that copy into WeChat Devtools without cloud services. Click P1, create a room, fill test players, and start the game. Importing the unchanged client does **not** automatically connect to the local backend.
6. Run `npm test --workspace server` and `npm run typecheck --workspace server`. Stop the backend with Ctrl+C.

## Review completion

The listed review tasks are complete with the qualifications above. This review issue can be closed once the reports are attached or committed and the unresolved findings are recorded as follow-up work. Closing the review does not mean the defects are fixed or the application is production-ready.

If the issue requires an unmodified, out-of-the-box local setup, keep that acceptance item open until frontend endpoint configuration is fixed and reverified. No GitHub issue was closed by this review.

Detailed evidence: [Status](STATUS.md), [Local Development](LOCAL_DEVELOPMENT.md), [Architecture](ARCHITECTURE.md), and [Prioritized Audit](ponytail-audit.md).
