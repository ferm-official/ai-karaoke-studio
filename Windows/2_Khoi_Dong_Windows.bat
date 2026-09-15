@echo off
setlocal
if exist "%~dp0\server.py" (
    cd /d "%~dp0"
) else (
    cd /d "%~dp0\.."
)
title AI Karaoke Studio Pro - Windows Launcher
color 0B

echo =======================================================================
echo          AI KARAOKE STUDIO PRO - WINDOWS (100%% LOCAL AI)
echo =======================================================================
echo.

if not exist "venv\Scripts\python.exe" (
    echo =======================================================================
    echo [CHU Y] BAN CHUA CAI DAT MOI TRUONG AO VENV CHO TOOL!
    echo =======================================================================
    echo.
    echo Truoc khi su dung lan dau, he thong can thiet lap moi truong AI
    echo bang cach chay file: 1_Cai_Dat_Windows.bat
    echo.
    echo Nhan phim bat ky de BAT DAU CAI DAT MOI TRUONG ngay bay gio...
    echo (Hoac dong cua so nay neu ban muon chay sau)
    echo =======================================================================
    echo.
    pause
    call "%~dp0\1_Cai_Dat_Windows.bat"
    if not exist "venv\Scripts\python.exe" (
        echo.
        echo [THONG BAO] Moi truong venv chua duoc tao xong. Khong the khoi dong.
        pause
        exit /b 1
    )
)

echo [*] Su dung moi truong ao: venv
set PYTHON_BIN=venv\Scripts\python.exe

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
