import { describe, expect, it } from 'vitest'
import { shellKindOf, makeTag, wrapCommand, scanForExit, startMarker } from '../src/shared/terminal-exit'

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
    expect(wrapCommand('faux', tag, 'posix')).toBe(
      `printf '%s%s\\n' '__T__' 'BEGIN'; faux; printf '%s%s%s\\n' '__T__' "$?" '__T__'`
    )
    expect(wrapCommand('faux', tag, 'cmd')).toContain(' & faux & ')
    expect(wrapCommand('faux', tag, 'powershell')).toContain('; faux; $__gvueOk = $?; if ($null -eq $LASTEXITCODE)')
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

  it('le repère de début n’apparaît jamais d’un seul tenant dans la commande tapée', () => {
    const tag = '__T__'
    for (const kind of ['posix', 'cmd', 'powershell'] as const) {
      const typed = wrapCommand('echo ok', tag, kind)
      expect(typed).not.toContain(startMarker(tag))
      expect(typed).not.toMatch(/__T__\d+__T__/)
    }
  })

  it('PowerShell : le code n’est pas avalé par un nom de variable collé à la balise', () => {
    const ps = wrapCommand('faux', '__T__', 'powershell')
    expect(ps).toContain('"__T__$($LASTEXITCODE)__T__"')
    expect(ps).not.toContain('$LASTEXITCODE__T__')
  })

  it('cmd lit le code APRÈS la commande (pas %errorlevel% développé à la saisie)', () => {
    expect(wrapCommand('faux', '__T__', 'cmd')).toBe('echo __T__^BEGIN & faux & call echo __T__%^errorlevel%__T__')
  })

  it('écho coupé à la largeur du terminal : rien de la commande tapée ne reste (capture réelle)', () => {
    const tag = '__GVUE1_mvjgoam9__'
    const raw = [
      'C:\\Dev>echo __GVUE1_mvjgoam9__^BEGIN & echo web-win-01 & call echo __GVUE1_mvjgoa',
      'm9__%^errorlevel%__GVUE1_mvjgoam9__',
      '__GVUE1_mvjgoam9__BEGIN',
      'web-win-01',
      '__GVUE1_mvjgoam9__0__GVUE1_mvjgoam9__',
      '',
      'C:\\Dev>'
    ].join('\r\n')
    const r = scanForExit(raw, tag)
    expect(r.code).toBe(0)
    expect(r.output).toBe('web-win-01')
  })

  it('readline redessine la ligne (caractères doublés) : seule la sortie reste', () => {
    const tag = '__T__'
    const raw = [
      "user@web-win-01:~$ printf '%s%s\\n' '__T__' 'BEGIN'; timeout 4",
      "4 echo web-win-01; printf '%s%s%s\\n' '__T__' \"$?\" '__T__'",
      '__T__BEGIN',
      'web-win-01',
      '__T__0__T__',
      'user@web-win-01:~$ '
    ].join('\n')
    const r = scanForExit(raw, tag)
    expect(r.output).toBe('web-win-01')
  })

  it('sortie sans saut de ligne final : le texte collé à la balise de fin est gardé', () => {
    const tag = '__T__'
    const r = scanForExit(`__T__BEGIN\nabc__T__0__T__`, tag)
    expect(r.code).toBe(0)
    expect(r.output).toBe('abc')
  })

  it('commande en cours : la sortie part du repère de début', () => {
    const tag = '__T__'
    const r = scanForExit(`$ printf ...\n__T__BEGIN\nServer listening`, tag)
    expect(r.done).toBe(false)
    expect(r.output).toBe('Server listening')
  })

  it('deux exécutions ne se confondent pas (balises distinctes)', () => {
    expect(makeTag(1)).not.toBe(makeTag(2))
    const r = scanForExit(`${makeTag(1)}0${makeTag(1)}`, makeTag(2))
    expect(r.done).toBe(false)
  })
})
