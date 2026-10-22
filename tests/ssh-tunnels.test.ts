import { describe, expect, it } from 'vitest'
import { addForward, removeForward, tunnelState, describeTunnel, probeHost } from '../src/main/services/ssh-tunnels'
import type { SshHost } from '../src/shared/types'

const hosts: SshHost[] = [
  { name: 'app-docker-01', source: 'manual', hostName: 'cqfd-cloud.ch', user: 'ops' },
  { name: 'web', source: 'manual', hostName: 'web.ch', forwards: [{ type: 'local', listenPort: 8080, destHost: 'srv', destPort: 80 }] }
]

describe('ssh-tunnels', () => {
  it('ajoute un tunnel à un serveur manuel sans toucher aux autres', () => {
    const next = addForward(hosts, 'app-docker-01', '14330:app.lan:1433')
    expect(next.forward).toEqual({ type: 'local', listenPort: 14330, listenHost: undefined, destHost: 'app.lan', destPort: 1433 })
    expect(next.hosts[0].forwards).toEqual([next.forward])
    expect(next.hosts[1]).toBe(hosts[1])
    // Pas de mutation de la configuration d'origine.
    expect(hosts[0].forwards).toBeUndefined()
  })

  it('refuse un doublon de port d’écoute du même sens', () => {
    expect(() => addForward(hosts, 'web', '8080:autre:81')).toThrow(/8080/)
    // Le sens distant écoute sur le serveur : pas de conflit avec -L 8080.
    expect(addForward(hosts, 'web', 'R 8080:localhost:3000').hosts[1].forwards).toHaveLength(2)
  })

  it('refuse une syntaxe illisible et un serveur inconnu', () => {
    expect(() => addForward(hosts, 'web', '14330:app.lan')).toThrow(/syntaxe/i)
    expect(() => addForward(hosts, 'inconnu', '1:a:2')).toThrow(/introuvable/i)
  })

  it('retire un tunnel par port (et par sens si précisé)', () => {
    const r = removeForward(hosts, 'web', 8080)
    expect(r.removed.destHost).toBe('srv')
    expect(r.hosts[1].forwards).toEqual([])
    expect(() => removeForward(hosts, 'web', 9999)).toThrow(/9999/)
    expect(() => removeForward(hosts, 'web', 8080, 'remote')).toThrow()
  })

  it('état d’un tunnel', () => {
    const L = { type: 'local' as const, listenPort: 1, destHost: 'a', destPort: 2 }
    const R = { type: 'remote' as const, listenPort: 1, destHost: 'a', destPort: 2 }
    expect(tunnelState(L, { listening: true, sessionConnected: true })).toBe('active')
    expect(tunnelState(L, { listening: true, sessionConnected: false })).toBe('port-used-elsewhere')
    expect(tunnelState(L, { listening: false, sessionConnected: true })).toBe('inactive')
    expect(tunnelState(R, { listening: null, sessionConnected: true })).toBe('unknown')
    expect(tunnelState(R, { listening: null, sessionConnected: false })).toBe('inactive')
  })

  it('description lisible avec le sens -L / -R / -D', () => {
    expect(describeTunnel({ type: 'local', listenPort: 14330, destHost: 'app.lan', destPort: 1433 })).toEqual({
      flag: '-L',
      spec: '14330:app.lan:1433',
      listen: 'localhost:14330',
      destination: 'app.lan:1433'
    })
    expect(describeTunnel({ type: 'dynamic', listenPort: 1080 }).flag).toBe('-D')
  })

  it('sonde l’adresse locale de bouclage quand l’écoute vise toutes les interfaces', () => {
    expect(probeHost(undefined)).toBe('127.0.0.1')
    expect(probeHost('*')).toBe('127.0.0.1')
    expect(probeHost('0.0.0.0')).toBe('127.0.0.1')
    expect(probeHost('localhost')).toBe('localhost')
  })
})
