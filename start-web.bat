@echo off
title Quench Elegance - Website (port 5173)
cd /d "%~dp0client"
if not exist "node_modules" call npm install
echo.
echo Website: http://localhost:5173
echo.
call npx vite --port 5173 --strictPort --open /
pause
