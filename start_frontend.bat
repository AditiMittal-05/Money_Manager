@echo off
title Money Manager - Frontend (React)
echo ==========================================
echo   Money Manager Frontend Starting...
echo ==========================================
echo.

cd /d "%~dp0frontend"

echo Installing packages (only slow on first run)...
call npm install

echo.
echo Starting React app at http://localhost:5173
echo Keep this window open while using the app!
echo.

call npm run dev

pause
