@echo off
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8
title AI Karaoke Studio Pro - 100%% Local Engine
color 0B

echo =======================================================
echo     AI KARAOKE STUDIO PRO - 100%% LOCAL AI POWERED
echo =======================================================
echo.
echo [*] Dang khoi dong Local AI Karaoke Server...
echo [*] Toi uu hoa: Da luong CPU + Intel QuickSync Hardware
echo [*] Dia chi truy cap: http://127.0.0.1:8008
echo.

start "" http://127.0.0.1:8008
python server.py

pause
