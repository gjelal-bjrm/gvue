import { Client, type SFTPWrapper } from 'ssh2'
import { promises as fsp, existsSync, watchFile, unwatchFile, type Stats } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, basename } from 'node:path'
import { homedir, tmpdir } from 'node:os'
import { app, BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc'
import type { SshHost, SftpEntry, SftpConnectResult, SftpProgress } from '@shared/types'
import { getConfig, setConfig } from './config-store'
import { logInfo, logError } from './logger'

/**
 * Sessions SFTP (phase 2 de l'accès distant — le « WinSCP sans ses défauts »).
 *
 * - Authentification dans l'ordre : agent OpenSSH de Windows, clés par défaut
 *   (~/.ssh/id_ed25519, id_rsa), puis mot de passe demandé au renderer.
 *   RIEN n'est stocké : ni mot de passe, ni clé — seule l'empreinte de l'hôte
 *   acceptée est persistée (TOFU : confirmée à la première connexion,
 *   mismatch = refus dur, comme OpenSSH).
 * - Une session par hôte (clé « hôte:port:user »), réutilisée par toutes les
 *   opérations ; fermée explicitement ou à la fermeture de l'app.
 * - Transferts séquentiels avec progression envoyée au renderer (throttlée).
 */

interface Session {
  client: Client
  sftp: SFTPWrapper
  home: string
}

const sessions = new Map<string, Session>()

// Connexions en cours : une tentative identique (même hôte + mêmes options)
// réutilise la promesse au lieu d'ouvrir un 2e socket — indispensable en dev,
// où React StrictMode double les effets et déclencherait 2 connexions.
const pending = new Map<string, Promise<SftpConnectResult>>()

/** Clé de session d'un hôte. */
export function hostKeyOf(host: SshHost): string {
  return `${host.hostName ?? host.name}:${host.port ?? 22}:${host.user ?? ''}`
}

/** Empreinte SHA256 base64 d'une clé d'hôte, au format d'OpenSSH. */
function fingerprintOf(key: Buffer): string {
  return 'SHA256:' + createHash('sha256').update(key).digest('base64').replace(/=+$/, '')
}

/**
 * Chemin de l'agent SSH s'il est réellement joignable, sinon undefined.
 * Passer un agent injoignable à ssh2 fait échouer TOUTE la connexion
 * (« Failed to connect to agent ») au lieu d'essayer les autres méthodes —
 * or le service Windows « ssh-agent » est désactivé par défaut.
 */
function agentPath(): string | undefined {
  if (process.platform === 'win32') {
    const pipe = '\\\\.\\pipe\\openssh-ssh-agent'
    return existsSync(pipe) ? pipe : undefined
  }
  return process.env.SSH_AUTH_SOCK || undefined
}

/** Clés privées par défaut présentes sur la machine. */
async function defaultKeys(): Promise<Buffer[]> {
  const out: Buffer[] = []
  for (const name of ['id_ed25519', 'id_ecdsa', 'id_rsa']) {
    try {
      out.push(await fsp.readFile(join(homedir(), '.ssh', name)))
    } catch {
      /* absente */
    }
  }
  return out
}

function sendToRenderer(channel: string, payload: unknown): void {
  const win = BrowserWindow.getAllWindows()[0]
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload)
}

/**
 * Établit (ou réutilise) la session d'un hôte. Machine à états : peut demander
 * la confirmation d'empreinte ou un mot de passe avant de réussir.
 */
export async function connect(
  host: SshHost,
  opts: { password?: string; acceptFingerprint?: string } = {}
): Promise<SftpConnectResult> {
  const key = hostKeyOf(host)
  if (sessions.has(key)) {
    return { status: 'ok', home: sessions.get(key)!.home }
  }
  const pendingKey = `${key}|${opts.acceptFingerprint ?? ''}|${opts.password ? 'pwd' : ''}`
  const inFlight = pending.get(pendingKey)
  if (inFlight) return inFlight
  const promise = connectOnce(host, key, opts).finally(() => pending.delete(pendingKey))
  pending.set(pendingKey, promise)
  return promise
}

