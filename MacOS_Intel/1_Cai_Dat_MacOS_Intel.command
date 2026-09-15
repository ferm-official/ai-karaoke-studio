#!/bin/bash
# AI Karaoke Studio Pro - Cai Dat Cho Mac Dung CPU Intel / macOS Chung

# 1. Dinh vi thu muc goc du an
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR/.."

# 2. Nap day du duong dan he thong macOS
export PATH="/usr/local/bin:/usr/local/sbin:/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"

echo "======================================================================="
echo "   AI KARAOKE STUDIO PRO - CAI DAT CHO MACOS INTEL / TIEU CHUAN"
echo "======================================================================="
echo ""

# 3. Kiem tra Python 3
PY_BIN=""
if [ -x "/usr/local/bin/python3" ]; then
    PY_BIN="/usr/local/bin/python3"
elif [ -x "/opt/homebrew/bin/python3" ]; then
    PY_BIN="/opt/homebrew/bin/python3"
elif command -v python3 &>/dev/null; then
    PY_BIN=$(which python3)
fi

if [ -z "$PY_BIN" ]; then
    echo "[LOI] Chua tim thay Python 3 tren may Mac cua ban!"
    echo "Dang tu dong mo trinh duyet de tai ban cai dat Python 3.11 cho macOS..."
    open "https://www.python.org/ftp/python/3.11.9/python-3.11.9-macos11.pkg"
    read -p "Nhan Enter de thoat..."
    exit 1
fi

echo "[*] Su dung Python tai: $PY_BIN"
echo "[*] Phien ban Python: $($PY_BIN --version)"
echo "[*] Thu muc lam viec: $(pwd)"
echo "[*] Dang cai dat moi truong venv_mac va thu vien AI..."
echo ""

$PY_BIN setup_env.py venv_mac

echo ""
echo "======================================================================="
echo "Cai dat hoan tat! Ban co the mo '2_Khoi_Dong_MacOS_Intel.command' de dung."
echo "======================================================================="
read -p "Nhan Enter de dong cua so..."
