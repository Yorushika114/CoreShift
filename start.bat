@echo off
title CoreShift

if not exist node_modules (
  echo Installing dependencies...
  npm install
)

echo Starting CoreShift server...
start /b npm run dev

:wait
timeout /t 2 /nobreak >nul
curl -s http://localhost:3001 >nul 2>&1
if errorlevel 1 goto wait

echo Server ready. Opening browser...
start http://localhost:3001
echo.
echo Press Ctrl+C to stop the server.
