import { runCucumber } from './run-cucumber-cli.mjs'

void runCucumber('not @email_signup and not @recaptcha_signup').catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
