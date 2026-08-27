import { execFileSync } from 'node:child_process'
import { readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { zipSync } from 'fflate'

const PART = process.argv[2] ?? 'patch'
if (!['patch', 'minor', 'major'].includes(PART)) {
  console.error('使い方: node scripts/release.mjs [patch|minor|major]')
  process.exit(1)
}

// src/core/version.ts の bumpVersion と同じロジックをここに複製している。
// このスクリプトは素のNodeで動かす（ts-node等のビルド設定を増やしたくない）ため、
// TypeScript側から直接importできない。ロジックを変えるときは両方直す。
function bumpVersion(version, part) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)
  if (!match) throw new Error(`不正なバージョン文字列です: ${version}`)
  const major = Number(match[1])
  const minor = Number(match[2])
  const patch = Number(match[3])
  if (part === 'major') return `${major + 1}.0.0`
  if (part === 'minor') return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}

async function collectFiles(baseDir, relPrefix, out) {
  const entries = await readdir(baseDir, { withFileTypes: true })
  for (const entry of entries) {
    const abs = path.join(baseDir, entry.name)
    const rel = relPrefix === '' ? entry.name : `${relPrefix}/${entry.name}`
    if (entry.isDirectory()) {
      await collectFiles(abs, rel, out)
    } else if (entry.isFile()) {
      out[rel] = new Uint8Array(await readFile(abs))
    }
  }
}

async function main() {
  console.log('1/6 問題データを検査しています…')
  // 壊れたデータをリリースしないための関所。落ちたらここで止まる。
  // 検査の中身は scripts/extract/vault_check.py を参照。
  execFileSync('py', ['-3', path.join(import.meta.dirname, 'extract/vault_check.py')], {
    stdio: 'inherit',
    env: { ...process.env, PYTHONUTF8: '1' },
  })

  console.log('2/6 プラグインをビルドしています…')
  execFileSync('npm', ['run', 'build'], { stdio: 'inherit', shell: true })

  console.log('3/6 バージョンを上げています…')
  const manifest = JSON.parse(await readFile('manifest.json', 'utf-8'))
  const pkg = JSON.parse(await readFile('package.json', 'utf-8'))
  const newVersion = bumpVersion(manifest.version, PART)
  manifest.version = newVersion
  pkg.version = newVersion
  await writeFile('manifest.json', `${JSON.stringify(manifest, null, 2)}\n`)
  await writeFile('package.json', `${JSON.stringify(pkg, null, 2)}\n`)
  console.log(`   v${newVersion} に更新しました`)

  console.log('4/6 問題データをZIP化しています…')
  const vaultDir = process.env.KOKUSHI_VAULT_DIR ?? 'G:\\マイドライブ\\000_My Obsidian\\国試対策\\データ'
  try {
    await stat(vaultDir)
  } catch {
    throw new Error(`Vaultの中身フォルダが見つかりません: ${vaultDir}（環境変数 KOKUSHI_VAULT_DIR で指定できます）`)
  }
  const files = {}
  await collectFiles(path.join(vaultDir, '問題'), '問題', files)
  await collectFiles(path.join(vaultDir, '知識ノート'), '知識ノート', files)
  // 図（グラフのSVG）も必ず入れる。問題ノートが ![[〜.svg]] で埋め込んでいるので、
  // これを落とすと自動更新した友達の画面でグラフが表示されなくなる。
  // 2026-08-27まで入れ忘れており、初回配布ZIPにしか入っていなかった。
  await collectFiles(path.join(vaultDir, '図'), '図', files)
  // _config.json は vaultDir（Vault内の「データ」フォルダ）の1つ上の階層にある
  // （src/obsidian/config.ts の CONFIG_PATH = '国試対策/_config.json' と同じ階層）
  files['_config.json'] = new Uint8Array(await readFile(path.join(vaultDir, '..', '_config.json')))
  const zipped = zipSync(files)
  await writeFile('data.zip', zipped)
  console.log(`   data.zip を作成しました（${Object.keys(files).length}ファイル）`)

  console.log('5/6 GitHub Releaseを作成しています…')
  try {
    execFileSync(
      'gh',
      [
        'release',
        'create',
        `v${newVersion}`,
        'main.js',
        'manifest.json',
        'styles.css',
        'data.zip',
        '--title',
        `v${newVersion}`,
        '--notes',
        `v${newVersion} の更新`,
      ],
      { stdio: 'inherit' }
    )
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(
        'gh コマンドが見つかりません。GitHub CLI (https://cli.github.com/) をインストールし、`gh auth login` でログインしてから再実行してください。'
      )
    }
    throw error
  }

  console.log('6/6 友達に渡す配布ZIPを作っています…')
  // リリースと配布ZIPは同じ材料から作らないとズレる。
  // 2026-08-27に「リリースだけ新しくて配布ZIPが古い」が実際に起きたので、
  // 必ずここで一緒に作る。検査とビルドは済んでいるので飛ばす。
  execFileSync('node', [path.join(import.meta.dirname, 'package.mjs'), '--skip-check'], { stdio: 'inherit' })

  await rm('data.zip')

  console.log(`完了しました: v${newVersion}`)
}

main().catch((error) => {
  console.error(error.message ?? error)
  process.exit(1)
})
