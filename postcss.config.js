module.exports = {
  // Electron embarque une version unique de Chromium : pas besoin
  // d'autoprefixer (aucun préfixe vendeur à générer). On garde donc
  // uniquement Tailwind, ce qui évite la chaîne browserslist/caniuse-lite.
  plugins: {
    tailwindcss: {}
  }
}
