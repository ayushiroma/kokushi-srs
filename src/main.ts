import { Notice, Plugin } from 'obsidian'

export default class KokushiPlugin extends Plugin {
  async onload(): Promise<void> {
    new Notice('国試対策プラグインを読み込みました')
  }
}
