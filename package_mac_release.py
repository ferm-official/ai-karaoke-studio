import os
import sys
import zipfile
import stat
from pathlib import Path

# Force UTF-8 stdout
if sys.platform.startswith("win"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_DIR = Path(__file__).parent.resolve()
OUTPUT_ZIP = BASE_DIR / "AI_Karaoke_Studio_Mac_AppleSilicon.zip"

print(f"[*] Packaging Mac Apple Silicon release: {OUTPUT_ZIP.name}...")

# Files and directories to include
include_files = [
    "run_mac.command",
    "HD_SU_DUNG_MAC.md",
    "server.py",
    "requirements.txt",
]

include_dirs = [
    "backend",
    "web"
]

with zipfile.ZipFile(OUTPUT_ZIP, "w", zipfile.ZIP_DEFLATED) as zf:
    # 1. Include root files
    for fname in include_files:
        fpath = BASE_DIR / fname
        if fpath.exists():
            arcname = f"AI_Karaoke_Studio_Mac/{fname}"
            
            # For shell script, ensure LF line endings and executable permission (0o755)
            if fname.endswith(".command") or fname.endswith(".sh"):
                content = fpath.read_bytes().replace(b"\r\n", b"\n")
                zinfo = zipfile.ZipInfo(arcname)
                zinfo.external_attr = (stat.S_IFREG | 0o755) << 16  # -rwxr-xr-x
                zf.writestr(zinfo, content)
                print(f"  [+] Added (Executable): {arcname}")
            else:
                zinfo = zipfile.ZipInfo.from_file(fpath, arcname)
                zinfo.external_attr = (stat.S_IFREG | 0o644) << 16
                zf.write(fpath, arcname)
                print(f"  [+] Added: {arcname}")

    # 2. Include directories
    for dname in include_dirs:
        dir_path = BASE_DIR / dname
        if dir_path.exists():
            for root, dirs, files in os.walk(dir_path):
                # Exclude __pycache__, .git, .DS_Store
                dirs[:] = [d for d in dirs if d not in ["__pycache__", ".git", ".pytest_cache"]]
                for file in files:
                    if file.endswith((".pyc", ".pyo", ".DS_Store")):
                        continue
                    full_p = Path(root) / file
                    rel_p = full_p.relative_to(BASE_DIR)
                    arcname = f"AI_Karaoke_Studio_Mac/{rel_p.as_posix()}"
                    
                    zinfo = zipfile.ZipInfo.from_file(full_p, arcname)
                    zinfo.external_attr = (stat.S_IFREG | 0o644) << 16
                    zf.write(full_p, arcname)
                    print(f"  [+] Added: {arcname}")

    # 3. Create clean storage placeholder
    storage_dirs = [
        "AI_Karaoke_Studio_Mac/storage/projects/.gitkeep",
        "AI_Karaoke_Studio_Mac/storage/cache/.gitkeep"
    ]
    for s_arc in storage_dirs:
        zinfo = zipfile.ZipInfo(s_arc)
        zinfo.external_attr = (stat.S_IFREG | 0o644) << 16
        zf.writestr(zinfo, b"")
        print(f"  [+] Created: {s_arc}")

zip_size_mb = OUTPUT_ZIP.stat().st_size / (1024 * 1024)
print(f"\n[SUCCESS] Packaging complete!")
print(f"File path: {OUTPUT_ZIP.resolve()}")
print(f"Size: {zip_size_mb:.2f} MB")
