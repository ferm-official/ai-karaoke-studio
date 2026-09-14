@echo off
setlocal
title AI Karaoke Studio Pro - 100%% Local Engine
color 0B

echo =======================================================
echo     AI KARAOKE STUDIO PRO - 100%% LOCAL AI POWERED
echo =======================================================
echo.

set PYTHON_BIN=python
if exist "venv\Scripts\python.exe" (
    echo [*] Su dung moi truong: venv
    set PYTHON_BIN=venv\Scripts\python.exe
) else (
    echo [*] Su dung Python he thong...
)

echo [*] Dang khoi dong Local AI Karaoke Server...
echo [*] Dia chi truy cap: http://127.0.0.1:8008
echo.

start "" http://127.0.0.1:8008
%PYTHON_BIN% server.py

pause
