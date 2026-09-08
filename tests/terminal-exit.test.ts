import { describe, expect, it } from 'vitest'
import { shellKindOf, makeTag, wrapCommand, scanForExit } from '../src/shared/terminal-exit'

describe('terminal-exit', () => {
  it('une session SSH parle POSIX, quel que soit le shell local qui a lancé ssh', () => {
    expect(shellKindOf('cmd', true)).toBe('posix')
    expect(shellKindOf('powershell', true)).toBe('posix')
  })

  it('sinon le shell du terminal décide', () => {
    expect(shellKindOf('cmd', false)).toBe('cmd')
    expect(shellKindOf('powershell', false)).toBe('powershell')
    expect(shellKindOf('pwsh', false)).toBe('powershell')
    expect(shellKindOf('git-bash', false)).toBe('posix')
    expect(shellKindOf(undefined, false)).toBe('posix')
  })

  it('le code est rendu MÊME quand la commande échoue (jamais &&)', () => {
    const tag = '__T__'
    expect(wrapCommand('faux', tag, 'posix')).toBe(`faux; printf '__T__%s__T__\\n' "$?"`)
    expect(wrapCommand('faux', tag, 'cmd')).toBe('faux & echo __T__%errorlevel%__T__')
    expect(wrapCommand('faux', tag, 'powershell')).toContain('; if ($null -eq $LASTEXITCODE)')
    for (const kind of ['posix', 'cmd', 'powershell'] as const) {
      expect(wrapCommand('x', tag, kind)).not.toContain('&&')
    }
  })

  it('lit le code de sortie et retire la ligne de balise', () => {
    const tag = '__T__'
    const raw = ['ls -l', 'total 4', 'app.js', `${tag}0${tag}`].join('\n')
    const r = scanForExit(raw, tag)
    expect(r.done).toBe(true)
    expect(r.code).toBe(0)
    expect(r.output).toBe('ls -l\ntotal 4\napp.js')
    expect(r.output).not.toContain(tag)
  })

  it('un échec rend son code', () => {
    const tag = '__T__'
    const r = scanForExit(`bash: introuvable\n${tag}127${tag}`, tag)
    expect(r.code).toBe(127)
    expect(r.output).toBe('bash: introuvable')
  })

  it('l’écho de la commande porte la balise sans être le résultat', () => {
    const tag = '__T__'
    // Première ligne : ce que le terminal réaffiche de la commande tapée.
    const raw = [`ls; printf '${tag}%s${tag}\\n' "$?"`, 'app.js', `${tag}0${tag}`].join('\n')
    const r = scanForExit(raw, tag)
    expect(r.code).toBe(0)
    expect(r.output).toBe('app.js')
  })

  it('commande encore en cours : pas de code, la sortie reste lisible', () => {
    const r = scanForExit('Server listening on :3000', '__T__')
    expect(r.done).toBe(false)
    expect(r.code).toBeNull()
    expect(r.output).toBe('Server listening on :3000')
  })

  it('deux exécutions ne se confondent pas (balises distinctes)', () => {
    expect(makeTag(1)).not.toBe(makeTag(2))
    const r = scanForExit(`${makeTag(1)}0${makeTag(1)}`, makeTag(2))
    expect(r.done).toBe(false)
  })
})
