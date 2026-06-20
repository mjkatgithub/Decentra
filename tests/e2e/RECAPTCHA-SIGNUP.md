# reCAPTCHA sign-up E2E (Issue 57)

## What it does

`npm run test:e2e:signup-recaptcha` starts Docker Synapse with
`enable_registration_captcha` and Google's **always-pass test keys**, seeds
users, builds Nuxt, runs the preview server, and executes Cucumber scenarios
tagged `@recaptcha_signup`.

## Prerequisites

- Docker Desktop (or compatible engine)
- Ports `8008`, `3000` free
- First run after toggling captcha overrides may need a clean
  `tests/e2e/synapse/data` (delete the folder and let
  `runtime-manage-synapse.mjs up` regenerate `homeserver.yaml`), same as
  email mode.

## Manual smoke (optional)

1. `cross-env DECENTRA_E2E_SIGNUP_RECAPTCHA=1 node tests/e2e/scripts/runtime-manage-synapse.mjs up`
2. `node tests/e2e/scripts/runtime-seed-synapse.mjs`
3. `npm run dev` (or preview on 3000)
4. Open `http://localhost:3000/signup`, homeserver `http://127.0.0.1:8008`,
   unique username/password/email.
5. Complete consent on the captcha step, then solve the v2 widget (test keys).

## Combining with email 3pid

Set **both** `DECENTRA_E2E_SIGNUP_EMAIL=1` and
`DECENTRA_E2E_SIGNUP_RECAPTCHA=1` before `runtime-manage-synapse.mjs up` to
inject captcha lines into the MailHog Synapse profile as well (custom
scenarios).
