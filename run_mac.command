#!/bin/bash
# ==============================================================================
#  AI Karaoke Studio Pro — macOS Apple Silicon (M1/M2/M3/M4) 1-Click Launcher
# ==============================================================================

# Change to current script directory
cd "$(dirname "$0")" || exit 1

# Clear terminal screen & print banner
clear
echo -e "\033[1;36m====================================================================\033[0m"
echo -e "\033[1;35m   🎤 AI KARAOKE STUDIO PRO — MACOS APPLE SILICON EDITION (M-SERIES) \033[0m"
echo -e "\033[1;36m====================================================================\033[0m"
echo ""

# 1. Check Python installation (prefer python3.11 or python3.10)
PYTHON_CMD=""
if command -v python3.11 &>/dev/null; then
    PYTHON_CMD="python3.11"
elif command -v python3.10 &>/dev/null; then
    PYTHON_CMD="python3.10"
elif command -v python3 &>/dev/null; then
    PYTHON_CMD="python3"
else
    echo -e "\033[1;31m[LỖI] Không tìm thấy Python 3 trên máy Mac của bạn!\033[0m"
    echo "Vui lòng cài đặt Python 3 qua Homebrew: brew install python@3.11"
    echo "Hoặc tải từ trang chủ: https://www.python.org/downloads/macos/"
    read -p "Nhấn Enter để thoát..."
    exit 1
fi

echo -e "\033[1;32m[✓] Python phát hiện:\033[0m $($PYTHON_CMD --version)"

# 2. Check FFmpeg (supports Apple VideoToolbox)
if ! command -v ffmpeg &>/dev/null; then
    if [ -f "/opt/homebrew/bin/ffmpeg" ]; then
        export PATH="/opt/homebrew/bin:$PATH"
    elif [ -f "/usr/local/bin/ffmpeg" ]; then
        export PATH="/usr/local/bin:$PATH"
    else
        echo -e "\033[1;33m[CẢNH BÁO] Chưa tìm thấy FFmpeg trên máy Mac.\033[0m"
        echo "Hệ thống đang tự động cài đặt FFmpeg qua Homebrew..."
        if command -v brew &>/dev/null; then
            brew install ffmpeg
        else
            echo "Vui lòng cài Homebrew và FFmpeg bằng lệnh:"
            echo '  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
            echo "  brew install ffmpeg"
        fi
    fi
fi

if command -v ffmpeg &>/dev/null; then
    echo -e "\033[1;32m[✓] FFmpeg phát hiện:\033[0m $(ffmpeg -version | head -n 1)"
fi

# 3. Create or activate macOS virtual environment
VENV_DIR="venv_mac"
if [ ! -d "$VENV_DIR" ]; then
    echo -e "\033[1;34m[*] Đang khởi tạo môi trường Python ảo cho Mac Apple Silicon ($VENV_DIR)...\033[0m"
    $PYTHON_CMD -m venv "$VENV_DIR"
    source "$VENV_DIR/bin/activate"
    echo -e "\033[1;34m[*] Đang cài đặt thư viện AI (PyTorch Metal MPS, Demucs, Whisper)...\033[0m"
    pip install --upgrade pip
    pip install -r requirements.txt
else
    source "$VENV_DIR/bin/activate"
fi

# 4. Check Apple Silicon MPS Acceleration
echo -e "\033[1;35m[*] Đang kiểm tra tăng tốc phần cứng Apple Silicon (Metal Performance Shaders)...\033[0m"
python -c "import torch; print('  -> Apple Metal MPS:', 'SẴN SÀNG (BẬT)' if torch.backends.mps.is_available() else 'CHẾ ĐỘ CPU')"

# 5. Start Backend Server
PORT=8008
echo ""
echo -e "\033[1;32m====================================================================\033[0m"
echo -e "\033[1;32m 🚀 Đang khởi động AI Karaoke Studio tại http://127.0.0.1:$PORT\033[0m"
echo -e "\033[1;32m====================================================================\033[0m"
echo ""

# Launch server in background
python -m uvicorn server:app --host 127.0.0.1 --port $PORT &
SERVER_PID=$!

# Cleanup server on exit
trap 'echo ""; echo "Đang tắt server Karaoke Studio..."; kill $SERVER_PID; exit 0' SIGINT SIGTERM EXIT

# Wait for server to start
sleep 2

# Open default browser
if command -v open &>/dev/null; then
    open "http://127.0.0.1:$PORT"
fi

echo -e "\033[1;36mPhần mềm đang chạy! Nhấn Ctrl + C trong cửa sổ này để tắt máy chủ bất cứ lúc nào.\033[0m"

# Keep script running
wait $SERVER_PID
