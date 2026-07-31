import { useMemo } from 'react'
import { GitCompareArrows, X, Folder, File, ArrowLeft, ArrowRight, RotateCw } from 'lucide-react'
import { useUiStore } from '../state/useUiStore'
import { useNavStore } from '../state/useNavStore'
import { compareDirs, type CompareRow, type DiffReason } from '../lib/compareDirs'
import { fmtBytes, formatDate, baseName } from '../lib/format'
import { t, tn } from '../i18n'
import type { DirEntry } from '@shared/types'

/** Libellé (traduit à l'appel, pas au chargement du module) d'une raison de différence. */
function reasonLabel(reason: DiffReason): string {
  switch (reason) {
    case 'kind':
      return t('type différent (fichier / dossier)')
    case 'size':
      return t('taille différente')
    case 'date':
      return t('date différente')
    default:
      return reason
  }
}

/**
 * Comparaison de deux volets (niveau courant, à partir des entrées déjà
 * chargées) : présents uniquement à gauche / à droite, et fichiers de même nom
 * mais différents (type, taille ou date). Superficielle : ne descend pas dans
 * les sous-dossiers.
 */
export default function ComparePanes(): JSX.Element | null {
  const open = useUiStore((s) => s.compareOpen)
  const panes = useNavStore((s) => s.panes)
  const close = (): void => useUiStore.getState().setCompare(false)

  // Les deux premiers volets qui affichent réellement un dossier.
  const usable = useMemo(
    () => panes.filter((p) => p.path && !p.quickAccess && !p.launcher).slice(0, 2),
    [panes]
  )

  const result = useMemo(() => {
    if (usable.length < 2) return null
    return compareDirs(usable[0].entries, usable[1].entries)
  }, [usable])

  if (!open) return null

  const [a, b] = usable

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center" onMouseDown={close}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative z-10 flex h-[min(620px,88vh)] w-[min(880px,94vw)] flex-col overflow-hidden rounded-app border border-border bg-bg-secondary shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
          <GitCompareArrows size={15} className="text-accent" />
          <span className="text-[13px] font-medium text-fg">{t('Comparer les volets')}</span>
          {result && (
            <span className="min-w-0 truncate text-[11px] text-fg-muted">
              {t('{a} ⟷ {b} · {identical}', {
                a: baseName(a.path),
                b: baseName(b.path),
                identical: tn(result.identical, '{n} identique', '{n} identiques')
              })}
            </span>
          )}
          <button
            onClick={() => useNavStore.getState().refreshAll()}
            title={t('Actualiser les deux volets')}
            className="ml-auto grid h-6 w-6 shrink-0 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-fg"
          >
            <RotateCw size={13} />
          </button>
          <button
            onClick={close}
            className="grid h-6 w-6 shrink-0 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-fg"
          >
            <X size={15} />
          </button>
        </div>

        {!result ? (
          <div className="flex flex-1 items-center justify-center px-6 text-center text-[12px] text-fg-muted">
            {t('Il faut deux volets ouverts sur des dossiers pour comparer.')}
            <br />
            {t("(Bouton « Diviser » de la barre d'outils, puis naviguer chaque volet.)")}
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto p-3 text-[12px]">
            <SectionTitle
              icon={<ArrowLeft size={13} />}
              label={t('Uniquement dans {dir}', { dir: baseName(a.path) || a.path })}
              count={result.onlyLeft.length}
              path={a.path}
            />
            <EntryRows entries={result.onlyLeft} />

            <SectionTitle
              icon={<ArrowRight size={13} />}
              label={t('Uniquement dans {dir}', { dir: baseName(b.path) || b.path })}
              count={result.onlyRight.length}
              path={b.path}
            />
            <EntryRows entries={result.onlyRight} />

            <SectionTitle
              icon={<GitCompareArrows size={13} />}
              label={t('Présents des deux côtés mais différents')}
              count={result.different.length}
            />
            {result.different.length === 0 ? (
              <Empty />
            ) : (
              result.different.map((row) => <DiffRow key={row.name} row={row} />)
            )}

            <p className="mt-4 px-1 text-[11px] text-fg-muted">
              {t('Comparaison superficielle du niveau courant (les sous-dossiers ne sont pas parcourus ; deux dossiers de même nom sont considérés identiques).')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function SectionTitle(props: {
  icon: React.ReactNode
  label: string
  count: number
  path?: string
}): JSX.Element {
  return (
    <div
      className="mb-1 mt-3 flex items-center gap-1.5 px-1 text-[11px] font-medium uppercase tracking-wider text-fg-muted first:mt-0"
      title={props.path}
    >
      {props.icon}
      <span className="min-w-0 truncate">{props.label}</span>
      <span className="tabular-nums">({props.count})</span>
    </div>
  )
}

function Empty(): JSX.Element {
  return <p className="px-2 py-1 text-fg-muted">{t('Rien.')}</p>
}

function EntryRows({ entries }: { entries: DirEntry[] }): JSX.Element {
  if (entries.length === 0) return <Empty />
  return (
    <>
      {entries.map((e) => (
        <div key={e.path} className="flex items-center gap-2 rounded-app px-2 py-1 hover:bg-bg-hover" title={e.path}>
          {e.kind === 'directory' ? (
            <Folder size={14} className="shrink-0 text-fg-muted" />
          ) : (
            <File size={14} className="shrink-0 text-fg-muted" />
          )}
          <span className="min-w-0 flex-1 truncate text-fg-secondary">{e.name}</span>
          <span className="shrink-0 text-[11px] text-fg-muted tabular-nums">
            {e.kind === 'file' ? fmtBytes(e.size) : ''}
          </span>
        </div>
      ))}
    </>
  )
}

function DiffRow({ row }: { row: CompareRow }): JSX.Element {
  const detail = (e: DirEntry): string =>
    e.kind === 'file'
      ? t('{size} · {date}', { size: fmtBytes(e.size), date: formatDate(e.modifiedMs) })
      : t('dossier')
  return (
    <div className="rounded-app px-2 py-1 hover:bg-bg-hover" title={reasonLabel(row.reason)}>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-fg">{row.name}</span>
        <span className="shrink-0 rounded bg-warning-bg px-1.5 text-[10px] text-warning-fg">
          {reasonLabel(row.reason)}
        </span>
      </div>
      <div className="flex items-center gap-2 pl-1 text-[11px] text-fg-muted tabular-nums">
        <span className="min-w-0 flex-1 truncate">◀ {detail(row.left)}</span>
        <span className="min-w-0 flex-1 truncate">▶ {detail(row.right)}</span>
      </div>
    </div>
  )
}
