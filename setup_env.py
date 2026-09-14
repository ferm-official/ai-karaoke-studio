#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AI Karaoke Studio Pro — Automated Environment Setup Script
Usage: python setup_env.py
"""

import sys
import os
import subprocess
from pathlib import Path

def main():
    print("=" * 65)
    print("   AI KARAOKE STUDIO PRO - TỰ ĐỘNG CÀI ĐẶT MÔI TRƯỜNG VIRTUALENV")
    print("=" * 65)
    print()

    base_dir = Path(__file__).resolve().parent
    venv_dir = base_dir / "venv"
    is_windows = (sys.platform == "win32")
    is_macos = (sys.platform == "darwin")

    if is_windows:
        python_venv = venv_dir / "Scripts" / "python.exe"
        pip_venv = venv_dir / "Scripts" / "pip.exe"
    else:
        python_venv = venv_dir / "bin" / "python"
        pip_venv = venv_dir / "bin" / "pip"

    # 1. Create venv if not exists
    if not python_venv.exists():
        print("[*] [1/4] Đang tạo môi trường ảo (venv)...")
        res = subprocess.run([sys.executable, "-m", "venv", str(venv_dir)])
        if res.returncode != 0:
            print("[LỖI] Không thể tạo thư mục venv!")
            sys.exit(1)
        print("[OK] Đã tạo thành công thư mục venv.")
    else:
        print("[*] [1/4] Thư mục venv đã tồn tại sẵn.")

    # 2. Upgrade pip
    print()
    print("[*] [2/4] Đang nâng cấp pip, setuptools, wheel trong venv...")
    subprocess.run([str(python_venv), "-m", "pip", "install", "--upgrade", "pip", "setuptools", "wheel", "--quiet"])
    print("[OK] Đã cập nhật pip.")

    # 3. Detect GPU & Install Torch
    print()
    print("[*] [3/4] Đang cài đặt PyTorch phù hợp với phần cứng...")
    has_nvidia = False
    if is_windows:
        try:
            check_gpu = subprocess.run(["nvidia-smi"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            has_nvidia = (check_gpu.returncode == 0)
        except Exception:
            has_nvidia = False

    if has_nvidia:
        print("[!] Phát hiện NVIDIA GPU! Đang cài PyTorch CUDA 12.1 (Tăng tốc GPU)...")
        subprocess.run([str(pip_venv), "install", "torch", "torchvision", "torchaudio", "--index-url", "https://download.pytorch.org/whl/cu121"])
    elif is_macos:
        print("[!] Phát hiện macOS (Apple Silicon / Intel). Đang cài PyTorch chuẩn Mac...")
        subprocess.run([str(pip_venv), "install", "torch", "torchvision", "torchaudio"])
    else:
        print("[!] Đang cài PyTorch phiên bản tiêu chuẩn CPU...")
        subprocess.run([str(pip_venv), "install", "torch", "torchvision", "torchaudio"])
    print("[OK] Đã cài đặt PyTorch.")

    # 4. Install requirements.txt
    print()
    print("[*] [4/4] Đang cài đặt các thư viện AI từ requirements.txt...")
    req_file = base_dir / "requirements.txt"
    if req_file.exists():
        subprocess.run([str(pip_venv), "install", "-r", str(req_file)])
    else:
        subprocess.run([str(pip_venv), "install", "demucs", "faster-whisper", "fastapi", "uvicorn", "yt-dlp", "pysubs2", "soundfile", "numpy"])
    print("[OK] Đã cài đặt toàn bộ thư viện.")

    print()
    print("=" * 65)
    print("   🎉 CHÚC MỪNG! ĐÃ CÀI ĐẶT MÔI TRƯỜNG VENV HOÀN TẤT (100%)")
    print("=" * 65)
    if is_windows:
        print("Khởi động tool bằng file:  2_KHOI_DONG_TOOL.bat")
    else:
        print("Khởi động tool bằng lệnh:  ./venv/bin/python server.py")
    print("=" * 65)

if __name__ == "__main__":
    main()
