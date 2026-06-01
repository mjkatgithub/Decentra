/**
 * Lists minified JS chunk sizes under .output/public/_nuxt after `npm run build`.
 */
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

const chunkDir = join(process.cwd(), '.output', 'public', '_nuxt')

function formatKiB(bytes) {
  return `${(bytes / 1024).toFixed(1)} kB`
}

async function main() {
  let entries
  try {
    entries = await readdir(chunkDir)
  } catch {
    console.error(
      'Missing .output/public/_nuxt — run `npm run build` first.',
    )
    process.exit(1)
  }

  const jsFiles = entries.filter((name) => name.endsWith('.js'))
  const sizes = await Promise.all(
    jsFiles.map(async (name) => {
      const filePath = join(chunkDir, name)
      const fileStat = await stat(filePath)
      return { name, bytes: fileStat.size }
    }),
  )

  sizes.sort((left, right) => right.bytes - left.bytes)

  console.log('Nuxt client chunks (.output/public/_nuxt/*.js):\n')
  for (const { name, bytes } of sizes) {
    console.log(`  ${formatKiB(bytes).padStart(12)}  ${name}`)
  }

  const totalBytes = sizes.reduce((sum, entry) => sum + entry.bytes, 0)
  console.log(`\n  ${formatKiB(totalBytes).padStart(12)}  total (${sizes.length} files)`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
