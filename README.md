# Decentra

Matrix-based chat client with Spaces, Categories, and Rooms.

**Status:** Alpha (v0.1.0) – MVP Phase 1. Full four-column layout follows in Phase 2.

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

# E2E with visible browser
npm run test:e2e:headed

# Install Playwright browser (one-time)
npm run prepare:e2e
```

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

- **Phase 1 (current):** Login, Rooms, Chat, Messages
- **Phase 2:** Four-column layout (Spaces | Categories/Rooms | Chat | Members)
- **Phase 3+:** Voice, E2E encryption, Design system, Native clients

## License

[Add license here]
