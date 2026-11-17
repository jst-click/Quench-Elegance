@echo off
title Quench Elegance - Backend API (port 8000)
cd /d "%~dp0backend"
if not exist ".venv\Scripts\uvicorn.exe" (
  echo Setting up Python environment for the first time...
  python -m venv .venv
  .venv\Scripts\python -m pip install -r requirements.txt
)
if not exist ".env" copy .env.example .env
echo.
echo Backend API:  http://localhost:8000
echo API docs:     http://localhost:8000/api/docs
echo.
.venv\Scripts\uvicorn app.main:app --reload --port 8000
pause
