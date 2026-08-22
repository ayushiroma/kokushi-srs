import { Notice, Plugin } from 'obsidian'
import { registerAnswerBlock } from './obsidian/answerBlock'
import { earliestExamDate, loadConfig } from './obsidian/config'
import { registerHomeBlock } from './obsidian/homeBlock'
import { registerKnowledgeMapBlock } from './obsidian/knowledgeMapBlock'
import { registerListBlock } from './obsidian/listBlock'
import { LogStore } from './obsidian/logStore'
import { openInPreview } from './obsidian/openInPreview'
import { indexQuestions } from './obsidian/questionIndex'
import { registerTodayBlock } from './obsidian/todayBlock'
import { registerWeaknessBlock } from './obsidian/weaknessBlock'

export default class KokushiPlugin extends Plugin {
  logStore!: LogStore

  override async onload(): Promise<void> {
    this.logStore = new LogStore(this.app)
    registerAnswerBlock(this)
    registerHomeBlock(this)
    registerTodayBlock(this)
    registerListBlock(this)
    registerWeaknessBlock(this)
    registerKnowledgeMapBlock(this)

    // 左端のリボンから必ずホームへ帰れるようにする。
    // ファイルツリーに1,675件並ぶVaultでは、これが唯一の確実な入口になる。
    this.addRibbonIcon('graduation-cap', '国試対策', () => {
      void openInPreview(this.app, '国試対策/ホーム')
    })

    this.addCommand({
      id: 'kokushi-open-home',
      name: 'ホームを開く',
      callback: () => {
        void openInPreview(this.app, '国試対策/ホーム')
      },
    })

    this.addCommand({
      id: 'kokushi-debug-index',
      name: '【デバッグ】問題数と試験日を表示する',
      callback: async () => {
        const config = await loadConfig(this.app)
        const questions = indexQuestions(this.app)
        new Notice(`問題 ${questions.length} 件 / 基準試験日 ${earliestExamDate(config)} / 先頭 ${questions[0]?.id ?? 'なし'}`)
      },
    })
  }
}
