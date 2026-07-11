import { describe, it, expect, vi } from 'vitest'

// fileActions importe des stores zustand (qui touchent window.api) : on les
// neutralise pour tester la fonction pure opFeedback.
vi.mock('../src/renderer/src/state/useUiStore', () => ({ useUiStore: { getState: () => ({}) } }))
vi.mock('../src/renderer/src/state/useNavStore', () => ({
  useNavStore: { getState: () => ({}) },
  activePane: () => ({})
}))
vi.mock('../src/renderer/src/state/useGitStore', () => ({ useGitStore: { getState: () => ({}) } }))

import { opFeedback } from '../src/renderer/src/lib/fileActions'

describe('opFeedback', () => {
  it('silencieux quand tout a réussi', () => {
    expect(opFeedback({ ok: 3, errors: [] }, 'Copie')).toBeNull()
  })

  it('« annulé » n’est pas une erreur', () => {
    expect(opFeedback({ ok: 1, errors: [], cancelled: true }, 'Copie')).toBe('Copie annulé(e).')
  })

  it('échec partiel : compte réussites et échecs', () => {
    const msg = opFeedback({ ok: 2, errors: ['EPERM: x', 'EBUSY: y'] }, 'Déplacement')
    expect(msg).toContain('2 réussi(s)')
    expect(msg).toContain('2 échec(s)')
    expect(msg).toContain('EPERM: x')
  })

  it('échec total', () => {
    expect(opFeedback({ ok: 0, errors: ['EACCES'] }, 'Copie')).toBe('Échec copie : EACCES')
  })

  it('tronque les messages longs à 120 caractères', () => {
    const long = 'x'.repeat(300)
    const msg = opFeedback({ ok: 0, errors: [long] }, 'Copie') ?? ''
    expect(msg.length).toBeLessThan(160)
    expect(msg).toContain('…')
  })
})
