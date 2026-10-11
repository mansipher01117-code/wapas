@echo off
title Wapas frontend
cd /d "%~dp0frontend"
if not exist node_modules call npm install
echo.
echo Open http://localhost:3000
call npm run dev
pause
