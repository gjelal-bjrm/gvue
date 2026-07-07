# PLAN — Charger le terminal (xterm, ~407 ko) à la demande

## Rang : 5/5

**Pourquoi ce rang :** le code-splitting a éclaté le bundle en 4 chunks, mais le
chunk `xterm` (407 ko, le plus gros) est **quand même chargé au démarrage** à
cause d'une chaîne d'imports statiques. Le différer allège le démarrage pour
l'usage « explorateur pur » (terminal fermé par défaut). Gain réel mais
confort ; à faire après les plans 1–4. C'est aussi le plan le plus délicat :
la difficulté n'est PAS `React.lazy`, c'est le graphe d'imports (voir Piège 1).

## Objectif

Le chunk `xterm-*.js` (et le CSS xterm) ne doit être téléchargé/évalué que
lorsqu'un terminal devient visible pour la première fois. Aucune régression :
thème appliqué aux terminaux vivants, fermeture d'onglet, historique préservé,
restauration d'espaces de travail avec terminaux.

## État des lieux exact (vérifié)

Le chunk xterm est tiré au démarrage par TROIS chemins statiques :

1. `src/renderer/src/App.tsx:12` → `import TerminalPanel from './components/TerminalPanel'`
   → `Terminal.tsx` → `lib/terminalRegistry.ts` → `@xterm/*` ;
