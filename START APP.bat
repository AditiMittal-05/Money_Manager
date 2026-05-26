@echo off
title Money Manager - Launcher
echo ==========================================
echo   Starting Money Manager App...
echo ==========================================
echo.
echo Opening backend server in a new window...
start "Backend Server" cmd /k "cd /d "%~dp0backend" && pip install -r requirements.txt --quiet && python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000"

echo Waiting 3 seconds for backend to start...
timeout /t 3 /nobreak > nul

echo Opening frontend in a new window...
start "Frontend React" cmd /k "cd /d "%~dp0frontend" && npm install && npm run dev"

echo.
echo ==========================================
echo   Both windows are opening!
echo   After a few seconds, open Chrome and go to:
echo   http://localhost:5173
echo ==========================================
echo.
pause
