import { Notice, Plugin } from 'obsidian'
import { registerAnswerBlock } from './obsidian/answerBlock'
import { earliestExamDate, loadConfig } from './obsidian/config'
import { LogStore } from './obsidian/logStore'
import { indexQuestions } from './obsidian/questionIndex'

export default class KokushiPlugin extends Plugin {
  logStore!: LogStore

  override async onload(): Promise<void> {
    this.logStore = new LogStore(this.app)
    registerAnswerBlock(this)

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
