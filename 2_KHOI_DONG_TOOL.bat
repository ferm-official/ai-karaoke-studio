@echo off
chcp 65001 >nul
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8
title AI Karaoke Studio Pro - 100%% Local AI Engine
color 0B

echo =======================================================================
echo          AI KARAOKE STUDIO PRO - 100%% LOCAL AI POWERED
echo =======================================================================
echo.

if exist "venv\Scripts\python.exe" (
    echo [*] Đang sử dụng môi trường ảo: venv
    set PYTHON_BIN=venv\Scripts\python.exe
) else (
    echo [!] CHƯA TÌM THẤY THƯ MỤC MÔI TRƯỜNG 'venv'!
    echo [*] Bạn có muốn tự động chạy cài đặt môi trường ngay bây giờ không? (Y/N)
    set /p USER_CHOICE="Lựa chọn của bạn (Y/N): "
    if /i "%USER_CHOICE%"=="Y" (
        call 1_CAI_DAT_MOI_TRUONG.bat
        set PYTHON_BIN=venv\Scripts\python.exe
    ) else (
        echo [*] Sử dụng Python mặc định trên máy...
        set PYTHON_BIN=python
    )
)

echo.
echo [*] Đang khởi động AI Karaoke Studio Server...
echo [*] Đang mở giao diện tại: http://127.0.0.1:8008
echo.

start "" http://127.0.0.1:8008
%PYTHON_BIN% server.py

echo.
echo =======================================================================
echo Server đã dừng hoạt động. Nhấn phím bất kỳ để thoát.
echo =======================================================================
pause
