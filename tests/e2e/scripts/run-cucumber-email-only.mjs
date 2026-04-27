import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const workspaceRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..'
)

function run() {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(
      'npx',
      ['cucumber-js', '--tags', '@email_signup'],
      {
        cwd: workspaceRoot,
        stdio: 'inherit',
        shell: process.platform === 'win32'
      }
    )
    child.on('error', (error) => rejectPromise(error))
    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise()
        return
      }
      rejectPromise(new Error(`cucumber-js exited with code ${code ?? 1}`))
    })
  })
}

void run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
