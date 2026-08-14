import { Notice, Plugin } from 'obsidian'
import { LogStore } from './obsidian/logStore'

export default class KokushiPlugin extends Plugin {
  logStore!: LogStore

  override async onload(): Promise<void> {
    this.logStore = new LogStore(this.app)

    this.addCommand({
      id: 'kokushi-debug-append',
      name: '【デバッグ】テスト記録を1件追加する',
      callback: async () => {
        await this.logStore.append({
          id: 'debug-question',
          at: new Date().toISOString(),
          result: 'ok',
        })
        const all = await this.logStore.readAll()
        new Notice(`記録しました。現在 ${all.length} 件`)
      },
    })
  }
}
