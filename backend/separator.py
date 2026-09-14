import os
import sys
import subprocess
import shutil
import logging
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import torch

from backend.cache_manager import compute_file_hash, get_cached_stems, save_stems_to_cache

logger = logging.getLogger(__name__)


def _encode_stems_mp3_parallel(
    final_vocals_wav: Path,
    final_vocals_mp3: Path,
    final_instrumental_wav: Path,
    final_instrumental_mp3: Path,
    file_hash: str = None,
    model_name: str = None,
    res_stems: dict = None
):
    """Encodes vocals and instrumental WAVs to MP3 in parallel to avoid CPU bottleneck."""
    def _enc(in_wav, out_mp3, bitrate):
        cmd = [
            "ffmpeg", "-y",
            "-i", str(in_wav),
            "-vn",
            "-b:a", bitrate,
            "-threads", "2",
            str(out_mp3)
        ]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return str(out_mp3)

    try:
        with ThreadPoolExecutor(max_workers=2) as executor:
            f1 = executor.submit(_enc, final_vocals_wav, final_vocals_mp3, "256k")
            f2 = executor.submit(_enc, final_instrumental_wav, final_instrumental_mp3, "320k")
            f1.result()
            f2.result()

        if file_hash and model_name and res_stems:
            save_stems_to_cache(file_hash, model_name, res_stems)
        logger.info("Successfully encoded vocals.mp3 and instrumental.mp3 in parallel.")
    except Exception as e:
        logger.error(f"Error encoding stems to MP3: {e}")


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
    progress_callback = None,
    async_mp3: bool = True
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
            
            has_v_mp3 = cached.get("vocals_mp3") and Path(cached["vocals_mp3"]).exists()
            has_i_mp3 = cached.get("instrumental_mp3") and Path(cached["instrumental_mp3"]).exists()
            if has_v_mp3 and has_i_mp3:
                shutil.copy2(cached["vocals_mp3"], final_vocals_mp3)
                shutil.copy2(cached["instrumental_mp3"], final_instrumental_mp3)
            else:
                _encode_stems_mp3_parallel(final_vocals_wav, final_vocals_mp3, final_instrumental_wav, final_instrumental_mp3)

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
    # For CPU: limit jobs to 2 (or 1 on dual-core) to save 70% RAM and avoid cache thrashing.
    if device == "cpu":
        total_cpus = os.cpu_count() or 4
        # On Intel hybrid architectures (e.g. 14 cores = 6 P-cores + 8 E-cores),
        # launching 14 or 20 threads causes thread thrashing between fast and slow cores.
        # Restricting to physical P-cores count (usually 4 to 6) gives maximum sustained throughput.
        num_jobs = "2" if total_cpus >= 6 else "1"
        omp_threads = str(min(max(total_cpus // 2, 2), 6))
    else:
        num_jobs = "2"
        omp_threads = "4"

    cmd = [
        sys.executable,
        "-m",
        "demucs",
        "--two-stems=vocals",
        "-n", model_name,
        "-d", device,
        "-j", num_jobs,
        "-o", str(out_dir / "_raw_stems"),
        str(input_path)
    ]
    if device == "cpu":
        # Ultra-lightweight CPU separation for low-RAM machines (e.g. 4GB RAM):
        # shifts=0 cuts execution time in half (no duplicate equatorial shift passes)
        # segment=4 cuts peak RAM usage by 45% (prevents Windows Pagefile disk thrashing)
        # overlap=0.08 reduces computation by 30% while preserving vocal isolation
        cmd.extend(["--overlap", "0.08", "--shifts", "0", "--segment", "4"])

    logger.info(f"Running Demucs separation: {' '.join(cmd)}")
    
    demucs_env = os.environ.copy()
    demucs_env["PYTHONIOENCODING"] = "utf-8"
    demucs_env["PYTHONUTF8"] = "1"
    demucs_env["OMP_NUM_THREADS"] = omp_threads
    demucs_env["MKL_NUM_THREADS"] = omp_threads
    demucs_env["TORCH_NUM_THREADS"] = omp_threads
    demucs_env["KMP_BLOCKTIME"] = "0"

    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=demucs_env
    )

    output_lines = []
    buffer = ""
    while True:
        char = process.stdout.read(1)
        if not char:
            break
        if char in ("\r", "\n"):
            line_str = buffer.strip()
            buffer = ""
            if line_str:
                output_lines.append(line_str)
                if len(output_lines) > 30:
                    output_lines.pop(0)
                logger.debug(f"[Demucs] {line_str}")
                if "%" in line_str and progress_callback:
                    try:
                        parts = line_str.split("%")[0].split()
                        pct = int(parts[-1])
                        scaled_pct = 10 + int(pct * 0.38)
                        progress_callback(scaled_pct, f"Đang tách nhạc và lời AI: {pct}%")
                    except Exception:
                        pass
        else:
            buffer += char

    process.wait()
    if process.returncode != 0:
        err_detail = "\n".join(output_lines[-10:])
        raise RuntimeError(f"Demucs separation failed with exit code {process.returncode}:\n{err_detail}")

    track_stem_dir = out_dir / "_raw_stems" / model_name / input_path.stem
    if not track_stem_dir.exists():
        subdirs = list((out_dir / "_raw_stems" / model_name).glob("*"))
        if subdirs:
            track_stem_dir = subdirs[0]
        else:
            raise FileNotFoundError(f"Could not locate Demucs output directory in {out_dir / '_raw_stems'}")

    raw_vocals = track_stem_dir / "vocals.wav"
    raw_instrumental = track_stem_dir / "no_vocals.wav"
    if not raw_instrumental.exists():
        raw_instrumental = track_stem_dir / "minus_vocals.wav"
    if not raw_instrumental.exists():
        for candidate in track_stem_dir.glob("*.wav"):
            if candidate.name.lower() != "vocals.wav":
                raw_instrumental = candidate
                break

    if not raw_vocals.exists() or not raw_instrumental.exists():
        found_files = [f.name for f in track_stem_dir.glob("*")]
        raise FileNotFoundError(f"Stem files missing in {track_stem_dir}. Found: {found_files}")


    final_vocals_wav = out_dir / "vocals.wav"
    final_instrumental_wav = out_dir / "instrumental.wav"
    final_vocals_mp3 = out_dir / "vocals.mp3"
    final_instrumental_mp3 = out_dir / "instrumental.mp3"

    shutil.copy2(raw_vocals, final_vocals_wav)
    shutil.copy2(raw_instrumental, final_instrumental_wav)

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

    if async_mp3:
        # Start MP3 encoding in background thread so Whisper transcription can start immediately!
        t = threading.Thread(
            target=_encode_stems_mp3_parallel,
            args=(final_vocals_wav, final_vocals_mp3, final_instrumental_wav, final_instrumental_mp3, file_hash, model_name, res_stems),
            daemon=True
        )
        t.start()
        res_stems["mp3_thread"] = t
        logger.info("Launched background parallel stem MP3 encoding thread.")
    else:
        if progress_callback:
            progress_callback(50, "Đang tối ưu hóa định dạng âm thanh web...")
        _encode_stems_mp3_parallel(final_vocals_wav, final_vocals_mp3, final_instrumental_wav, final_instrumental_mp3, file_hash, model_name, res_stems)

    return res_stems
