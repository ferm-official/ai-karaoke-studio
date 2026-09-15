#!/bin/bash
# AI Karaoke Studio Pro - Cai Dat Cho Mac Chip M (Apple Silicon M1/M2/M3/M4)

# 1. Dinh vi thu muc goc du an
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
if [ -f "$DIR/setup_env.py" ]; then
    cd "$DIR"
else
    cd "$DIR/.."
fi

# 2. Nap day du duong dan he thong macOS va Homebrew Apple Silicon
export PATH="$DIR/../bin:$DIR/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/local/sbin:$PATH"

echo "======================================================================="
echo "   AI KARAOKE STUDIO PRO - CAI DAT CHO MAC CHIP M (APPLE SILICON)"
echo "======================================================================="
echo ""

# 3. Kiem tra kien truc chip Apple Silicon
ARCH_NAME=$(uname -m)
echo "[*] Kien truc phan cung phat hien: $ARCH_NAME"
if [ "$ARCH_NAME" != "arm64" ]; then
    echo "[CANH BAO] Terminal dang chay o che do gia lap Rosetta ($ARCH_NAME)."
    echo "           Khuyen nghi mo Terminal goc ARM64 de dat hieu nang cao nhat."
fi

# 4. Kiem tra trinh thong dich Python 3
PY_BIN=""
if [ -x "/opt/homebrew/bin/python3" ]; then
    PY_BIN="/opt/homebrew/bin/python3"
elif [ -x "/usr/local/bin/python3" ]; then
    PY_BIN="/usr/local/bin/python3"
elif command -v python3 &>/dev/null; then
    PY_BIN=$(which python3)
fi

if [ -z "$PY_BIN" ]; then
    echo "======================================================================="
    echo "[LOI] CHUA TIM THAY PYTHON 3 TREN MAY MAC CUA BAN!"
    echo "======================================================================="
    echo ""
    echo "Dang tu dong mo trinh duyet de tai ban cai dat Python 3.11 cho macOS..."
    open "https://www.python.org/ftp/python/3.11.9/python-3.11.9-macos11.pkg"
    echo ""
    echo "Huong dan cai dat Python cho Mac:"
    echo "  1. Mo file .pkg vua tai ve va cai dat theo mac dinh cua Apple."
    echo "  2. Sau khi cai dat xong, hay chay lai file nay de tiep tuc."
    echo "======================================================================="
    read -p "Nhan Enter de dong cua so..."
    exit 1
fi

echo "[*] Trinh thong dich Python duoc chon: $PY_BIN"
echo "[*] Phien ban Python: $($PY_BIN --version)"
echo "[*] Thu muc du an: $(pwd)"
echo ""

# 5. Kiem tra FFmpeg
if ! command -v ffmpeg &>/dev/null; then
    echo "[!] Chua phat hien cong cu FFmpeg tren he thong."
    if command -v brew &>/dev/null; then
        echo "[*] Phat hien Homebrew. Dang tu dong cai dat FFmpeg qua lệnh: brew install ffmpeg..."
        brew install ffmpeg
    else
        echo "[CHUY Y] Khuyen nghi cai dat Homebrew hoac FFmpeg de xuat video MP4."
        echo "        Lenh cai Homebrew: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
    fi
else
    echo "[OK] FFmpeg da co san tren Mac."
fi
echo ""

# 6. Chay script thiet lap moi truong venv_mac
$PY_BIN setup_env.py venv_mac

echo ""
echo "======================================================================="
echo "Cai dat hoan tat! Ban co the mo file '2_Khoi_Dong_Mac_M.command' de dung."
echo "======================================================================="
read -p "Nhan Enter de dong cua so..."
