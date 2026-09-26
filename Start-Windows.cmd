@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 24 or later, then run this file again.
  pause
  exit /b 1
)
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 24 ? 0 : 1)"
if errorlevel 1 (
  echo Node.js 24 or later is required.
  pause
  exit /b 1
)
start "Story Framework server" cmd /k node server.mjs
timeout /t 2 /nobreak >nul
start "" http://127.0.0.1:4317
