import { useEffect, useState } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { GitCommit as GitCommitIcon, Loader2, Copy } from 'lucide-react'
import type { GitCommit, GitFileChange } from '@shared/types'
import { pathKey } from '../../lib/format'
import DiffView from './DiffView'
import { badge } from './badge'

/**
 * Vue « Historique » façon GitHub Desktop : liste des commits (gauche), fichiers
 * modifiés par le commit sélectionné (milieu), et diff du fichier (droite).
 */
export default function GitHistory({ root }: { root: string }): JSX.Element {
  const [commits, setCommits] = useState<GitCommit[]>([])
  const [selHash, setSelHash] = useState<string | null>(null)
  const [files, setFiles] = useState<GitFileChange[]>([])
  const [selFile, setSelFile] = useState<string | null>(null)
  const [diff, setDiff] = useState('')
  const [loadingFiles, setLoadingFiles] = useState(false)

  // Charge l'historique à l'ouverture / au changement de dépôt.
  useEffect(() => {
    let alive = true
    setSelHash(null)
    setFiles([])
    setSelFile(null)
    setDiff('')
    if (!root) {
      setCommits([])
      return
    }
    void window.api.git.log(root, 200).then((c) => {
      if (alive) setCommits(c)
    })
    return () => {
      alive = false
    }
  }, [root])

  const loadDiff = async (hash: string, file: string): Promise<void> => {
    setSelFile(file)
    setDiff(await window.api.git.commitDiff(root, hash, file))
  }

  const selectCommit = async (hash: string): Promise<void> => {
    setSelHash(hash)
    setSelFile(null)
    setDiff('')
    setLoadingFiles(true)
    const fs = await window.api.git.commitFiles(root, hash)
    setLoadingFiles(false)
    setFiles(fs)
    if (fs.length) void loadDiff(hash, fs[0].path)
  }

  const relOf = (p: string): string => (p.startsWith(root + '/') ? p.slice(root.length + 1) : p)
  const selCommit = commits.find((c) => c.hash === selHash) ?? null

  return (
    <PanelGroup autoSaveId="gvue:git-history" direction="horizontal" className="min-h-0 flex-1">
      {/* Liste des commits */}
      <Panel defaultSize={30} minSize={20}>
        <div className="flex h-full flex-col border-r border-border">
          <div className="shrink-0 border-b border-border px-3 py-1.5 text-[11px] uppercase tracking-wider text-fg-muted">
            Historique{commits.length ? ` · ${commits.length}` : ''}
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {commits.length === 0 ? (
              <p className="px-3 py-3 text-center text-[12px] text-fg-muted">Aucun commit.</p>
            ) : (
              commits.map((c) => {
                const isSel = c.hash === selHash
                return (
                  <button
                    key={c.hash}
                    onClick={() => void selectCommit(c.hash)}
                    className={`flex w-full flex-col items-start gap-0.5 border-b border-border/60 px-3 py-2 text-left ${
                      isSel ? 'bg-accent-soft' : 'hover:bg-bg-hover'
                    }`}
                  >
                    <span
                      className={`w-full truncate text-[12px] ${isSel ? 'text-accent' : 'text-fg'}`}
                      title={c.subject}
                    >
                      {c.subject}
                    </span>
                    <span className="flex w-full items-center gap-1.5 text-[11px] text-fg-muted">
                      <span className="min-w-0 flex-1 truncate">{c.author}</span>
                      <span className="shrink-0 tabular-nums">{c.date}</span>
                      <span className="shrink-0 font-mono">{c.shortHash}</span>
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      </Panel>

      <PanelResizeHandle className="w-px bg-border transition-colors hover:bg-accent" />

      {/* Fichiers du commit sélectionné */}
      <Panel defaultSize={28} minSize={18}>
        <div className="flex h-full flex-col border-r border-border">
          {selCommit ? (
            <>
              <div className="shrink-0 border-b border-border px-3 py-2">
                <div className="mb-1 flex items-start gap-1.5">
                  <GitCommitIcon size={14} className="mt-0.5 shrink-0 text-accent" />
                  <span className="min-w-0 break-words text-[12px] text-fg">{selCommit.subject}</span>
                </div>
                <div className="flex items-center gap-1.5 pl-[22px] text-[11px] text-fg-muted">
                  <span className="min-w-0 flex-1 truncate">
                    {selCommit.author} · {selCommit.date}
                  </span>
                  <button
                    onClick={() => void navigator.clipboard?.writeText(selCommit.hash)}
                    title="Copier le hash complet"
                    className="flex shrink-0 items-center gap-1 rounded px-1 font-mono hover:bg-bg-hover hover:text-fg"
                  >
                    {selCommit.shortHash} <Copy size={11} />
                  </button>
                </div>
              </div>
              <div className="shrink-0 px-3 py-1 text-[11px] uppercase tracking-wider text-fg-muted">
                {loadingFiles ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 size={11} className="animate-spin" /> Chargement…
                  </span>
                ) : (
                  `${files.length} fichier${files.length > 1 ? 's' : ''} modifié${files.length > 1 ? 's' : ''}`
                )}
              </div>
              <div className="min-h-0 flex-1 overflow-auto p-1.5">
                {files.map((f) => {
                  const b = badge(f.category)
                  const isSel = selFile != null && pathKey(f.path) === pathKey(selFile)
                  return (
                    <button
                      key={f.path}
                      onClick={() => void loadDiff(selCommit.hash, f.path)}
                      className={`flex w-full items-center gap-1.5 rounded-app px-1.5 py-1 text-left ${
                        isSel ? 'bg-accent-soft ring-1 ring-inset ring-accent' : 'hover:bg-bg-hover'
                      }`}
                    >
                      <span className={`w-3 shrink-0 text-center font-mono text-[11px] font-bold ${b.cls}`}>
                        {b.letter}
                      </span>
                      <span
                        className={`min-w-0 flex-1 truncate text-[12px] ${isSel ? 'text-accent' : 'text-fg-secondary'}`}
                        title={relOf(f.path)}
                      >
                        {relOf(f.path)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center px-4 text-center text-[12px] text-fg-muted">
              Sélectionnez un commit pour voir ses fichiers.
            </div>
          )}
        </div>
      </Panel>

      <PanelResizeHandle className="w-px bg-border transition-colors hover:bg-accent" />

      {/* Diff du fichier sélectionné */}
      <Panel minSize={28}>
        <div className="flex h-full flex-col">
          {!selFile ? (
            <div className="flex h-full items-center justify-center text-[12px] text-fg-muted">
              {selCommit ? 'Sélectionnez un fichier pour voir le diff.' : ''}
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto p-2">
              <div className="mb-1.5 truncate px-1 font-mono text-[11px] text-fg-muted">
                {relOf(selFile)}
              </div>
              {diff ? (
                <DiffView diff={diff} />
              ) : (
                <p className="px-1 text-[12px] text-fg-muted">
                  Pas de diff textuel (fichier binaire, vide, ou renommage sans modification).
                </p>
              )}
            </div>
          )}
        </div>
      </Panel>
    </PanelGroup>
  )
}
