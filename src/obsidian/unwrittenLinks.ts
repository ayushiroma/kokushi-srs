import { TFile } from 'obsidian'
import { isKokushiNote } from '../core/vaultPaths'
import type KokushiPlugin from '../main'

/**
 * 本体がまだ無い `[[リンク]]` を、押せない普通の文字にする。
 *
 * 問題の「関連知識」は `tags:` をそのままリンクにして作ったので、
 * 1,675問中1,116問（67%）が、本体の無いリンクを含んでいる
 * （2026-08-16に「1回しか出てこないタグは知識ノートを作らない」と決めたため）。
 * Obsidianは本体の無いリンクを押すと**その名前のノートを新規作成する**ので、
 * 解いている途中で押すたびに、設定 `newFileLocation` の場所（既定はVaultのルート）に
 * 空ファイルが増えていく（2026-08-23のあゆさんの報告）。
 *
 * 問題ファイル1,675件は書き換えない。描画時に差し替えるだけにしておけば、
 * あとでその知識ノートを書いた時点で、何もしなくてもリンクに戻る。
 */
export function registerUnwrittenLinkGuard(plugin: KokushiPlugin): void {
  plugin.registerMarkdownPostProcessor((el, ctx) => {
    // 国試対策の外（daily note・メモなど）では、押して新規作成できるほうが便利なので触らない
    if (!isKokushiNote(ctx.sourcePath)) return

    for (const link of Array.from(el.querySelectorAll('a.internal-link'))) {
      // Obsidianはリンク先を data-href に入れる。href は表示用で崩れることがある
      const target = link.getAttribute('data-href') ?? link.getAttribute('href') ?? ''
      if (target === '') continue

      // 解決できるかは自分で確かめる。`is-unresolved` クラスは
      // Obsidian側の処理順に依存するので当てにしない
      const dest = plugin.app.metadataCache.getFirstLinkpathDest(target, ctx.sourcePath)
      if (dest instanceof TFile) continue

      const plain = createSpan({
        cls: 'kokushi-unwritten',
        text: link.textContent ?? target,
      })
      plain.setAttribute('title', 'この知識ノートはまだありません')
      link.replaceWith(plain)
    }
  })
}
