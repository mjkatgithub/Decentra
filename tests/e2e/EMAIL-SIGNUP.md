# Email sign-up E2E (Issue 56)

## What it does

`npm run test:e2e:signup-email` starts Docker (Synapse + MailHog), seeds
test users, builds the Nuxt app, runs the preview server, and executes
Cucumber scenarios tagged `@email_signup`. Synapse is configured with
`registrations_require_3pid: email` and SMTP to MailHog.

## Prerequisites

- Docker Desktop (or compatible engine) on the host
- Ports `8008`, `8025`, `3000` free
- First run may need a clean `tests/e2e/synapse/data` if you switch
  between default and email Synapse overrides (delete the folder and let
  `runtime-manage-synapse.mjs up` regenerate `homeserver.yaml`).

## Manual smoke (optional)

1. `cross-env DECENTRA_E2E_SIGNUP_EMAIL=1 node tests/e2e/scripts/runtime-manage-synapse.mjs up`
2. `node tests/e2e/scripts/runtime-seed-synapse.mjs`
3. `npm run dev` (or preview on 3000)
4. Open `http://localhost:3000/signup`, use homeserver `http://127.0.0.1:8008`,
   a unique email, username, password.
5. Confirm the “check your email” step, then open MailHog at
   `http://127.0.0.1:8025`, use the link in the message, then finish at
   `/signup/verify-email` in the same browser session.

## Default E2E vs optional signup suites

- `npm run test:e2e` uses `cucumber-js` with
  `--tags "not @email_signup and not @recaptcha_signup"` so MailHog and
  optional captcha-heavy scenarios stay out of the default lane.
- Email flows run via `test:e2e:signup-email` or `test:e2e:run:email`
  (Synapse configured for 3pid email).
- reCAPTCHA flows run via `test:e2e:signup-recaptcha` or
  `test:e2e:run:recaptcha` (Synapse `enable_registration_captcha` with
  Google test keys); see `tests/e2e/RECAPTCHA-SIGNUP.md`.
