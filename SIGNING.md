# Politique de signature de code — GVue

> **Statut :** en cours de mise en place. La signature sera assurée par un
> certificat fourni gratuitement par **[SignPath Foundation](https://signpath.org/)**
> dans le cadre de son programme pour les projets open-source, une fois la
> candidature du projet approuvée. Tant que ce n'est pas actif, les installeurs
> ne sont pas signés (Windows SmartScreen peut afficher un avertissement au
> premier lancement) ; vérifiez alors l'intégrité via les sommes de contrôle
> publiées sur la page de release.

## Ce qui est signé

- L'installeur Windows (`GVue-Setup-*.exe`, NSIS).
- L'exécutable principal de l'application.

## Provenance des binaires (chaîne de confiance)

- Les binaires signés sont **exclusivement** produits par le workflow GitHub
  Actions [`release.yml`](.github/workflows/release.yml), à partir d'un commit
  taggé `vX.Y.Z` du dépôt public [gjelal-bjrm/gvue](https://github.com/gjelal-bjrm/gvue).
- Aucun binaire construit localement n'est signé. SignPath vérifie que la demande
  de signature provient bien de ce workflow (et non d'un tiers en possession du
  jeton d'API).
- Le certificat est émis au nom du projet par SignPath Foundation ; le projet ne
  signe que ses propres binaires, issus de son propre code source.

## Comment vérifier une release

1. **Signature numérique** (une fois active) : clic droit sur l'installeur →
   *Propriétés* → onglet *Signatures numériques* → l'éditeur doit correspondre au
   certificat SignPath Foundation du projet.
2. **Somme de contrôle** : comparer le SHA-256 de l'installeur téléchargé à celui
   publié sur la page de la release GitHub.

## Gouvernance

- Authentification multifacteur (MFA) activée pour tous les membres ayant accès à
  la configuration de signature.
- Rôles distincts conformément au modèle SignPath (auteur / relecteur / approbateur).
- Le jeton d'API SignPath est stocké comme **secret de dépôt GitHub**
  (`SIGNPATH_API_TOKEN`) et n'apparaît jamais dans le code ou les logs.

## Signaler un problème

En cas de doute sur l'authenticité d'un binaire, ouvrez une issue sur le dépôt
sans exécuter le fichier suspect.
