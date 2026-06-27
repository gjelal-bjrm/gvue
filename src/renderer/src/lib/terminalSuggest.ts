import type { Terminal as XTerm } from '@xterm/xterm'

/**
 * Autocomplétion « fantôme » (ghost text) pour le terminal — façon fish/zsh.
 *
 * Best-effort : GVue est à l'extérieur du shell réel, donc on reconstitue la
 * ligne tapée en interceptant les touches (printables + retour arrière), et on
 * dessine la suggestion dans un **overlay DOM** positionné sur le curseur (jamais
 * dans le tampon du pty → aucune corruption possible). Tab valide la suggestion.
 * Sur une touche complexe (flèches, Ctrl…), on se met en pause jusqu'à Entrée.
 *
 * Sources : liste de commandes selon le type de shell + fichiers/dossiers du cwd.
 */

type Family = 'powershell' | 'cmd' | 'unix' | 'python' | 'other'

function familyOf(id: string): Family {
  if (id === 'powershell' || id === 'pwsh') return 'powershell'
  if (id === 'cmd' || id === 'fallback') return 'cmd'
  if (['git-bash', 'wsl', 'bash', 'zsh', 'sh', 'default'].includes(id)) return 'unix'
  if (id === 'python') return 'python'
  return 'other'
}

/** Couleur du fantôme, adaptée au type de terminal (dim). */
const GHOST_COLOR: Record<Family, string> = {
  powershell: 'rgba(122,166,218,0.6)',
  cmd: 'rgba(160,166,173,0.55)',
  unix: 'rgba(143,191,127,0.6)',
  python: 'rgba(216,192,106,0.6)',
  other: 'rgba(160,160,170,0.55)'
}

const COMMON = ['git', 'npm', 'npx', 'node', 'python', 'pip', 'code', 'cls', 'clear', 'exit']

const COMMANDS: Record<Family, string[]> = {
  powershell: [
    'Get-ChildItem', 'Set-Location', 'Get-Content', 'Set-Content', 'Remove-Item', 'Copy-Item',
    'Move-Item', 'New-Item', 'Get-Process', 'Stop-Process', 'Start-Process', 'Select-String',
    'Write-Host', 'Where-Object', 'ForEach-Object', 'Get-Command', 'Get-Help',
    'ls', 'dir', 'cd', 'cat', 'rm', 'cp', 'mv', 'mkdir', 'echo', 'pwd', 'cls', ...COMMON
  ],
  cmd: [
    'dir', 'cd', 'cls', 'copy', 'move', 'del', 'erase', 'mkdir', 'md', 'rmdir', 'rd', 'type',
    'echo', 'set', 'ren', 'rename', 'where', 'tasklist', 'taskkill', 'ipconfig', 'ping', 'tree',
    'findstr', 'start', 'title', 'pause', ...COMMON
  ],
  unix: [
    'ls', 'cd', 'pwd', 'cat', 'less', 'more', 'head', 'tail', 'grep', 'find', 'mkdir', 'rmdir',
    'rm', 'cp', 'mv', 'touch', 'echo', 'export', 'chmod', 'chown', 'which', 'ln', 'tar', 'curl',
    'wget', 'ssh', 'scp', 'nano', 'vim', 'kill', 'ps', 'df', 'du', 'sudo', 'man', ...COMMON
  ],
  python: ['print(', 'import ', 'from ', 'def ', 'class ', 'return ', 'for ', 'while ', 'if ',
    'elif ', 'else:', 'help(', 'range(', 'len(', 'open(', 'exit()'],
  other: COMMON
}

export interface SuggestOptions {
  shellId: string
  cwd: string
  write: (data: string) => void
}

