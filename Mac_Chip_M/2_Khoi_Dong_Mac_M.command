#!/bin/bash
# AI Karaoke Studio Pro - Khoi Dong Phong Thu Cho Mac Chip M (Apple Silicon)

# 1. Dinh vi thu muc goc du an
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
if [ -f "$DIR/server.py" ]; then
    cd "$DIR"
else
    cd "$DIR/.."
fi

# 2. Nap day du duong dan he thong macOS va Homebrew Apple Silicon
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/local/sbin:$PATH"

echo "======================================================================="
echo "   AI KARAOKE STUDIO PRO - PHONG THU MAC CHIP M (APPLE SILICON)"
echo "======================================================================="
echo ""

# 3. Kiem tra moi truong venv_mac
if [ ! -f "venv_mac/bin/python" ]; then
    echo "[!] Chua tim thay moi truong venv_mac. Dang khoi chay cai dat lan dau..."
    if [ -f "$DIR/1_CAI_DAT_MAC_M.command" ]; then
        bash "$DIR/1_CAI_DAT_MAC_M.command"
    else
        bash "$DIR/1_Cai_Dat_Mac_M.command"
    fi
fi

if [ ! -f "venv_mac/bin/python" ]; then
    echo "[LOI] Khong the khoi dong vi moi truong venv_mac chua duoc tao."
    read -p "Nhan Enter de thoat..."
    exit 1
fi

echo "[*] Su dung moi truong ao: venv_mac"
echo "[*] Dang khoi dong AI Karaoke Server..."
echo "[*] Tu dong mo trinh duyet tai: http://127.0.0.1:8008"
echo ""

# Mo trinh duyet mac dinh cua Mac sau 1 giay
(sleep 1 && open "http://127.0.0.1:8008") &

./venv_mac/bin/python server.py

echo ""
echo "======================================================================="
echo "Server da dung hoat dong. Nhan Enter de thoat..."
echo "======================================================================="
read
