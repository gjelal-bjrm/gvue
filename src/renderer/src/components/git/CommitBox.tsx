import { useState } from 'react'
import { GitCommit } from 'lucide-react'
import { t } from '../../i18n'

/**
 * Zone de commit (message + bouton + erreur git). Le champ se vide quand
 * `onCommit` résout à vrai (commit accepté).
 */
export default function CommitBox(props: {
  branch: string
  stagedCount: number
  busy: boolean
  error: string | null
  onCommit: (message: string) => Promise<boolean>
}): JSX.Element {
  const [message, setMessage] = useState('')

  const commit = (): void => {
    const m = message.trim()
    if (!m) return
    void props.onCommit(m).then((ok) => {
      if (ok) setMessage('')
    })
  }

  return (
    <div className="shrink-0 border-t border-border p-2">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={t('Message de commit…')}
        spellCheck={false}
        rows={2}
        className="mb-1.5 w-full resize-none rounded-app border border-border bg-bg px-2 py-1.5 text-[12px] text-fg outline-none placeholder:text-fg-muted focus:border-accent"
      />
      <button
        onClick={commit}
        disabled={props.busy || !message.trim() || props.stagedCount === 0}
        className="flex w-full items-center justify-center gap-1.5 rounded-app bg-accent px-2 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-40"
      >
        <GitCommit size={14} />
        {t('Commit{suffix} sur {branch}', {
          suffix: props.stagedCount > 0 ? ` (${props.stagedCount})` : '',
          branch: props.branch
        })}
      </button>
      {props.error && (
        <pre className="mt-1.5 max-h-24 overflow-auto whitespace-pre-wrap break-words rounded-app border border-danger-fg bg-danger-bg px-2 py-1 text-[11px] text-danger-fg">
          {props.error}
        </pre>
      )}
    </div>
  )
}
