#!/usr/bin/env node
/**
 * Pont MCP (stdio) vers l'instance GVue EN COURS D'EXÉCUTION.
 *
 * Les clients MCP (Claude Code, etc.) lancent un serveur MCP en stdio ; or le
 * contexte vit dans l'app GVue déjà ouverte. Ce pont parle le protocole MCP
 * (JSON-RPC 2.0, un message par ligne) sur stdin/stdout et relaie chaque appel
 * d'outil au serveur HTTP local de GVue (127.0.0.1, port + jeton lus dans
 * userData/mcp-endpoint.json — écrit par GVue quand le serveur MCP est activé
 * dans ⚙ Paramètres → Général).
 *
 * Enregistrement côté Claude Code :
 *   claude mcp add gvue -- node "<chemin>\gvue-mcp.cjs"
 *
 * Aucune dépendance npm : http + fs + readline de Node.
 */
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const readline = require('node:readline')

/* ------------------------- Endpoint de l'app GVue ------------------------ */

function endpointFile() {
  if (process.env.GVUE_MCP_ENDPOINT) return process.env.GVUE_MCP_ENDPOINT
  const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming')
  return path.join(appData, 'gvue', 'mcp-endpoint.json')
}

function readEndpoint() {
  const raw = fs.readFileSync(endpointFile(), 'utf8')
  const { port, token } = JSON.parse(raw)
  if (!port || !token) throw new Error('endpoint invalide')
  return { port, token }
}

function callGvue(tool, args) {
  return new Promise((resolve, reject) => {
    let ep
    try {
      ep = readEndpoint()
    } catch {
      reject(
        new Error(
          "GVue n'est pas joignable : lance l'application et active le serveur MCP " +
            '(⚙ Paramètres → Général → « Serveur MCP »).'
        )
      )
      return
    }
    const body = JSON.stringify({ tool, args })
    const req = http.request(
      {
        host: '127.0.0.1',
        port: ep.port,
        path: '/rpc',
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
          'x-gvue-token': ep.token
        },
        timeout: 10000
      },
      (res) => {
        let data = ''
        res.on('data', (c) => (data += c))
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data)
            if (parsed.ok) resolve(parsed.result)
            else reject(new Error(parsed.error || 'Erreur GVue'))
          } catch {
            reject(new Error(`Réponse GVue invalide (HTTP ${res.statusCode})`))
          }
        })
      }
    )
    req.on('error', () =>
      reject(new Error("GVue n'est pas lancé (ou le serveur MCP a été désactivé)."))
    )
    req.on('timeout', () => req.destroy(new Error('GVue ne répond pas.')))
    req.end(body)
  })
}

/* ------------------------------- Outils MCP ------------------------------ */

const WIN = {
  windowId: {
    type: 'number',
    description:
      'Fenêtre GVue visée (voir get_context → windows). Par défaut : la fenêtre active ou la dernière utilisée.'
  }
}
const TARGET = {
  ptyId: { type: 'string', description: 'Terminal visé (voir list_terminals)' },
  title: { type: 'string', description: 'À défaut : fragment du titre' },
  server: { type: 'string', description: 'À défaut : fragment du serveur SSH (hôte:port:user)' }
}

