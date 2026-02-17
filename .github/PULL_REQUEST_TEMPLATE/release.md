## Release Summary
<!-- Describe the release intent and scope -->

## Branch Flow
- Source branch: `develop`
- Target branch: `master`

## Included Work
- [ ] Milestone completed (example: Phase 3)
- [ ] Linked feature/bug PRs are merged into `develop`
- [ ] Release notes draft is prepared

## Compatibility and Risk
- Breaking changes: [ ] No [ ] Yes (describe below)
- Migration required: [ ] No [ ] Yes (describe below)
- Risk level: [ ] Low [ ] Medium [ ] High

### Breaking changes / migration notes
<!-- Add details or write N/A -->

## Validation
### Pre-release checks
- [ ] CI pipelines passed on `develop`
- [ ] Smoke tests passed
- [ ] Critical user flows validated manually

### Post-merge plan
- [ ] Verify production/staging health
- [ ] Monitor logs and error tracking
- [ ] Prepare rollback if required

## Rollback Plan
- Revert release merge commit on `master`
- Hotfix from `master` if partial rollback is needed

## Checklist
- [ ] CHANGELOG updated
- [ ] Version/tag strategy confirmed
- [ ] Stakeholder communication prepared
