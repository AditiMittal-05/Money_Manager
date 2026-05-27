@echo off
title Money Manager - Frontend (React)
echo ==========================================
echo   Money Manager Frontend Starting...
echo ==========================================
echo.

cd /d "%~dp0frontend"

echo Installing packages (only slow on first run)...
npm.cmd install

echo.
echo Starting React app...
echo Keep this window open while using the app!
echo.
echo Once you see "Local: http://localhost:5173", open Chrome and go to:
echo http://localhost:5173
echo.

npm.cmd run dev

pause