async function connectOnce(
  host: SshHost,
  key: string,
  opts: { password?: string; acceptFingerprint?: string }
): Promise<SftpConnectResult> {

  const target = host.hostName ?? host.name
  const user = host.user ?? process.env.USERNAME ?? 'root'
  const port = host.port ?? 22

  // TOFU : accepte l'empreinte connue, celle que l'utilisateur vient de
  // valider, sinon on interrompt pour la lui montrer.
  const known = getConfig('sshFingerprints')
  const fpKey = `${target}:${port}`

  const client = new Client()

  const result = await new Promise<SftpConnectResult>((resolve) => {
    let settled = false
    const done = (r: SftpConnectResult): void => {
      if (!settled) {
        settled = true
        resolve(r)
      }
    }

    client.on('ready', () => {
      client.sftp((err, sftp) => {
        if (err) {
          client.end()
          return done({ status: 'error', message: err.message })
        }
        sftp.realpath('.', (err2, home) => {
          const h = err2 ? '/' : home
          sessions.set(key, { client, sftp, home: h })
          logInfo('sftp', `Connecté à ${key}.`)
          done({ status: 'ok', home: h })
        })
      })
    })

    client.on('error', (err) => {
      const msg = err.message ?? String(err)
      logError('sftp', `Connexion ${key} : ${msg}`)
      // Toutes les méthodes d'authentification ont échoué → demander un mot de passe.
      if (/authentication/i.test(msg) && !opts.password) {
        done({ status: 'password' })
      } else if (/authentication/i.test(msg)) {
        done({ status: 'password', message: 'Mot de passe refusé, réessayez.' })
      } else {
        done({ status: 'error', message: msg })
      }
    })

    void (async () => {
      const keys = await defaultKeys()
      logInfo(
        'sftp',
        `Connexion à ${key} (agent: ${agentPath() ? 'oui' : 'non'}, clés: ${keys.length}, ` +
          `mdp: ${opts.password ? 'oui' : 'non'}, empreinte acceptée: ${opts.acceptFingerprint ? 'oui' : 'non'})…`
      )
      try {
        client.connect({
          host: target,
          port,
          username: user,
          password: opts.password,
          // Agent SSH seulement s'il est joignable (service Windows souvent désactivé).
          agent: agentPath(),
          privateKey: keys[0],
          tryKeyboard: false,
          readyTimeout: 15_000,
          // Trace du handshake dans le journal en dev (diagnostic des timeouts).
          debug: app.isPackaged ? undefined : (m: string) => logInfo('ssh2', m),
          hostVerifier: (keyBuf: Buffer): boolean => {
            const fp = fingerprintOf(keyBuf)
            if (known[fpKey] === fp) return true
            if (opts.acceptFingerprint === fp) {
              // Décision explicite de l'utilisateur : persistée IMMÉDIATEMENT
              // (elle survit à un échec d'auth ensuite, et les tentatives
              // suivantes n'ont plus besoin de la re-transporter).
              setConfig('sshFingerprints', { ...getConfig('sshFingerprints'), [fpKey]: fp })
              return true
            }
            if (known[fpKey] && known[fpKey] !== fp) {
              // Clé d'hôte CHANGÉE : refus dur (attaque possible), comme OpenSSH.
              done({
                status: 'error',
                message:
                  `L'EMPREINTE DE ${target} A CHANGÉ (${fp}). Connexion refusée. ` +
                  `Si le serveur a vraiment été réinstallé, retirez l'ancienne empreinte des paramètres GVue.`
              })
              return false
            }
            done({ status: 'fingerprint', fingerprint: fp })
            return false
          }
        })
      } catch (e) {
        done({ status: 'error', message: e instanceof Error ? e.message : String(e) })
      }
    })()
  })

  if (result.status !== 'ok') client.end()
  else {
    client.on('close', () => {
      sessions.delete(key)
      logInfo('sftp', `Session ${key} fermée.`)
    })
  }
  return result
}

export function disconnect(hostKey: string): void {
  const s = sessions.get(hostKey)
  if (s) {
    stopEditsFor(hostKey)
    s.client.end()
    sessions.delete(hostKey)
  }
}

