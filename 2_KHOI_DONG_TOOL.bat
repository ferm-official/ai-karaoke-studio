@echo off
setlocal
title AI Karaoke Studio Pro - 100%% Local AI Engine
color 0B

echo =======================================================================
echo          AI KARAOKE STUDIO PRO - 100%% LOCAL AI POWERED
echo =======================================================================
echo.

set PYTHON_BIN=python
if exist "venv\Scripts\python.exe" (
    echo [*] Su dung moi truong ao: venv
    set PYTHON_BIN=venv\Scripts\python.exe
) else (
    echo [*] Chua thay thu muc venv, su dung Python he thong...
)

echo [*] Dang khoi dong AI Karaoke Studio Server...
echo [*] Dang mo giao dien tai: http://127.0.0.1:8008
echo.

start "" http://127.0.0.1:8008
%PYTHON_BIN% server.py

echo.
echo =======================================================================
echo Server da dung hoat dong. Nhan phim bat ky de thoat.
echo =======================================================================
pause
