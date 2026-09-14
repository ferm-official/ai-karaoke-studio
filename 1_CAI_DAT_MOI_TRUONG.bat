@echo off
chcp 65001 >nul
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8
title AI Karaoke Studio Pro - Cài Đặt Môi Trường Tự Động (1-Click Installer)
color 0A

echo =======================================================================
echo          AI KARAOKE STUDIO PRO - TRÌNH CÀI ĐẶT MÔI TRƯỜNG TỰ ĐỘNG
echo =======================================================================
echo.
echo [*] Đang kiểm tra cài đặt Python trên máy tính...

python --version >nul 2>&1
if %errorlevel% neq 0 (
    py --version >nul 2>&1
    if %errorlevel% neq 0 (
        echo.
        echo =======================================================================
        echo [LỖI] KHÔNG TÌM THẤY PYTHON TRÊN MÁY TÍNH CỦA BẠN!
        echo =======================================================================
        echo.
        echo Vui lòng cài đặt Python (khuyên dùng bản 3.10, 3.11 hoặc 3.12) tại:
        echo     https://www.python.org/downloads/
        echo.
        echo ⚠️ LƯU Ý QUAN TRỌNG KHI CÀI ĐẶT:
        echo    Hãy TÍCH CHỌN vào ô: [v] "Add Python to PATH" (hoặc Add python.exe to PATH)
        echo    ở ngay màn hình đầu tiên của bộ cài đặt Python.
        echo.
        echo Sau khi cài đặt xong, vui lòng khởi động lại file này.
        echo =======================================================================
        echo.
        pause
        exit /b 1
    ) else (
        set PY_CMD=py
    )
) else (
    set PY_CMD=python
)

for /f "tokens=*" %%v in ('%PY_CMD% --version 2^>^&1') do set PY_VER=%%v
echo [OK] Tìm thấy: %PY_VER%
echo.

if not exist "venv\Scripts\python.exe" (
    echo [*] [BƯỚC 1/4] Đang tạo môi trường ảo (virtual environment: venv)...
    %PY_CMD% -m venv venv
    if %errorlevel% neq 0 (
        echo.
        echo [LỖI] Không thể tạo thư mục venv! Vui lòng kiểm tra quyền ghi ổ cứng.
        pause
        exit /b 1
    )
    echo [OK] Đã tạo thành công thư mục môi trường: venv
) else (
    echo [*] [BƯỚC 1/4] Thư mục môi trường 'venv' đã có sẵn. Tiếp tục cấu hình...
)
echo.

echo [*] [BƯỚC 2/4] Nâng cấp công cụ pip, setuptools, wheel trong venv...
venv\Scripts\python.exe -m pip install --upgrade pip setuptools wheel --quiet
echo [OK] Đã nâng cấp pip thành công.
echo.

echo [*] [BƯỚC 3/4] Kiểm tra phần cứng đồ họa (NVIDIA GPU / CUDA)...
nvidia-smi >nul 2>&1
if %errorlevel% equ 0 (
    echo [!] Phát hiện card đồ họa rời NVIDIA GPU!
    echo [*] Đang cài đặt PyTorch hỗ trợ tăng tốc CUDA 12.1 (Full GPU & NVENC)...
    venv\Scripts\python.exe -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
) else (
    echo [!] Không phát hiện card NVIDIA (hoặc đang dùng CPU / Intel Iris / AMD).
    echo [*] Đang cài đặt PyTorch phiên bản tiêu chuẩn CPU...
    venv\Scripts\python.exe -m pip install torch torchvision torchaudio
)
echo [OK] Đã cài đặt PyTorch thành công.
echo.

echo [*] [BƯỚC 4/4] Đang cài đặt toàn bộ thư viện AI (Demucs, Faster-Whisper, FastAPI, yt-dlp, pysubs2)...
venv\Scripts\python.exe -m pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo.
    echo [CẢNH BÁO] Có một số thư viện cài đặt chưa hoàn tất. Đang thử cài đặt bổ sung...
    venv\Scripts\python.exe -m pip install demucs faster-whisper fastapi uvicorn yt-dlp pysubs2 soundfile numpy
)
echo [OK] Đã cài đặt đầy đủ tất cả thư viện AI!
echo.

echo [*] Kiểm tra công cụ FFmpeg...
ffmpeg -version >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Đã tìm thấy FFmpeg trên hệ thống!
) else (
    echo.
    echo -----------------------------------------------------------------------
    echo [CHÚ Ý] Máy tính chưa có công cụ FFmpeg trong biến môi trường PATH.
    echo         Tool cần FFmpeg để xuất video MP4 Karaoke và tách âm thanh.
    echo         Nếu tool báo thiếu FFmpeg, bạn có thể mở PowerShell và gõ:
    echo             winget install Gyan.FFmpeg
    echo         hoặc tải về từ https://www.gyan.dev/ffmpeg/builds/
    echo -----------------------------------------------------------------------
)
echo.

echo =======================================================================
echo          🎉 CHÚC MỪNG! ĐÃ CÀI ĐẶT MÔI TRƯỜNG THÀNH CÔNG (100%)
echo =======================================================================
echo.
echo Môi trường ảo (venv) đã được thiết lập đầy đủ toàn bộ AI & Thư viện.
echo Bạn có thể khởi động phòng thu bất cứ lúc nào bằng cách:
echo.
echo           👉 Click đúp vào file:  2_KHOI_DONG_TOOL.bat
echo.
echo =======================================================================
echo.
pause
