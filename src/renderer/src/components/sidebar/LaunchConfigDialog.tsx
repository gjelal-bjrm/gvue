import { useEffect, useState } from 'react'
import { Play, FileCode, FolderOpen } from 'lucide-react'
import { useRunnerStore } from '../../state/useRunnerStore'
import { commandForFile, joinWin } from '../../lib/runfile'
import FilePickerDialog from '../FilePickerDialog'
import { t } from '../../i18n'

/**
 * Petite boîte de dialogue pour définir la commande exécutée par le ▶ d'un
 * projet (avec raccourcis vers les scripts package.json détectés).
 */
export default function LaunchConfigDialog(props: {
  root: string
  name: string
  onClose: () => void
}): JSX.Element {
  const projectLaunch = useRunnerStore((s) => s.projectLaunch)
  const setProjectCommand = useRunnerStore((s) => s.setProjectCommand)
  const runProject = useRunnerStore((s) => s.runProject)

  const [command, setCommand] = useState(projectLaunch[props.root] ?? '')
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

  const save = (run: boolean): void => {
    setProjectCommand(props.root, command)
    if (run && command.trim()) void runProject(props.root, props.name)
    props.onClose()
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center" onMouseDown={props.onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative z-10 w-[min(440px,92vw)] rounded-app border border-border bg-bg-secondary p-4 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center gap-2 text-[13px] font-medium text-fg">
          <Play size={14} className="text-accent" />
          {t('Lancement de {name}', { name: props.name })}
        </div>
        <p className="mb-3 text-[12px] text-fg-muted">
          {t("Commande exécutée d'un clic sur ▶, dans le dossier du projet.")}
        </p>

        <div className="flex gap-1.5">
          <input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save(true)
              else if (e.key === 'Escape') props.onClose()
            }}
            autoFocus
            spellCheck={false}
            placeholder={t('ex. npm run dev')}
            className="min-w-0 flex-1 rounded-app border border-border bg-bg px-2 py-1.5 font-mono text-[12px] text-fg outline-none placeholder:text-fg-muted focus:border-accent"
          />
          <button
            onClick={() => setPicking(true)}
            title={t('Choisir un fichier à lancer (.bat, .ps1, .exe…)')}
            className="flex shrink-0 items-center gap-1 rounded-app border border-border px-2 text-[12px] text-fg-secondary hover:bg-bg-hover"
          >
            <FolderOpen size={13} /> {t('Fichier…')}
          </button>
        </div>

        {picking && (
          <FilePickerDialog
            initialDir={props.root}
            onPick={(file) => {
              setCommand(commandForFile(file))
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
                onClick={() => setCommand(commandForFile(joinWin(props.root, f)))}
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
                onClick={() => setCommand(`npm run ${s}`)}
                className="flex items-center gap-1 rounded-app border border-border px-1.5 py-0.5 text-[11px] text-fg-secondary hover:bg-bg-hover"
              >
                <FileCode size={11} /> {s}
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center justify-end gap-2">
          {projectLaunch[props.root] && (
            <button
              onClick={() => {
                setProjectCommand(props.root, '')
                props.onClose()
              }}
              className="mr-auto rounded-app px-2 py-1.5 text-[12px] text-danger-fg hover:bg-bg-hover"
            >
              {t('Effacer')}
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
            disabled={!command.trim()}
            className="rounded-app border border-border px-2.5 py-1.5 text-[12px] text-fg hover:bg-bg-hover disabled:opacity-40"
          >
            {t('Enregistrer')}
          </button>
          <button
            onClick={() => save(true)}
            disabled={!command.trim()}
            className="flex items-center gap-1.5 rounded-app bg-accent px-2.5 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            <Play size={13} /> {t('Lancer')}
          </button>
        </div>
      </div>
    </div>
  )
}
