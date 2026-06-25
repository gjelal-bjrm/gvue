import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc'
import type {
  TerminalCreateOptions,
  TerminalDataEvent,
  TerminalExitEvent
} from '@shared/types'
import { detectShells } from '../services/shell-detect'
import { createPty, writePty, resizePty, killPty } from '../services/pty-manager'

/**
 * Handlers IPC du terminal.
 * - shells/create : requête/réponse (invoke).
 * - write/resize/kill : flux à sens unique haute fréquence (send).
 * - onData/onExit : streamés vers le renderer via webContents.send.
 */
export function registerTerminalHandlers(): void {
  ipcMain.handle(IPC.terminalShells, async () => detectShells())

  ipcMain.handle(IPC.terminalCreate, async (e, opts: TerminalCreateOptions) => {
    const wc = e.sender
    // createPty peut lever si node-pty n'est pas chargeable : on laisse
    // l'erreur remonter au renderer (invoke rejette) pour affichage.
    return createPty(
      opts,
      (ptyId, data) => {
        if (!wc.isDestroyed()) wc.send(IPC.terminalOnData, { ptyId, data } satisfies TerminalDataEvent)
      },
      (ptyId, exitCode) => {
        if (!wc.isDestroyed()) wc.send(IPC.terminalOnExit, { ptyId, exitCode } satisfies TerminalExitEvent)
      }
    )
  })

  ipcMain.on(IPC.terminalWrite, (_e, ptyId: string, data: string) => writePty(ptyId, data))
  ipcMain.on(IPC.terminalResize, (_e, ptyId: string, cols: number, rows: number) =>
    resizePty(ptyId, cols, rows)
  )
  ipcMain.on(IPC.terminalKill, (_e, ptyId: string) => killPty(ptyId))
}
