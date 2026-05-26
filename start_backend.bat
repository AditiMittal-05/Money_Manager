@echo off
title Money Manager - Backend Server
echo ==========================================
echo   Money Manager Backend Starting...
echo ==========================================
echo.

cd /d "%~dp0backend"

echo Checking Python packages...
pip install -r requirements.txt --quiet

echo.
echo Starting backend server at http://localhost:8000
echo Keep this window open while using the app!
echo Press Ctrl+C to stop the server.
echo.

python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000

pause
