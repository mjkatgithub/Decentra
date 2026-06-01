# Decentra documentation

Project map for **developers** and **AI agents**: where code lives, how
major areas connect, and where to start for common tasks.

Coding standards (CCD, 1000-line limit, splits) live in
[`.cursor/rules/`](../.cursor/rules/) and [`AGENTS.md`](../AGENTS.md).
This folder answers **where** and **how things fit together**.

## Documents

| Doc | Purpose |
| --- | --- |
| [**architecture.md**](architecture.md) | Repo layout, Matrix client, chat UI, unread pipeline, spaces, settings, tests, cheat sheet |
| [**build-bundling.md**](build-bundling.md) | Production chunks, `matrix-js-sdk` size, `npm run build:chunks` |
| [**issue-documentation-checklist.md**](issue-documentation-checklist.md) | Copy into GitHub issues when work touches structure |

## For agents

When finishing an issue that changes module boundaries, file locations, or
non-obvious user flows:

1. Patch the **relevant section** in [architecture.md](architecture.md)
   (small diff — no essay).
2. Update [CHANGELOG.md](../CHANGELOG.md) and issue AC as today.
3. If no doc change is needed, add one line to issue **Notes**:
   `Docs: N/A — …`

See [AGENTS.md](../AGENTS.md) — **Project documentation**.

## For humans

- New to the repo? Skim [architecture.md](architecture.md) top to bottom,
  then use **Where to change X** for your task.
- Build / bundle questions? [build-bundling.md](build-bundling.md).
- Matrix signup / UIA details? [README.md](../README.md) — Matrix registration.
