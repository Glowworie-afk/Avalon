# Current Development Status

Reconstructed on 2026-11-27 from saved test outputs and confirmed work. The previous untracked file was deleted and could not be restored from Git. This document separates verified engineering work from pending product behavior.

## Engineering baseline

- Node 24.3.0 with npm workspaces and a root lockfile.
- Node test runner with TypeScript loading through tsx; isolated test credentials.
- GitHub CI runs dependency installation, backend types, unit/integration tests, and the WeChat build on main pushes and PRs.
- The published pre-cleanup baseline passed on GitHub: https://github.com/Glowworie-afk/Avalon/actions/runs/45800692644 .
- The cleanup working tree passed a fresh installation, 73 tests, backend type checking, and WeChat compilation. It includes previously uncommitted rule tests, so this count differs from the earlier 57-test committed baseline.

## Cleanup included in v0.1.0

- Preserve the host flag when a guest leaves; regression test added.
- Share extension eligibility rules and retain existing gameplay regression tests.
- Configure a single backend origin and derive HTTP/WS endpoints; require HTTPS for production builds.
- Reuse private-role visibility in the deal screen and identity panel; extract game results.
- Remove unused RoleConfig UI and four direct dependencies without upgrading retained packages.
- Preserve historical documents and provide current setup, architecture, and project instructions.

## Product and security work remaining

The PRD is a target, not a description of completed behavior. Fixed dual modes, the early five-card Lancelot variant, reconnect/abort lifecycle, timed host transfer, and next-game cleanup need implementation or verification. Existing gameplay must not be treated as full PRD acceptance.

Known follow-ups include runtime payload validation, active-game configuration changes, cross-room membership, overlapping connections, terminal-result replay, and production signing-secret enforcement. A clean test suite does not prove these are fixed.

Client lint and full type checking remain outside the initial CI gate. Real WeChat authentication, physical-device UI, full manual acceptance, load testing, production TLS/domain setup, and deployment are not certified by the build. CI uses a non-routable origin only to compile the frontend.

## References

- [Local development](LOCAL_DEVELOPMENT.md)
- [Testing baseline](TESTING.md)
- [CI](CI.md)
- [Architecture](ARCHITECTURE.md)
- [Roadmap](ROADMAP.md)
- [Historical audit](ponytail-audit.md)
