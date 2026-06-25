@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ============================================
echo   GVue - lancement en mode developpement
echo ============================================
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
    echo Mets a jour Node puis relance ce script.
    echo.
    pause
    exit /b 1
)
echo.

REM --- Installe les dependances si besoin ---
REM Reinstalle si node_modules est absent OU si une dependance cle manque
REM (sentinelles : lucide-react = phase 1, @xterm/xterm = phase 2).
set NEED_INSTALL=
if not exist "node_modules" set NEED_INSTALL=1
if not exist "node_modules\lucide-react" set NEED_INSTALL=1
if not exist "node_modules\@xterm\xterm" set NEED_INSTALL=1
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
    REM Recompile node-pty pour l'ABI d'Electron (terminal natif).
    REM Tolere l'echec : sans outils de build C++, l'app tourne quand meme
    REM et seul le terminal affiche un message d'aide.
    if exist "node_modules\node-pty" (
        echo Recompilation de node-pty pour Electron...
        call npm run rebuild
        if errorlevel 1 (
            echo.
            echo [AVERTISSEMENT] La recompilation de node-pty a echoue.
            echo Le terminal integre sera indisponible, mais GVue fonctionne.
            echo Pour l'activer : installez les outils de build C++ Windows puis
            echo relancez "npm run rebuild".
            echo.
        )
    ) else (
        echo.
        echo [INFO] node-pty non installe ^(outils de build C++ absents^).
        echo Le terminal integre sera indisponible ; le reste fonctionne.
        echo.
    )
)

REM --- Lance l'app ---
echo Demarrage de GVue ^(npm run dev^)...
echo.
call npm run dev

endlocal
