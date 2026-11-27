# Contributing to Avalon

Avalon is a learning and portfolio project. Explain significant technical decisions before implementation, including the problem, the smallest practical solution, and its tradeoffs. Discuss large refactors, game-rule changes, and storage migrations before making them. An audit finding alone does not authorize a fix.

## 1. Development Workflow

Track each task in a GitHub Issue with its purpose, scope, and acceptance criteria. Use GitHub Projects and its `Version` field to organize development stages; milestones are optional. See the [roadmap](docs/ROADMAP.md) for stage goals.

Before editing, read the project instructions, inspect `git status`, and review existing changes. Preserve unrelated and uncommitted work. Do not discard, overwrite, automatically stash, or include someone else's changes in your commit.

### During v0.1.0

Direct development on `main` is allowed. Feature branches and pull requests are not required during this stage.

1. Make one focused change.
2. Run checks relevant to that change.
3. Review the diff and stage only the intended files.
4. Create a small commit with a clear English message.
5. Push to GitHub when ready to share or back up the work.

Do not wait until the entire stage is complete to commit. Avoid rewriting shared history; fix mistakes with a new commit or use `git revert` when appropriate. Existing branch work must be reviewed and safely integrated before continuing on `main`.

### After v0.1.0: GitHub Flow

1. Start from an up-to-date `main` with a clean working tree, or safely isolate existing work first.
2. Create a short-lived branch for one task.
3. Implement, validate, and commit focused changes.
4. Push the branch and open a pull request targeting `main`.
5. Review the changes and check results, then merge.
6. Delete the merged task branch.

Keep `main` buildable and testable. Do not introduce a long-lived `develop` branch. After this transition, use pull requests for documentation as well as application changes.

## 2. Branch Naming

Once branch-based development begins, use `<type>/<short-description>` with lowercase English words separated by hyphens.

| Prefix | Purpose | Example |
|---|---|---|
| `feat/` | New functionality | `feat/wechat-room-invite` |
| `fix/` | Bug fixes | `fix/host-transfer` |
| `docs/` | Documentation | `docs/local-development` |
| `refactor/` | Internal changes without intended behavior changes | `refactor/room-validation` |
| `test/` | Tests | `test/lancelot-switching` |
| `ci/` | CI configuration | `ci/github-actions` |
| `chore/` | Other maintenance | `chore/update-dependencies` |

An issue number is optional, for example `feat/42-wechat-room-invite`.

## 3. Commit Messages

Use Conventional Commits with concise English descriptions:

```text
type(scope): description
```

The scope is optional. Common types are `feat`, `fix`, `docs`, `refactor`, `test`, `ci`, and `chore`.

```text
feat(lobby): support WeChat share invitations
fix(game): reject duplicate quest submissions
docs: document local development setup
test(game): cover tied team votes
ci: run backend checks on pull requests
```

Each commit should express one coherent change. Avoid vague messages such as `update code`. For an actual breaking change, use `!` after the type or scope and explain the incompatibility in the commit body. Commit types do not automatically trigger a release.

## 4. Pull Requests and Merging

These conventions apply after v0.1.0, or earlier when a pull request is voluntarily used.

- Keep each PR focused on one task and use an English Conventional Commit title.
- Describe the problem, resulting behavior, checks actually performed, and known limitations.
- Link the relevant issue. Use `Closes #42` only when the PR completes the issue; use `Refs #42` for partial work.
- Review the full diff before merging. For solo development, self-review is acceptable; a separate reviewer is not mandatory.
- Resolve relevant check failures before merging, and explicitly document unrelated existing failures or checks not run.
- Prefer **Squash and merge**, using the PR title as the final commit subject.
- Delete the source branch after merging.

When introducing the PR workflow, add `.github/pull_request_template.md` with these sections: Summary, Related Issue, Changes, Validation, Risks or Limitations, and Checklist. This document describes the convention; it does not mean the template or GitHub merge settings already exist.

## 5. Validation and CI

See the [testing baseline](docs/TESTING.md) for test setup, coverage commands, verified results, and known gaps.

Run checks appropriate to the change from the repository root:

```bash
npm test --workspace server
npm run typecheck --workspace server
AVALON_API_ORIGIN=https://ci.invalid npm run build:weapp --workspace client
```

See the [README](README.md) and [local development guide](docs/LOCAL_DEVELOPMENT.md) for setup and known client-check limitations. Report actual results; do not claim that unrun checks passed. Separate existing failures from regressions introduced by the change.

Add meaningful tests alongside behavior changes. Prioritize reconnection, private-role boundaries, host transfer, invalid operations, and terminal-state recovery. For documentation-only changes, inspect content, links, and formatting; application tests are not required.

The initial workflow and its verification limits are documented in [CI.md](docs/CI.md). The CI policy is:

- During v0.1.0, run automated checks on pushes to `main` once CI is configured.
- After adopting PRs, run checks when a PR is opened or updated, and on pushes to `main`.
- Configure required checks and main-branch protection when introducing the PR workflow.

A Git commit does not run tests automatically unless hooks are configured. The workflow is published and push-triggered execution has passed on GitHub; see CI.md for evidence and remaining checks. Required checks and branch protection remain separate tasks for the transition to PR-based development.

## 6. Implementation Principles

Follow KISS, YAGNI, and DRY. Reuse existing code and platform capabilities before adding dependencies. Avoid speculative abstractions, interfaces, and configuration.

Preserve existing functionality, authorization, validation, error handling, and private-information boundaries. Inspect callers before changing shared behavior. Product behavior is defined in the [PRD](docs/PRD.md).

Use the project-local Ponytail skill in full mode by default; see the [Ponytail setup guide](docs/ponytail-setup.md). Audits and reviews produce findings without modifying application code unless fixes are explicitly requested.

## 7. Secrets, Infrastructure, and Automation

Keep real secrets in untracked local configuration or a secure runtime environment. Never commit credentials or `.env` secrets.

Do not provision AWS resources during the current phase. Follow the roadmap for containerization, deployment, continuous delivery, and monitoring. Before provisioning, verify available allowances, budgets, and least-privilege access.

AI assistants must not commit, push, or modify remote project boards unless the current task authorizes the corresponding action. Authorization to commit does not automatically authorize a push.
