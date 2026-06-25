@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ===================================================
echo   GVue - construction de l'installeur Windows
echo ===================================================
echo.

REM --- Verifie que Node est disponible ---
where node >nul 2>nul
if errorlevel 1 (
    echo [ERREUR] Node.js est introuvable dans le PATH.
    echo Installe Node 20 LTS depuis https://nodejs.org puis relance ce script.
    echo.
    pause
    exit /b 1
)

REM --- Verifie la version majeure de Node ( >= 18 requis ) ---
for /f "tokens=1 delims=." %%v in ('node -p "process.versions.node"') do set NODE_MAJOR=%%v
echo Node detecte : version !NODE_MAJOR!.x
if !NODE_MAJOR! LSS 18 (
    echo.
    echo [ERREUR] Node !NODE_MAJOR! est trop ancien. GVue exige Node 18+ ^(20 LTS recommande^).
    echo.
    pause
    exit /b 1
)
echo.

REM --- Installe les dependances si besoin ---
REM (sentinelles : electron-builder pour le packaging, lucide-react pour l'app).
set NEED_INSTALL=
if not exist "node_modules" set NEED_INSTALL=1
if not exist "node_modules\electron-builder" set NEED_INSTALL=1
if not exist "node_modules\lucide-react" set NEED_INSTALL=1
if defined NEED_INSTALL (
    echo Installation / mise a jour des dependances...
    echo.
    call npm install --no-audit --no-fund
    if errorlevel 1 (
        echo.
        echo [ERREUR] npm install a echoue.
        echo.
        pause
        exit /b 1
    )
    echo.
)

REM --- Construit l'installeur ---
REM npm run dist = build de production + electron-builder ^(cible NSIS^).
REM Au premier passage, electron-builder telecharge NSIS / winCodeSign.
echo Construction de l'installeur ^(npm run dist^)...
echo Cette etape peut prendre quelques minutes.
echo.
call npm run dist
if errorlevel 1 (
    echo.
    echo [ERREUR] La construction a echoue.
    echo - Si l'erreur mentionne un certificat ^(unable to verify^), c'est le
    echo   telechargement des outils electron-builder bloque par un proxy.
    echo - Si elle mentionne node-gyp / GetCommitHash, verifie que npmRebuild
    echo   est bien a false dans electron-builder.yml.
    echo.
    pause
    exit /b 1
)

echo.
echo ===================================================
echo   Termine ! Installeur genere dans le dossier dist :
echo ===================================================
dir /b "dist\*.exe" 2>nul
echo.
echo Ouverture du dossier dist...
start "" explorer "%~dp0dist"
echo.
echo Double-clique sur GVue-Setup-x.y.z.exe pour installer GVue.
echo ^(Au 1er lancement, Windows SmartScreen peut avertir : app non signee,
echo  clique sur "Informations complementaires" puis "Executer quand meme".^)
echo.
pause
endlocal
