/**
 * Mode sélecteur (--pick) : le renderer confirme un choix de fichiers, on
 * écrit le fichier de sortie attendu par l'outil appelant (GRay…) — un chemin
 * par ligne, UTF-8 — puis on quitte. Le chemin de sortie vient uniquement de
 * la ligne de commande (jamais du renderer), et n'est écrit qu'une seule fois.
 */
import { app, ipcMain } from 'electron'
import { promises as fsp } from 'fs'
import { IPC } from '@shared/ipc'

let outFile: string | null = null

export function setPickOut(file: string): void {
  outFile = file
}

export function registerPickHandlers(): void {
  ipcMain.handle(IPC.pickConfirm, async (_e, paths: string[]) => {
    if (outFile === null) return
    const target = outFile
    outFile = null // double validation impossible
    const clean = (Array.isArray(paths) ? paths : []).filter(
      (p) => typeof p === 'string' && p.trim() !== ''
    )
    try {
      await fsp.writeFile(target, clean.join('\n'), 'utf8')
    } catch {
      /* dossier temporaire disparu : l'appelant verra une liste vide */
    }
    app.quit()
  })
}
