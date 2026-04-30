# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- reCAPTCHA UIA stage (`m.login.recaptcha`) in signup with consent-gated
  script load and optional iubenda hooks (#57)
- Optional Synapse-backed E2E for registration captcha (`@recaptcha_signup`);
  see `tests/e2e/RECAPTCHA-SIGNUP.md`
- Dedicated GitHub Bug issue template at `.github/ISSUE_TEMPLATE/bug.md`
  with `bug/<bugfix>` branch guidance and bug-focused planning/test sections
- MVP signup page with Matrix registration and user-facing error feedback (#52)
- Chat image messages with inline preview and lightbox support
- E2EE image sending support from chat input
- Media utilities for encrypted media fetch, decrypt, cache, and revoke flows
- Unit and integration test coverage for media utilities and image timelines
- Four-column chat layout with responsive sidebars and mobile overlays
- Space rail with compact/expanded modes and create-space stub route
- Account settings page and space settings base page
- Member list with presence badges (online, away, offline, unknown)
- Presence selector in account settings with homeserver capability check
- Theme preference composable with explicit localStorage persistence
- App i18n composable with English/German locale persistence
- SVG favicon and global head registration
- Message timeline event notices for join/leave/profile and room metadata changes
- Message replies with Matrix `m.in_reply_to` relation payload support
- Reply mode in chat composer with preview and explicit cancel action
- Message interaction bar component for hover/focus actions
- E2E env template and loader for credential-based login scenarios
- Smoke-tagged E2E scenarios and dedicated smoke test script
- GitHub Actions CI workflow with fast and full test lanes
- Synapse-backed E2E orchestration script (`test:e2e`) with startup, seeding,
  execution, and teardown flow
- Local Synapse runtime scripts for env loading, server lifecycle management,
  and deterministic test seeding
- Synapse Docker Compose setup under `tests/e2e/synapse` for local and CI runs
- Executable chat E2E scenarios for E2EE fallback continuity, image rendering
  and lightbox behavior, plus reply and missing-origin fallback handling
- Executable chat E2E presence scenarios for standard member states
  (online, away, offline) with sidebar status-dot verification
- Message reactions with add/remove support, grouped emoji counters, and
  incremental live updates in timeline rendering
- Advanced reaction emoji picker with category tabs, shortcode conversion
  (for example `:wave:` to `👋`), and user-scoped frequent emojis
- Additional reaction coverage in unit and E2E tests for Matrix toggle logic,
  aggregation mapping, and message-level reaction UI behavior
- Session restore gating with explicit startup lifecycle state and completion
  helpers in `useMatrixClient`
- Global startup loading modal shown while Matrix session restore is in progress
- Global auth middleware for protected routes with restore-aware redirect checks
- Unit coverage for restore-state transitions and global auth middleware
- Root landing page on `/` with hero content, feature cards, and a download
  call-to-action placeholder
- Dedicated landing logo background assets (`logoBg.svg`) for the root route
- Unit tests for root-page restore and redirect behavior in
  `tests/unit/pages/index.spec.ts`
- Onboarding panel on empty chat state with entry points for starting a
  direct message, creating a group room, and exploring public rooms (#59)
- Direct message start panel with user-id input, user directory search,
  and shareable `matrix.to` links for the own account and invited users
- Public room discovery panel with homeserver directory search and
  distinct loading, empty, and error states
- Dedicated room creation page at `/rooms/new` for single group rooms
  with visibility and topic controls
- Matrix client wrappers for direct-message lookup and reuse via
  `m.direct` account data, group room creation, id/alias joining,
  public room directory search, and user directory search
- Unit coverage for the new Matrix client wrappers, the room creation
  page, and the `/rooms` auth middleware protection
- Matrix email sign-up (UIA): pending state in session storage, dedicated
  registration helpers, two-step `/signup` with an email-confirmation step,
  `/signup/verify-email` auto-finalize page, and matching i18n keys (#56)
- E2E stack: MailHog beside Synapse in `tests/e2e/synapse` Docker Compose,
  optional `DECENTRA_E2E_SIGNUP_EMAIL` homeserver overrides (3pid email +
  SMTP to MailHog), Cucumber scenarios tagged `@email_signup`, helper
  runners to exclude that tag in default E2E, `test:e2e:signup-email` full
  pipeline script, and `tests/e2e/EMAIL-SIGNUP.md` notes
- Extended Matrix signup UIA (#58): `m.login.registration_token`
  (including `*.login.registration_token` ids), `m.login.terms` with
  `SignupTermsStep.vue`, shortest completable email-flow selection, chained
  pre-email stages on `/signup` and `/signup/verify-email`
- User-facing SSO-only registration hint (`SIGNUP_SSO_USE_WEB_CLIENT`)
  and explicit SMS signup non-support (`SIGNUP_MSISDN_NOT_SUPPORTED`)
  (#58)
- Additional unit coverage for registration UIA helpers and signup pages
  (`matrixRegistrationUia.spec.ts`, page specs)

### Changed

- Direct message resolution now consults `m.direct` account data before
  falling back to two-member heuristics for existing rooms
- Global auth middleware now also protects the `/rooms` route prefix

- Chat timeline now opens with a bounded initial message window to reduce
  startup scroll depth and perceived room-load latency
- Login page now shows a post-signup success banner (#52)
- Chat history loading switched from button-based pagination to bidirectional
  infinite scroll with guarded top/bottom sentinel triggers
- Initial message viewport now centers around the user's last-read event when
  newer messages exist, and otherwise starts at the bottom
- Matrix attachment encryption now uses unpadded base64 for IV and hashes
- Image sending flow now checks room encryption before creating media events
- Space navigation now separates icon-button interaction from text-click area
- Room navigation supports home categories for personal/unassigned rooms
- Chat shell styling refined with distinct visual background accents
- Read receipts now show smaller avatars on each reader's last-read message
- README: CI/E2E credential setup; Matrix registration (UIA) section and
  signup-related structure paths; phased roadmap bullets removed—priorities
  in GitHub Issues; status line shortened
- Message list rendering was modularized with a dedicated `ChatMessageItem`
  component and reusable `ChatMessageActionBar`
- Full CI lane now runs E2E against local Dockerized Synapse instead of
  requiring repository Matrix credential secrets
- Default `test:e2e:run` Cucumber invocation now skips `@email_signup`
  scenarios; use `test:e2e:run:email` or `test:e2e:signup-email` for the
  MailHog-backed email registration path
- Synapse-specific E2E step definitions were consolidated into existing
  `login.steps.mjs` and `chat.steps.mjs`
- Synapse environment validation moved from scenario-level Given setup into
  hook-based prechecks for seeded-room scenarios
- Message action bar now uses icon-only reply/reaction controls with compact
  gray styling and native button tooltips
- Chat page media helper logic was moved into `useChatMedia` to reduce page
  size and improve composable reuse
- Root route startup behavior now waits for restore completion before login/chat
  navigation decisions
- Root route now keeps restore-aware `watchEffect` gating while rendering
  landing content for unauthenticated users
- Landing copy and i18n keys were aligned with the finalized Issue-41 hero and
  feature text
- Landing background logo loading now uses a bundler URL import to avoid
  runtime path resolution issues

### Fixed

- Space-to-room parent mapping now uses Matrix `m.space.parent` state
- Space avatar resolution now supports Matrix mxc avatar URLs with fallback
- Homeserver base URL normalization now upgrades public http to https to avoid
  redirect-driven CORS failures in the browser (#52)
- CI install issues from unused `@nuxt/test-utils` setup were resolved
- Synapse compose configuration no longer contains duplicate `services` blocks
  that broke Docker parsing
- Seeded image events now include upload-backed media URLs so image preview and
  lightbox assertions can pass reliably
- Protected route redirects now avoid startup auth flicker by waiting for
  session restore and sending unauthenticated users to `/`
- E2EE decryption regressions after login/session changes were fixed by
  reusing remembered Matrix `device_id` for the same account and homeserver
  while preventing reuse across different homeservers

## [0.1.0] - 2025-02-13

### Added

- Matrix-based chat client (Spaces, Categories, Rooms)
- Login page with Matrix authentication
- Chat page with room list, message list, and input field
- Matrix client composable (login, sync, rooms, messages, pagination)
- Nuxt UI + Tailwind CSS, Dark Mode as default
- Unit tests (Vitest, Chai)
- Integration tests (Nuxt Test Utils)
- E2E tests (Cucumber + Playwright)
- Configurable headless/headed mode for E2E tests

### Technical

- Nuxt 4, Vue 3, matrix-js-sdk
- Components: ChatRoomList, ChatMessageList, ChatMessageInput

[Unreleased]: https://github.com/mjkatgithub/Decentra/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/mjkatgithub/Decentra/releases/tag/v0.1.0
