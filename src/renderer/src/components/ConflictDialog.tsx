import { AlertTriangle, File, Folder } from 'lucide-react'
import { useUiStore } from '../state/useUiStore'
import { fmtBytes, formatDate } from '../lib/format'
import { t, tn } from '../i18n'
import type { ConflictInfo } from '@shared/types'

/**
 * Dialogue de conflits de copie/déplacement (façon explorateur Windows) :
 * la destination contient déjà des éléments du même nom. Le choix s'applique
 * à tout le lot : Remplacer (l'existant part à la corbeille, récupérable),
 * Ignorer les conflits, ou Garder les deux (« nom (copie) »). Échap = annuler.
 */
export default function ConflictDialog(): JSX.Element | null {
  const req = useUiStore((s) => s.conflictReq)
  if (!req) return null

  const n = req.conflicts.length
  const pick = (m: 'overwrite' | 'skip' | 'rename' | null): void => req.resolve(m)

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center" onMouseDown={() => pick(null)}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative z-10 flex max-h-[80vh] w-[min(640px,94vw)] flex-col overflow-hidden rounded-app border border-border bg-bg-secondary shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') pick(null)
        }}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
          <AlertTriangle size={15} className="text-warning-fg" />
          <span className="text-[13px] font-medium text-fg">
            {tn(n, '{n} élément existe déjà dans la destination', '{n} éléments existent déjà dans la destination')}
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-4 py-2 text-[12px]">
          {req.conflicts.slice(0, 200).map((c) => (
            <Row key={c.targetPath} c={c} />
          ))}
          {n > 200 && (
            <p className="px-1 py-1 text-fg-muted">{t('… +{count} autres', { count: n - 200 })}</p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3">
          <span className="mr-auto max-w-[220px] text-[11px] text-fg-muted">
            {t('« Remplacer » envoie les éléments existants à la corbeille (récupérable).')}
          </span>
          <button
            onClick={() => pick(null)}
            className="rounded-app px-2.5 py-1.5 text-[12px] text-fg-secondary hover:bg-bg-hover"
          >
            {t('Annuler')}
          </button>
          <button
            onClick={() => pick('skip')}
            className="rounded-app border border-border px-2.5 py-1.5 text-[12px] text-fg hover:bg-bg-hover"
          >
            {t('Ignorer les conflits')}
          </button>
          <button
            onClick={() => pick('rename')}
            className="rounded-app border border-border px-2.5 py-1.5 text-[12px] text-fg hover:bg-bg-hover"
          >
            {t('Garder les deux')}
          </button>
          <button
            onClick={() => pick('overwrite')}
            className="rounded-app bg-accent px-2.5 py-1.5 text-[12px] font-medium text-white hover:opacity-90"
          >
            {tn(n, 'Remplacer', 'Remplacer tout')}
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({ c }: { c: ConflictInfo }): JSX.Element {
  const Icon = c.target.dir ? Folder : File
  const detail = (s: { size: number; modifiedMs: number; dir: boolean }): string =>
    s.dir
      ? t('dossier · {date}', { date: formatDate(s.modifiedMs) })
      : t('{size} · {date}', { size: fmtBytes(s.size), date: formatDate(s.modifiedMs) })
  const newer = !c.source.dir && !c.target.dir && c.source.modifiedMs > c.target.modifiedMs + 2000
  return (
    <div className="rounded-app px-1.5 py-1 hover:bg-bg-hover" title={c.targetPath}>
      <div className="flex items-center gap-2">
        <Icon size={14} className="shrink-0 text-fg-muted" />
        <span className="min-w-0 flex-1 truncate text-fg">{c.name}</span>
        {newer && (
          <span className="shrink-0 rounded bg-info-bg px-1.5 text-[10px] text-info-fg">
            {t('source plus récente')}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 pl-6 text-[11px] text-fg-muted tabular-nums">
        <span className="min-w-0 flex-1 truncate">{t('source : {detail}', { detail: detail(c.source) })}</span>
        <span className="min-w-0 flex-1 truncate">{t('existant : {detail}', { detail: detail(c.target) })}</span>
      </div>
    </div>
  )
}
