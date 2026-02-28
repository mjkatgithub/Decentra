---
name: Bug
about: Plan and track a bug fix slice
title: "Bug: "
labels: ["type:bug"]
assignees: []
---

## Goal
<!-- One short statement of the user-visible bug impact -->

## Scope
<!-- In scope:
- Bug source analysis
- Code fix
- Required test updates
-->

## Branch
`bug/<bugfix>`

## Bug Details
### Current Behavior
<!-- What happens today? -->

### Expected Behavior
<!-- What should happen instead? -->

### Steps to Reproduce
1. ...
2. ...
3. ...

## Acceptance Criteria
- [ ] Root cause is identified and fixed.
- [ ] Behavior matches expected result in affected flow.
- [ ] No regression is introduced in related flow.

## Test Checklist
### Unit
- [ ] Add or update unit tests for the bug scenario.

### Integration
- [ ] Add or update integration tests if cross-component behavior changed.

### E2E
- [ ] Add or update E2E coverage when user flow is affected.

### Manual
- [ ] Reproduce bug on current main/develop baseline.
- [ ] Verify fix with same repro steps after patch.

## Notes
<!-- Optional context, links, decisions -->