export function disconnectAll(): void {
  for (const key of [...sessions.keys()]) disconnect(key)
}

function sessionOf(hostKey: string): Session {
  const s = sessions.get(hostKey)
  if (!s) throw new Error('Session SFTP fermée — reconnectez-vous.')
  return s
}

/* -------------------------------- Opérations ------------------------------ */

/** Liste un dossier distant (dossiers d'abord, puis alphabétique). */
export function list(hostKey: string, dir: string): Promise<SftpEntry[]> {
  const { sftp } = sessionOf(hostKey)
  return new Promise((resolve, reject) => {
    sftp.readdir(dir, (err, entries) => {
      if (err) return reject(err)
      const out: SftpEntry[] = entries.map((e) => {
        const mode = e.attrs.mode ?? 0
        const kind = (mode & 0xf000) === 0x4000 ? 'directory' : (mode & 0xf000) === 0xa000 ? 'symlink' : 'file'
        return {
          name: e.filename,
          path: dir === '/' ? `/${e.filename}` : `${dir}/${e.filename}`,
          kind,
          size: e.attrs.size ?? 0,
          modifiedMs: (e.attrs.mtime ?? 0) * 1000
        }
      })
      out.sort((a, b) =>
        a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'directory' ? -1 : 1
      )
      resolve(out)
    })
  })
}

export function mkdir(hostKey: string, path: string): Promise<void> {
  const { sftp } = sessionOf(hostKey)
  return new Promise((resolve, reject) =>
    sftp.mkdir(path, (err) => (err ? reject(err) : resolve()))
  )
}

export function rename(hostKey: string, from: string, to: string): Promise<void> {
  const { sftp } = sessionOf(hostKey)
  return new Promise((resolve, reject) =>
    sftp.rename(from, to, (err) => (err ? reject(err) : resolve()))
  )
}

/** Supprime fichier ou dossier (récursif — SFTP n'a pas de corbeille !). */
export async function remove(hostKey: string, entry: SftpEntry): Promise<void> {
  const { sftp } = sessionOf(hostKey)
  if (entry.kind !== 'directory') {
    return new Promise((resolve, reject) =>
      sftp.unlink(entry.path, (err) => (err ? reject(err) : resolve()))
    )
  }
  const children = await list(hostKey, entry.path)
  for (const child of children) await remove(hostKey, child)
  return new Promise((resolve, reject) =>
    sftp.rmdir(entry.path, (err) => (err ? reject(err) : resolve()))
  )
}

/** Envoie la progression au renderer (throttlée par fichier). */
function progress(p: SftpProgress): void {
  sendToRenderer(IPC.sftpOnProgress, p)
}

