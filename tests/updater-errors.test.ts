import { describe, expect, it } from 'vitest'
import {
  isTransientNetworkError,
  isNoReleaseError,
  friendlyUpdateError
} from '../src/main/services/updater-errors'

describe('updater-errors', () => {
  it('reconnaît les erreurs réseau passagères (cas vécu : flux HTTP/2 refusé)', () => {
    for (const m of [
      'net::ERR_HTTP2_SERVER_REFUSED_STREAM',
      'net::ERR_CONNECTION_RESET',
      'net::ERR_INTERNET_DISCONNECTED',
      'net::ERR_NETWORK_CHANGED',
      'read ECONNRESET',
      'connect ETIMEDOUT 140.82.121.4:443',
      'getaddrinfo EAI_AGAIN github.com',
      'socket hang up',
      'request timed out'
    ]) {
      expect(isTransientNetworkError(m), m).toBe(true)
    }
  })

  it('ne prend pas une panne définitive pour une erreur réseau', () => {
    for (const m of ['EACCES: permission denied', 'sha512 checksum mismatch', 'ENOSPC']) {
      expect(isTransientNetworkError(m), m).toBe(false)
    }
  })

  it('distingue « aucune release publiée » d’une panne', () => {
    expect(isNoReleaseError('No published versions on GitHub')).toBe(true)
    expect(isNoReleaseError('Cannot find latest.yml')).toBe(true)
    expect(isNoReleaseError('HttpError: 404 Not Found')).toBe(true)
    expect(isNoReleaseError('net::ERR_HTTP2_SERVER_REFUSED_STREAM')).toBe(false)
  })

  it('remplace les codes techniques par une phrase actionnable', () => {
    const net = friendlyUpdateError('net::ERR_HTTP2_SERVER_REFUSED_STREAM')
    expect(net).toContain('Internet')
    expect(net).not.toContain('ERR_HTTP2')

    expect(friendlyUpdateError('EACCES: permission denied')).toContain('Droits insuffisants')
    expect(friendlyUpdateError('ENOSPC: no space left')).toContain('Espace disque')
    expect(friendlyUpdateError('sha512 checksum mismatch')).toContain('corrompu')
  })

  it('garde le message brut quand la cause est inconnue (mieux que rien)', () => {
    expect(friendlyUpdateError('Erreur inattendue XYZ')).toBe('Erreur inattendue XYZ')
  })
})
