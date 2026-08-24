/**
 * 問題文の選択肢リスト（Markdownの番号付きリスト）を探す。
 *
 * 別の場所に番号ボタンを並べると、選択肢を読んでから目線を大きく動かすことになる
 * （2026-08-22の実機確認で判明）。選択肢の行そのものを押せるのが一番迷わない。
 */
export function findChoiceList(root: HTMLElement, expectedCount: number): HTMLElement | null {
  for (const ol of Array.from(root.querySelectorAll('ol'))) {
    // 解説calloutの中にも `1. ` で始まる行があるが、あれは選択肢ではない
    if (ol.closest('.callout') !== null) continue
    // 項目数が選択肢の数と一致するものだけを選択肢とみなす。
    // 一致しないリストを掴むと、押せない行や番号のずれが生まれて混乱するため。
    if (ol.querySelectorAll(':scope > li').length !== expectedCount) continue
    return ol
  }
  return null
}
