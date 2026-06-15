- Follow `.cursor/rules/clean-code-developer.mdc` (CCD): SRP, max 1000 lines
  per source file under `app/` and `tests/`, i18n one locale file per language.
- Commit messages use imperative mood.
- Prefer detailed commit messages by default.
- Use a one-line commit message for very small changes.
- Keep summary line at 50 characters maximum (hard limit).
- Keep body lines at 72 characters maximum (hard limit).
- Prefer `-` for bullet lists in commit message bodies.
- When interacting with GitHub, always use MCP tools.
- Never use the `gh` CLI for GitHub operations.
- Treat `prio1` as Project Priority `P1` in the repository's project board,
  not as a GitHub label named `prio1`.
- When diagnosing Decentra Matrix login/API failures (Failed to fetch,
  transport errors that look like CORS) that succeed on localhost but fail
  on GitHub Pages or another public origin—or the reverse—**ask promptly**
  whether **privacy or firewall-style browser extensions** (uMatrix, Brave
  Shields, ad blockers filtering XHR/fetch/script) block third-party requests
  to the homeserver; rules often **differ by site origin**.
- When implementing or finishing work on a GitHub issue, **update that
  issue** via MCP (`issue_write`): tick **Acceptance Criteria** and **Test
  Checklist** items that are done (`[x]`), leave open what is not verified.
  Add a short **Notes** line on what shipped if helpful. Do this before
  telling the user the issue is ready to merge.
- **Never close GitHub issues** via MCP (`issue_write` with `state: closed`
  or `state_reason`). Only the user closes issues, and only after the work
  is committed and merged (or they explicitly ask to close). Reopen only if
  undoing an erroneous agent close when the user requests it.
- When an issue is successfully completed, add a concise entry under
  `## [Unreleased]` in `CHANGELOG.md` (Keep a Changelog style, link the
  issue number) before telling the user the work is ready to merge.
- **CHANGELOG placement** (read the file first — do not append blindly
  under `[Unreleased]`):
  - Scan from the top until the first `## [version]` release heading
    (e.g. `## [0.1.0]`). Everything above that is `[Unreleased]`.
  - Under `[Unreleased]`, use the **existing** subsection headings only:
    `### Added`, `### Changed`, `### Deprecated`, `### Removed`,
    `### Fixed`, `### Security`. Do **not** add a second `### Fixed`
    (or any duplicate heading) inside `### Added` or elsewhere.
  - Insert each new bullet **at the top of the matching subsection**
    (immediately after its `### …` line), newest first within that block.
  - Pick the subsection by change type: new capability → Added; behavior
    change → Changed; bug/CI/test fix → Fixed; removal → Removed; etc.
  - One bullet per deliverable; link the GitHub issue
    (`[#123](https://github.com/mjkatgithub/Decentra/issues/123)`).
  - If the subsection does not exist yet under `[Unreleased]`, add it in
    Keep a Changelog order **before** the next lower section (e.g. new
    `### Fixed` after `### Changed`, not after `### Added`).

## Project documentation

- Architecture map: [docs/README.md](docs/README.md) and
  [docs/architecture.md](docs/architecture.md) (where code lives, how
  areas connect, cheat sheet). Coding standards remain in
  `.cursor/rules/` — do not duplicate CCD here.
- Before telling the user work is **merge-ready**, check whether the
  issue changed structure agents or developers would look up by path.
- **Update** [docs/architecture.md](docs/architecture.md) when the issue:
  - adds or moves module boundaries (`composables/*`, `utils/*`, pages)
  - refactors file locations (#63-style splits)
  - introduces a new user-facing flow with non-obvious wiring
- Patch **only the relevant section** (and cheat-sheet row if needed) —
  small diff, no essay per issue.
- If no doc change is needed, add one line to the issue **Notes**:
  `Docs: N/A — …` (e.g. bugfix in place, i18n-only, tests-only).
- Optional checklist for new issues:
  [docs/issue-documentation-checklist.md](docs/issue-documentation-checklist.md).

- Size vs. Estimate (solo):
  - Size (XS/S/M/L/XL): a coarse category for how much surface area the issue
    touches. Set when planning. XL = epic-scale or cross-cutting; prefer
    sub-issues over one XL deliverable.
  - Estimate (SP): expected effort + uncertainty (not just lines of code).
    Set after a short think; allow a +1 adjustment once implementation starts.
  - Use SP as a personal calibrator (no team velocity required):
    - 1 SP: clear, small change, few files, little unknown.
    - 2 SP: a focused block with some tests/manual checks.
    - 3 SP: multi-step work or noticeably uncertain.
    - 5+ SP: consider splitting into smaller issues.
  - Optional solo time orientation (not a rule — calibrate against your
    own completed issues; adjust when reality diverges):
    - 1 SP: about 1–2 hours of focused work.
    - 2 SP: about half a day.
    - 3 SP: about one day.
    - 5 SP: about two or more days — strong signal to split.
