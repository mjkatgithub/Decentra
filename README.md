# Decentra

Matrix-based chat client with Spaces, Categories, and Rooms.

**Status:** Alpha (v0.1.0) – Phase 2 completed, Phase 3 in planning.

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

## Build & Preview

```bash
npm run build
npm run preview
```

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

- **Fast lane:** runs on push + pull request (`test:ci:fast`).
- **Full lane:** runs nightly and optionally manual
  (`test:ci:full`).

### Required repository secrets (for full lane)

Set these in GitHub under **Settings > Secrets and variables > Actions**:

- `E2E_MATRIX_HOMESERVER` (optional, defaults to `https://matrix.org`)
- `E2E_MATRIX_USERNAME`
- `E2E_MATRIX_PASSWORD`

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

## Project Structure

```
app/
├── composables/useMatrixClient.ts   # Matrix login, sync, rooms, messages
├── pages/
│   ├── login.vue
│   ├── chat.vue
│   └── index.vue
└── components/Chat/
    ├── RoomList.vue
    ├── MessageList.vue
    └── MessageInput.vue
```

## Roadmap

- **Phase 1:** Login, Rooms, Chat, Messages
- **Phase 2:** Four-column layout (Spaces | Categories/Rooms | Chat | Members)
- **Phase 3 (current):** Voice, E2E encryption, favorites, and space grouping
- **Phase 4:** Design system and selectable themes
- **Phase 5:** Native clients (Windows, Linux, Android)

## License

This project is licensed under the GNU Affero General Public License v3.0
or later (AGPL-3.0-or-later). See `LICENSE` for details.
