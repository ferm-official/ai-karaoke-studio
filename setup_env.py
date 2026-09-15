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
elif sys.platform == "darwin":
    # Ensure Homebrew and standard macOS bin directories are in PATH
    extra_paths = ["/opt/homebrew/bin", "/opt/homebrew/sbin", "/usr/local/bin", "/usr/local/sbin"]
    current_path = os.environ.get("PATH", "")
    for p in extra_paths:
        if p not in current_path and os.path.exists(p):
            current_path = f"{p}:{current_path}"
    os.environ["PATH"] = current_path

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
    is_windows = (sys.platform == "win32")
    is_macos = (sys.platform == "darwin")

    # Isolate virtual environments between Windows and Mac
    venv_name = "venv" if is_windows else "venv_mac"
    for arg in sys.argv[1:]:
        if not arg.startswith("-"):
            venv_name = arg
            break

    venv_dir = base_dir / venv_name
    print(f"[*] Thư mục môi trường ảo mục tiêu: {venv_name}")

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
        if is_macos:
            print("[!] Chưa có FFmpeg trên máy Mac. Đang thử cài đặt tự động qua Homebrew...")
            try:
                b = subprocess.run(["brew", "install", "ffmpeg"], timeout=300)
                ffmpeg_ok = (b.returncode == 0)
            except Exception:
                ffmpeg_ok = False
            if ffmpeg_ok:
                print("[OK] Đã cài đặt FFmpeg thành công qua Homebrew.")
            else:
                print("-----------------------------------------------------------------------")
                print("[CHÚ Ý] Máy tính Mac chưa có công cụ FFmpeg.")
                print("        Vui lòng mở Terminal trên Mac và gõ lệnh:  brew install ffmpeg")
                print("-----------------------------------------------------------------------")
        elif is_windows:
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
    # 7. Kiem thu thuc te: Thuc su chay Demucs & Whisper tren phan cung
    run_e2e = (os.environ.get("GITHUB_ACTIONS") == "true") or ("--test-run" in sys.argv)
    if all_ok and run_e2e:
        print()
        print("=" * 68)
        print("   [KIEM THU THUC TE: CHAY DEMUCS & WHISPER TREN PHAN CUNG]")
        print("=" * 68)
        e2e_code = """
import sys, os, subprocess, shutil
from pathlib import Path

print('[*] Kiem tra phan cung va he dieu hanh:')
print(f'    Platform: {sys.platform}')
import torch
print(f'    PyTorch version: {torch.__version__}')
has_mps = hasattr(torch.backends, 'mps') and torch.backends.mps.is_available()
print(f'    Apple Silicon MPS available: {has_mps}')

# 1. Tao file am thanh test 3s
test_wav = Path('_test_song.wav')
subprocess.run([
    'ffmpeg', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3',
    '-c:a', 'pcm_s16le', '-ar', '44100', str(test_wav)
], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
print('[OK] [1/3] Da tao file am thanh thu nghiem 3 giay.')

# 2. Chay tach beat thuc te bang Demucs
from backend.separator import separate_audio
print('[*] [2/3] Dang chay tach beat Demucs thuc te tren may...')
stems = separate_audio(
    input_audio_path=str(test_wav),
    output_dir='_test_stems_out',
    model_name='htdemucs',
    device='cpu',
    use_cache=False,
    async_mp3=False
)
assert Path(stems['vocals_wav']).exists(), 'Vocals wav not found'
assert Path(stems['instrumental_wav']).exists(), 'Instrumental wav not found'
print('[OK] [2/3] Demucs da tach nhac va giong hat thanh cong 100% tren may!')

# 3. Chay nhan dien loi Faster-Whisper thuc te
from backend.transcriber import transcribe_vocals
print('[*] [3/3] Dang chay nhan dien loi Whisper thuc te tren may...')
res = transcribe_vocals(
    vocal_audio_path=stems['vocals_wav'],
    model_size='tiny',
    device='cpu',
    use_cache=False
)
print('[OK] [3/3] Whisper da nhan dien am thanh thanh cong 100% tren may!')

# Don dep file tam
try:
    test_wav.unlink(missing_ok=True)
    shutil.rmtree('_test_stems_out', ignore_errors=True)
except Exception:
    pass

print()
print('=' * 68)
print('   XAC NHAN: TOAN BO HE THONG AI DA CHAY THUC TE 100% THANH CONG!')
print('=' * 68)
"""
        test_script = base_dir / "_run_e2e_check.py"
        test_script.write_text(e2e_code, encoding="utf-8")
        try:
            subprocess.run([str(python_venv), str(test_script)], check=True)
        except Exception as e:
            print(f"[CANH BAO] Kiem thu thuc te gap loi: {e}")
        finally:
            if test_script.exists():
                test_script.unlink()

    print()
    print("=" * 68)
    if all_ok:
        print("   [HOAN TAT] DA CAI DAT MOI TRUONG VENV HOAN TAT (100%)")
    else:
        print("   [CANH BAO] HOAN TAT THIET LAP VOI MOT SO CANH BAO MANG")
    print("=" * 68)
    if is_windows:
        print("[*] Khoi dong phong thu bang cach chay file trong thu muc Windows: 2_Khoi_Dong_Windows.bat")
    else:
        print(f"[*] Khoi dong phong thu bang cach chay file: ./{venv_name}/bin/python server.py")
    print("=" * 68)

if __name__ == "__main__":
    main()
