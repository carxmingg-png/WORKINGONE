@echo off
title CarX Injection Panel
cd /d "%~dp0"
echo ====================================================
echo Starting CarX Injection Website Panel...
echo ====================================================
set "PATH=C:\Program Files\nodejs;%PATH%"

echo Starting server on http://localhost:3000 ...
start http://localhost:3000
npm run dev
pause
