# Continuous Integration

## Initial scope

The initial pipeline in `.github/workflows/ci.yml` runs on pushes to `main`, pull requests targeting `main`, and manual dispatch. It uses Node 24.3.0 from `.nvmrc` on an Ubuntu runner, a single validation job, read-only repository permissions, and commit-pinned official checkout/setup-node actions. Superseded runs on the same ref are cancelled.

Steps run in order and fail immediately on errors:

```bash
HUSKY=0 npm ci --no-audit --no-fund
npm run typecheck --workspace server
npm test --workspace server
npm run build:weapp --workspace client
```

The root `package-lock.json` controls workspace installation and the npm download cache key. Do not run independent installs from `client/` or `server/` in CI. Dependency declarations and versions were preserved. The root lockfile was repaired to include missing SWC and Taro optional native packages for other platforms, after Ubuntu builds exposed macOS-only lock records. `HUSKY=0` disables local Git-hook installation in CI; it does not skip package build scripts. Audit output is excluded from the installation step, not treated as a security audit pass.

Tests use the isolated configuration documented in [TESTING.md](TESTING.md). No real WeChat secrets, Redis service, AWS credentials, or deployment permissions are required. The backend runs through `tsx`; its type check serves as its compilation check, with no additional bundling introduced.

Official action references: [checkout](https://github.com/actions/checkout), [setup-node](https://github.com/actions/setup-node).

## Verification on 2026-11-26

Validated an archive of committed `main` after merging `docs/english-prd`, without carrying over unrelated working-tree changes or existing `node_modules`:

- Fresh `npm ci`: passed, 1,261 packages installed, no lockfile edits.
- Backend type checking: passed.
- Unit and integration tests: 57 passed, 0 failed.
- WeChat build: passed, with existing Sass deprecation warnings.
- Failure probe: a temporary deliberately failing test made `npm test` exit nonzero; the probe was removed and was not added to the repository.
- Workflow YAML, triggers, permissions, and absence of ignored failures: checked locally.

The local checks above ran on macOS with Node 24.3.0/npm 11.4.2. After publication, the [Ubuntu CI run](https://github.com/Glowworie-afk/Avalon/actions/runs/45800464785) passed installation, backend types, tests, and the WeChat build on commit `1b1a9f6`. Earlier failed runs correctly stopped on missing native binaries; the lockfile repair resolved them. Push triggering and GitHub-hosted success/failure reporting are verified. PR triggering is configured but has not yet been exercised. Issue #5 remains open for its deferred scope.

## Deliberately deferred checks

- **ESLint:** the existing client configuration extends `taro/react`; no lint script exists. A clean-install probe fails before linting because `@ungap/structured-clone` cannot be resolved. Repair the lint dependency/configuration baseline separately, then add a failing-on-error CI step.
- **Prettier:** no project configuration was found. Do not introduce repository-wide formatting as part of this pipeline.
- **Client type checking:** existing Node/Taro declaration errors and unused bindings remain. The frontend build is not a substitute for a clean type check. Fix these separately before adding the gate.
- **Branch protection:** deferred until the transition to branch/PR development after v0.1.0. During direct development, failed CI reports a problem after the push; it does not prevent code from entering `main`.
- **Backend bundling and deployment:** not needed for the current `tsx` runtime; CI does not deploy.

The original Issue #5 checklist is broader than this agreed minimal first stage. Lint automation, branch protection, and actual GitHub success/failure verification must remain explicitly deferred or pending, not marked complete.

## Publishing and remote verification

1. Review the complete local commits ahead of `origin/main`, not just the workflow diff.
2. Publish the intended commits and workflow after authorization.
3. Confirm the `CI` workflow runs on GitHub and all steps pass on Ubuntu.
4. Verify PR updates trigger a run using a temporary validation branch. Put any deliberate failure probe only on that branch, confirm failure, then remove it and confirm success. Never merge the probe.
5. After adopting PR-based development, configure the observed validation check as required and test that it blocks a failing PR.

The README badge now reports the published workflow's `main` status. The publishing steps above remain a reference for future verification; PR-trigger verification and branch protection are still pending.
