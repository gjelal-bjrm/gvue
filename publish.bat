@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ===============================================
echo   GVue - Publication d'une mise a jour (GitHub)
echo ===============================================
echo.

REM --- 1) Token GitHub (jamais stocke dans ce fichier) ---
REM Tu peux le definir avant de lancer (set GH_TOKEN=ghp_...) pour ne pas le retaper.
REM Le token doit pouvoir CREER UNE RELEASE sur gjelal-bjrm/gvue-releases
REM (depot public dedie aux installeurs ; le code source reste prive).
if not defined GH_TOKEN set /p GH_TOKEN=Colle ton token GitHub (ghp_...) :
if not defined GH_TOKEN (
  echo.
  echo Aucun token fourni. Abandon.
  pause
  exit /b 1
)

REM --- 2) Choix de la version ---
for /f "delims=" %%v in ('node -p "require('./package.json').version"') do set CURRENT=%%v
echo.
echo Version actuelle : !CURRENT!
echo.
echo   [1] Increment patch  (ex. 0.1.0 -^> 0.1.1)   [recommande]
echo   [2] Increment minor  (ex. 0.1.0 -^> 0.2.0)
echo   [3] Saisir une version precise
echo   [4] Garder !CURRENT! (re-publier la meme)
echo.
set /p CHOIX=Ton choix [1] :
if "!CHOIX!"=="" set CHOIX=1

if "!CHOIX!"=="1" call npm version patch --no-git-tag-version
if "!CHOIX!"=="2" call npm version minor --no-git-tag-version
if "!CHOIX!"=="3" (
  set /p NEWV=Nouvelle version ^(ex. 0.2.0^) :
  call npm version !NEWV! --no-git-tag-version
)

for /f "delims=" %%v in ('node -p "require('./package.json').version"') do set FINAL=%%v
echo.
echo === Construction + publication de GVue v!FINAL! sur GitHub ===
echo.

REM --- 3) Generer les notes "Nouveautes" depuis les messages de commit ---
echo Generation des notes de version...
call node scripts\gen-whatsnew.cjs
echo.

REM --- 4) Build de l'installeur (sans televersement) ---
call npm run dist
if errorlevel 1 (
  echo.
  echo === ECHEC du build. ===
  pause
  exit /b 1
)

REM --- 5) Publication : UNE release complete, publiee tout de suite ---
REM electron-builder televersait en brouillon, parfois en DEUX brouillons pour
REM la meme version avec les fichiers eparpilles — et une version restee en
REM brouillon est invisible pour les applications installees.
call node scriptselay-release.cjs gjelal-bjrm/gvue-releases
if errorlevel 1 (
  echo.
  echo === ECHEC de la publication. ===
  echo Verifie : GH_TOKEN autorise a creer une release sur gvue-releases,
  echo connexion internet, version superieure a la precedente.
  pause
  exit /b 1
)

echo.
echo ===============================================
echo   GVue v!FINAL! est PUBLIEE sur gvue-releases.
echo   Les applications installees la verront a leur prochaine
echo   verification. Rien d'autre a faire.
echo.
echo   RAPPEL : ce depot doit rester PUBLIC. S'il est prive,
echo   les apps recoivent 404 et ne voient aucune mise a jour.
echo ===============================================
echo.
echo Pense a committer le changement de version + les notes :
echo   git add package.json package-lock.json src/renderer/src/data/whatsNew.json
echo   git commit -m "GVue v!FINAL!"
echo   git push
echo.
pause
