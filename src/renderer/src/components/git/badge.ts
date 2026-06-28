import type { GitCategory } from '@shared/types'

/** Lettre + classe de couleur du statut d'un fichier (façon GitHub Desktop). */
export function badge(cat: GitCategory): { letter: string; cls: string } {
  switch (cat) {
    case 'added':
      return { letter: 'A', cls: 'text-success-fg' }
    case 'untracked':
      return { letter: 'U', cls: 'text-success-fg' }
    case 'deleted':
      return { letter: 'D', cls: 'text-danger-fg' }
    case 'renamed':
      return { letter: 'R', cls: 'text-accent' }
    case 'conflict':
      return { letter: '!', cls: 'text-danger-fg' }
    default:
      return { letter: 'M', cls: 'text-warning-fg' }
  }
}
