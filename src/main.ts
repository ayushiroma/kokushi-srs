import { Notice, Plugin } from 'obsidian'
import { registerAnswerBlock } from './obsidian/answerBlock'
import { LogStore } from './obsidian/logStore'

export default class KokushiPlugin extends Plugin {
  logStore!: LogStore

  override async onload(): Promise<void> {
    this.logStore = new LogStore(this.app)
    registerAnswerBlock(this)

    this.addCommand({
      id: 'kokushi-debug-count',
      name: '【デバッグ】記録件数を表示する',
      callback: async () => {
        const all = await this.logStore.readAll()
        new Notice(`現在 ${all.length} 件`)
      },
    })
  }
}
