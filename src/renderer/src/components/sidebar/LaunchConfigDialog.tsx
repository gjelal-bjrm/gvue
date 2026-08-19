import { useEffect, useState } from 'react'
import { Play, FileCode, FolderOpen, Plus, X } from 'lucide-react'
import type { ProjectLaunch, LaunchIcon } from '@shared/types'
import { LAUNCH_ICONS, MAX_LAUNCHES } from '@shared/launches'
import { useRunnerStore } from '../../state/useRunnerStore'
import { commandForFile, joinWin } from '../../lib/runfile'
import { LAUNCH_ICON_MAP, launchIconLabel } from '../../lib/launchIcons'
import FilePickerDialog from '../FilePickerDialog'
import { t } from '../../i18n'

/**
 * Éditeur des lancements d'un projet : jusqu'à quatre commandes (dév, build,
 * déploiement…), chacune avec son icône. Les raccourcis détectés (scripts
 * package.json, fichiers exécutables) remplissent la ligne en cours d'édition.
 */
export default function LaunchConfigDialog(props: {
  root: string
  name: string
  onClose: () => void
}): JSX.Element {
  const launchesFor = useRunnerStore((s) => s.launchesFor)
  const setProjectLaunches = useRunnerStore((s) => s.setProjectLaunches)
  const runLaunch = useRunnerStore((s) => s.runLaunch)

  const [list, setList] = useState<ProjectLaunch[]>(() => {
    const existing = launchesFor(props.root)
    return existing.length
      ? existing
      : [{ id: `l-${Date.now()}`, name: t('Démarrer'), command: '', icon: 'play' }]
  })
  // Ligne visée par les raccourcis « Scripts » / « Fichiers ».
  const [current, setCurrent] = useState(0)
  const [scripts, setScripts] = useState<string[]>([])
  const [files, setFiles] = useState<string[]>([])
  const [picking, setPicking] = useState(false)

  useEffect(() => {
    let alive = true
    void Promise.all([
      window.api.fs.packageScripts(props.root),
      window.api.fs.runnableFiles(props.root)
    ]).then(([s, f]) => {
      if (!alive) return
      setScripts(s)
      setFiles(f)
    })
    return () => {
      alive = false
    }
  }, [props.root])

  const patch = (i: number, p: Partial<ProjectLaunch>): void =>
    setList((l) => l.map((x, j) => (j === i ? { ...x, ...p } : x)))
  const setCommandOf = (i: number, command: string): void => patch(i, { command })

  const valid = list.filter((l) => l.command.trim())
  const save = (run: boolean): void => {
    setProjectLaunches(props.root, valid)
    if (run && valid[0]) void runLaunch(props.root, valid[0].id)
    props.onClose()
  }

  const field =
    'min-w-0 flex-1 rounded-app border border-border bg-bg px-2 py-1.5 text-[12px] text-fg outline-none placeholder:text-fg-muted focus:border-accent'

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center" onMouseDown={props.onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative z-10 w-[min(520px,94vw)] rounded-app border border-border bg-bg-secondary p-4 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center gap-2 text-[13px] font-medium text-fg">
          <Play size={14} className="text-accent" />
          {t('Lancements de {name}', { name: props.name })}
        </div>
        <p className="mb-3 text-[12px] text-fg-muted">
          {t('Chaque lancement devient un bouton sur la ligne du projet, exécuté dans son dossier.')}
        </p>

        <div className="flex flex-col gap-1.5">
          {list.map((l, i) => {
            const Icon = LAUNCH_ICON_MAP[l.icon] ?? Play
            return (
              <div
                key={l.id}
                onFocusCapture={() => setCurrent(i)}
                className={`flex items-center gap-1.5 rounded-app border p-1.5 ${
                  current === i ? 'border-accent/50 bg-bg' : 'border-border'
                }`}
              >
                <span className="relative shrink-0">
                  <select
                    value={l.icon}
                    onChange={(e) => patch(i, { icon: e.target.value as LaunchIcon })}
                    title={t('Icône du bouton')}
                    className="h-7 w-[54px] cursor-pointer rounded-app border border-border bg-bg-tertiary pl-6 text-[11px] text-fg outline-none focus:border-accent"
                  >
                    {LAUNCH_ICONS.map((ic) => (
                      <option key={ic} value={ic}>
                        {launchIconLabel(ic)}
                      </option>
                    ))}
                  </select>
                  <Icon
                    size={13}
                    className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 text-accent"
                  />
                </span>
                <input
                  value={l.name}
                  onChange={(e) => patch(i, { name: e.target.value })}
                  placeholder={t('Nom')}
                  spellCheck={false}
                  className={`${field} max-w-[110px] flex-none`}
                />
                <input
                  value={l.command}
                  onChange={(e) => setCommandOf(i, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') save(true)
                    else if (e.key === 'Escape') props.onClose()
                  }}
                  autoFocus={i === 0}
                  spellCheck={false}
                  placeholder={t('ex. npm run dev')}
                  className={`${field} font-mono`}
                />
                {list.length > 1 && (
                  <button
                    onClick={() => setList((cur) => cur.filter((_, j) => j !== i))}
                    title={t('Retirer ce lancement')}
                    className="grid h-6 w-6 shrink-0 place-items-center rounded text-fg-muted hover:bg-bg-hover hover:text-danger-fg"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={() =>
              setList((l) => [
                ...l,
                { id: `l-${Date.now()}`, name: t('Construire'), command: '', icon: 'build' }
              ])
            }
            disabled={list.length >= MAX_LAUNCHES}
            title={
              list.length >= MAX_LAUNCHES
                ? t('Maximum {n} lancements — au-delà, les icônes ne tiennent plus sur la ligne du projet.', {
                    n: String(MAX_LAUNCHES)
                  })
                : undefined
            }
            className="flex items-center gap-1 rounded-app border border-border px-2 py-1 text-[11px] text-fg-secondary hover:bg-bg-hover hover:text-fg disabled:opacity-40"
          >
            <Plus size={12} /> {t('Ajouter un lancement')}
          </button>
          <button
            onClick={() => setPicking(true)}
            title={t('Choisir un fichier à lancer (.bat, .ps1, .exe…)')}
            className="flex items-center gap-1 rounded-app border border-border px-2 py-1 text-[11px] text-fg-secondary hover:bg-bg-hover hover:text-fg"
          >
            <FolderOpen size={12} /> {t('Fichier…')}
          </button>
        </div>

        {picking && (
          <FilePickerDialog
            initialDir={props.root}
            onPick={(file) => {
              setCommandOf(current, commandForFile(file))
              setPicking(false)
            }}
            onClose={() => setPicking(false)}
          />
        )}

        {files.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-fg-muted">{t('Fichiers :')}</span>
            {files.map((f) => (
              <button
                key={f}
                onClick={() => setCommandOf(current, commandForFile(joinWin(props.root, f)))}
                className="flex items-center gap-1 rounded-app border border-border px-1.5 py-0.5 text-[11px] text-fg-secondary hover:bg-bg-hover"
              >
                <Play size={10} /> {f}
              </button>
            ))}
          </div>
        )}

        {scripts.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-fg-muted">{t('Scripts :')}</span>
            {scripts.map((s) => (
              <button
                key={s}
                onClick={() => setCommandOf(current, `npm run ${s}`)}
                className="flex items-center gap-1 rounded-app border border-border px-1.5 py-0.5 text-[11px] text-fg-secondary hover:bg-bg-hover"
              >
                <FileCode size={11} /> {s}
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center justify-end gap-2">
          {launchesFor(props.root).length > 0 && (
            <button
              onClick={() => {
                setProjectLaunches(props.root, [])
                props.onClose()
              }}
              className="mr-auto rounded-app px-2 py-1.5 text-[12px] text-danger-fg hover:bg-bg-hover"
            >
              {t('Tout effacer')}
            </button>
          )}
          <button
            onClick={props.onClose}
            className="rounded-app px-2.5 py-1.5 text-[12px] text-fg-secondary hover:bg-bg-hover"
          >
            {t('Annuler')}
          </button>
          <button
            onClick={() => save(false)}
            disabled={valid.length === 0}
            className="rounded-app border border-border px-2.5 py-1.5 text-[12px] text-fg hover:bg-bg-hover disabled:opacity-40"
          >
            {t('Enregistrer')}
          </button>
          <button
            onClick={() => save(true)}
            disabled={valid.length === 0}
            className="flex items-center gap-1.5 rounded-app bg-accent px-2.5 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            <Play size={13} /> {t('Lancer')}
          </button>
        </div>
      </div>
    </div>
  )
}
