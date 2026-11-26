# Automated Testing Baseline

Reviewed on 2026-11-26 for Issue #4. This baseline verifies existing behavior, not completion of every requirement in the newer PRD.

## Framework and commands

The server uses Node's built-in `node:test` runner and `node:assert/strict`, with `tsx` loading TypeScript. No new testing dependency was added. Verified runtime: Node 24.3.0. Use Node 24 for the documented commands; older runtimes may lack the coverage filters or timeout options.

From the repository root, after installing workspace dependencies:

```bash
npm test --workspace server
npm run test:coverage --workspace server
npm run typecheck --workspace server
```

To run only the new authentication and HTTP tests:

```bash
cd server
node --require ./test/setup.cjs --import tsx --test --test-timeout=15000 test/token.test.ts test/http.test.ts test/ws-auth.test.ts
```

Tests preload explicit mock login, a test-only signing secret, a fixed token lifetime, and fake WeChat credentials. They do not need a personal `.env`, Redis, a running application server, or a real WeChat account. REST and WebSocket tests open temporary local ports; the runtime must permit local socket access. Real WeChat responses are stubbed. Test files are isolated by Node's runner; tests that mutate configuration or mock globals remain sequential within their file and restore their changes.

## Reviewed coverage

| Area | Existing coverage and additions |
|---|---|
| Shared rules | Role counts, role metadata, quest team sizes, failure thresholds, expansion availability |
| Game engine | Role assignment, private/public projections, team proposal authorization, voting, quest resolution, assassination, and expansion behavior |
| Stores and room codes | Room save/read/delete and collision retry behavior |
| REST integration (added) | Real Express login/profile routers and authentication middleware over HTTP; missing login code; mock identity; profile authentication, validation, normalization, and cross-user isolation; stubbed WeChat success, rejection, and network failure |
| Token unit tests (added) | Identity round trip, tampering, malformed tokens, exact expiry, invalid subjects, and unsupported headers |
| WebSocket integration | Real clients and server handlers for lobby membership, capacity, host permissions, readiness, game start, private roles, team proposals, and inspection routing; added missing/invalid-token connection rejection |

The HTTP tests mount production routers and middleware, not a reimplementation. They do not boot `server/index.ts`; `/health`, `/api/me`, and startup wiring are not covered by this new HTTP harness. The client has no automated test script or component test suite. Builds and manual Mini Program checks are not counted as automated behavior tests.

## Results

Two baselines were verified to avoid confusing pre-existing uncommitted work with this change:

| Snapshot | Tests | Failures | Line / branch / function coverage |
|---|---:|---:|---|
| Existing working tree before this task | 61 | 0 | Not collected |
| Working tree with this task | 70 | 0 | 87.19% / 83.11% / 92.62% |
| Isolated HEAD snapshot plus only this task's changes | 57 | 0 | 85.16% / 81.94% / 91.79% |

Backend type checking passed for both final snapshots. The isolated snapshot reused installed dependencies with workspace imports redirected to its own shared sources; this was not a fresh-install verification. The difference in test counts comes from pre-existing uncommitted tests, which were preserved and excluded from this commit.

Nine new tests were added. Two initially failed and exposed token validation defects: tokens were accepted at the exact expiry second, and signed claims with invalid subjects could be accepted. A narrow verifier fix now rejects those cases and unsupported JWT headers while retaining signature verification. No gameplay implementation was refactored.

See [coverage output](testing-coverage.txt) for the isolated snapshot's generated report. Native coverage measures loaded modules only, excludes tests and dependencies, and does not establish whole-repository or client coverage. Unloaded entry points are absent rather than counted as zero. With TypeScript loaded through `tsx`, native V8 coverage and source locations should be treated as diagnostics, not a precise quality score. No arbitrary coverage gate is introduced.

## Conventions

- Put server unit and integration tests in `server/test/*.test.ts`; `npm test` discovers all of them.
- Test observable outcomes, authorization, privacy, and state transitions rather than implementation details.
- Cover successful operations, rejection paths, and relevant boundaries. Assert rejected operations do not alter state where applicable.
- Use local ephemeral ports, bounded waits, deterministic time mocking for expiry, and cleanup hooks for servers and mocks.
- Fix the underlying defect when a valid regression test fails. Do not weaken assertions just to make the suite pass.
- Keep new PRD behavior separate from existing-behavior tests. Add its tests when implementing the feature.
- Run relevant tests during development and the full suite before completing a task. Record actual results and limitations.

## Remaining work outside this baseline

Known product/security defects remain follow-up work: lobby host flags after guest departure, active-game configuration changes, cross-room ghost membership, wire-value validation, overlapping connections, and terminal-result replay. The previous audit documents these concerns; a green suite does not certify their absence. Add regression tests alongside each fix.

New PRD features such as fixed dual modes, host readiness exemption, the five-card Lancelot deck, timed host transfer, and abort-without-winner need feature-specific tests during implementation. Existing tests are not proof of compliance with that future behavior.

Client automation, real-device/real-WeChat validation, load tests, startup/health/me integration, production signing-secret enforcement, and TLS verification remain outside this change. Debug-bot paths have relatively low coverage and are not a release-quality assurance substitute. CI configuration belongs to Issue #5.

## Short English summary

Establish a dependency-free testing baseline with isolated test configuration, REST and WebSocket authentication coverage, token boundary regression tests, and native coverage reporting. Fix token expiry and claim validation. All tests and backend type checks pass in both the current working tree and an isolated commit snapshot.
