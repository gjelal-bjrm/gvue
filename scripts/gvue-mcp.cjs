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

const TOOLS = [
  {
    name: 'get_context',
    description:
      "Contexte courant de l'explorateur GVue : colonnes et onglets ouverts (chemins), " +
      'onglet actif, fichiers SÉLECTIONNÉS par l’utilisateur, dépôt Git courant ' +
      '(racine + branche) et terminaux ouverts. À appeler en premier pour savoir ' +
      'ce que l’utilisateur regarde.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'list_terminals',
    description: 'Liste les terminaux intégrés ouverts dans GVue (ptyId, titre, dossier, état).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'get_terminal_output',
    description:
      "Sortie (logs) d'un terminal intégré de GVue — ex. le serveur de dev qui y tourne. " +
      'Sans argument : le terminal le plus récent. Sinon cibler par ptyId ou par titre.',
    inputSchema: {
      type: 'object',
      properties: {
        ptyId: { type: 'string', description: 'Identifiant exact (voir list_terminals)' },
        title: { type: 'string', description: 'Fragment du titre du terminal' },
        tailLines: { type: 'number', description: 'Nombre de lignes de fin (défaut 200, max 2000)' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'navigate',
    description: "Ouvre un dossier dans GVue (l'onglet actif y navigue, la fenêtre passe au premier plan).",
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Chemin absolu du dossier' } },
      required: ['path'],
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
        name: { type: 'string', description: 'Nom exact du lancement (voir list_launch_tasks)' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'screenshot',
    description:
      "Capture d'écran de la fenêtre GVue (rendu réel de l'interface). Renvoie le chemin " +
      "d'un PNG temporaire à ouvrir avec l'outil de lecture d'images. Indispensable pour " +
      'vérifier visuellement un bug ou un changement d’UI.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'open_terminal',
    description:
      'Ouvre un terminal intégré VISIBLE dans GVue (et y lance une commande si fournie). ' +
      "À préférer pour les commandes longues (serveurs de dev…) : l'utilisateur voit la " +
      "sortie en direct et le processus survit à la session de l'agent.",
    inputSchema: {
      type: 'object',
      properties: {
        cwd: { type: 'string', description: 'Dossier de travail (chemin absolu)' },
        command: { type: 'string', description: 'Commande à lancer (optionnel : sinon shell vide)' },
        title: { type: 'string', description: "Titre de l'onglet (optionnel)" }
      },
      required: ['cwd'],
      additionalProperties: false
    }
  },
  {
    name: 'reveal',
    description:
      "Révèle un fichier ou dossier dans GVue : navigue jusqu'à lui et le sélectionne. " +
      "Utile pour MONTRER à l'utilisateur un fichier généré ou pertinent.",
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Chemin absolu' } },
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
      properties: { message: { type: 'string' } },
      required: ['message'],
      additionalProperties: false
    }
  },
  {
    name: 'get_ui_state',
    description:
      "État de l'interface GVue : panneaux ouverts (Git, aperçu, terminal, recherche, " +
      'paramètres), mode liste/grille, thème actif, contenu de l’étagère. Utile pour ' +
      'déboguer « je ne vois pas X ».',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
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