const TOOLS = [
  {
    name: 'get_context',
    description:
      "Contexte courant de GVue : TOUTES les fenêtres ouvertes (`windows`, chacune avec son " +
      '`windowId`, ses colonnes, son dépôt Git, son espace de travail), la fenêtre active ' +
      '(`activeWindowId`, dont `panes`/`repo` sont repris au premier niveau), les fichiers ' +
      'SÉLECTIONNÉS par l’utilisateur et tous les terminaux (avec leur `windowId`). À appeler ' +
      'en premier pour savoir ce que l’utilisateur regarde.',
    inputSchema: { type: 'object', properties: { ...WIN }, additionalProperties: false }
  },
  {
    name: 'list_terminals',
    description:
      'Liste les terminaux intégrés de TOUTES les fenêtres GVue (ptyId, windowId, titre, ' +
      'dossier, état, shell, et pour les sessions DISTANTES `sshHost` + `sshState` : ' +
      '« connected » (ssh tourne), « connecting » (tout juste ouverte), « disconnected » ' +
      '(connexion fermée : le shell LOCAL a repris la main — rouvrez avec open_ssh). ' +
      "À CONSULTER EN PREMIER : l'utilisateur préfère qu'on travaille dans SES terminaux " +
      '(run_in_terminal) plutôt que d’en ouvrir de nouveaux — cela réutilise aussi une ' +
      'connexion SSH déjà établie.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'get_terminal_output',
    description:
      "Texte affiché par un terminal intégré (écran + historique de défilement, comme " +
      "l'utilisateur le voit) — ex. les logs du serveur de dev qui y tourne. Sans argument : " +
      'le terminal le plus récent de la fenêtre active.',
    inputSchema: {
      type: 'object',
      properties: {
        ...TARGET,
        tailLines: { type: 'number', description: 'Nombre de lignes de fin (défaut 200, max 2000)' },
        ...WIN
      },
      additionalProperties: false
    }
  },
  {
    name: 'run_in_terminal',
    description:
      'Lance une commande dans un terminal DÉJÀ OUVERT de GVue, attend sa FIN et rend sa ' +
      'sortie avec son CODE DE SORTIE (`exitCode` 0 = succès ; `finished` faux = toujours ' +
      'en cours après le délai, cas normal pour un serveur qui tourne). ' +
      "C'EST L'OUTIL PAR DÉFAUT : n'ouvre pas d'onglet supplémentaire et travaille dans les " +
      "terminaux de l'utilisateur. Sur une session SSH ouverte par GVue, la commande part sur " +
      "le SERVEUR dans la connexion déjà authentifiée. Sert aussi à naviguer (cd, ls). " +
      'Une commande SANS FIN (tail -f, serveur…) occupe le terminal : arrêtez-la ensuite avec ' +
      'send_keys { keys: "ctrl+c" }, ou bornez-la (timeout 30 …). ' +
      'POUR JOINDRE UN SERVEUR : passez par open_ssh, jamais par un « ssh » tapé ici ' +
      '(il ignorerait le mot de passe enregistré dans GVue).',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Commande à exécuter' },
        ...TARGET,
        submit: {
          type: 'boolean',
          description:
            'Valider par Entrée (défaut vrai). Faux pour répondre à une invite ; les caractères ' +
            'de contrôle sont alors acceptés (préférez send_keys).'
        },
        timeoutMs: {
          type: 'number',
          description:
            'Attente MAXIMALE de la fin de la commande (défaut 20000, max 300000). Au-delà, la ' +
            'commande continue de tourner et la sortie est rendue telle quelle.'
        },
        ...WIN
      },
      required: ['command'],
      additionalProperties: false
    }
  },
  {
    name: 'send_keys',
    description:
      'Envoie des touches à un terminal : « ctrl+c » (interrompre une commande sans fin), ' +
      '« ctrl+d », « ctrl+z », « enter », « esc », « tab », « up », « down », « left », ' +
      '« right », « backspace » — plusieurs séparées par des espaces (« up enter »).',
    inputSchema: {
      type: 'object',
      properties: { keys: { type: 'string' }, ...TARGET, ...WIN },
      required: ['keys'],
      additionalProperties: false
    }
  },
  {
    name: 'close_terminal',
    description:
      'Ferme un terminal (termine son processus et retire l’onglet). À utiliser pour les ' +
      'terminaux que VOUS avez ouverts et qui ne servent plus — pas ceux de l’utilisateur ' +
      'sans son accord.',
    inputSchema: {
      type: 'object',
      properties: { ...TARGET },
      additionalProperties: false
    }
  },
  {
    name: 'open_terminal',
    description:
      'Ouvre un terminal intégré visible dans GVue (et y lance une commande si fournie) et ' +
      'rend son `ptyId`. Sans commande, un terminal local DÉJÀ OUVERT dans ce dossier est ' +
      'réutilisé (newTerminal: true pour en forcer un autre). À réserver aux commandes ' +
      "longues (serveurs de dev…) qui méritent leur propre onglet ; pour le reste, préférez " +
      'run_in_terminal dans un terminal existant. Donnez un `title` parlant (ex. « Serveur ' +
      'dev »), sinon l’onglet prend le nom du dossier.',
    inputSchema: {
      type: 'object',
      properties: {
        cwd: { type: 'string', description: 'Dossier de travail (chemin absolu)' },
        command: { type: 'string', description: 'Commande à lancer (optionnel : sinon shell vide)' },
        title: { type: 'string', description: "Titre de l'onglet (recommandé)" },
        newTerminal: { type: 'boolean', description: 'Forcer un nouveau terminal (défaut faux)' },
        split: { type: 'boolean', description: 'Afficher les terminaux côte à côte (défaut faux)' },
        ...WIN
      },
      required: ['cwd'],
      additionalProperties: false
    }
  },
  {
    name: 'navigate',
    description: "Ouvre un dossier dans GVue (la colonne active de la fenêtre visée y navigue).",
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Chemin absolu du dossier' }, ...WIN },
      required: ['path'],
      additionalProperties: false
    }
  },
  {
    name: 'reveal',
    description:
      "Révèle un fichier ou dossier dans GVue : navigue jusqu'à lui et le sélectionne. " +
      "Un fichier caché (.gitignore, .env…) est rendu visible (affichage des fichiers cachés " +
      'activé, signalé par `hiddenFilesShown`).',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Chemin absolu' },
        showHidden: {
          type: 'boolean',
          description: 'Afficher les fichiers cachés si nécessaire (défaut vrai)'
        },
        ...WIN
      },
      required: ['path'],
      additionalProperties: false
    }
  },
  {
    name: 'notify',
    description:
      "Affiche une notification (toast) dans GVue — ex. « Build terminé ✓ ». Le message " +
      'est préfixé « Agent : » côté interface.',
    inputSchema: {
      type: 'object',
      properties: { message: { type: 'string' }, ...WIN },
      required: ['message'],
      additionalProperties: false
    }
  },
  {
    name: 'list_launch_tasks',
    description: 'Liste les « lancements » configurés dans GVue (commandes de projets : dev server, build…).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'run_launch_task',
    description: 'Démarre un lancement GVue (par id ou par nom exact) dans le terminal intégré.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string', description: 'Nom exact du lancement (voir list_launch_tasks)' },
        ...WIN
      },
      additionalProperties: false
    }
  },
  {
    name: 'set_ui',
    description:
      "Ouvre ou ferme un panneau/dialogue de GVue : git, terminal, preview (aperçu), settings, " +
      'recycleBin, servers (manager SSH/SFTP), tidyRules, shortcuts, palette, hiddenFiles ' +
      '(afficher les fichiers cachés). Pour le terminal : `maximized` (plein espace), `split` ' +
      '(terminaux côte à côte) et `dock` (bottom | right | left : terminal sous les colonnes ' +
      'ou à côté, sur toute la hauteur). Rend la main après le rendu.',
    inputSchema: {
      type: 'object',
      properties: {
        panel: {
          type: 'string',
          enum: [
            'git',
            'terminal',
            'preview',
            'settings',
            'recycleBin',
            'servers',
            'tidyRules',
            'shortcuts',
            'palette',
            'hiddenFiles'
          ]
        },
        open: { type: 'boolean', description: 'true = ouvrir (défaut), false = fermer' },
        maximized: { type: 'boolean', description: 'Terminal : plein espace de la fenêtre' },
        split: { type: 'boolean', description: 'Terminal : côte à côte (sinon onglets)' },
        dock: { type: 'string', enum: ['bottom', 'right', 'left'], description: 'Terminal : position' },
        ...WIN
      },
      required: ['panel'],
      additionalProperties: false
    }
  },
  {
    name: 'set_theme',
    description:
      "Applique un thème à GVue : 'auto', 'light', 'dark', ou l'id d'une palette " +
      '(cyber, matrix, synthwave, tokyo, nord, oled, crt, paper). Rend la main une fois le ' +
      'thème affiché (une capture juste après le montre bien).',
    inputSchema: {
      type: 'object',
      properties: { theme: { type: 'string' }, ...WIN },
      required: ['theme'],
      additionalProperties: false
    }
  },
  {
    name: 'list_presets',
    description: "Liste les préréglages d'apparence enregistrés (thème, accent…).",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'apply_preset',
    description: "Applique un préréglage d'apparence (nom exact, voir list_presets).",
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string' }, ...WIN },
      required: ['name'],
      additionalProperties: false
    }
  },
  {
    name: 'list_workspaces',
    description:
      'Liste les espaces de travail enregistrés (colonnes, terminaux, position du terminal, ' +
      'thème) et celui chargé dans chaque fenêtre. Un espace remet en une fois toute une ' +
      'disposition : préférez-le à une reconstruction étape par étape.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'load_workspace',
    description: 'Charge un espace de travail (nom exact, voir list_workspaces) dans la fenêtre visée.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string' }, ...WIN },
      required: ['name'],
      additionalProperties: false
    }
  },
  {
    name: 'save_workspace',
    description:
      'Enregistre la disposition courante de la fenêtre (colonnes, panneaux, terminaux, ' +
      'apparence) comme espace de travail — remplace un espace du même nom.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string' }, ...WIN },
      required: ['name'],
      additionalProperties: false
    }
  },
  {
    name: 'set_window',
    description:
      'Change l’état de la fenêtre GVue : maximized (vraiment agrandie, au sens de Windows), ' +
      'fullscreen, normal, minimized, ou focus (premier plan).',
    inputSchema: {
      type: 'object',
      properties: {
        state: { type: 'string', enum: ['maximized', 'fullscreen', 'normal', 'minimized', 'focus'] },
        ...WIN
      },
      required: ['state'],
      additionalProperties: false
    }
  },
  {
    name: 'resize_window',
    description: 'Redimensionne et recentre la fenêtre GVue (pixels) — pour des captures homogènes.',
    inputSchema: {
      type: 'object',
      properties: { width: { type: 'number' }, height: { type: 'number' }, ...WIN },
      required: ['width', 'height'],
      additionalProperties: false
    }
  },
  {
    name: 'screenshot',
    description:
      "Capture d'écran de la fenêtre GVue (rendu réel). Renvoie le chemin d'un PNG " +
      "temporaire à ouvrir avec l'outil de lecture d'images.",
    inputSchema: { type: 'object', properties: { ...WIN }, additionalProperties: false }
  },
  {
    name: 'get_ui_state',
    description:
      "État de l'interface d'une fenêtre GVue : panneaux ouverts, disposition du terminal " +
      '(position, plein espace, côte à côte), fichiers cachés affichés, mode liste/grille, ' +
      'thème, espace de travail chargé, état de la fenêtre.',
    inputSchema: { type: 'object', properties: { ...WIN }, additionalProperties: false }
  },
  {
    name: 'list_servers',
    description:
      'Liste les serveurs SSH/SFTP connus de GVue (ajouts manuels + alias du ~/.ssh/config) : ' +
      'nom, cible user@hôte:port, origine, sessions ouvertes et leur état, et le DÉTAIL des ' +
      'tunnels (sens -L/-R/-D, écoute → destination, port local en écoute ou non, état : ' +
      '« active », « inactive », « port-used-elsewhere », « unknown » pour un -R).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'open_tunnel',
    description:
      'Rend un tunnel EFFECTIVEMENT actif : ouvre une session SSH portant ce tunnel (onglet ' +
      '« serveur · tunnel port », mot de passe enregistré fourni automatiquement) et attend que ' +
      'le port local écoute. Soit un tunnel déjà défini (listenPort), soit un tunnel ponctuel ' +
      '(spec), qui n’est PAS enregistré. Le tunnel vit tant que cet onglet reste ouvert.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Serveur (voir list_servers)' },
        listenPort: { type: 'number', description: 'Port d’écoute d’un tunnel défini sur ce serveur' },
        spec: {
          type: 'string',
          description: 'À défaut : tunnel ponctuel, ex. « 14330:app.lan:1433 » (-L), « R 9000:localhost:9000 », « D 1080 »'
        },
        timeoutMs: { type: 'number', description: 'Attente maximale de l’écoute (défaut 20000)' },
        ...WIN
      },
      required: ['name'],
      additionalProperties: false
    }
  },
  {
    name: 'add_tunnel',
    description:
      'Ajoute un tunnel à la configuration d’un serveur géré par GVue (pas ceux du ~/.ssh/config). ' +
      'L’UTILISATEUR doit confirmer dans GVue : sans son accord, rien n’est modifié. Le tunnel ' +
      'est monté aux prochaines connexions ; open_tunnel le rend actif tout de suite.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Serveur (voir list_servers)' },
        spec: {
          type: 'string',
          description: '« portLocal:hôte:portDistant » (-L), « R portServeur:hôte:port » (-R) ou « D port » (SOCKS)'
        },
        ...WIN
      },
      required: ['name', 'spec'],
      additionalProperties: false
    }
  },
  {
    name: 'remove_tunnel',
    description:
      'Retire un tunnel de la configuration d’un serveur géré par GVue. L’UTILISATEUR doit ' +
      'confirmer dans GVue. Une session déjà ouverte garde le tunnel jusqu’à sa fermeture.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Serveur (voir list_servers)' },
        listenPort: { type: 'number', description: 'Port d’écoute du tunnel à retirer' },
        type: { type: 'string', enum: ['local', 'remote', 'dynamic'], description: 'Sens, si ambigu' },
        ...WIN
      },
      required: ['name', 'listenPort'],
      additionalProperties: false
    }
  },
  {
    name: 'open_ssh',
    description:
      'Ouvre — ou REPREND — un terminal SSH sur le serveur indiqué (nom exact, voir ' +
      'list_servers) et rend son `ptyId`. Une session ENCORE CONNECTÉE vers ce serveur est ' +
      'réutilisée (newSession: true pour une deuxième, dont le ptyId est rendu) ; si la ' +
      'connexion est tombée, une nouvelle session est ouverte (`reopened`). Le mot de ' +
      "passe enregistré dans GVue est fourni automatiquement à l'invite. Enchaînez avec " +
      'run_in_terminal sur le ptyId rendu.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        newSession: {
          type: 'boolean',
          description: 'Forcer une nouvelle session même si une est déjà ouverte (défaut faux)'
        },
        ...WIN
      },
      required: ['name'],
      additionalProperties: false
    }
  },
  {
    name: 'open_sftp',
    description: "Ouvre l'explorateur de fichiers distant (SFTP) sur le serveur indiqué (voir list_servers).",
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string' }, ...WIN },
      required: ['name'],
      additionalProperties: false
    }
  }
]

