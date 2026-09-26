@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Install Node.js 24 or later, then run this file again.
 pause
 exit /b 1
)
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 24 ? 0 : 1)"
if errorlevel 1 (
 echo Node.js 24 or later is required.
 pause
 exit /b 1
)
if not exist node_modules\electron\cli.js (
 echo Installing Electron for the first run...
 call npm install
 if errorlevel 1 (
  echo Electron installation failed. Check the npm error above.
  pause
  exit /b 1
 )
)
call npm run desktop
if errorlevel 1 pause
