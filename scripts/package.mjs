// 友達に最初に渡す「Vault丸ごとZIP」を作る。
//
// **入れるものを列挙する方式（ホワイトリスト）にしてある。**
// 除外リスト方式だと、Vaultに新しいファイルが増えたとき勝手に混ざる。
// 配布物に個人データが1回でも混ざったら取り返しがつかないので、
// 「知っているものだけ入れる」に倒している。
//
//   npm run package
//
// 完成物: G:\マイドライブ\010_プロダクト開発\040_国試対策\配布\YYYYMMDD_国試対策.zip
import { execFileSync } from 'node:child_process'
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { zipSync } from 'fflate'

const VAULT = process.env.KOKUSHI_VAULT_ROOT ?? 'G:/マイドライブ/000_My Obsidian'
const OUT_DIR = process.env.KOKUSHI_DIST_DIR ?? 'G:/マイドライブ/010_プロダクト開発/040_国試対策/配布'
const REPO = path.resolve(import.meta.dirname, '..')
const SKIP_CHECK = process.argv.includes('--skip-check')

// Vaultから入れるファイル（単体）
const FILES = [
  '.obsidian/app.json',
  '.obsidian/core-plugins.json',
  '.obsidian/community-plugins.json',
  '国試対策/ホーム.md',
  '国試対策/_config.json',
]
// Vaultから入れるフォルダ（配下ぜんぶ）
const DIRS = ['国試対策/メニュー', '国試対策/データ/問題', '国試対策/データ/知識ノート', '国試対策/データ/図']
// リポジトリのビルド成果物から入れるもの（Vault側ではなくビルドが正）
const PLUGIN = ['main.js', 'manifest.json', 'styles.css']

// 配布物に絶対に入ってはいけないもの。作ったあとに必ず検査する
const FORBIDDEN = [
  { name: '解答ログ', test: (n) => n.includes('_記録') },
  { name: 'プラグインの個人設定', test: (n) => n.endsWith('plugins/kokushi-srs/data.json') },
  { name: '端末ごとの画面状態', test: (n) => n.endsWith('workspace.json') || n.endsWith('workspace-mobile.json') },
  { name: 'daily note', test: (n) => n.includes('daily note') },
]

async function collect(baseDir, relPrefix, out) {
  for (const entry of await readdir(baseDir, { withFileTypes: true })) {
    const abs = path.join(baseDir, entry.name)
    const rel = `${relPrefix}/${entry.name}`
    if (entry.isDirectory()) await collect(abs, rel, out)
    else if (entry.isFile()) out[rel] = new Uint8Array(await readFile(abs))
  }
}

async function main() {
  if (!SKIP_CHECK) {
    console.log('1/4 問題データを検査しています…')
    execFileSync('py', ['-3', path.join(REPO, 'scripts/extract/vault_check.py')], {
      stdio: 'inherit',
      env: { ...process.env, PYTHONUTF8: '1' },
    })
  } else {
    console.log('1/4 検査をスキップしました（--skip-check）')
  }

  console.log('2/4 プラグインをビルドしています…')
  execFileSync('npm', ['run', 'build'], { stdio: 'inherit', shell: true, cwd: REPO })

  console.log('3/4 Vaultをまとめています…')
  const files = {}
  for (const rel of FILES) {
    files[rel] = new Uint8Array(await readFile(path.join(VAULT, rel)))
  }
  for (const rel of DIRS) {
    await collect(path.join(VAULT, rel), rel, files)
  }
  for (const name of PLUGIN) {
    files[`.obsidian/plugins/kokushi-srs/${name}`] = new Uint8Array(await readFile(path.join(REPO, name)))
  }

  // 入ってはいけないものが混ざっていないか
  const leaked = []
  for (const name of Object.keys(files)) {
    for (const rule of FORBIDDEN) {
      if (rule.test(name)) leaked.push(`${rule.name}: ${name}`)
    }
  }
  if (leaked.length > 0) {
    throw new Error(`配布してはいけないファイルが混ざっています:\n  ${leaked.join('\n  ')}`)
  }

  console.log('4/4 ZIPを書き出しています…')
  const manifest = JSON.parse(await readFile(path.join(REPO, 'manifest.json'), 'utf-8'))
  const now = process.env.KOKUSHI_DATE ?? new Date().toISOString().slice(0, 10).replaceAll('-', '')
  await mkdir(OUT_DIR, { recursive: true })
  const outPath = path.join(OUT_DIR, `${now}_国試対策.zip`)
  await writeFile(outPath, zipSync(files))
  const size = (await stat(outPath)).size

  const count = (prefix) => Object.keys(files).filter((n) => n.startsWith(prefix)).length
  console.log('')
  console.log(`完了しました: ${outPath}`)
  console.log(`  プラグイン v${manifest.version}`)
  console.log(`  問題 ${count('国試対策/データ/問題/')}件 / 知識ノート ${count('国試対策/データ/知識ノート/')}件 / 図 ${count('国試対策/データ/図/')}件`)
  console.log(`  合計 ${Object.keys(files).length}ファイル・${(size / 1024 / 1024).toFixed(1)}MB`)
  console.log('')
  console.log('  友達の手順: Obsidianを入れる → 解凍 → フォルダを開く → 制限モードをオフ')
}

main().catch((error) => {
  console.error(error.message ?? error)
  process.exit(1)
})
