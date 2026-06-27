import { promises as fs } from 'node:fs'
import { shell } from 'electron'
import type { UndoInfo, UndoResult } from '@shared/types'

/**
 * Pile d'annulation des opérations sur fichiers (renommage simple / en masse,
 * déplacement, copie, création). Chaque opération enregistre de quoi se défaire :
 *  - renommages/déplacements → on remet chaque cible à sa source (ordre inverse) ;
 *  - créations/copies → on envoie les éléments produits à la corbeille (réversible).
 * La suppression (corbeille) n'est pas empilée : l'OS la gère déjà (restauration
 * manuelle depuis la corbeille).
 */

export type UndoOp =
  | { kind: 'rename'; label: string; pairs: { from: string; to: string }[] }
  | { kind: 'move'; label: string; pairs: { from: string; to: string }[] }
  | { kind: 'create'; label: string; paths: string[] }
  | { kind: 'copy'; label: string; paths: string[] }

const MAX = 30
const stack: UndoOp[] = []

export function pushUndo(op: UndoOp): void {
  // Ignore les opérations vides (rien à défaire).
  if ('pairs' in op && op.pairs.length === 0) return
  if ('paths' in op && op.paths.length === 0) return
  stack.push(op)
  if (stack.length > MAX) stack.shift()
}

export function peekUndo(): UndoInfo {
  const op = stack[stack.length - 1]
  return op ? { canUndo: true, label: op.label } : { canUndo: false }
}

async function trashAll(paths: string[]): Promise<void> {
  for (const p of paths) {
    try {
      await shell.trashItem(p)
    } catch {
      /* déjà supprimé / introuvable : on continue */
    }
  }
}

async function revertPairs(pairs: { from: string; to: string }[]): Promise<void> {
  // Ordre inverse : évite les collisions transitoires entre éléments du lot.
  for (const p of [...pairs].reverse()) {
    await fs.rename(p.to, p.from)
  }
}

/** Annule la dernière opération empilée. */
export async function undoLast(): Promise<UndoResult> {
  const op = stack.pop()
  if (!op) return { ok: false, error: 'Rien à annuler.' }
  try {
    if (op.kind === 'rename' || op.kind === 'move') {
      await revertPairs(op.pairs)
    } else {
      await trashAll(op.paths)
    }
    return { ok: true, label: op.label }
  } catch (e) {
    return { ok: false, label: op.label, error: e instanceof Error ? e.message : String(e) }
  }
}
