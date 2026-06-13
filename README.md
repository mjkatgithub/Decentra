# Decentra

Matrix-based chat client with Spaces, Categories, and Rooms.

**Status:** Alpha (v0.1.0). Priorities follow GitHub Issues for this repo.

## Tech Stack

- **Framework:** Nuxt 4, Vue 3
- **Matrix:** matrix-js-sdk
- **UI:** Nuxt UI, Tailwind CSS (Dark Mode default)
- **Tests:** Vitest (Unit/Integration), Cucumber + Playwright (E2E)

## Prerequisites

- Node.js 20+
- Matrix account (e.g. matrix.org)

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Optional debug logging (console vs. remote)

By default, Decentra logs debug traces only to the **browser console**.
You can optionally forward those traces to a remote ingest endpoint by
setting environment variables (recommended via a local untracked file):

```bash
cp .env.example .env.local
```

Then set one or more of:

- `NUXT_PUBLIC_DEBUG_LOG_INGEST_URL` (enables remote logging)
- `NUXT_PUBLIC_DEBUG_LOG_SESSION_ID` (optional)
- `NUXT_PUBLIC_DEBUG_LOG_SESSION_HEADER` (optional, e.g. `X-Debug-Session-Id`)

## Build & Preview

```bash
npm run build
npm run preview
```

Production bundles are larger than dev because of `matrix-js-sdk`
(~1 MB+ minified). Vite may warn about chunks &gt; 500 kB — that is
normal for Matrix clients. See [docs/build-bundling.md](docs/build-bundling.md)
for chunk splitting, baseline sizes, and `npm run build:chunks`.

## Tests

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests (builds app, starts server, runs Cucumber)
npm run test:e2e

# E2E smoke tests only (@smoke-tagged scenarios)
npm run test:e2e:smoke

# E2E with visible browser
npm run test:e2e:headed

# Coverage (currently from unit Vitest config)
npm run test:coverage

# CI fast lane (unit + integration + e2e smoke)
npm run test:ci:fast

# CI full lane (unit + integration + coverage + full e2e)
npm run test:ci:full

# Install Playwright browser (one-time)
npm run prepare:e2e
```

### E2E Credentials

For credential-based E2E scenarios, create a local env file:

```bash
cp tests/e2e/.env.e2e.example tests/e2e/.env.e2e.local
```

Then fill `E2E_MATRIX_USERNAME` and `E2E_MATRIX_PASSWORD`.
The local file stays untracked.

## GitHub Actions CI

This repo uses `.github/workflows/ci.yml` with two lanes:

- **Fast lane:** runs on push to non-`master` branches (feature branches,
  `develop`); runs `test:ci:fast` (unit + integration + E2E smoke).
- **Full lane:** runs on every pull request (targets `develop` or
  `master`), push to `master`, nightly schedule, and manual dispatch with
  `run_full: true`; runs `test:ci:full` (integration + coverage + full
  Synapse E2E via Docker).

### E2E credentials (full lane)

The full lane starts a local Synapse stack in Docker and writes
`tests/e2e/.env.e2e.generated` during seeding — **no GitHub secrets are
required** for the default CI full-lane path.

For optional scenarios against an external homeserver (e.g. matrix.org),
set repository secrets under **Settings > Secrets and variables > Actions**:

- `E2E_MATRIX_HOMESERVER` (optional, defaults to `https://matrix.org`)
- `E2E_MATRIX_USERNAME`
- `E2E_MATRIX_PASSWORD`

For local credential-based runs, copy `tests/e2e/.env.e2e.example` to
`tests/e2e/.env.e2e.local` and fill in username/password (see above).

### How to run manually

1. Open your repository on GitHub.
2. Go to **Actions**.
3. Select workflow **CI**.
4. Click **Run workflow**.
5. Set `run_full` to `true` if you want the full lane.

### Note on Nuxt test-utils

`@nuxt/test-utils` is intentionally not part of the current test runtime.
In our current dependency set, it caused peer dependency conflicts in CI while
its Nuxt runtime helpers were not actively used by our tests.
We can reintroduce it later when we add dedicated Nuxt runtime integration
tests (`setupTest()`, plugin/runtime integration, Nitro route tests).

## Project structure

High-level layout: `app/` (Nuxt pages, composables, components, utils),
`tests/` (unit, integration, e2e), `.cursor/rules/` (CCD and workflow).

**Architecture and where to change things:**
[docs/architecture.md](docs/architecture.md) — Matrix client, chat UI,
unread pipeline, spaces/sidebar, settings, tests, cheat sheet.
[docs/README.md](docs/README.md) links all project docs.

## Matrix registration (UIA)

Signup uses Matrix **User-Interactive Authentication** against
`/register`: first request may return **401** with `session`, `flows`,
and `params`; the client keeps the session and completes stages in order.

**Delegated auth (MAS / OAuth — e.g. matrix.org)**

If `/.well-known/matrix/client` includes `org.matrix.msc2965.authentication`,
the homeserver typically **blocks legacy `POST /register`** for web clients but
delegates new-account creation (and related flows) to a Matrix Authentication
  Service (OAuth/OIDC).

- Set **`NUXT_PUBLIC_SITE_URL`** to your app's public **`https://` origin**
  **without path** (Matrix dynamic client registration rejects `http://localhost`
  redirects; use an HTTPS tunnel / preview URL for local OAuth).
- Optional **`NUXT_PUBLIC_MATRIX_OIDC_CLIENT_ID`** — static OAuth client id if you
  register one yourself.
- Redirect/callback **`/auth/matrix-oidc/callback`** completes the PKCE exchange,
  restores the Matrix JS SDK session (`matrixOidcNative.ts`, `useMatrixClient`).

**Supported stages today (legacy `/register` UIA)**

| Stage | Notes |
| --- | --- |
| `m.login.email.identity` | Email verification link; continuation on `/signup/verify-email` |
| `m.login.recaptcha` | reCAPTCHA v2/v3 from homeserver params |
| `m.login.registration_token` | Opaque token; unstable ids ending in `.login.registration_token` treated the same |
| `m.login.terms` | Policy links from `params`; user accepts before continuing |
| `m.login.dummy` | Included in finalize loop when required by the server |

**Explicit non-support**

- **`m.login.sso`** as an in-flow stage **after `/register` already returned UIA**
  (`session` + flows) — not wired in-app; where MSC2965 is advertised, prefer
  the **delegated OAuth** button on the **sign-up** page instead.
- **`m.login.msisdn`** – Phone/SMS registration is not implemented; users get
  a clear “not supported” message instead of failing silently.

When several flows include email verification, Decentra picks a **shortest**
flow whose stages are all supported.

**Locations:** `matrixRegistrationUia.ts` (logic), `signup.vue` /
`signup/verify-email.vue` + `SignupTermsStep.vue` (UI).  
**Regression tests:** `npm run test:unit` (see `tests/unit/composables/matrixRegistrationUia.spec.ts`
and signup page specs).

## License

This project is licensed under the GNU Affero General Public License v3.0
or later (AGPL-3.0-or-later). See `LICENSE` for details.
