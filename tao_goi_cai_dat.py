#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AI Karaoke Studio Pro - Script Tu Dong Tao Goi Cai Dat Doc Lap
(Tao ban Windows rieng va ban Mac Chip M rieng voi day du quyen POSIX 755 cho macOS)
"""

import os
import sys
import time
import shutil
import zipfile
from pathlib import Path

def make_zip_with_unix_permissions(source_dir: Path, output_zip_path: Path, is_mac: bool = False):
    print(f"[*] Dang nen file ZIP: {output_zip_path.name}...")
    with zipfile.ZipFile(output_zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for file_path in sorted(source_dir.rglob("*")):
            arcname = file_path.relative_to(source_dir.parent).as_posix()
            if file_path.is_dir():
                if is_mac:
                    zinfo = zipfile.ZipInfo(arcname + "/")
                    zinfo.create_system = 3
                    zinfo.external_attr = (0o755 << 16) | 0o040000
                    try:
                        mtime = file_path.stat().st_mtime
                        zinfo.date_time = time.localtime(mtime)[:6]
                    except Exception:
                        zinfo.date_time = (2026, 1, 1, 0, 0, 0)
                    zf.writestr(zinfo, b"")
                continue
            zinfo = zipfile.ZipInfo(arcname)
            
            try:
                mtime = file_path.stat().st_mtime
                zinfo.date_time = time.localtime(mtime)[:6]
            except Exception:
                zinfo.date_time = (2026, 1, 1, 0, 0, 0)
                
            zinfo.compress_type = zipfile.ZIP_DEFLATED
            
            if is_mac:
                zinfo.create_system = 3  # 3 = Unix / macOS
                # Gan quyen 0755 (-rwxr-xr-x) cho cac file script va launcher tren Mac
                is_exec = (
                    file_path.suffix in [".command", ".sh"] or
                    "Contents/MacOS" in arcname
                )
                if is_exec:
                    zinfo.external_attr = (0o755 << 16) | 0o100000
                else:
                    zinfo.external_attr = (0o644 << 16) | 0o100000
            else:
                zinfo.create_system = 0  # 0 = Windows FAT
                zinfo.external_attr = 0o666 << 16

            with open(file_path, "rb") as f:
                content = f.read()
                # Dam bao cac file script Mac co dau xuong dong Unix LF
                if is_mac and (file_path.suffix in [".command", ".sh", ".txt", ".py", ".plist"] or "Contents/MacOS" in arcname):
                    content = content.replace(b"\r\n", b"\n")
                zf.writestr(zinfo, content)
    print(f"[OK] Da tao xong file ZIP: {output_zip_path.name} ({round(output_zip_path.stat().st_size / 1024 / 1024, 2)} MB)")

def package():
    base_dir = Path(__file__).resolve().parent
    dist_dir = base_dir / "dist_packages"
    dist_dir.mkdir(exist_ok=True)

    def copy_core(target_dir):
        target_dir.mkdir(parents=True, exist_ok=True)
        for folder_name in ["backend", "web"]:
            src = base_dir / folder_name
            dst = target_dir / folder_name
            if dst.exists():
                shutil.rmtree(dst)
            shutil.copytree(src, dst, ignore=shutil.ignore_patterns("__pycache__", "*.pyc", "*.tmp", ".git*"))
        
        for fn in ["server.py", "setup_env.py", "requirements.txt", "version.json"]:
            src = base_dir / fn
            if src.exists():
                shutil.copy2(src, target_dir / fn)

        # Include clean logs folder in release package
        logs_src = base_dir / "logs"
        logs_dst = target_dir / "logs"
        logs_dst.mkdir(parents=True, exist_ok=True)
        (logs_dst / "projects").mkdir(parents=True, exist_ok=True)
        if (logs_src / "README.txt").exists():
            shutil.copy2(logs_src / "README.txt", logs_dst / "README.txt")
        if (logs_src / ".gitkeep").exists():
            shutil.copy2(logs_src / ".gitkeep", logs_dst / ".gitkeep")

    # 1. Goi Windows
    win_pkg = dist_dir / "AI_Karaoke_Studio_Windows"
    print("=======================================================================")
    print("[1/2] DANG DONG GOI BAN WINDOWS (STANDALONE)...")
    print("=======================================================================")
    if win_pkg.exists():
        shutil.rmtree(win_pkg)
    copy_core(win_pkg)
    
    shutil.copy2(base_dir / "Windows" / "1_Cai_Dat_Windows.bat", win_pkg / "1_CAI_DAT_WINDOWS.bat")
    shutil.copy2(base_dir / "Windows" / "2_Khoi_Dong_Windows.bat", win_pkg / "2_KHOI_DONG_WINDOWS.bat")
    shutil.copy2(base_dir / "Windows" / "Huong_Dan_Windows.txt", win_pkg / "HUONG_DAN_SU_DUNG.txt")
    
    win_zip = dist_dir / "AI_Karaoke_Studio_Windows.zip"
    make_zip_with_unix_permissions(win_pkg, win_zip, is_mac=False)

    # 2. Goi Mac Chip M
    print()
    print("=======================================================================")
    print("[2/2] DANG DONG GOI BAN MAC CHIP M (APPLE SILICON STANDALONE)...")
    print("=======================================================================")
    mac_pkg = dist_dir / "AI_Karaoke_Studio_Mac_M"
    if mac_pkg.exists():
        shutil.rmtree(mac_pkg)
    copy_core(mac_pkg)
    
    shutil.copy2(base_dir / "Mac_Chip_M" / "MO_KHOA_QUYEN_MAC.command", mac_pkg / "0_MO_KHOA_QUYEN.command")
    shutil.copy2(base_dir / "Mac_Chip_M" / "1_Cai_Dat_Mac_M.command", mac_pkg / "1_CAI_DAT_MAC_M.command")
    shutil.copy2(base_dir / "Mac_Chip_M" / "2_Khoi_Dong_Mac_M.command", mac_pkg / "2_KHOI_DONG_MAC_M.command")
    shutil.copy2(base_dir / "Mac_Chip_M" / "Huong_Dan_Mac_M.txt", mac_pkg / "HUONG_DAN_SU_DUNG.txt")
    
    app_src = base_dir / "Mac_Chip_M" / "AI_Karaoke_Studio.app"
    if app_src.exists():
        shutil.copytree(app_src, mac_pkg / "AI_Karaoke_Studio.app")

    mac_zip = dist_dir / "AI_Karaoke_Studio_Mac_M.zip"
    make_zip_with_unix_permissions(mac_pkg, mac_zip, is_mac=True)

    print()
    print("=======================================================================")
    print("[HOAN TAT] DA DONG GOI XONG 100%!")
    print("Cac thu muc va file ZIP san sang de ban giao:")
    print(f"  1. Ban Mac Chip M: {mac_zip}")
    print(f"  2. Ban Windows:   {win_zip}")
    print("=======================================================================")

if __name__ == "__main__":
    package()
