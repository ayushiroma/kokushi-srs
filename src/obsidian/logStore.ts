import { Platform, type App } from 'obsidian'
import { formatEntry, mergeLogs, parseLog } from '../core/log'
import type { ReviewEntry } from '../core/types'

const LOG_DIR = '.kokushi'

export class LogStore {
  constructor(private readonly app: App) {}

  private get devicePath(): string {
    return `${LOG_DIR}/review-${Platform.isMobile ? 'mobile' : 'desktop'}.md`
  }

  async append(entry: ReviewEntry): Promise<void> {
    const adapter = this.app.vault.adapter
    if (!(await adapter.exists(LOG_DIR))) {
      await adapter.mkdir(LOG_DIR)
    }
    const path = this.devicePath
    if (!(await adapter.exists(path))) {
      await adapter.write(path, '')
    }
    await adapter.append(path, `${formatEntry(entry)}\n`)
  }

  async readAll(): Promise<ReviewEntry[]> {
    const adapter = this.app.vault.adapter
    if (!(await adapter.exists(LOG_DIR))) return []
    const listed = await adapter.list(LOG_DIR)
    const logs: ReviewEntry[][] = []
    for (const file of listed.files) {
      if (!file.endsWith('.md')) continue
      try {
        logs.push(parseLog(await adapter.read(file)))
      } catch {
        continue
      }
    }
    return mergeLogs(logs)
  }
}
