import { useEffect, useState } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { History, X, Copy, Loader2 } from 'lucide-react'
import type { GitCommit } from '@shared/types'
import { useUiStore } from '../../state/useUiStore'
import { baseName } from '../../lib/format'
import { t, tn } from '../../i18n'
import DiffView from './DiffView'

/** Dossier parent d'un chemin (séparateurs Windows ou POSIX). */
function parentOf(p: string): string {
  return p.replace(/[\\/][^\\/]+$/, '') || p
}

/**
 * Historique Git d'un fichier (clic droit → « Historique Git ») : liste des
 * commits ayant touché le fichier (renommages suivis via --follow) à gauche,
 * diff du fichier dans le commit sélectionné à droite.
 */
export default function FileHistory(): JSX.Element | null {
  const file = useUiStore((s) => s.fileHistoryPath)
  const close = (): void => useUiStore.getState().setFileHistory(null)

  const [commits, setCommits] = useState<GitCommit[] | null>(null)
  const [selHash, setSelHash] = useState<string | null>(null)
  const [diff, setDiff] = useState('')

  // Charge l'historique à l'ouverture (le dossier parent suffit : git remonte
  // lui-même à la racine du dépôt).
  useEffect(() => {
    if (!file) return
    let alive = true
    setCommits(null)
    setSelHash(null)
    setDiff('')
    void window.api.git.fileLog(parentOf(file), file, 200).then((c) => {
      if (!alive) return
      setCommits(c)
      if (c.length) {
        setSelHash(c[0].hash)
        void window.api.git.commitDiff(parentOf(file), c[0].hash, file).then((d) => alive && setDiff(d))
      }
    })
    return () => {
      alive = false
    }
  }, [file])

  // Fermer avec Échap.
  useEffect(() => {
    if (!file) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [file])

  if (!file) return null

  const select = (hash: string): void => {
    setSelHash(hash)
    setDiff('')
    void window.api.git.commitDiff(parentOf(file), hash, file).then(setDiff)
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center" onMouseDown={close}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative z-10 flex h-[min(640px,88vh)] w-[min(980px,94vw)] flex-col overflow-hidden rounded-app border border-border bg-bg-secondary shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
          <History size={15} className="text-accent" />
          <span className="min-w-0 truncate text-[13px] font-medium text-fg" title={file}>
            {t('Historique Git — {name}', { name: baseName(file) })}
          </span>
          {commits && (
            <span className="shrink-0 text-[11px] text-fg-muted">
              {tn(commits.length, '{n} commit', '{n} commits')}
            </span>
          )}
          <button
            onClick={close}
            className="ml-auto grid h-6 w-6 shrink-0 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-fg"
          >
            <X size={15} />
          </button>
        </div>

        {commits === null ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-[12px] text-fg-muted">
            <Loader2 size={14} className="animate-spin" /> {t("Chargement de l'historique…")}
          </div>
        ) : commits.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-6 text-center text-[12px] text-fg-muted">
            {t('Aucun commit ne touche ce fichier (non suivi, ou hors dépôt Git).')}
          </div>
        ) : (
          <PanelGroup autoSaveId="gvue:file-history" direction="horizontal" className="min-h-0 flex-1">
            <Panel defaultSize={38} minSize={24}>
              <div className="h-full overflow-auto border-r border-border">
                {commits.map((c) => {
                  const isSel = c.hash === selHash
                  return (
                    <button
                      key={c.hash}
                      onClick={() => select(c.hash)}
                      className={`flex w-full flex-col items-start gap-0.5 border-b border-border/60 px-3 py-2 text-left ${
                        isSel ? 'bg-accent-soft' : 'hover:bg-bg-hover'
                      }`}
                    >
                      <span className={`w-full truncate text-[12px] ${isSel ? 'text-accent' : 'text-fg'}`} title={c.subject}>
                        {c.subject}
                      </span>
                      <span className="flex w-full items-center gap-1.5 text-[11px] text-fg-muted">
                        <span className="min-w-0 flex-1 truncate">{c.author}</span>
                        <span className="shrink-0 tabular-nums">{c.date}</span>
                        <span
                          onClick={(e) => {
                            e.stopPropagation()
                            void navigator.clipboard?.writeText(c.hash)
                          }}
                          title={t('Copier le hash complet')}
                          className="flex shrink-0 items-center gap-0.5 rounded px-0.5 font-mono hover:bg-bg-hover hover:text-fg"
                        >
                          {c.shortHash} <Copy size={10} />
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </Panel>

            <PanelResizeHandle className="w-px bg-border transition-colors hover:bg-accent" />

            <Panel minSize={30}>
              <div className="h-full overflow-auto p-2">
                {diff ? (
                  <DiffView diff={diff} />
                ) : selHash ? (
                  <p className="px-1 text-[12px] text-fg-muted">
                    {t('Pas de diff textuel pour ce commit (binaire, ou renommage sans modification).')}
                  </p>
                ) : null}
              </div>
            </Panel>
          </PanelGroup>
        )}
      </div>
    </div>
  )
}
