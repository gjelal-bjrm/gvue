import { ipcMain, Menu, BrowserWindow } from 'electron'
import type { MenuItemConstructorOptions } from 'electron'
import { IPC } from '@shared/ipc'
import type { NativeMenuItem } from '@shared/types'

/**
 * Menu contextuel NATIF (Menu.popup) : contrairement à un menu HTML, c'est une
 * fenêtre popup de l'OS — elle peut déborder de la fenêtre de l'application,
 * comme le menu de l'explorateur Windows. Le renderer envoie une structure
 * sérialisée (id/label/enabled/submenu) et reçoit l'id de l'entrée cliquée
 * (ou null si le menu est fermé sans clic).
 */

// Un seul menu à la fois : un nouveau popup remplace le précédent (couvre aussi
// le double-montage de React.StrictMode en dev).
let current: Menu | null = null

function toTemplate(
  items: NativeMenuItem[],
  onPick: (id: string | null) => void
): MenuItemConstructorOptions[] {
  return items.map((it) => {
    if (it.type === 'separator') return { type: 'separator' as const }
    // Sous Windows, « & » marque un mnémonique dans les menus : on l'échappe
    // (les noms de fichiers peuvent en contenir).
    const label =
      process.platform === 'win32' ? (it.label ?? '').replace(/&/g, '&&') : it.label ?? ''
    if (it.submenu) {
      return { label, enabled: it.enabled !== false, submenu: toTemplate(it.submenu, onPick) }
    }
    return {
      label,
      enabled: it.enabled !== false,
      click: () => onPick(it.id ?? null)
    }
  })
}

export function registerMenuHandlers(): void {
  ipcMain.handle(
    IPC.menuPopup,
    (e, items: NativeMenuItem[], x: number, y: number): Promise<string | null> | null => {
      const win = BrowserWindow.fromWebContents(e.sender)
      if (!win || !Array.isArray(items) || items.length === 0) return null
      current?.closePopup()
      return new Promise<string | null>((resolve) => {
        let done = false
        const finish = (id: string | null): void => {
          if (done) return
          done = true
          resolve(id)
        }
        const menu = Menu.buildFromTemplate(toTemplate(items, finish))
        current = menu
        menu.popup({
          window: win,
          x: Math.round(x),
          y: Math.round(y),
          // Appelé à la fermeture ; le click d'une entrée peut arriver juste
          // après → petite temporisation pour le laisser gagner.
          callback: () => setTimeout(() => finish(null), 80)
        })
      })
    }
  )
}
