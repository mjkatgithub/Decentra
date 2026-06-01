#!/usr/bin/env node
/**
 * Warn/fail when source files exceed the project line limit (default 1000).
 * Scans app/ and tests/ for .ts, .vue, .mjs
 */
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
const LIMIT = 1000
const EXTENSIONS = new Set(['.ts', '.vue', '.mjs'])
const SCAN_DIRS = ['app', 'tests']

async function walk(dir, files = []) {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue
      await walk(full, files)
    } else {
      const ext = entry.name.slice(entry.name.lastIndexOf('.'))
      if (EXTENSIONS.has(ext)) files.push(full)
    }
  }
  return files
}

const offenders = []

for (const scanDir of SCAN_DIRS) {
  const dir = join(ROOT, scanDir)
  const files = await walk(dir)
  for (const file of files) {
    const content = await readFile(file, 'utf8')
    const lines = content.split('\n').length
    if (lines > LIMIT) {
      offenders.push({ file: relative(ROOT, file), lines })
    }
  }
}

if (offenders.length === 0) {
  console.log(`OK: no files exceed ${LIMIT} lines.`)
  process.exit(0)
}

offenders.sort((left, right) => right.lines - left.lines)
console.error(`Files exceeding ${LIMIT} lines:\n`)
for (const { file, lines } of offenders) {
  console.error(`  ${file}: ${lines}`)
}
process.exit(1)
