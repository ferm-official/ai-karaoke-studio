@echo off
chcp 65001 >nul
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8
title AI Karaoke Studio Pro - 100%% Local Engine
color 0B

echo =======================================================
echo     AI KARAOKE STUDIO PRO - 100%% LOCAL AI POWERED
echo =======================================================
echo.

if exist "venv\Scripts\python.exe" (
    echo [*] Đang sử dụng môi trường: venv
    set PYTHON_BIN=venv\Scripts\python.exe
) else (
    echo [*] Đang sử dụng Python hệ thống...
    set PYTHON_BIN=python
)

echo [*] Dang khoi dong Local AI Karaoke Server...
echo [*] Dia chi truy cap: http://127.0.0.1:8008
echo.

start "" http://127.0.0.1:8008
%PYTHON_BIN% server.py

pause
