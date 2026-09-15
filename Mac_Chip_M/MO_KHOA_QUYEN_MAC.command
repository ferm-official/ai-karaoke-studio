#!/bin/bash
# AI Karaoke Studio Pro - Mo Khoa Quyen Va Bo Chan macOS Gatekeeper

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
if [ -f "$DIR/setup_env.py" ]; then
    cd "$DIR"
    ROOT_DIR="$DIR"
else
    cd "$DIR/.."
    ROOT_DIR="$DIR/.."
fi

echo "======================================================================="
echo "   MO KHOA QUYEN THUC THI VA XOA CHAN GATEKEEPER CHO MACOS"
echo "======================================================================="
echo ""

echo "[*] Dang cap quyen thuc thi cho cac tap lenh Mac..."
chmod +x "$DIR"/*.command 2>/dev/null

echo "[*] Dang go bo nhan cach ly quarantine cua macOS..."
xattr -cr "$ROOT_DIR" 2>/dev/null

echo ""
echo "======================================================================="
echo "[HOAN TAT] Da mo khoa quyen thanh cong 100%!"
echo "Ban co the nhap dup vao '1_Cai_Dat_Mac_M.command' de cai dat"
echo "hoac '2_Khoi_Dong_Mac_M.command' de khoi dong phong thu."
echo "======================================================================="
read -p "Nhan Enter de dong..."
