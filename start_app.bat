@echo off
title Money Manager - Launcher
echo ==========================================
echo   Starting Money Manager App...
echo ==========================================
echo.

echo [1/2] Opening Backend Server...
start "Backend Server" cmd /k "cd /d "%~dp0backend" && pip install -r requirements.txt --quiet && python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000"

echo Waiting 5 seconds for backend to initialize...
timeout /t 5 /nobreak > nul

echo [2/2] Opening Frontend (React)...
start "Frontend React" cmd /k "cd /d "%~dp0frontend" && npm.cmd install && npm.cmd run dev"

echo.
echo ==========================================
echo   Done! Both windows are now opening.
echo.
echo   Wait about 30 seconds, then open Chrome:
echo   http://localhost:5173
echo.
echo   Keep BOTH black windows open while using the app.
echo   To stop: close both black windows.
echo ==========================================
echo.
timeout /t 30 /nobreak > nul
start "" "http://localhost:5173"
