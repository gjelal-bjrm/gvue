/**
 * Construit une commande shell pour exécuter un fichier choisi, indépendamment
 * du shell du terminal (PowerShell, cmd, Git Bash). Sur Windows, `cmd /c` lance
 * les .bat/.cmd/.exe de façon uniforme ; les scripts ont leur interpréteur.
 */
export function commandForFile(p: string): string {
  const ext = p.slice(p.lastIndexOf('.')).toLowerCase()
  const q = `"${p}"`
  switch (ext) {
    case '.ps1':
      return `powershell -ExecutionPolicy Bypass -File ${q}`
    case '.sh':
      return `bash ${q}`
    case '.py':
      return `python ${q}`
    case '.js':
      return `node ${q}`
    default:
      // .bat, .cmd, .exe et autres : exécution via cmd, valable dans tout shell.
      return `cmd /c ${q}`
  }
}

/** Joint un dossier et un nom de fichier en chemin Windows. */
export function joinWin(dir: string, name: string): string {
  return `${dir.replace(/[\\/]+$/, '')}\\${name}`
}
