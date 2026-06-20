import { runCucumber } from './run-cucumber-cli.mjs'

void runCucumber('@smoke').catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