/** Télécharge des entrées distantes vers un dossier local. */
export async function download(
  hostKey: string,
  entries: SftpEntry[],
  destDir: string
): Promise<{ ok: number; errors: string[] }> {
  const res = { ok: 0, errors: [] as string[] }
  const flat: { entry: SftpEntry; local: string }[] = []

  // Aplatis récursivement (les dossiers deviennent des mkdir locaux).
  const collect = async (entry: SftpEntry, localDir: string): Promise<void> => {
    const local = join(localDir, entry.name)
    if (entry.kind === 'directory') {
      await fsp.mkdir(local, { recursive: true })
      for (const child of await list(hostKey, entry.path)) await collect(child, local)
    } else {
      flat.push({ entry, local })
    }
  }
  for (const e of entries) {
    try {
      await collect(e, destDir)
    } catch (err) {
      res.errors.push(`${e.name} : ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const { sftp } = sessionOf(hostKey)
  for (let i = 0; i < flat.length; i++) {
    const { entry, local } = flat[i]
    try {
      let last = 0
      await new Promise<void>((resolve, reject) =>
        sftp.fastGet(entry.path, local, {
          step: (done, _chunk, total) => {
            const now = Date.now()
            if (now - last > 150 || done === total) {
              last = now
              progress({ hostKey, file: entry.name, done, total, index: i + 1, count: flat.length })
            }
          }
        }, (err) => (err ? reject(err) : resolve()))
      )
      res.ok++
    } catch (err) {
      res.errors.push(`${entry.name} : ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  return res
}

/** Téléverse des fichiers/dossiers locaux vers un dossier distant. */
export async function upload(
  hostKey: string,
  localPaths: string[],
  remoteDir: string
): Promise<{ ok: number; errors: string[] }> {
  const res = { ok: 0, errors: [] as string[] }
  const flat: { local: string; remote: string }[] = []

  const collect = async (local: string, dir: string): Promise<void> => {
    const st = await fsp.stat(local)
    const remote = dir === '/' ? `/${basename(local)}` : `${dir}/${basename(local)}`
    if (st.isDirectory()) {
      await mkdir(hostKey, remote).catch(() => undefined) // existe déjà : OK
      for (const name of await fsp.readdir(local)) await collect(join(local, name), remote)
    } else {
      flat.push({ local, remote })
    }
  }
  for (const p of localPaths) {
    try {
      await collect(p, remoteDir)
    } catch (err) {
      res.errors.push(`${basename(p)} : ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const { sftp } = sessionOf(hostKey)
  for (let i = 0; i < flat.length; i++) {
    const { local, remote } = flat[i]
    try {
      let last = 0
      await new Promise<void>((resolve, reject) =>
        sftp.fastPut(local, remote, {
          step: (done, _chunk, total) => {
            const now = Date.now()
            if (now - last > 150 || done === total) {
              last = now
              progress({
                hostKey,
                file: basename(local),
                done,
                total,
                index: i + 1,
                count: flat.length
              })
            }
          }
        }, (err) => (err ? reject(err) : resolve()))
      )
      res.ok++
    } catch (err) {
      res.errors.push(`${basename(local)} : ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  return res
}

/* ---------------------- Édition distante (ré-upload auto) ----------------- */

// Fichiers temporaires surveillés : sauvegarde locale → ré-upload silencieux.
const edits = new Map<string, { hostKey: string; remote: string }>()

/**
 * Télécharge un fichier distant dans un dossier temporaire, l'ouvre avec
 * l'application par défaut, et ré-téléverse à chaque sauvegarde locale.
 */
export async function editRemote(hostKey: string, entry: SftpEntry): Promise<string> {
  const dir = join(tmpdir(), 'gvue-sftp-edit')
  await fsp.mkdir(dir, { recursive: true })
  // Préfixe unique : deux fichiers distants du même nom ne se percutent pas.
  const local = join(dir, `${Date.now().toString(36)}-${entry.name}`)
  const r = await download(hostKey, [entry], dir)
  // download écrit sous entry.name : renomme vers le chemin unique.
  if (r.errors.length) throw new Error(r.errors[0])
  await fsp.rename(join(dir, entry.name), local)

  edits.set(local, { hostKey, remote: entry.path })
  watchFile(local, { interval: 1000 }, (cur: Stats, prev: Stats) => {
    if (cur.mtimeMs === prev.mtimeMs) return
    const edit = edits.get(local)
    if (!edit) return
    const s = sessions.get(edit.hostKey)
    if (!s) return
    s.sftp.fastPut(local, edit.remote, (err) => {
      if (err) logError('sftp', `Ré-upload de ${entry.name} : ${err.message}`)
      else {
        logInfo('sftp', `${entry.name} ré-téléversé après modification locale.`)
        sendToRenderer(IPC.sftpOnProgress, {
          hostKey: edit.hostKey,
          file: `${entry.name} — ré-téléversé ✓`,
          done: 1,
          total: 1,
          index: 1,
          count: 1
        } satisfies SftpProgress)
      }
    })
  })

  await import('electron').then(({ shell }) => shell.openPath(local))
  return local
}

function stopEditsFor(hostKey: string): void {
  for (const [local, edit] of edits) {
    if (edit.hostKey === hostKey) {
      unwatchFile(local)
      edits.delete(local)
    }
  }
}

// La fermeture globale est branchée dans main/index.ts (before-quit).
