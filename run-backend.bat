@echo off
title Wapas backend
cd /d "%~dp0backend"
if not exist .venv (
  echo Creating Python environment...
  python -m venv .venv
)
.venv\Scripts\python -m pip install -q -r requirements.txt
if not exist .env copy .env.example .env >nul
echo.
echo Wapas API running at http://localhost:8000  (docs: /docs)
.venv\Scripts\python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
pause
