@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ===============================================
echo   GVue - Publication d'une mise a jour (GitHub)
echo ===============================================
echo.

REM --- 1) Token GitHub (jamais stocke dans ce fichier) ---
REM Tu peux le definir avant de lancer (set GH_TOKEN=ghp_...) pour ne pas le retaper.
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

REM --- 3) Build + televersement de la release ---
call npm run publish
if errorlevel 1 (
  echo.
  echo === ECHEC de la publication. ===
  echo Verifie : token valide ^(scope repo^), connexion internet, version superieure a la precedente.
  pause
  exit /b 1
)

echo.
echo ===============================================
echo   Build v!FINAL! televerse en BROUILLON sur GitHub.
echo.
echo   DERNIERE ETAPE (1 clic) :
echo   GitHub -^> Releases -^> ouvre le brouillon v!FINAL!
echo   -^> bouton "Publish release".
echo   (Cela cree le tag ; ensuite les apps installees se
echo    mettront a jour automatiquement.)
echo ===============================================
echo.
echo Pense a committer le changement de version :
echo   git add package.json package-lock.json
echo   git commit -m "GVue v!FINAL!"
echo   git push
echo.
pause
