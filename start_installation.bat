@echo off
cd /d "%~dp0"
echo Starting Vizualux Installation...

echo Starting Python Tracking Backend...
start "Tracking Backend" cmd /k "cd backend && python main.py"

echo Starting Vite Frontend...
start "Frontend Web Server" cmd /k "cd frontend && npm run dev"

echo =======================================================
echo Startup commands issued!
echo Two new terminal windows should have opened.
echo To stop the installation later, close those two windows.
echo =======================================================
pause
