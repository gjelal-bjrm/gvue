import { describe, it, expect } from 'vitest'
import { looksLikePasswordPrompt } from '../src/main/services/pty-manager'

describe('looksLikePasswordPrompt', () => {
  it("reconnaît les invites d'OpenSSH (anglais, français, phrase de passe)", () => {
    expect(looksLikePasswordPrompt("demo@test.rebex.net's password: ")).toBe(true)
    expect(looksLikePasswordPrompt('Password:')).toBe(true)
    expect(looksLikePasswordPrompt('Mot de passe : ')).toBe(true)
    expect(looksLikePasswordPrompt("Enter passphrase for key '/c/id_rsa': ")).toBe(true)
  })

  it('ignore le mot croisé dans des logs (invite = fin de fragment)', () => {
    expect(looksLikePasswordPrompt('Wrong password: retry later\nuser@host:~$ ')).toBe(false)
    expect(looksLikePasswordPrompt('changed the password of the DB')).toBe(false)
    expect(looksLikePasswordPrompt('')).toBe(false)
  })
})
import { stripAnsi, tailLines } from '../src/main/services/strip-ansi'
import { appendCapped } from '../src/main/services/pty-manager'

describe('stripAnsi', () => {
  it('retire les couleurs CSI', () => {
    expect(stripAnsi('\x1b[32mOK\x1b[0m fini')).toBe('OK fini')
  })

  it('retire les séquences OSC (titre de fenêtre)', () => {
    expect(stripAnsi('\x1b]0;mon titre\x07texte')).toBe('texte')
  })

  it('retire les échappements simples et les retours chariot', () => {
    expect(stripAnsi('a\x1b7b\r\nc')).toBe('ab\nc')
  })

  it('laisse le texte normal intact (crochets et backslashes compris)', () => {
    expect(stripAnsi('tableau[3] = C:\\dev éè')).toBe('tableau[3] = C:\\dev éè')
  })
})

describe('tailLines', () => {
  it('renvoie les n dernières lignes', () => {
    expect(tailLines('a\nb\nc\nd', 2)).toBe('c\nd')
  })
  it('texte plus court que n : tout', () => {
    expect(tailLines('a\nb', 10)).toBe('a\nb')
  })
})

describe('appendCapped (tampon de sortie pty)', () => {
  it('accumule sous le plafond', () => {
    const buf = { chunks: [] as string[], size: 0 }
    appendCapped(buf, 'aaa', 100)
    appendCapped(buf, 'bbb', 100)
    expect(buf.chunks.join('')).toBe('aaabbb')
    expect(buf.size).toBe(6)
  })

  it('évince les plus anciens fragments au-delà du plafond', () => {
    const buf = { chunks: [] as string[], size: 0 }
    appendCapped(buf, 'x'.repeat(60), 100)
    appendCapped(buf, 'y'.repeat(60), 100)
    // 120 > 100 → le premier fragment est évincé.
    expect(buf.chunks.join('')).toBe('y'.repeat(60))
    expect(buf.size).toBe(60)
  })

  it('conserve toujours au moins le dernier fragment (même trop grand)', () => {
    const buf = { chunks: [] as string[], size: 0 }
    appendCapped(buf, 'z'.repeat(500), 100)
    expect(buf.chunks.join('')).toBe('z'.repeat(500))
  })
})
