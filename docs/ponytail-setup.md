# Ponytail in Avalon

Configured on 2026-11-25 in `/Users/jiaxuan/Desktop/Projects/Avalon`.

## Installation and compatibility

The [official installation guide](https://github.com/DietrichGebert/ponytail/blob/v5.3.3/INSTALL.md) supports both a Codex plugin and standalone skills. [Codex documentation](https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills) supports repository-local `.agents/skills` and an `AGENTS.md` for project instructions.

This Codex session already exposed the Ponytail 5.3.3 plugin skills. Node v24.3.0 and Python 3.11.9 are present. The integration uses standalone Markdown skills; no application dependencies, hooks, background services, global configuration, or app permissions were added. Plugin lifecycle-hook trust and activation were not tested or changed.

Installed three upstream skills, unchanged, from release v5.3.3, pinned to Git revision `7801d061243d7b753bad0e0b3c057cd250b11755`:

- `.agents/skills/ponytail/SKILL.md`: development guidance and lite/full/ultra modes.
- `.agents/skills/ponytail-audit/SKILL.md`: whole-repository audit, report only.
- `.agents/skills/ponytail-review/SKILL.md`: review a change, report only.

The Codex skill-installer downloaded these paths using its `--dest` option. Only the three workflows needed for development and review were installed. No Skills CLI npm package was required. `.agents/skills/PONYTAIL-LICENSE` retains the upstream MIT license.

There was no AGENTS.md, CLAUDE.md, `.agents`, or `.codex` configuration in this checkout before installation. The chat workspace at `/Users/jiaxuan/Claude/Projects/Avalon` contained the ten-day roadmap. That AGENTS.md was copied verbatim as the prefix of this checkout's new AGENTS.md, then a short Ponytail section was appended. The source workspace files remain unchanged. Existing application edits, package manifests, lockfiles, and test files were preserved.

## Use during development

Open the **Desktop checkout** in Codex; the separate Claude workspace is not this Git repository. The local skills should be available on the next turn in a chat rooted in this checkout. If they do not appear, restart Codex. Local and already-installed plugin skills with the same name may both appear; select the entry whose path starts with this repository's `.agents/skills`. Codex does not merge duplicate names.

Examples to paste into Codex:

- `Use the project-local ponytail skill in full mode. Implement <task> with the smallest complete change and preserve validation and security.`
- `Use the project-local ponytail skill in lite mode for <task>.`
- `Use the project-local ponytail skill in ultra mode for <task>.`
- `Use the project-local ponytail-audit skill. Audit this repository and report findings without changing application code.`
- `Use the project-local ponytail-review skill. Review my uncommitted changes without modifying them.`

In CLI/IDE skill selectors, `$ponytail`, `$ponytail-audit`, and `$ponytail-review` can explicitly invoke skills. Upstream also documents slash-command forms, but this instruction-only installation does not register executable commands or persistent hook state. Say `stop ponytail` or `normal mode` to end the session mode; Avalon project requirements still apply.

The project defaults to full mode for coding tasks. KISS means the simplest complete solution, YAGNI means no speculative features, and DRY means reusing existing rules and helpers. They never justify weakening authentication, private-role projection, server validation, error handling, or tests. A report is not authorization to refactor: request a specific finding to be fixed in a later task.

For application changes, run `npm test --workspace server` and `npm run typecheck --workspace server` from the repo root; use relevant client checks for client changes. Audit results and current limitations are in [Ponytail audit](./ponytail-audit.md).

## Updating or removing

Updates are deliberate: inspect a new upstream release and diff these three skill directories before replacing them. Keep the revision and license current here. Do not run upstream setup scripts or overwrite AGENTS.md wholesale.

To remove this project integration, delete only these three skill directories, their license, and the appended Ponytail section of AGENTS.md. Keep the original roadmap. The previously installed global plugin is independent and remains unchanged.
