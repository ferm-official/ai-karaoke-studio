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

# Configure UTF-8 for Windows console if possible
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

def main():
    print("=" * 68)
    print("   AI KARAOKE STUDIO PRO - TỰ ĐỘNG CÀI ĐẶT MÔI TRƯỜNG VIRTUALENV")
    print("=" * 68)
    print()

    # Check Python version
    major, minor = sys.version_info.major, sys.version_info.minor
    print(f"[*] Phiên bản Python đang dùng: {major}.{minor}.{sys.version_info.micro}")
    if major < 3 or (major == 3 and minor < 9):
        print("[CẢNH BÁO] Bạn đang dùng Python < 3.9. Khuyến nghị dùng Python 3.10 hoặc 3.11 để tương thích tốt nhất.")
    elif major == 3 and minor >= 13:
        print("[CẢNH BÁO] Python 3.13+ có thể chưa tương thích hoàn toàn với một số bản build của PyTorch/Demucs.")

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
    print()
    if not python_venv.exists():
        print("[*] [BƯỚC 1/5] Đang tạo môi trường ảo (virtual environment: venv)...")
        res = subprocess.run([sys.executable, "-m", "venv", str(venv_dir)])
        if res.returncode != 0:
            print("[LỖI] Không thể tạo thư mục venv! Vui lòng kiểm tra quyền truy cập thư mục.")
            sys.exit(1)
        print("[OK] Đã tạo thành công thư mục venv.")
    else:
        print("[*] [BƯỚC 1/5] Thư mục môi trường 'venv' đã có sẵn.")

    # 2. Upgrade pip
    print()
    print("[*] [BƯỚC 2/5] Nâng cấp công cụ pip, setuptools, wheel trong venv...")
    subprocess.run([str(python_venv), "-m", "pip", "install", "--upgrade", "pip", "setuptools", "wheel", "--quiet"])
    print("[OK] Đã cập nhật pip thành công.")

    # 3. Detect GPU & Install Torch
    print()
    print("[*] [BƯỚC 3/5] Kiểm tra phần cứng đồ họa (NVIDIA GPU / CUDA)...")
    has_nvidia = False
    if is_windows:
        try:
            check_gpu = subprocess.run(["nvidia-smi"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            has_nvidia = (check_gpu.returncode == 0)
        except Exception:
            has_nvidia = False

    if has_nvidia:
        print("[!] Phát hiện card đồ họa rời NVIDIA GPU!")
        print("[*] Đang cài đặt PyTorch hỗ trợ tăng tốc CUDA 12.1 (GPU Acceleration)...")
        subprocess.run([str(pip_venv), "install", "torch", "torchvision", "torchaudio", "--index-url", "https://download.pytorch.org/whl/cu121"])
    elif is_macos:
        print("[!] Phát hiện hệ điều hành macOS (Apple Silicon / Intel). Đang cài PyTorch...")
        subprocess.run([str(pip_venv), "install", "torch", "torchvision", "torchaudio"])
    else:
        print("[!] Không phát hiện NVIDIA GPU (hoặc đang dùng CPU / Intel / AMD).")
        print("[*] Đang cài đặt PyTorch phiên bản tiêu chuẩn CPU...")
        subprocess.run([str(pip_venv), "install", "torch", "torchvision", "torchaudio"])
    print("[OK] Đã hoàn thành cấu hình PyTorch.")

    # 4. Install requirements.txt
    print()
    print("[*] [BƯỚC 4/5] Đang cài đặt các thư viện AI (Demucs, Whisper, FastAPI, yt-dlp, pysubs2)...")
    req_file = base_dir / "requirements.txt"
    if req_file.exists():
        subprocess.run([str(pip_venv), "install", "-r", str(req_file)])
    else:
        subprocess.run([str(pip_venv), "install", "demucs", "faster-whisper", "fastapi>=0.115.0,<0.120.0", "uvicorn", "yt-dlp", "pysubs2", "soundfile", "numpy"])
    print("[OK] Đã cài đặt đầy đủ tất cả thư viện AI.")

    # 5. Check FFmpeg
    print()
    print("[*] [BƯỚC 5/5] Kiểm tra công cụ FFmpeg...")
    ffmpeg_ok = False
    try:
        res = subprocess.run(["ffmpeg", "-version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        ffmpeg_ok = (res.returncode == 0)
    except Exception:
        ffmpeg_ok = False

    if ffmpeg_ok:
        print("[OK] FFmpeg đã có sẵn trên hệ thống.")
    else:
        print("[!] Chưa có FFmpeg trên máy. Đang thử cài đặt tự động qua winget...")
        try:
            w = subprocess.run(["winget", "install", "Gyan.FFmpeg", "--accept-package-agreements", "--accept-source-agreements"], timeout=180)
            ffmpeg_ok = (w.returncode == 0)
        except Exception:
            ffmpeg_ok = False

        if ffmpeg_ok:
            print("[OK] Đã cài đặt FFmpeg thành công qua winget.")
        else:
            print("-----------------------------------------------------------------------")
            print("[CHÚ Ý] Máy tính chưa có công cụ FFmpeg trong biến môi trường PATH.")
            print("        Tool cần FFmpeg để xuất video Karaoke MP4 và tách âm thanh.")
            print("        Cách cài nhanh trên Windows (mở PowerShell và gõ):")
            print("            winget install Gyan.FFmpeg")
            print("        Hoặc tải giải nén từ: https://www.gyan.dev/ffmpeg/builds/")
            print("-----------------------------------------------------------------------")

    # 6. Verify core libraries installation
    print()
    print("[*] Kiểm tra hoạt động của các thư viện cốt lõi...")
    verify_cmd = [
        str(python_venv), "-c",
        "import torch, demucs, faster_whisper, fastapi; print('ALL_CORE_LIBS_OK')"
    ]
    check_run = subprocess.run(verify_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    all_ok = "ALL_CORE_LIBS_OK" in (check_run.stdout or "")
    if all_ok:
        print("[OK] Toàn bộ thư viện AI cốt lõi đã sẵn sàng 100%!")
    else:
        print("-----------------------------------------------------------------------")
        print("[CẢNH BÁO] Có một số thư viện chưa tải xong do đường truyền mạng.")
        print("           Bạn vui lòng chạy lại file 1_CAI_DAT_MOI_TRUONG.bat để")
        print("           hệ thống tự động tải tiếp các gói còn thiếu!")
        print("-----------------------------------------------------------------------")

    print()
    print("=" * 68)
    if all_ok:
        print("   🎉 CHÚC MỪNG! ĐÃ CÀI ĐẶT MÔI TRƯỜNG VENV HOÀN TẤT (100%)")
    else:
        print("   ⚠️ HOÀN TẤT THIẾT LẬP VỚI MỘT SỐ CẢNH BÁO MẠNG")
    print("=" * 68)
    if is_windows:
        print("👉 Khởi động phòng thu bằng cách chạy file:  2_KHOI_DONG_TOOL.bat")
    else:
        print("👉 Khởi động phòng thu bằng lệnh:  ./venv/bin/python server.py")
    print("=" * 68)

if __name__ == "__main__":
    main()
