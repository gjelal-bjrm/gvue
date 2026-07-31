import { describe, it, expect } from 'vitest'
import { parseSshConfig, splitSshTokens } from '../src/main/services/ssh-config'
import { sshCommandFor, sshSubtitle, sshCdCommandFor } from '@renderer/lib/ssh'
import type { SshHost } from '@shared/types'

const SAMPLE = `# Serveurs perso
Host vps
  HostName vps.exemple.com
  User gjelal
  Port 2222

Host prod staging
    HostName= serveur.exemple.com
    user deploy

# Règles génériques : pas des serveurs cliquables
Host *
  ServerAliveInterval 60
Host *.interne !bastion
  ProxyJump bastion

Match host "*.exemple.com"
  ForwardAgent yes

Host bastion
  HostName 10.0.0.1
`

describe('parseSshConfig', () => {
  const hosts = parseSshConfig(SAMPLE)
  const names = hosts.map((h) => h.name)

  it('extrait les hôtes nommés et ignore les motifs génériques', () => {
    expect(names).toEqual(['vps', 'prod', 'staging', 'bastion'])
  })

  it('associe HostName/User/Port (séparateur espace ou =, casse libre)', () => {
    const vps = hosts.find((h) => h.name === 'vps')!
    expect(vps).toMatchObject({ hostName: 'vps.exemple.com', user: 'gjelal', port: 2222 })
    // « Host prod staging » : les DEUX alias reçoivent les propriétés du bloc.
    const prod = hosts.find((h) => h.name === 'prod')!
    const staging = hosts.find((h) => h.name === 'staging')!
    expect(prod.hostName).toBe('serveur.exemple.com')
    expect(staging.user).toBe('deploy')
  })

  it('un bloc Match ne capture pas les propriétés suivantes', () => {
    const bastion = hosts.find((h) => h.name === 'bastion')!
    expect(bastion.hostName).toBe('10.0.0.1')
    // ForwardAgent (bloc Match) ne doit pas avoir fui sur staging.
    expect(hosts.find((h) => h.name === 'staging')!.port).toBeUndefined()
  })

  it('tolère un fichier vide ou sans hôte', () => {
    expect(parseSshConfig('')).toEqual([])
    expect(parseSshConfig('# rien\nServerAliveInterval 60\n')).toEqual([])
  })

  it('respecte les guillemets : alias multi-mots et valeurs quotées (cas réel ami)', () => {
    // Le bug constaté : « Host "CQFD tools" » éclatait en « "CQFD » + « tools" ».
    const hosts = parseSshConfig(`
Host "CQFD tools" wallix
  HostName cqfd.dev
  User user
  Port 2245

Host demo
  HostName "serveur avec espace.local"
`)
    expect(hosts.map((h) => h.name)).toEqual(['CQFD tools', 'wallix', 'demo'])
    expect(hosts[0]).toMatchObject({ hostName: 'cqfd.dev', user: 'user', port: 2245 })
    expect(hosts[2].hostName).toBe('serveur avec espace.local')
  })
})

describe('splitSshTokens', () => {
  it('découpe en respectant les guillemets', () => {
    expect(splitSshTokens('"CQFD tools" simple "a b c"')).toEqual(['CQFD tools', 'simple', 'a b c'])
    expect(splitSshTokens('sans guillemets')).toEqual(['sans', 'guillemets'])
    expect(splitSshTokens('')).toEqual([])
  })
})

describe('sshCommandFor / sshSubtitle', () => {
  it("un hôte du ssh_config se connecte par son alias (jamais doublé d'options)", () => {
    const h: SshHost = { name: 'vps', source: 'config', hostName: 'vps.exemple.com', user: 'x', port: 2222 }
    expect(sshCommandFor(h)).toBe('ssh vps')
  })

  it('un hôte manuel construit user@hôte et le port', () => {
    expect(
      sshCommandFor({ name: 'NAS', source: 'manual', hostName: '192.168.1.10', user: 'admin', port: 2202 })
    ).toBe('ssh -p 2202 admin@192.168.1.10')
    expect(sshCommandFor({ name: 'srv', source: 'manual', hostName: 'srv.lan' })).toBe('ssh srv.lan')
  })

  it('sshCdCommandFor ouvre un shell interactif déjà positionné (quoting sans $)', () => {
    expect(sshCdCommandFor({ name: 'vps', source: 'config' }, '/var/www/mon site')).toBe(
      `ssh -t vps "cd '/var/www/mon site' && exec bash -l || exec sh -l"`
    )
    expect(
      sshCdCommandFor(
        { name: 'NAS', source: 'manual', hostName: '10.0.0.5', user: 'admin', port: 2222 },
        '/srv'
      )
    ).toBe(`ssh -t -p 2222 admin@10.0.0.5 "cd '/srv' && exec bash -l || exec sh -l"`)
    // Apostrophe dans le chemin : échappement POSIX '\''.
    expect(sshCdCommandFor({ name: 'vps', source: 'config' }, "/home/l'app")).toContain(
      `cd '/home/l'\\''app'`
    )
    // Jamais de $ (PowerShell/Git Bash locaux interpoleraient).
    expect(sshCdCommandFor({ name: 'vps', source: 'config' }, '/srv')).not.toContain('$')
  })

  it('le sous-titre montre la cible réelle, port seulement si non standard', () => {
    expect(
      sshSubtitle({ name: 'vps', source: 'config', hostName: 'vps.exemple.com', user: 'gjelal', port: 2222 })
    ).toBe('gjelal@vps.exemple.com:2222')
    expect(sshSubtitle({ name: 'web', source: 'config', hostName: 'web.fr', port: 22 })).toBe('web.fr')
    // Alias du ssh_config sans HostName : rien à montrer de plus que le nom.
    expect(sshSubtitle({ name: 'alias', source: 'config' })).toBe('')
  })
})
