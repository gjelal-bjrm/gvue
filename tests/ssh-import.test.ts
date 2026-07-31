import { describe, it, expect } from 'vitest'
import {
  parseRegSessions,
  parseWinScpIni,
  decodeSessionName,
  parsePortForwardings
} from '../src/main/services/ssh-import'
import { mergeHosts, forwardArgs, parseForwards, forwardsToText } from '@renderer/lib/ssh'
import type { SshHost } from '@shared/types'

// Format calqué sur la sortie réelle de `reg query … /s` observée sur la
// machine (indentation 4 espaces, ports en hexadécimal, noms %-encodés).
const REG = `
HKEY_CURRENT_USER\\Software\\SimonTatham\\PuTTY\\Sessions
HKEY_CURRENT_USER\\Software\\SimonTatham\\PuTTY\\Sessions\\Default%20Settings
    HostName    REG_SZ
    PortNumber    REG_DWORD    0x16
    ProxyHost    REG_SZ    proxy
HKEY_CURRENT_USER\\Software\\SimonTatham\\PuTTY\\Sessions\\app-docker-01
    HostName    REG_SZ    docker01.exemple.ch
    PortNumber    REG_DWORD    0x7393
    UserName    REG_SZ    ubuntu
    Compression    REG_DWORD    0x0
HKEY_CURRENT_USER\\Software\\SimonTatham\\PuTTY\\Sessions\\CQFD%20-%20Lifou
    HostName    REG_SZ    lifou.cqfd.ch
    PortNumber    REG_DWORD    0x16
HKEY_CURRENT_USER\\Software\\SimonTatham\\PuTTY\\Sessions\\Sans%20Hote
    PortNumber    REG_DWORD    0x16
`

describe('parseRegSessions', () => {
  const hosts = parseRegSessions(REG)

  it('extrait les sessions utilisables et ignore Default Settings + sans hôte', () => {
    expect(hosts.map((h) => h.name)).toEqual(['app-docker-01', 'CQFD - Lifou'])
  })

  it('décode hôte/utilisateur/port (hexadécimal, 22 omis)', () => {
    expect(hosts[0]).toMatchObject({
      name: 'app-docker-01',
      hostName: 'docker01.exemple.ch',
      user: 'ubuntu',
      port: 0x7393, // 29587 — port non standard conservé
      source: 'manual'
    })
    expect(hosts[1].port).toBeUndefined() // 0x16 = 22 → omis
  })

  it('sortie vide → aucune session', () => {
    expect(parseRegSessions('')).toEqual([])
  })
})

describe('parseWinScpIni', () => {
  const INI = `
[Configuration]
RandomSeedFile=x

[Sessions/ignorée-mauvais-séparateur]
HostName=nope

[Sessions\\SVPA%20-%20Prod]
HostName=svpa.exemple.ch
UserName=deploy
PortNumber=29583

[Sessions\\Default%20Settings]
HostName=jamais

[Sessions\\backup_auto@www]
HostName=www.exemple.ch
`
  const hosts = parseWinScpIni(INI)

  it('extrait les sections Sessions\\ avec hôte', () => {
    expect(hosts.map((h) => h.name)).toEqual(['SVPA - Prod', 'backup_auto@www'])
    expect(hosts[0]).toMatchObject({
      hostName: 'svpa.exemple.ch',
      user: 'deploy',
      port: 29583
    })
  })

  it('Default Settings du .ini est aussi écarté', () => {
    expect(hosts.some((h) => h.name === 'Default Settings')).toBe(false)
  })
})

