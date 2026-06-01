# Issue documentation checklist

Copy the block below into feature issues when work might touch project
structure. Agents and developers use the same rules as
[AGENTS.md](../AGENTS.md) — **Project documentation**.

## When to update `docs/architecture.md`

Update the **relevant section only** (small diff) when the issue:

- Adds or moves a composable/util area or module boundary
- Changes where a major user flow is wired (new page, new pipeline step)
- Refactors file locations (#63-style splits) that agents would look up by path

## When docs are not needed

Note in the issue **Notes** with one line, for example:

- `Docs: N/A — bugfix in existing function, no path changes`
- `Docs: N/A — copy/i18n only`
- `Docs: N/A — test-only change`

## Snippet for GitHub issues

```markdown
## Documentation checklist
- [ ] Structural change? Update `docs/architecture.md` (relevant section only)
- [ ] If no doc change: note in **Notes**: `Docs: N/A — …`
- [ ] User-visible change logged in CHANGELOG under `[Unreleased]`
```

Main map: [architecture.md](architecture.md). Hub: [README.md](README.md).
