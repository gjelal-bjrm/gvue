/**
 * Classification des erreurs de mise à jour (pur, testé).
 *
 * Deux besoins : savoir si un réessai a des chances d'aboutir, et donner à
 * l'utilisateur une phrase actionnable — « net::ERR_HTTP2_SERVER_REFUSED_STREAM »
 * n'apprend rien à personne et fait peur.
 */

/**
 * Erreurs réseau TRANSITOIRES : coupure, DNS momentané, flux refusé par le
 * serveur (GitHub renvoie ERR_HTTP2_SERVER_REFUSED_STREAM quand il limite les
 * connexions). Un réessai quelques secondes plus tard passe le plus souvent.
 */
export function isTransientNetworkError(message: string): boolean {
  return /ERR_HTTP2|ERR_CONNECTION|ERR_NETWORK_CHANGED|ERR_INTERNET_DISCONNECTED|ERR_TIMED_OUT|ERR_EMPTY_RESPONSE|ECONNRESET|ECONNREFUSED|ECONNABORTED|ETIMEDOUT|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH|socket hang up|network|timed? ?out/i.test(
    message
  )
}

/** Aucune release exploitable : rien à installer, ce n'est pas une panne. */
export function isNoReleaseError(message: string): boolean {
  return /no published versions|not found|404|cannot find|latest\.yml/i.test(message)
}

/**
 * Message affiché : une phrase claire pour les cas connus, le message brut en
 * dernier recours (mieux que rien quand la cause est inhabituelle).
 */
export function friendlyUpdateError(message: string): string {
  if (isTransientNetworkError(message)) {
    return 'Connexion au serveur de mise à jour impossible. Vérifiez votre accès à Internet, puis réessayez.'
  }
  if (/EACCES|EPERM|permission/i.test(message)) {
    return 'Droits insuffisants pour installer la mise à jour. Fermez GVue et relancez-le.'
  }
  if (/ENOSPC|disk|space/i.test(message)) {
    return 'Espace disque insuffisant pour télécharger la mise à jour.'
  }
  if (/signature|sha512|checksum|corrupt/i.test(message)) {
    return 'Le fichier téléchargé est incomplet ou corrompu. Réessayez.'
  }
  return message
}
