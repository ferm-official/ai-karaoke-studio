import os
import sys
import subprocess
import shutil
import logging
from pathlib import Path
import torch

from backend.cache_manager import compute_file_hash, get_cached_stems, save_stems_to_cache

logger = logging.getLogger(__name__)

def get_best_device() -> str:
    """Returns 'cuda' if NVIDIA GPU is available, 'mps' if Apple Silicon GPU is available, else 'cpu'."""
    if torch.cuda.is_available():
        return "cuda"
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return "mps"
    return "cpu"

def separate_audio(
    input_audio_path: str,
    output_dir: str,
    model_name: str = "htdemucs",
    device: str = None,
    use_cache: bool = True,
    progress_callback = None
) -> dict:
    """
    Separates audio file into 'vocals' and 'instrumental' using Meta Demucs with smart caching.
    """
    if device is None:
        device = get_best_device()

    input_path = Path(input_audio_path).resolve()
    out_dir = Path(output_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    if not input_path.exists():
        raise FileNotFoundError(f"Input audio file not found: {input_audio_path}")

    file_hash = compute_file_hash(str(input_path))

    # Check Cache
    if use_cache:
        cached = get_cached_stems(file_hash, model_name)
        if cached:
            if progress_callback:
                progress_callback(45, "⚡ Tìm thấy bản tách Beat trong Cache! Nạp tức thì (0.1s)...")
            
            final_vocals_wav = out_dir / "vocals.wav"
            final_instrumental_wav = out_dir / "instrumental.wav"
            final_vocals_mp3 = out_dir / "vocals.mp3"
            final_instrumental_mp3 = out_dir / "instrumental.mp3"

            shutil.copy2(cached["vocals_wav"], final_vocals_wav)
            shutil.copy2(cached["instrumental_wav"], final_instrumental_wav)
            
            if cached.get("vocals_mp3") and Path(cached["vocals_mp3"]).exists():
                shutil.copy2(cached["vocals_mp3"], final_vocals_mp3)
            else:
                subprocess.run(["ffmpeg", "-y", "-i", str(final_vocals_wav), "-vn", "-b:a", "256k", str(final_vocals_mp3)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

            if cached.get("instrumental_mp3") and Path(cached["instrumental_mp3"]).exists():
                shutil.copy2(cached["instrumental_mp3"], final_instrumental_mp3)
            else:
                subprocess.run(["ffmpeg", "-y", "-i", str(final_instrumental_wav), "-vn", "-b:a", "320k", str(final_instrumental_mp3)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

            return {
                "vocals_wav": str(final_vocals_wav),
                "instrumental_wav": str(final_instrumental_wav),
                "vocals_mp3": str(final_vocals_mp3),
                "instrumental_mp3": str(final_instrumental_mp3),
                "cache_hit": True
            }

    if progress_callback:
        progress_callback(10, f"Đang khởi tạo Demucs ({model_name}) trên {device.upper()}...")

    # Run Demucs CLI to cleanly isolate memory and prevent CUDA cache leaks
    cmd = [
        sys.executable,
        "-m",
        "demucs",
        "--two-stems=vocals",
        "-n", model_name,
        "-d", device,
        "-j", "2",
        "-o", str(out_dir / "_raw_stems"),
        str(input_path)
    ]

    logger.info(f"Running Demucs separation: {' '.join(cmd)}")
    
    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace"
    )

    for line in process.stdout:
        line_str = line.strip()
        if line_str:
            logger.debug(f"[Demucs] {line_str}")
            if "%" in line_str and progress_callback:
                try:
                    parts = line_str.split("%")[0].split()
                    pct = int(parts[-1])
                    scaled_pct = 10 + int(pct * 0.38)
                    progress_callback(scaled_pct, f"Đang tách nhạc và lời AI: {pct}%")
                except Exception:
                    pass

    process.wait()
    if process.returncode != 0:
        raise RuntimeError(f"Demucs separation failed with exit code {process.returncode}")

    track_stem_dir = out_dir / "_raw_stems" / model_name / input_path.stem
    if not track_stem_dir.exists():
        subdirs = list((out_dir / "_raw_stems" / model_name).glob("*"))
        if subdirs:
            track_stem_dir = subdirs[0]
        else:
            raise FileNotFoundError(f"Could not locate Demucs output directory in {out_dir / '_raw_stems'}")

    raw_vocals = track_stem_dir / "vocals.wav"
    raw_instrumental = track_stem_dir / "no_vocals.wav"

    if not raw_vocals.exists() or not raw_instrumental.exists():
        raise FileNotFoundError(f"Stem files missing in {track_stem_dir}")

    final_vocals_wav = out_dir / "vocals.wav"
    final_instrumental_wav = out_dir / "instrumental.wav"
    final_vocals_mp3 = out_dir / "vocals.mp3"
    final_instrumental_mp3 = out_dir / "instrumental.mp3"

    shutil.copy2(raw_vocals, final_vocals_wav)
    shutil.copy2(raw_instrumental, final_instrumental_wav)

    if progress_callback:
        progress_callback(50, "Đang tối ưu hóa định dạng âm thanh web...")

    subprocess.run(
        ["ffmpeg", "-y", "-i", str(final_vocals_wav), "-vn", "-b:a", "256k", str(final_vocals_mp3)],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
    )
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(final_instrumental_wav), "-vn", "-b:a", "320k", str(final_instrumental_mp3)],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
    )

    try:
        shutil.rmtree(out_dir / "_raw_stems", ignore_errors=True)
    except Exception:
        pass

    res_stems = {
        "vocals_wav": str(final_vocals_wav),
        "instrumental_wav": str(final_instrumental_wav),
        "vocals_mp3": str(final_vocals_mp3),
        "instrumental_mp3": str(final_instrumental_mp3),
        "cache_hit": False
    }

    # Save to persistent cache for instant future reuse
    save_stems_to_cache(file_hash, model_name, res_stems)

    return res_stems