describe('tunnels SSH', () => {
  it('décode les PortForwardings de PuTTY (le cas « site distant sur localhost »)', () => {
    const f = parsePortForwardings('L3001=localhost:3001')
    expect(f).toEqual([
      { type: 'local', listenPort: 3001, listenHost: undefined, destHost: 'localhost', destPort: 3001 }
    ])
    expect(forwardArgs(f[0])).toBe('-L 3001:localhost:3001')
  })

  it('gère plusieurs tunnels, distants, SOCKS, bind et préfixes 4/6', () => {
    const f = parsePortForwardings('L3001=localhost:3001,R9000=localhost:9000,D1080=,4L127.0.0.1:8080=srv:80')
    expect(f.map((x) => x.type)).toEqual(['local', 'remote', 'dynamic', 'local'])
    expect(forwardArgs(f[1])).toBe('-R 9000:localhost:9000')
    expect(forwardArgs(f[2])).toBe('-D 1080')
    expect(forwardArgs(f[3])).toBe('-L 127.0.0.1:8080:srv:80')
  })

  it('ignore les entrées vides ou mal formées', () => {
    expect(parsePortForwardings('')).toEqual([])
    expect(parsePortForwardings('n’importe quoi')).toEqual([])
    expect(parsePortForwardings('L99999=localhost:80')).toEqual([])
    expect(parsePortForwardings('L3001=sans-port')).toEqual([])
  })

  it('les sessions importées portent leurs tunnels', () => {
    const hosts = parseRegSessions(`
HKEY_CURRENT_USER\\Software\\SimonTatham\\PuTTY\\Sessions\\client-prod
    HostName    REG_SZ    client.exemple.ch
    PortForwardings    REG_SZ    L3001=localhost:3001,L5432=localhost:5432
`)
    expect(hosts[0].forwards).toHaveLength(2)
    expect(hosts[0].forwards?.[0].listenPort).toBe(3001)
  })

  it('saisie manuelle : forme courte, R/D explicites, aller-retour texte', () => {
    expect(parseForwards('3001:localhost:3001')).toEqual([
      { type: 'local', listenPort: 3001, listenHost: undefined, destHost: 'localhost', destPort: 3001 }
    ])
    expect(parseForwards('R 9000:localhost:9000')[0].type).toBe('remote')
    expect(parseForwards('D 1080')[0]).toMatchObject({ type: 'dynamic', listenPort: 1080 })
    // Plusieurs lignes + ligne invalide ignorée.
    expect(parseForwards('3001:localhost:3001\nn’importe quoi\n8080:srv:80')).toHaveLength(2)
    // forwardsToText ∘ parseForwards = identité sur la forme canonique.
    const text = '3001:localhost:3001\nR 9000:localhost:9000\nD 1080'
    expect(forwardsToText(parseForwards(text))).toBe(text)
  })
})

describe('decodeSessionName', () => {
  it('décode %20 et les séquences UTF-8', () => {
    expect(decodeSessionName('CQFD%20-%20Lifou')).toBe('CQFD - Lifou')
    expect(decodeSessionName('h%C3%B4te%20priv%C3%A9')).toBe('hôte privé')
    expect(decodeSessionName('sans-encodage')).toBe('sans-encodage')
  })

  it('survit à une séquence invalide', () => {
    expect(decodeSessionName('abc%ZZdef%20x')).toBe('abc%ZZdef x')
  })
})

describe('mergeHosts', () => {
  const h = (name: string, hostName: string, port?: number): SshHost => ({
    name,
    source: 'manual',
    hostName,
    port
  })

  it('ignore les doublons exacts et suffixe les homonymes différents', () => {
    const merged = mergeHosts(
      [h('prod', 'a.ch'), h('dev', 'b.ch')],
      [h('prod', 'a.ch'), h('prod', 'AUTRE.ch'), h('staging', 'c.ch')]
    )
    expect(merged.map((x) => x.name)).toEqual(['prod', 'dev', 'prod (2)', 'staging'])
    expect(merged.find((x) => x.name === 'prod (2)')?.hostName).toBe('AUTRE.ch')
  })

  it('suffixe en cascade si « (2) » est déjà pris', () => {
    const merged = mergeHosts([h('s', 'x.ch'), h('s (2)', 'y.ch')], [h('s', 'z.ch')])
    expect(merged.map((x) => x.name)).toEqual(['s', 's (2)', 's (3)'])
  })
})
