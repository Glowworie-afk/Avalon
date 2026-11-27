# Development Roadmap

Reconstructed on 2026-11-27 from confirmed project decisions. The earlier local file was deleted before it entered Git, so this is not a byte-for-byte recovery.

| Stage | Scope | Status |
|---|---|---|
| v0.1.0 | Codebase review, PRD, contribution conventions, automated test baseline, initial CI, and agreed cleanup | Declared complete by the maintainer; final commits and release verification pending |
| v0.2.0 | Deliver the playable product described in the PRD: base mode, fixed combined-expansion mode, sharing, full game flow, and essential reconnect/abort behavior | Planned |
| v0.3.0 | Strengthen reliability and tests, multi-device verification, and containerization | Planned |
| v1.0.0 | Stable release, AWS deployment, continuous delivery, and monitoring | Planned |

Tests accompany every feature; v0.3.0 is not the starting point for testing. Use GitHub Issues and Projects with a Version field. Milestones and a long-lived develop branch are not required.

After v0.1.0, use short-lived feature branches and pull requests as described in [CONTRIBUTING.md](../CONTRIBUTING.md). Version labels identify development stages; strict Semantic Versioning automation is not required.

## Explicit follow-ups

The initial CI checks backend types, automated tests, and the WeChat build. ESLint repair/automation, client type-check cleanup, PR-trigger verification, and required checks/branch protection remain follow-ups. The original broad Issue #5 is not fully complete merely because the initial CI passes.

Do not provision AWS resources now. Candidate AWS services are not committed architecture. Complete the core product before cloud deployment; verify costs, access controls, and available credits before provisioning.

See [PRD.md](PRD.md) for product behavior, [STATUS.md](STATUS.md) for implementation evidence, and [CI.md](CI.md) for CI scope.