2. `src/renderer/src/state/useAppearanceStore.ts:4` →
   `import { applyThemeAll } from '../lib/terminalRegistry'` (le store
   d'apparence est initialisé au boot → il embarque xterm !) ;
3. `src/renderer/src/state/useTerminalStore.ts:4` →
   `import { disposeTerminal } from '../lib/terminalRegistry'`.

Plus le CSS : `src/renderer/src/main.tsx` importe `'@xterm/xterm/css/xterm.css'`.

`lib/terminalSuggest.ts` n'importe que le TYPE `Terminal` (`import type`) —
effacé à la compilation, aucun impact, ne pas y toucher.

## Fichiers à toucher

| Fichier | Action |
|---|---|
| `src/renderer/src/lib/terminalBridge.ts` | **Créer** (façade sans dépendance xterm) |
| `src/renderer/src/lib/terminalRegistry.ts` | S'enregistrer dans la façade + importer le CSS xterm |
| `src/renderer/src/state/useAppearanceStore.ts` | Importer la façade au lieu du registre |
| `src/renderer/src/state/useTerminalStore.ts` | Idem |
| `src/renderer/src/App.tsx` | `React.lazy` + `Suspense` autour de TerminalPanel |
| `src/renderer/src/main.tsx` | Retirer l'import du CSS xterm |

## Implémentation, dans l'ordre

### Étape 1 — la façade `lib/terminalBridge.ts`

```ts
/**
 * Façade sans dépendance xterm : permet aux stores chargés au démarrage
 * (apparence, terminal) d'appeler le registre SANS l'importer statiquement —
 * sinon le chunk xterm (~407 ko) serait tiré au boot. Tant que le registre
 * n'est pas chargé (aucun terminal ouvert), les appels sont des no-ops :
 * il n'existe alors aucune instance xterm à thémer ou à détruire.
 */
interface TerminalImpl {
  applyThemeAll(): void
  disposeTerminal(ptyId: string): void
}

let impl: TerminalImpl | null = null

/** Appelé par terminalRegistry à son chargement. */
export function registerTerminalImpl(i: TerminalImpl): void {
  impl = i
}

export function applyThemeAll(): void {
  impl?.applyThemeAll()
}

export function disposeTerminal(ptyId: string): void {
  impl?.disposeTerminal(ptyId)
}
```

### Étape 2 — `terminalRegistry.ts` s'enregistre + reprend le CSS

En tête de `lib/terminalRegistry.ts`, ajouter :

```ts
import '@xterm/xterm/css/xterm.css'
import { registerTerminalImpl } from './terminalBridge'
```

et tout en bas du fichier (après les définitions) :

```ts
// Expose les opérations aux stores via la façade (chargement paresseux).
registerTerminalImpl({ applyThemeAll, disposeTerminal })
```

Dans `src/renderer/src/main.tsx`, SUPPRIMER la ligne
`import '@xterm/xterm/css/xterm.css'` (Vite injecte le CSS d'un chunk async à
son chargement — comportement standard).

### Étape 3 — les stores passent par la façade

- `useAppearanceStore.ts` ligne 4 :
  `import { applyThemeAll } from '../lib/terminalRegistry'`
  → `import { applyThemeAll } from '../lib/terminalBridge'`
  (l'appel ligne ~65 reste identique).
- `useTerminalStore.ts` ligne 4 : même substitution pour `disposeTerminal`.

### Étape 4 — `TerminalPanel` paresseux dans App.tsx

Remplacer l'import statique :

```ts
import TerminalPanel from './components/TerminalPanel'
```

par :

```ts
import { lazy, Suspense } from 'react'   // fusionner avec l'import react existant
const TerminalPanel = lazy(() => import('./components/TerminalPanel'))
```

et au rendu (le bloc `{terminalOpen && (… <TerminalPanel /> …)}`) :

```tsx
<Suspense fallback={null}>
  <TerminalPanel />
</Suspense>
```

`fallback={null}` suffit : le Panel parent réserve déjà l'espace, et le chunk
se charge en quelques ms depuis le disque local.

### Étape 5 — vérifier le graphe puis committer

1. `npm run typecheck && npm test && npm run build`.
2. **Preuve du découplage** : ouvrir `out/renderer/index.html` et vérifier que
   `xterm-*.js` n'apparaît PAS dans les `<link rel="modulepreload">` (avant ce
   plan, il y est). Le chunk doit exister dans `out/renderer/assets/` mais ne
   plus être préchargé.
3. Test manuel (`npm run dev`, réseau DevTools) : au boot, `@xterm` absent ;
   ouvrir le terminal → le chunk se charge, le prompt s'affiche stylé
   (le CSS suit le chunk).
4. Commit : préfixe `GVue:`, ligne
   `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`, boucle de
   réessai git (`.git/index.lock` — GVue qui tourne le verrouille).

## Pièges relevés (qu'un modèle moins attentif raterait)

1. **`React.lazy` seul ne sert à rien ici.** Même avec TerminalPanel paresseux,
   `useAppearanceStore` (chargé au boot par App) importe statiquement
   `terminalRegistry` → Rollup place le graphe xterm dans les modulepreload du
   démarrage. C'est la façade (étape 1–3) qui casse réellement la chaîne. Ne
   pas sauter ces étapes puis déclarer victoire sur la foi du seul lazy().
2. **La façade en no-op est correcte, pas un hack** : si le registre n'est pas
   chargé, il n'existe AUCUNE instance xterm — `applyThemeAll` n'a rien à
   thémer (chaque terminal reçoit de toute façon `buildTheme()` à sa création
   dans `acquire()`), et `disposeTerminal` n'a rien à détruire.
3. **Le CSS doit suivre le chunk.** Si on laisse `xterm.css` dans `main.tsx`,
   on garde 30 ko de CSS mort au boot ; si on l'oublie partout, le terminal
   s'affiche cassé (pas de grille, curseur invisible). L'import dans
   `terminalRegistry.ts` garantit CSS et JS chargés ensemble.
4. **Restauration d'espace de travail avec terminaux** : au chargement d'un
   workspace, `terminalOpen` peut devenir vrai très tôt → Suspense se déclenche
   au premier rendu. C'est géré (fallback null + chunk local), mais tester ce
   scénario explicitement (critère 5) — c'est LE chemin que personne ne pense
   à re-tester.
5. **Ne pas toucher `manualChunks`** dans `electron.vite.config.ts` : la
   fonction actuelle (`id.includes('@xterm') → 'xterm'`) reste correcte ; le
   plan change QUI charge le chunk, pas comment il est découpé.
6. **`import type` ≠ import réel** : `terminalSuggest.ts` référence le type
   xterm sans coût runtime. Ne pas le « corriger ».

## Critères d'acceptation

1. `out/renderer/index.html` ne contient plus `xterm` dans ses modulepreload
   (comparer avant/après le commit).
2. Au lancement (terminal fermé), l'onglet Réseau des DevTools ne montre aucun
   fichier `xterm-*.js` ; il apparaît **à l'ouverture** du terminal.
3. Terminal fonctionnel après chargement paresseux : prompt stylé, saisie,
   ghost-text (Tab), clic droit copie/colle, liens cliquables.
4. Changer la couleur d'accent AVEC un terminal ouvert recolorise le terminal
   (curseur/sélection) ; la changer SANS terminal ouvert ne charge pas le chunk
   (vérifier au réseau).
5. Charger un espace de travail qui contient des terminaux → les onglets se
   rouvrent normalement.
6. Fermer un onglet terminal libère bien l'instance (rouvrir → nouveau shell,
   pas l'ancien buffer).
7. `npm run typecheck`, `npm test`, `npm run build` verts.
