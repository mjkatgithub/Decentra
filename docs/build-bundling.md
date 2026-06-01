# Build bundling and chunk sizes

Decentra is a Matrix web client; `matrix-js-sdk` and Rust crypto WASM
dominate the production bundle. This document explains what to expect
from `npm run build`, how chunks are split, and why dev can feel slower
than preview/production.

## Dev vs production

| Mode | Command | Notes |
|------|---------|--------|
| Development | `npm run dev` | Unminified modules, HMR, no aggressive chunking — larger and more requests. |
| Production | `npm run build` + `npm run preview` | Minified, tree-shaken, manual vendor chunks — closer to deploy/GitHub Pages. |
| Static export | `npm run generate` | Same client bundle as `build` for static hosting. |

Production often feels smoother than dev even when total JS bytes are
similar, because the browser loads fewer, optimized files.

## Vite “chunks larger than 500 kB” warning

After `npm run build`, Vite may warn that some chunks exceed 500 kB.
For Matrix clients this is **expected**: `matrix-js-sdk` alone is on the
order of **~1 MB minified** (before gzip). Splitting into dedicated chunks
does **not** reduce how much JS the app must download on first load; it
improves **cacheability** (app code can redeploy without invalidating the
SDK chunk) and makes bundle inspection clearer.

Configuration lives in [`nuxt.config.ts`](../nuxt.config.ts):

- `matrix-js-sdk` → chunk `matrix-js-sdk`
- `@matrix-org/matrix-sdk-crypto-wasm` → chunk `matrix-crypto-wasm`

Output file names are still content-hashed (e.g. `uwvG9rjQ.js`); use
`npm run build:chunks` or the build log to inspect sizes.

## Measured baseline (issue #62)

Recorded on Windows, Nuxt 4.3.1, `matrix-js-sdk` ^37.5.0.

### Before `manualChunks`

| Asset (build log) | Minified | Gzip (Vite) |
|-------------------|----------|-------------|
| Single largest JS (`D2bpsiS2.js`) | **1,476 kB** | 420 kB |
| Next largest (`Ch2C0R-s.js`) | 259 kB | 71 kB |
| `matrix_sdk_crypto_wasm_bg.*.wasm` | 5,399 kB | 1,796 kB |

Vite warned about chunks &gt; 500 kB (the ~1.5 MB bundle).

### After `manualChunks`

| Role (logical chunk) | Minified (build log) | Gzip (Vite) |
|----------------------|----------------------|-------------|
| `matrix-js-sdk` (hashed `uwvG9rjQ.js`) | **957 kB** | 263 kB |
| `matrix-crypto-wasm` + related (`CUKWLU_I.js`) | **479 kB** | 157 kB |
| App / other vendors (`BOt9W6Ew.js`, etc.) | ≤ 259 kB each | — |
| WASM (unchanged) | 5,399 kB | 1,796 kB |

**First-load JS total** (all `.js` under `.output/public/_nuxt`): ~1,955 kB
before and after — **no meaningful byte reduction**, but the Matrix SDK
is no longer merged into one anonymous megachunk. Two chunks still exceed
500 kB (SDK + crypto path); that is acceptable for this stack.

### Route-level code splitting

Nuxt already emits per-route chunks (e.g. `chat`). `useMatrixClient()` is
used from [`app/app.vue`](../app/app.vue) and auth middleware, so
`matrix-js-sdk` still loads on the landing page for session restore.
Deferring the SDK to `/chat` only would be a **runtime** change (see
issue #103), not bundling alone.

## Icons (no runtime CDN fetch)

`@iconify-json/lucide` is a **devDependency** bundled locally. Nuxt Icon
uses `serverBundleMode: local` so Lucide icons are not fetched from
Iconify CDN at runtime.

## How to reproduce measurements

```bash
npm run build
npm run build:chunks
```

Optional treemap:

```bash
npx nuxi analyze
```

For Network-tab first load: `npm run preview`, open DevTools → Network,
disable cache, load `/`, `/login`, and `/chat` (logged in). Compare
request count and transferred JS; expect similar totals, separate SDK
files after splitting.

## Known build warnings (follow-up)

Non-fatal noise during `npm run build` (Tailwind sourcemap plugin message,
Node `DEP0155` from transitive `@iconify` / `@vueuse` exports) is tracked in
[#120](https://github.com/mjkatgithub/Decentra/issues/120). They do not fail
the build and are unrelated to Matrix chunk sizes.

## Related issues

- [#62](https://github.com/mjkatgithub/Decentra/issues/62) — this bundling work
- [#120](https://github.com/mjkatgithub/Decentra/issues/120) — build warning cleanup
- [#63](https://github.com/mjkatgithub/Decentra/issues/63) — source file size limits
- [#103](https://github.com/mjkatgithub/Decentra/issues/103) — chat runtime performance
