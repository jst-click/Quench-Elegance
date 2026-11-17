@echo off
REM Opens backend, website and admin panel in three separate windows.
cd /d "%~dp0"
start "Quench Backend" cmd /k start-backend.bat
start "Quench Website" cmd /k start-web.bat
start "Quench Admin" cmd /k start-admin.bat