/** Branche l'autocomplétion fantôme sur une instance xterm. Renvoie un dispose. */
export function attachSuggest(term: XTerm, opts: SuggestOptions): () => void {
  const family = familyOf(opts.shellId)
  const sep = family === 'unix' ? '/' : '\\'
  const cmds = COMMANDS[family]
  const host = term.element
  if (!host) return () => {}

  let line = ''
  let ghost = ''
  let paused = false
  let cwd = opts.cwd
  let reqId = 0

  const overlay = document.createElement('div')
  overlay.style.position = 'absolute'
  overlay.style.pointerEvents = 'none'
  overlay.style.whiteSpace = 'pre'
  overlay.style.zIndex = '5'
  overlay.style.color = GHOST_COLOR[family]
  overlay.style.display = 'none'
  host.style.position = 'relative'
  host.appendChild(overlay)

  const hideGhost = (): void => {
    ghost = ''
    overlay.style.display = 'none'
  }

  const place = (): void => {
    const screen = host.querySelector('.xterm-screen') as HTMLElement | null
    if (!screen || !ghost) {
      overlay.style.display = 'none'
      return
    }
    const sRect = screen.getBoundingClientRect()
    const hRect = host.getBoundingClientRect()
    const cellW = sRect.width / term.cols
    const cellH = sRect.height / term.rows
    const cx = term.buffer.active.cursorX
    const cy = term.buffer.active.cursorY
    // Ne pas déborder de la largeur du terminal.
    if (cx + ghost.length > term.cols) {
      overlay.style.display = 'none'
      return
    }
    overlay.style.left = `${sRect.left - hRect.left + cx * cellW}px`
    overlay.style.top = `${sRect.top - hRect.top + cy * cellH}px`
    overlay.style.height = `${cellH}px`
    overlay.style.lineHeight = `${cellH}px`
    overlay.style.fontFamily = String(term.options.fontFamily || 'monospace')
    overlay.style.fontSize = `${term.options.fontSize || 13}px`
    overlay.textContent = ghost
    overlay.style.display = 'block'
  }

  const splitToken = (): { token: string; isFirstWord: boolean } => {
    const m = /(\S*)$/.exec(line)
    const token = m ? m[1] : ''
    const before = line.slice(0, line.length - token.length)
    return { token, isFirstWord: before.trim() === '' }
  }

  const recompute = (): void => {
    if (paused) return hideGhost()
    const { token, isFirstWord } = splitToken()
    if (!token) return hideGhost()
    const hasSep = token.includes('/') || token.includes('\\')

    if (isFirstWord && !hasSep) {
      // Complétion de commande (synchrone).
      const low = token.toLowerCase()
      const hit = cmds.find((c) => c.toLowerCase().startsWith(low) && c.length > token.length)
      if (hit) {
        ghost = hit.slice(token.length)
        place()
      } else {
        hideGhost()
      }
      return
    }

    // Complétion de fichier/dossier (asynchrone).
    const id = ++reqId
    const at = line
    void window.api.fs
      .complete(cwd, token, sep)
      .then((cands) => {
        if (id !== reqId || line !== at) return // obsolète
        const hit = cands.find((c) => c.length > token.length && c.startsWith(token))
        if (hit) {
          ghost = hit.slice(token.length)
          place()
        } else {
          hideGhost()
        }
      })
      .catch(() => {})
  }

  // Met à jour le cwd (best-effort) quand l'utilisateur valide un « cd … ».
  const onSubmit = (): void => {
    const m = /^\s*cd\s+(.+?)\s*$/.exec(line)
    if (m) {
      let target = m[1].trim().replace(/^["']|["']$/g, '')
      if (target === '..') cwd = cwd.replace(/[\\/][^\\/]+[\\/]?$/, '') || cwd
      else if (target === '~') {
        /* inconnu côté renderer : on laisse le cwd */
      } else if (/^([a-zA-Z]:[\\/]|[\\/])/.test(target)) cwd = target // chemin absolu
      else cwd = `${cwd.replace(/[\\/]+$/, '')}${sep}${target}` // relatif
    }
    line = ''
    paused = false
    hideGhost()
  }

  term.attachCustomKeyEventHandler((e) => {
    if (e.type !== 'keydown') return true
    if (e.key === 'Tab' && ghost) {
      e.preventDefault()
      opts.write(ghost)
      line += ghost
      hideGhost()
      return false // ne pas envoyer Tab au pty
    }
    if (e.ctrlKey || e.altKey || e.metaKey) {
      paused = true
      hideGhost()
      return true
    }
    if (e.key === 'Enter') {
      onSubmit()
      return true
    }
    if (e.key === 'Tab') return true // pas de fantôme → complétion native du shell
    if (e.key === 'Backspace') {
      if (!paused) {
        line = line.slice(0, -1)
        recompute()
      }
      return true
    }
    if (e.key.length === 1) {
      if (!paused) {
        line += e.key
        recompute()
      }
      return true
    }
    // Flèches, Home/Fin, Suppr, etc. → on se met en pause (désync possible).
    paused = true
    hideGhost()
    return true
  })

  // Collage (multi-caractères) → pause (impossible à suivre fidèlement).
  const dataDisp = term.onData((d) => {
    if (d.length > 1 && !d.startsWith('\x1b')) {
      paused = true
      hideGhost()
    }
  })
  const renderDisp = term.onRender(() => place())
  const resizeDisp = term.onResize(() => place())

  return () => {
    term.attachCustomKeyEventHandler(() => true)
    dataDisp.dispose()
    renderDisp.dispose()
    resizeDisp.dispose()
    overlay.remove()
  }
}
