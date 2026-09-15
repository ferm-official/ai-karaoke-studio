#!/bin/bash
# AI Karaoke Studio Pro - Khoi Dong Cho Mac Dung CPU Intel / macOS Chung

# 1. Dinh vi thu muc goc du an
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR/.."

# 2. Nap day du duong dan he thong macOS
export PATH="/usr/local/bin:/usr/local/sbin:/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"

echo "======================================================================="
echo "   AI KARAOKE STUDIO PRO - KHOI DONG MACOS INTEL / TIEU CHUAN"
echo "======================================================================="
echo ""

if [ ! -f "venv_mac/bin/python" ]; then
    echo "[!] Chua co thu muc venv_mac. Dang tien hanh cai dat truoc..."
    bash "$DIR/1_Cai_Dat_MacOS_Intel.command"
fi

if [ ! -f "venv_mac/bin/python" ]; then
    echo "[LOI] Khong tim thay moi truong venv_mac sau khi cai dat."
    read -p "Nhan Enter de thoat..."
    exit 1
fi

echo "[*] Su dung moi truong ao: venv_mac"
echo "[*] Dang khoi dong AI Karaoke Studio Server..."
echo "[*] Dang mo trinh duyet tai: http://127.0.0.1:8008"
echo ""

# Mo trinh duyet mac dinh tren Mac
(sleep 1 && open "http://127.0.0.1:8008") &

./venv_mac/bin/python server.py

echo ""
echo "======================================================================="
echo "Server da dung hoat dong. Nhan Enter de thoat..."
echo "======================================================================="
read
