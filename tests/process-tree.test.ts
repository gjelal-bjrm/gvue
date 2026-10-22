import { describe, expect, it } from 'vitest'
import { parseWmicCsv, parsePsList, hasDescendant, sshState } from '../src/main/services/process-tree'

describe('process-tree', () => {
  it('lit la sortie CSV de wmic (lignes vides et \\r\\r\\n compris)', () => {
    const raw =
      '\r\r\nNode,Name,ParentProcessId,ProcessId\r\r\n' +
      'PC,System Idle Process,0,0\r\r\n' +
      'PC,cmd.exe,4000,5000\r\r\n' +
      'PC,ssh.exe,5000,5100\r\r\n\r\r\n'
    expect(parseWmicCsv(raw)).toEqual([
      { pid: 0, ppid: 0, name: 'System Idle Process' },
      { pid: 5000, ppid: 4000, name: 'cmd.exe' },
      { pid: 5100, ppid: 5000, name: 'ssh.exe' }
    ])
  })

  it('un nom de processus contenant une virgule ne décale pas les colonnes', () => {
    expect(parseWmicCsv('Node,Name,ParentProcessId,ProcessId\nPC,a,b.exe,1,2\n')).toEqual([
      { pid: 2, ppid: 1, name: 'a,b.exe' }
    ])
  })

  it('lit la sortie de ps (Linux / macOS)', () => {
    expect(parsePsList('  100     1 bash\n  200   100 /usr/bin/ssh\n')).toEqual([
      { pid: 100, ppid: 1, name: 'bash' },
      { pid: 200, ppid: 100, name: '/usr/bin/ssh' }
    ])
  })

  const rows = [
    { pid: 10, ppid: 1, name: 'cmd.exe' },
    { pid: 11, ppid: 10, name: 'ssh.exe' },
    { pid: 20, ppid: 1, name: 'bash.exe' },
    { pid: 21, ppid: 20, name: 'bash.exe' },
    { pid: 22, ppid: 21, name: 'ssh.exe' },
    { pid: 30, ppid: 1, name: 'cmd.exe' },
    { pid: 31, ppid: 30, name: 'sshd.exe' },
    { pid: 32, ppid: 30, name: 'conhost.exe' }
  ]

  it('trouve ssh sous le shell du terminal, même à plusieurs niveaux', () => {
    expect(hasDescendant(rows, 10, /^ssh(\.exe)?$/i)).toBe(true)
    expect(hasDescendant(rows, 20, /^ssh(\.exe)?$/i)).toBe(true)
  })

  it('« Connection closed » : ssh terminé, le shell local reste → pas de descendant', () => {
    expect(hasDescendant(rows, 30, /^ssh(\.exe)?$/i)).toBe(false)
  })

  it('une boucle parent/enfant (pid recyclé) ne bloque pas la recherche', () => {
    const loop = [
      { pid: 1, ppid: 2, name: 'a' },
      { pid: 2, ppid: 1, name: 'b' }
    ]
    expect(hasDescendant(loop, 1, /^ssh$/)).toBe(false)
  })

  it('état SSH : connecté, en cours de connexion, déconnecté', () => {
    expect(sshState(true, 60_000)).toBe('connected')
    expect(sshState(false, 2_000)).toBe('connecting')
    expect(sshState(false, 60_000)).toBe('disconnected')
    // Liste des processus indisponible : on ne prétend rien.
    expect(sshState(null, 60_000)).toBe('unknown')
  })
})
