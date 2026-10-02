@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto nonode
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 24 ? 0 : 1)"
if errorlevel 1 goto oldnode
if not exist node_modules\electron\cli.js (
  echo First run: downloading the desktop window. This needs internet and can take a few minutes...
  call npm install
  if errorlevel 1 goto failed
)
call npm run desktop
if errorlevel 1 pause
exit /b 0
:failed
echo.
echo The Electron download did not finish.
echo - Check your internet connection and try again.
echo - Or double-click Start-Windows.cmd to play in your browser instead. Nothing to download.
echo.
pause
exit /b 1
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
