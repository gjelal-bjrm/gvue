import { useCallback, useEffect, useMemo, useState } from 'react'
import { Trash2, X, Undo2, Loader2, RotateCw, FolderOpen, Search } from 'lucide-react'
import type { RecycleItem } from '@shared/types'
import { useUiStore } from '../state/useUiStore'
import { useNavStore } from '../state/useNavStore'
import { formatSize, formatDate } from '../lib/format'
import { t, tn } from '../i18n'

/**
 * Corbeille Windows dans GVue : liste des éléments supprimés (nom, emplacement
 * d'origine, taille, date), avec restauration, suppression définitive et
 * vidage. Sélection multiple façon explorateur (clic, Ctrl+clic, Maj+clic).
 */
export default function RecycleBin(): JSX.Element | null {
  const open = useUiStore((s) => s.recycleBinOpen)
  const close = (): void => useUiStore.getState().setRecycleBin(false)

  const [items, setItems] = useState<RecycleItem[]>([])
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [anchor, setAnchor] = useState<number | null>(null)
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      setItems(await window.api.bin.list())
    } catch {
      setItems([])
    } finally {
      setLoading(false)
      setSel(new Set())
      setAnchor(null)
    }
  }, [])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (i) => i.name.toLowerCase().includes(q) || i.originalPath.toLowerCase().includes(q)
    )
  }, [items, filter])

  if (!open) return null

  const selectedIds = visible.filter((i) => sel.has(i.id)).map((i) => i.id)

  const onRowClick = (e: React.MouseEvent, index: number): void => {
    const id = visible[index].id
    if (e.shiftKey && anchor !== null) {
      const [a, b] = anchor < index ? [anchor, index] : [index, anchor]
      setSel(new Set(visible.slice(a, b + 1).map((i) => i.id)))
      return
    }
    if (e.ctrlKey || e.metaKey) {
      setSel((prev) => {
        const n = new Set(prev)
        n.has(id) ? n.delete(id) : n.add(id)
        return n
      })
    } else {
      setSel(new Set([id]))
    }
    setAnchor(index)
  }

  // Exécute une action sur la sélection, signale le résultat et recharge.
  const act = async (
    fn: (ids: string[]) => Promise<{ ok: number; errors: string[] }>,
    verb: string
  ): Promise<void> => {
    if (selectedIds.length === 0) return
    setBusy(true)
    const res = await fn(selectedIds)
    setBusy(false)
    const ui = useUiStore.getState()
    if (res.errors.length) {
      ui.showToast(
        t('{verb} : {ok} réussi(s), {errCount} échec(s) — {err0}', {
          verb,
          ok: res.ok,
          errCount: res.errors.length,
          err0: res.errors[0]
        })
      )
    } else {
      ui.showToast(tn(res.ok, '{verb} : {n} élément.', '{verb} : {n} éléments.', { verb }))
    }
    await load()
    // Une restauration fait réapparaître des fichiers : rafraîchit les volets.
    useNavStore.getState().refreshAll()
  }

  const restore = (): Promise<void> =>
    act((ids) => window.api.bin.restore(ids), t('Restauration'))

  const removeForever = (): void => {
    const n = selectedIds.length
    if (
      !window.confirm(
        tn(n, 'Supprimer définitivement {n} élément ? Irréversible.', 'Supprimer définitivement {n} éléments ? Irréversible.')
      )
    )
      return
    void act((ids) => window.api.bin.delete(ids), t('Suppression définitive'))
  }

  const emptyAll = (): void => {
    if (!window.confirm(t('Vider la corbeille ({n} éléments) ? Irréversible.', { n: items.length })))
      return
    void (async () => {
      setBusy(true)
      const res = await window.api.bin.empty()
      setBusy(false)
      useUiStore
        .getState()
        .showToast(
          res.errors.length ? t('Échec : {err}', { err: res.errors[0] }) : t('Corbeille vidée.')
        )
      await load()
    })()
  }

  const totalSize = items.reduce((sum, i) => sum + i.size, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" onMouseDown={close}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative z-10 flex max-h-[86vh] w-[min(900px,94vw)] flex-col overflow-hidden rounded-app border border-border bg-bg-secondary shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
          <Trash2 size={15} className="shrink-0 text-accent" />
          <span className="text-[13px] font-medium text-fg">{t('Corbeille')}</span>
          <span className="text-[11px] text-fg-muted">
            {tn(items.length, '{n} élément', '{n} éléments')}
            {totalSize > 0 && ` · ${formatSize(totalSize, 'file')}`}
          </span>
          <button
            onClick={() => void load()}
            title={t('Actualiser')}
            className="ml-auto grid h-6 w-6 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-fg"
          >
            <RotateCw size={13} />
          </button>
          <button
            onClick={close}
            title={t('Fermer (Échap)')}
            className="grid h-6 w-6 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-fg"
          >
            <X size={15} />
          </button>
        </div>

        {/* Barre d'actions */}
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border px-3 py-2">
          <div className="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-app border border-border bg-bg px-2">
            <Search size={13} className="shrink-0 text-fg-muted" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t('Filtrer par nom ou emplacement…')}
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent text-[12px] text-fg outline-none placeholder:text-fg-muted"
            />
          </div>
          <button
            onClick={() => void restore()}
            disabled={busy || selectedIds.length === 0}
            title={t("Remettre à l'emplacement d'origine")}
            className="flex shrink-0 items-center gap-1.5 rounded-app bg-accent px-2.5 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            <Undo2 size={13} /> {t('Restaurer')}
            {selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
          </button>
          <button
            onClick={removeForever}
            disabled={busy || selectedIds.length === 0}
            className="flex shrink-0 items-center gap-1.5 rounded-app border border-border px-2.5 py-1.5 text-[12px] text-danger-fg hover:bg-bg-hover disabled:opacity-40"
          >
            <Trash2 size={13} /> {t('Supprimer')}
          </button>
          <button
            onClick={emptyAll}
            disabled={busy || items.length === 0}
            className="flex shrink-0 items-center gap-1.5 rounded-app border border-border px-2.5 py-1.5 text-[12px] text-fg-secondary hover:bg-bg-hover disabled:opacity-40"
          >
            {t('Vider tout')}
          </button>
        </div>

        {/* Liste */}
        <div className="min-h-0 flex-1 overflow-auto">
          {loading ? (
            <p className="flex items-center justify-center gap-2 py-8 text-[12px] text-fg-muted">
              <Loader2 size={14} className="animate-spin" /> {t('Lecture de la corbeille…')}
            </p>
          ) : visible.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-fg-muted">
              {items.length === 0 ? t('La corbeille est vide.') : t('Aucun élément ne correspond.')}
            </p>
          ) : (
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 bg-bg-secondary text-[11px] uppercase tracking-wider text-fg-muted">
                <tr className="border-b border-border">
                  <th className="px-3 py-1.5 text-left font-normal">{t('Nom')}</th>
                  <th className="px-3 py-1.5 text-left font-normal">{t("Emplacement d'origine")}</th>
                  <th className="px-3 py-1.5 text-right font-normal">{t('Taille')}</th>
                  <th className="px-3 py-1.5 text-right font-normal">{t('Supprimé le')}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item, index) => {
                  const selected = sel.has(item.id)
                  const parent = item.originalPath.slice(
                    0,
                    Math.max(0, item.originalPath.lastIndexOf('\\'))
                  )
                  return (
                    <tr
                      key={item.id}
                      onClick={(e) => onRowClick(e, index)}
                      onDoubleClick={() => {
                        if (parent) {
                          useNavStore.getState().navigate(parent)
                          close()
                        }
                      }}
                      title={t("{path}\n(double-clic : ouvrir le dossier d'origine)", {
                        path: item.originalPath
                      })}
                      className={`cursor-default border-b border-border/50 ${
                        selected ? 'bg-accent-soft' : 'hover:bg-bg-hover'
                      }`}
                    >
                      <td className="max-w-[240px] truncate px-3 py-1.5">
                        <span className="flex items-center gap-1.5">
                          {item.isDir && <FolderOpen size={13} className="shrink-0 text-fg-muted" />}
                          <span className={`truncate ${selected ? 'text-accent' : 'text-fg'}`}>
                            {item.name}
                          </span>
                        </span>
                      </td>
                      <td className="max-w-[300px] truncate px-3 py-1.5 text-fg-muted">{parent}</td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-fg-secondary">
                        {item.isDir ? '—' : formatSize(item.size, 'file')}
                      </td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-fg-muted">
                        {formatDate(item.deletedAtMs)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="shrink-0 border-t border-border px-3 py-1.5 text-[11px] text-fg-muted">
          {t("Clic pour sélectionner · Ctrl+clic multiple · Maj+clic plage · double-clic : ouvrir le dossier d'origine")}
        </div>
      </div>
    </div>
  )
}
