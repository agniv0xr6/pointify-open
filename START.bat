@echo off
rem Pointify - local POS server.
rem
rem   Double-click this file.
rem   To also allow access from a phone on the same Wi-Fi, run instead:
rem       set HOST=0.0.0.0 && node server.js
rem
rem   To use another port:
rem       set PORT=3000 && node server.js
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js is not installed.
  echo.
  pause
  exit /b 1
)

echo.
echo   POINTIFY is starting
echo   ---------------------
echo     This device :  http://127.0.0.1:8080/app.html
echo     Phone/tablet:  not reachable (server bound to this machine only)
echo                       To open it from another device, close this and run:
echo                           set HOST=0.0.0.0 ^&^& node server.js
echo.
echo   Press Ctrl+C to stop.
echo.
node server.js
pause
