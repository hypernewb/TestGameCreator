@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto nonode
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 24 ? 0 : 1)"
if errorlevel 1 goto oldnode
if not exist node_modules (
  echo First run: preparing the game folder. This takes a moment...
  call npm install --omit=dev --no-audit --no-fund
  if errorlevel 1 echo Setup step did not finish. The browser game can still start without it.
)
start "Story Framework server" cmd /k node server.mjs
timeout /t 2 /nobreak >nul
start "" http://127.0.0.1:4317
exit /b 0
:nonode
echo.
echo Story Framework needs Node.js 24 or later, and it is not installed.
echo.
echo   1. Download the Windows installer from https://nodejs.org/en/download
echo   2. Run the installer and keep the default options.
echo   3. Double-click this file again.
echo.
pause
exit /b 1
:oldnode
echo.
echo The Node.js on this computer is too old. Story Framework needs Node.js 24 or later.
echo Install the current version from https://nodejs.org/en/download over the old one, then double-click this file again.
echo.
pause
exit /b 1
