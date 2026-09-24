@echo off
cd /d "%~dp0"
echo Starting Vizualux Installation...

for /f %%i in ('powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback' -and $_.IPAddress -notmatch '^169\.254\.' }).IPAddress | Select-Object -First 1"') do set "LOCAL_IP=%%i"

echo Starting Python Tracking Backend (listening on 0.0.0.0:8765)...
start "Tracking Backend" cmd /k "cd backend && python main.py"

echo Starting Vite Frontend Web Server (listening on 0.0.0.0:5173)...
start "Frontend Web Server" cmd /k "cd frontend && npm run dev"

echo =======================================================
echo Vizualux is now running and hosted on your local network!
echo.
echo Local Machine:    http://localhost:5173
echo Local Network:    http://%LOCAL_IP%:5173
echo.
echo Any phone, tablet, laptop, or projector client on the same
echo Wi-Fi/LAN can open the Local Network URL to control or view.
echo.
echo To stop the installation later, close the two terminal windows.
echo =======================================================
pause