/* --------------------------- Protocole MCP stdio -------------------------- */

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n')
}

async function handle(msg) {
  const { id, method, params } = msg
  if (method === 'initialize') {
    send({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: (params && params.protocolVersion) || '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'gvue', version: '1.0.0' }
      }
    })
    return
  }
  if (method === 'notifications/initialized' || method === 'notifications/cancelled') return
  if (method === 'ping') {
    send({ jsonrpc: '2.0', id, result: {} })
    return
  }
  if (method === 'tools/list') {
    send({ jsonrpc: '2.0', id, result: { tools: TOOLS } })
    return
  }
  if (method === 'tools/call') {
    const name = params && params.name
    const args = (params && params.arguments) || {}
    try {
      const result = await callGvue(name, args)
      send({
        jsonrpc: '2.0',
        id,
        result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      })
    } catch (e) {
      send({
        jsonrpc: '2.0',
        id,
        result: { content: [{ type: 'text', text: `Erreur : ${e.message}` }], isError: true }
      })
    }
    return
  }
  // Méthode inconnue avec id → erreur JSON-RPC ; notification inconnue → silence.
  if (id !== undefined) {
    send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Méthode inconnue : ${method}` } })
  }
}

const rl = readline.createInterface({ input: process.stdin, terminal: false })
rl.on('line', (line) => {
  const trimmed = line.trim()
  if (!trimmed) return
  let msg
  try {
    msg = JSON.parse(trimmed)
  } catch {
    return
  }
  void handle(msg)
})
rl.on('close', () => process.exit(0))
