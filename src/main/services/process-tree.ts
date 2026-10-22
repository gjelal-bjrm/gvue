import { execFile } from 'node:child_process'

/**
 * Arbre des processus : sert à savoir si le `ssh` lancé dans un terminal tourne
 * ENCORE.
 *
 * Un terminal SSH de GVue est un shell local (cmd, bash…) dans lequel on a
 * tapé `ssh …`. Quand la connexion tombe (« Connection to … closed »), ssh se
 * termine mais le shell reste : le terminal paraît vivant alors qu'il parle de
 * nouveau à la machine locale. Le texte affiché ne suffit pas à le voir
 * (messages traduits, invites personnalisées) ; la présence d'un processus ssh
 * SOUS le shell du terminal, si.
 */

export interface ProcRow {
  pid: number
  ppid: number
  name: string
}

/** Sortie de `wmic process get ProcessId,ParentProcessId,Name /format:csv` (pur). */
export function parseWmicCsv(raw: string): ProcRow[] {
  const out: ProcRow[] = []
  for (const line of raw.split(/\r*\n/)) {
    const cells = line.trim().split(',')
    // Node,Name,ParentProcessId,ProcessId — le nom peut contenir des virgules :
    // les deux nombres sont pris en FIN de ligne.
    if (cells.length < 4) continue
    const pid = Number(cells[cells.length - 1])
    const ppid = Number(cells[cells.length - 2])
    if (!/^\d+$/.test(cells[cells.length - 1]) || !Number.isInteger(ppid)) continue
    out.push({ pid, ppid, name: cells.slice(1, -2).join(',') })
  }
  return out
}

/** Sortie de `ps -A -o pid=,ppid=,comm=` (pur). */
export function parsePsList(raw: string): ProcRow[] {
  const out: ProcRow[] = []
  for (const line of raw.split('\n')) {
    const m = /^\s*(\d+)\s+(\d+)\s+(.+?)\s*$/.exec(line)
    if (m) out.push({ pid: Number(m[1]), ppid: Number(m[2]), name: m[3] })
  }
  return out
}

/** Un descendant de `rootPid` porte-t-il un nom (sans dossier) reconnu ? (pur) */
export function hasDescendant(rows: ProcRow[], rootPid: number, name: RegExp): boolean {
  const children = new Map<number, ProcRow[]>()
  for (const r of rows) {
    if (r.pid === r.ppid) continue
    const list = children.get(r.ppid)
    if (list) list.push(r)
    else children.set(r.ppid, [r])
  }
  const seen = new Set<number>([rootPid])
  const queue = [rootPid]
  while (queue.length) {
    for (const child of children.get(queue.shift() as number) ?? []) {
      if (seen.has(child.pid)) continue
      seen.add(child.pid)
      if (name.test(child.name.split(/[\\/]/).pop() ?? '')) return true
      queue.push(child.pid)
    }
  }
  return false
}

export type SshState = 'connected' | 'connecting' | 'disconnected' | 'unknown'

/** Laps pendant lequel un terminal SSH tout juste ouvert n'a pas encore lancé ssh. */
export const SSH_STARTUP_GRACE_MS = 8000

/**
 * État d'une session SSH (pur). `sshRunning` null = liste des processus
 * indisponible : on ne prétend rien plutôt que d'annoncer à tort une coupure.
 */
export function sshState(sshRunning: boolean | null, ageMs: number): SshState {
  if (sshRunning === null) return 'unknown'
  if (sshRunning) return 'connected'
  return ageMs < SSH_STARTUP_GRACE_MS ? 'connecting' : 'disconnected'
}

const SSH_NAME = /^ssh(\.exe)?$/i

function run(file: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: true, timeout: 5000, maxBuffer: 8 * 1024 * 1024 }, (err, stdout) =>
      err ? reject(err) : resolve(stdout)
    )
  })
}

async function listProcesses(): Promise<ProcRow[]> {
  if (process.platform !== 'win32') return parsePsList(await run('ps', ['-A', '-o', 'pid=,ppid=,comm=']))
  try {
    // wmic : ~150 ms. Absent des Windows récents → repli PowerShell (~600 ms).
    const rows = parseWmicCsv(await run('wmic', ['process', 'get', 'ProcessId,ParentProcessId,Name', '/format:csv']))
    if (rows.length) return rows
  } catch {
    /* wmic retiré : repli */
  }
  const raw = await run('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    "Get-CimInstance Win32_Process | ForEach-Object { 'N,{0},{1},{2}' -f $_.Name,$_.ParentProcessId,$_.ProcessId }"
  ])
  return parseWmicCsv(`Node,Name,ParentProcessId,ProcessId\n${raw}`)
}

// Plusieurs outils MCP peuvent interroger l'état coup sur coup : un instantané
// récent est réutilisé (et une requête en vol partagée).
let cache: { at: number; rows: Promise<ProcRow[]> } | null = null

/**
 * Pour chaque pid de shell, un ssh tourne-t-il dessous ? null si la liste des
 * processus est indisponible.
 */
export async function sshRunningUnder(shellPids: number[]): Promise<Map<number, boolean> | null> {
  if (!shellPids.length) return new Map()
  if (!cache || Date.now() - cache.at > 1000) {
    const rows = listProcesses()
    cache = { at: Date.now(), rows }
    rows.catch(() => {
      if (cache?.rows === rows) cache = null
    })
  }
  try {
    const rows = await cache.rows
    return new Map(shellPids.map((pid) => [pid, hasDescendant(rows, pid, SSH_NAME)]))
  } catch {
    return null
  }
}
