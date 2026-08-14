import { Notice, Plugin } from 'obsidian'

export default class KokushiPlugin extends Plugin {
  override async onload(): Promise<void> {
    new Notice('国試対策プラグインを読み込みました')
  }
}
