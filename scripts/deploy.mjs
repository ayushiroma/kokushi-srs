import { copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_DIR = 'G:\\マイドライブ\\000_My Obsidian\\.obsidian\\plugins\\kokushi-srs'
const dest = process.env.KOKUSHI_VAULT_PLUGIN_DIR ?? DEFAULT_DIR

await mkdir(dest, { recursive: true })
for (const f of ['main.js', 'manifest.json', 'styles.css']) {
  await copyFile(f, path.join(dest, f))
  console.log(`copied ${f} -> ${dest}`)
}
