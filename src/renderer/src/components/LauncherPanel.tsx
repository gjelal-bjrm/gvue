import { useEffect, useState } from 'react'
import { Rocket, Play, Square, Plus, Trash2, Layers, FileCode } from 'lucide-react'
import { useRunnerStore } from '../state/useRunnerStore'
import { useNavStore, activePane } from '../state/useNavStore'
import { baseName } from '../lib/format'

/**
 * Lanceur : définir des tâches (commande + dossier) et des profils (groupes de
 * tâches), puis les lancer/arrêter. L'exécution se fait dans le terminal intégré.
 */
export default function LauncherPanel(): JSX.Element {
  const tasks = useRunnerStore((s) => s.tasks)
  const profiles = useRunnerStore((s) => s.profiles)
  const running = useRunnerStore((s) => s.running)
  const { addTask, removeTask, addProfile, removeProfile, runTask, stopTask, runProfile, stopProfile } =
    useRunnerStore()
  const defaultCwd = useNavStore((s) => activePane(s).path)

  const [name, setName] = useState('')
  const [cwd, setCwd] = useState(defaultCwd)
  const [command, setCommand] = useState('')
  const [scripts, setScripts] = useState<string[]>([])

  const [profileName, setProfileName] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())

  // Scripts package.json détectés pour le dossier saisi.
  useEffect(() => {
    let alive = true
    window.api.fs
      .packageScripts(cwd)
      .then((s) => alive && setScripts(s))
      .catch(() => alive && setScripts([]))
    return () => {
      alive = false
    }
  }, [cwd])

  const submitTask = (): void => {
    if (!name.trim() || !command.trim() || !cwd.trim()) return
    addTask({ name: name.trim(), cwd: cwd.trim(), command: command.trim() })
    setName('')
    setCommand('')
  }

  const submitProfile = (): void => {
    if (!profileName.trim() || picked.size === 0) return
    addProfile(profileName.trim(), [...picked])
    setProfileName('')
    setPicked(new Set())
  }

  const togglePick = (id: string): void =>
    setPicked((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  return (
    <div className="flex h-full flex-col bg-bg">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2.5">
        <Rocket size={15} className="text-accent" />
        <span className="text-[13px] font-medium text-fg">Lanceur</span>
      </div>

      <div className="flex-1 overflow-auto p-3 text-[13px]">
        {/* Profils */}
        {profiles.length > 0 && (
          <section className="mb-5">
            <GroupTitle icon={<Layers size={12} />}>Profils</GroupTitle>
            <div className="flex flex-col gap-1.5">
              {profiles.map((p) => {
                const any = p.taskIds.some((t) => running[t])
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 rounded-app border border-border bg-bg-secondary px-2.5 py-2"
                  >
                    <RunBtn
                      running={any}
                      onRun={() => void runProfile(p.id)}
                      onStop={() => stopProfile(p.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-fg">{p.name}</div>
                      <div className="truncate text-[11px] text-fg-muted">
                        {p.taskIds.length} tâche{p.taskIds.length > 1 ? 's' : ''}
                      </div>
                    </div>
                    <IconBtn title="Supprimer le profil" onClick={() => removeProfile(p.id)} danger>
                      <Trash2 size={14} />
                    </IconBtn>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Tâches */}
        <section className="mb-5">
          <GroupTitle icon={<Rocket size={12} />}>Tâches</GroupTitle>
          {tasks.length === 0 ? (
            <p className="px-1 py-1.5 text-fg-muted">Aucune tâche. Ajoutez-en une ci-dessous.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {tasks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-2 rounded-app border border-border bg-bg-secondary px-2.5 py-2"
                >
                  <RunBtn
                    running={!!running[t.id]}
                    onRun={() => void runTask(t.id)}
                    onStop={() => stopTask(t.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-fg">{t.name}</div>
                    <div className="truncate font-mono text-[11px] text-fg-muted" title={`${t.command} — ${t.cwd}`}>
                      {t.command} · {baseName(t.cwd)}
                    </div>
                  </div>
                  <IconBtn title="Supprimer la tâche" onClick={() => removeTask(t.id)} danger>
                    <Trash2 size={14} />
                  </IconBtn>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Nouvelle tâche */}
        <section className="mb-5 rounded-app border border-border p-2.5">
          <div className="mb-2 text-[12px] font-medium text-fg-secondary">Nouvelle tâche</div>
          <div className="flex flex-col gap-1.5">
            <Input value={name} onChange={setName} placeholder="Nom (ex. Front dev)" />
            <Input value={cwd} onChange={setCwd} placeholder="Dossier (cwd)" mono />
            <Input value={command} onChange={setCommand} placeholder="Commande (ex. npm run dev)" mono />
            {scripts.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[11px] text-fg-muted">Scripts détectés :</span>
                {scripts.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setCommand(`npm run ${s}`)
                      if (!name.trim()) setName(s)
                    }}
                    className="flex items-center gap-1 rounded-app border border-border px-1.5 py-0.5 text-[11px] text-fg-secondary hover:bg-bg-hover"
                  >
                    <FileCode size={11} /> {s}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={submitTask}
              disabled={!name.trim() || !command.trim() || !cwd.trim()}
              className="flex items-center justify-center gap-1.5 rounded-app bg-accent px-2 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-40"
            >
              <Plus size={14} /> Ajouter la tâche
            </button>
          </div>
        </section>

        {/* Nouveau profil */}
        {tasks.length > 0 && (
          <section className="rounded-app border border-border p-2.5">
            <div className="mb-2 text-[12px] font-medium text-fg-secondary">Nouveau profil</div>
            <div className="flex flex-col gap-1.5">
              <Input value={profileName} onChange={setProfileName} placeholder="Nom (ex. Projet X — dev)" />
              <div className="flex flex-col gap-1">
                {tasks.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 text-[12px] text-fg-secondary">
                    <input
                      type="checkbox"
                      checked={picked.has(t.id)}
                      onChange={() => togglePick(t.id)}
                      className="accent-[var(--accent)]"
                    />
                    <span className="truncate">{t.name}</span>
                  </label>
                ))}
              </div>
              <button
                onClick={submitProfile}
                disabled={!profileName.trim() || picked.size === 0}
                className="flex items-center justify-center gap-1.5 rounded-app bg-accent px-2 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-40"
              >
                <Layers size={14} /> Créer le profil
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function GroupTitle(props: { icon: React.ReactNode; children: React.ReactNode }): JSX.Element {
  return (
    <div className="mb-2 flex items-center gap-1.5 px-1 text-[11px] font-medium uppercase tracking-wider text-fg-muted">
      {props.icon}
      {props.children}
    </div>
  )
}

function RunBtn(props: { running: boolean; onRun: () => void; onStop: () => void }): JSX.Element {
  return props.running ? (
    <button
      onClick={props.onStop}
      title="Arrêter"
      className="grid h-7 w-7 shrink-0 place-items-center rounded-app bg-danger-bg text-danger-fg hover:opacity-90"
    >
      <Square size={13} />
    </button>
  ) : (
    <button
      onClick={props.onRun}
      title="Lancer"
      className="grid h-7 w-7 shrink-0 place-items-center rounded-app bg-success-bg text-success-fg hover:opacity-90"
    >
      <Play size={14} />
    </button>
  )
}

function IconBtn(props: {
  title: string
  onClick: () => void
  danger?: boolean
  children: React.ReactNode
}): JSX.Element {
  return (
    <button
      onClick={props.onClick}
      title={props.title}
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-app text-fg-muted hover:bg-bg-hover ${
        props.danger ? 'hover:text-danger-fg' : 'hover:text-fg'
      }`}
    >
      {props.children}
    </button>
  )
}

function Input(props: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  mono?: boolean
}): JSX.Element {
  return (
    <input
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      spellCheck={false}
      className={`w-full rounded-app border border-border bg-bg px-2 py-1.5 text-[12px] text-fg outline-none placeholder:text-fg-muted focus:border-accent ${
        props.mono ? 'font-mono' : ''
      }`}
    />
  )
}
