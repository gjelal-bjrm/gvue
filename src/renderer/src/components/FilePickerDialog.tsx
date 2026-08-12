import { useEffect, useState } from 'react'
import { Folder, File, ArrowUp, CornerDownLeft } from 'lucide-react'
import type { ListResult } from '@shared/types'
import { t } from '../i18n'

/**
 * Sélecteur de fichier OU de dossier intégré à GVue (n'utilise pas la boîte
 * native — c'est le but du programme). Navigue via `fs.list` depuis
 * `initialDir` ; un clic sur un dossier y entre. En mode 'file', un clic sur
 * un fichier le choisit ; en mode 'folder', les fichiers sont estompés et le
 * bouton « Choisir ce dossier » valide le dossier affiché.
 */
export default function FilePickerDialog(props: {
  initialDir: string
  title?: string
  /** 'file' (défaut) : choisir un fichier ; 'folder' : choisir un dossier. */
  mode?: 'file' | 'folder'
  onPick: (path: string) => void
  onClose: () => void
}): JSX.Element {
  const folderMode = props.mode === 'folder'
  const [dir, setDir] = useState(props.initialDir)
  const [result, setResult] = useState<ListResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setError(null)
    // track=false : un simple parcours ne doit pas compter comme une visite.
    window.api.fs
      .list(dir, false)
      .then((r) => alive && setResult(r))
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      alive = false
    }
  }, [dir])

  // Dossiers d'abord, puis fichiers ; on masque les éléments cachés.
  const entries = (result?.entries ?? [])
    .filter((e) => !e.hidden)
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name)
    })

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center" onMouseDown={props.onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative z-10 flex max-h-[70vh] w-[min(560px,92vw)] flex-col overflow-hidden rounded-app border border-border bg-bg-secondary shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2.5">
          <button
            onClick={() => result?.parent && setDir(result.parent)}
            disabled={!result?.parent}
            title={t('Dossier parent')}
            className="grid h-6 w-6 shrink-0 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-fg disabled:opacity-30"
          >
            <ArrowUp size={15} />
          </button>
          <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-fg" title={dir}>
            {dir}
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-auto py-1">
          {error ? (
            <div className="px-3 py-6 text-center text-[13px] text-danger-fg">{error}</div>
          ) : entries.length === 0 ? (
            <div className="px-3 py-6 text-center text-[13px] text-fg-muted">{t('Dossier vide')}</div>
          ) : (
            entries.map((e) =>
              e.kind === 'directory' ? (
                <button
                  key={e.path}
                  onClick={() => setDir(e.path)}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] text-fg-secondary hover:bg-bg-hover hover:text-fg"
                >
                  <Folder size={15} className="shrink-0 text-accent" />
                  <span className="min-w-0 flex-1 truncate">{e.name}</span>
                </button>
              ) : folderMode ? (
                // Contexte seulement : en mode dossier, les fichiers se voient
                // mais ne se choisissent pas.
                <div
                  key={e.path}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] text-fg-muted opacity-50"
                >
                  <File size={15} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{e.name}</span>
                </div>
              ) : (
                <button
                  key={e.path}
                  onClick={() => props.onPick(e.path)}
                  className="group flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] text-fg-secondary hover:bg-accent-soft hover:text-accent"
                  title={t('Choisir {name}', { name: e.name })}
                >
                  <File size={15} className="shrink-0 text-fg-muted group-hover:text-accent" />
                  <span className="min-w-0 flex-1 truncate">{e.name}</span>
                  <CornerDownLeft
                    size={13}
                    className="shrink-0 opacity-0 group-hover:opacity-100"
                  />
                </button>
              )
            )
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-3 py-2">
          <span className="min-w-0 truncate text-[11px] text-fg-muted">
            {folderMode
              ? t('Naviguez jusqu’au dossier voulu, puis validez.')
              : t('Cliquez un fichier pour le choisir.')}
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            {folderMode && (
              <button
                onClick={() => props.onPick(dir)}
                className="flex items-center gap-1.5 rounded-app bg-accent px-3 py-1 text-[12px] font-medium text-white hover:opacity-90"
              >
                <Folder size={13} /> {t('Choisir ce dossier')}
              </button>
            )}
            <button
              onClick={props.onClose}
              className="rounded-app px-2.5 py-1 text-[12px] text-fg-secondary hover:bg-bg-hover"
            >
              {t('Annuler')}
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}
