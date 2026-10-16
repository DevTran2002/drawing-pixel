@echo off
chcp 65001 >nul
title Pixel Draw Studio Launcher
echo ======================================================================
echo                     KHOI DONG PIXEL DRAW STUDIO
echo ======================================================================
echo Dang khoi dong:
echo   - Backend WebSocket Bridge: http://127.0.0.1:3055
echo   - Studio Web UI:            http://localhost:5173
echo ======================================================================
echo.

:: Mo trinh duyet sau 2 giay
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:5173"

:: Chay song song server va studio bang concurrently
call npm run dev
