import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc'
import type { SshHost, SftpEntry } from '@shared/types'
import * as sftp from '../services/sftp-manager'

/**
 * Handler IPC SFTP : adaptateur fin au gestionnaire de sessions. Les erreurs
 * sont converties en objets { error } — jamais d'exception traversant l'IPC.
 */
export function registerSftpHandlers(): void {
  ipcMain.handle(
    IPC.sftpConnect,
    async (_e, host: SshHost, opts?: { password?: string; acceptFingerprint?: string }) =>
      sftp.connect(host, opts ?? {})
  )

  ipcMain.handle(IPC.sftpDisconnect, async (_e, hostKey: string) => sftp.disconnect(hostKey))

  ipcMain.handle(IPC.sftpList, async (_e, hostKey: string, dir: string) => {
    try {
      return { entries: await sftp.list(hostKey, dir) }
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) }
    }
  })

  ipcMain.handle(IPC.sftpMkdir, async (_e, hostKey: string, path: string) => {
    try {
      await sftp.mkdir(hostKey, path)
      return {}
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) }
    }
  })

  ipcMain.handle(IPC.sftpRename, async (_e, hostKey: string, from: string, to: string) => {
    try {
      await sftp.rename(hostKey, from, to)
      return {}
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) }
    }
  })

  ipcMain.handle(IPC.sftpDelete, async (_e, hostKey: string, entries: SftpEntry[]) => {
    const errors: string[] = []
    let ok = 0
    for (const entry of entries) {
      try {
        await sftp.remove(hostKey, entry)
        ok++
      } catch (e) {
        errors.push(`${entry.name} : ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    return { ok, errors }
  })

  ipcMain.handle(
    IPC.sftpDownload,
    async (_e, hostKey: string, entries: SftpEntry[], destDir: string) => {
      try {
        return await sftp.download(hostKey, entries, destDir)
      } catch (e) {
        return { ok: 0, errors: [e instanceof Error ? e.message : String(e)] }
      }
    }
  )

  ipcMain.handle(
    IPC.sftpUpload,
    async (_e, hostKey: string, localPaths: string[], remoteDir: string) => {
      try {
        return await sftp.upload(hostKey, localPaths, remoteDir)
      } catch (e) {
        return { ok: 0, errors: [e instanceof Error ? e.message : String(e)] }
      }
    }
  )

  ipcMain.handle(IPC.sftpEdit, async (_e, hostKey: string, entry: SftpEntry) => {
    try {
      return { local: await sftp.editRemote(hostKey, entry) }
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) }
    }
  })
}
