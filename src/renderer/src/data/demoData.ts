import type { GitProject, SshHost } from '@shared/types'

/**
 * Données FICTIVES du mode démo (Paramètres → Général). Elles remplacent à
 * l'écran les vrais projets et serveurs — captures d'écran pour le site,
 * démonstration à un client sans exposer les autres clients. Rien n'est
 * écrit : les vraies données restent intactes dans la configuration.
 *
 * Les chemins pointent vers l'arborescence de démo (créée par
 * `node scripts/demo-tree.cjs`), pour que la navigation reste crédible.
 */

export const DEMO_ROOT = 'C:\\Dev\\gvue-demo'

export const DEMO_PROJECTS: GitProject[] = [
  { root: `${DEMO_ROOT}\\boutique-web`, name: 'boutique-web', branch: 'main', dirty: true },
  { root: `${DEMO_ROOT}\\api-commandes`, name: 'api-commandes', branch: 'develop', dirty: false },
  { root: `${DEMO_ROOT}\\site-vitrine`, name: 'site-vitrine', branch: 'main', dirty: false }
]

export const DEMO_SERVERS: SshHost[] = [
  {
    name: 'production',
    source: 'manual',
    hostName: 'vps.exemple.com',
    user: 'deploy',
    forwards: [{ type: 'local', listenPort: 3306, destHost: 'localhost', destPort: 3306 }],
    keepAlive: true
  },
  { name: 'preprod', source: 'manual', hostName: 'preprod.exemple.com', user: 'deploy', keepAlive: true },
  { name: 'sauvegardes', source: 'manual', hostName: 'backup.exemple.com', user: 'backup', port: 2222 }
]
