import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc'
import type { SearchOptions, SearchResultEvent, SearchDoneEvent } from '@shared/types'
import { startSearch, cancelSearch } from '../services/search'

/**
 * Handlers IPC de la recherche.
 * - start : requête (invoke) qui lance ripgrep ; l'id est fourni par le
 *   renderer pour qu'aucun événement streamé n'arrive « avant » son id.
 * - cancel : flux à sens unique.
 * - onResult/onDone : streamés vers le renderer via webContents.send.
 */
export function registerSearchHandlers(): void {
  ipcMain.handle(IPC.searchStart, async (e, searchId: string, opts: SearchOptions) => {
    const wc = e.sender
    startSearch(
      searchId,
      opts,
      (id, matches) => {
        if (!wc.isDestroyed())
          wc.send(IPC.searchOnResult, { searchId: id, matches } satisfies SearchResultEvent)
      },
      (id, done) => {
        if (!wc.isDestroyed())
          wc.send(IPC.searchOnDone, { searchId: id, done } satisfies SearchDoneEvent)
      }
    )
  })

  ipcMain.on(IPC.searchCancel, (_e, searchId: string) => cancelSearch(searchId))
}
