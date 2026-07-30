import { describe, it, expect } from 'vitest'
import { parseSshConfig } from '../src/main/services/ssh-config'
import { sshCommandFor, sshSubtitle } from '@renderer/lib/ssh'
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

  it('le sous-titre montre la cible réelle, port seulement si non standard', () => {
    expect(
      sshSubtitle({ name: 'vps', source: 'config', hostName: 'vps.exemple.com', user: 'gjelal', port: 2222 })
    ).toBe('gjelal@vps.exemple.com:2222')
    expect(sshSubtitle({ name: 'web', source: 'config', hostName: 'web.fr', port: 22 })).toBe('web.fr')
    // Alias du ssh_config sans HostName : rien à montrer de plus que le nom.
    expect(sshSubtitle({ name: 'alias', source: 'config' })).toBe('')
  })
})
