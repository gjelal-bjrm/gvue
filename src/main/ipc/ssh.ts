import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc'
import { readSshConfigHosts, sshAvailable } from '../services/ssh-config'
import { importSources } from '../services/ssh-import'

/** Handler IPC SSH : hôtes du ~/.ssh/config, OpenSSH, import PuTTY/WinSCP. */
export function registerSshHandlers(): void {
  ipcMain.handle(IPC.sshConfigHosts, async () => readSshConfigHosts())
  ipcMain.handle(IPC.sshAvailable, async () => sshAvailable())
  ipcMain.handle(IPC.sshImportSources, async () => importSources())
}
