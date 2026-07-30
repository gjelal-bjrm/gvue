import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc'
import { readSshConfigHosts, sshAvailable } from '../services/ssh-config'

/** Handler IPC SSH : hôtes du ~/.ssh/config + disponibilité d'OpenSSH. */
export function registerSshHandlers(): void {
  ipcMain.handle(IPC.sshConfigHosts, async () => readSshConfigHosts())
  ipcMain.handle(IPC.sshAvailable, async () => sshAvailable())
}
