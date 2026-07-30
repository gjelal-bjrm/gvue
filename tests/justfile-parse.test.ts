import { describe, it, expect } from 'vitest'
import { parseJustfile } from '../src/main/services/justfile'

// Extrait fidèle d'un justfile réel de l'utilisateur (projet GestFit).
const REAL = `set windows-shell := ["cmd", "/c"]

# Exécutable Python : \`python\` sous Windows, \`python3\` ailleurs (Linux/macOS).
python := if os() == "windows" { "python" } else { "python3" }

# Affiche la liste courte des commandes
default:
  just --list --unsorted

# Affiche l'aide détaillée de chaque recette
help:
  {{python}} Scripts/help.py

# =============================================================================
# CI build (test local des modules ci/)
# =============================================================================

# Valide l'encodage des scripts SQL
ci-check-sql:
  cd GestFit.Client.WebApp2 && {{python}} -m ci.check_sql

# Régénère MergedCss.css / MergedJs.js / version.txt
ci-merge version="dev":
  cd GestFit.Client.WebApp2 && {{python}} -m ci.merge_css_js --version {{version}}

# Assemble le zip artefact sans upload (test local)
ci-package version publish_dir:
  cd GestFit.Client.WebApp2 && {{python}} -m ci.package_release --version {{version}}
`

describe('parseJustfile', () => {
  const recipes = parseJustfile(REAL)
  const names = recipes.map((r) => r.name)

  it('extrait toutes les recettes du justfile réel', () => {
    expect(names).toEqual(['default', 'help', 'ci-check-sql', 'ci-merge', 'ci-package'])
  })

  it('ignore les settings et les assignations', () => {
    expect(names).not.toContain('set')
    expect(names).not.toContain('python')
  })

  it('associe le commentaire précédent comme description', () => {
    expect(recipes.find((r) => r.name === 'help')?.description).toBe(
      "Affiche l'aide détaillée de chaque recette"
    )
    // Le bandeau « ==== » ne doit pas devenir une description.
    expect(recipes.find((r) => r.name === 'ci-check-sql')?.description).toBe(
      "Valide l'encodage des scripts SQL"
    )
  })

  it('capture les paramètres, avec ou sans valeur par défaut', () => {
    expect(recipes.find((r) => r.name === 'ci-merge')?.params).toEqual(['version="dev"'])
    expect(recipes.find((r) => r.name === 'ci-package')?.params).toEqual(['version', 'publish_dir'])
    expect(recipes.find((r) => r.name === 'help')?.params).toEqual([])
  })

  it('ignore le corps indenté des recettes', () => {
    expect(names).not.toContain('cd')
    expect(names).not.toContain('just')
  })

  it('ignore les recettes privées et garde les dépendances hors des params', () => {
    const r = parseJustfile('_priv:\n  echo x\n\nbuild: _priv\n  echo y\n')
    expect(r.map((x) => x.name)).toEqual(['build'])
    expect(r[0].params).toEqual([])
  })

  it('gère @recette, alias/export/import et les doublons', () => {
    const r = parseJustfile(
      'alias b := build\nexport FOO := "1"\nimport "other.just"\n@quiet:\n  echo hi\nbuild:\n  echo 1\nbuild:\n  echo 2\n'
    )
    expect(r.map((x) => x.name)).toEqual(['quiet', 'build'])
  })

  it('renvoie une liste vide sur un contenu vide ou sans recette', () => {
    expect(parseJustfile('')).toEqual([])
    expect(parseJustfile('# juste un commentaire\nx := "1"\n')).toEqual([])
  })
})
