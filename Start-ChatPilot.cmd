@echo off
setlocal
cd /d "%~dp0"
if exist "src-tauri\target\release\chatpilot.exe" (
  start "" "src-tauri\target\release\chatpilot.exe"
  exit /b 0
)
if exist "src-tauri\target\debug\chatpilot.exe" (
  start "" "src-tauri\target\debug\chatpilot.exe"
  exit /b 0
)
echo ChatPilot has not been built yet.
echo Run: npm ci
echo Then: npm run tauri -- build
pause
exit /b 1
