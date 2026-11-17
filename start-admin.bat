@echo off
title Quench Elegance - Admin Panel (port 5174)
cd /d "%~dp0client"
if not exist "node_modules" call npm install
echo.
echo Admin panel: http://localhost:5174/admin
echo.
call npx vite --port 5174 --strictPort --open /admin
pause
