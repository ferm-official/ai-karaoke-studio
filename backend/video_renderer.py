import os
import sys
import subprocess
import logging
from pathlib import Path
from typing import Optional
import torch

logger = logging.getLogger(__name__)

def escape_ffmpeg_filter_path(path_str: str) -> str:
    """Escapes backslashes, colons, and single quotes for FFmpeg filter arguments on Windows."""
    # Convert backslashes to forward slashes
    p = str(Path(path_str).resolve()).replace("\\", "/")
    # Escape colon (e.g., C:/ -> C\\:/)
    p = p.replace(":", "\\:")
    # Escape single quote
    p = p.replace("'", "'\\''")
    return p

def create_default_background(output_image_path: str, width: int = 1920, height: int = 1080) -> str:
    """
    Creates a stylish dark studio background image with ambient glow if none is provided.
    """
    out_path = Path(output_image_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    
    if out_path.exists():
        return str(out_path)

    # Use FFmpeg lavfi to generate a premium dark purple/blue gradient image
    cmd = [
        "ffmpeg", "-y",
        "-f", "lavfi",
        "-i", f"color=c=0x0a0c16:s={width}x{height}",
        "-vf", (
            f"drawradial=x={width//2}:y={height//2}:r1=100:r2={width//2}:"
            "c1=0x381254:c2=0x0a0c16:mode=add"
        ),
        "-frames:v", "1",
        str(out_path)
    ]
    
    # Fallback to simple gradient if drawradial is not supported
    try:
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    except Exception:
        fallback_cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi",
            "-i", f"color=c=0x0f1123:s={width}x{height}",
            "-frames:v", "1",
            str(out_path)
        ]
        subprocess.run(fallback_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    return str(out_path)

def render_karaoke_video(
    audio_path: str,
    ass_subtitle_path: str,
    output_video_path: str,
    background_path: Optional[str] = None,
    resolution: str = "1920x1080",
    fps: int = 30,
    use_gpu: bool = True,
    pitch_semitones: int = 0,
    progress_callback = None
) -> str:
    """
    Renders a Full HD Karaoke MP4 with burned-in ASS subtitles using FFmpeg.
    """
    if progress_callback:
        progress_callback(85, "Đang chuẩn bị khung hình và hiệu ứng Karaoke...")

    audio_file = Path(audio_path).resolve()
    ass_file = Path(ass_subtitle_path).resolve()
    out_file = Path(output_video_path).resolve()
    out_file.parent.mkdir(parents=True, exist_ok=True)

    # Check if target video file is currently open / locked by Windows Media Player or VLC
    if out_file.exists():
        try:
            with open(out_file, "a+b") as lock_chk:
                pass
        except PermissionError:
            raise PermissionError(
                f"Tệp video '{out_file.name}' đang được mở bởi một chương trình khác (như Windows Media Player, VLC, Premiere...). Vui lòng tắt video đang xem rồi bấm Xuất Video lại!"
            )

    escaped_ass = escape_ffmpeg_filter_path(str(ass_file))

    # Resolve background
    bg_file = None
    if background_path and Path(background_path).exists():
        bg_file = Path(background_path).resolve()
    else:
        default_bg = out_file.parent / "default_bg.jpg"
        create_default_background(str(default_bg))
        bg_file = default_bg

    is_video_bg = bg_file.suffix.lower() in [".mp4", ".mov", ".avi", ".mkv", ".webm"]

    width, height = resolution.split("x")

    # Video filter chain
    if is_video_bg:
        # Loop video background to match audio duration
        input_args = ["-stream_loop", "-1", "-i", str(bg_file), "-i", str(audio_file)]
        vf = f"scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},ass=filename='{escaped_ass}'"
    else:
        # Loop static image with subtle zoom/ambient motion
        input_args = ["-loop", "1", "-i", str(bg_file), "-i", str(audio_file)]
        vf = f"scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},ass=filename='{escaped_ass}'"

    # Select best hardware accelerated encoder
    is_macos = (sys.platform == "darwin")
    is_cuda = torch.cuda.is_available()

    # Check for Intel QuickSync (QSV) hardware acceleration
    has_qsv = False
    if sys.platform == "win32" and not is_cuda:
        try:
            test_qsv = subprocess.run(
                ["ffmpeg", "-f", "lavfi", "-i", "color=c=black:s=64x64:d=0.1", "-c:v", "h264_qsv", "-f", "null", "-"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=2
            )
            has_qsv = (test_qsv.returncode == 0)
        except Exception:
            has_qsv = False

    if use_gpu and is_macos:
        video_encoder = "h264_videotoolbox"
        encoder_args = ["-b:v", "8000k", "-allow_sw", "1"]
        gpu_label = "Apple VideoToolbox"
    elif use_gpu and is_cuda:
        video_encoder = "h264_nvenc"
        encoder_args = ["-preset", "p4", "-cq", "20"]
        gpu_label = "NVIDIA NVENC"
    elif has_qsv:
        video_encoder = "h264_qsv"
        encoder_args = ["-b:v", "8000k", "-preset", "faster"]
        gpu_label = "Intel QuickSync GPU"
    else:
        video_encoder = "libx264"
        encoder_args = ["-preset", "veryfast", "-crf", "22", "-threads", "0"]
        if not is_video_bg:
            encoder_args.extend(["-tune", "stillimage"])
        gpu_label = "CPU Software (Đa luồng Siêu Tốc)"

    # Audio filter chain for pitch transpose without tempo change
    af_args = []
    af_cpu_args = []
    if pitch_semitones != 0:
        pitch_ratio = 2.0 ** (pitch_semitones / 12.0)
        # Check if rubberband is supported in this FFmpeg build
        has_rubberband = False
        try:
            chk = subprocess.run(["ffmpeg", "-filters"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=2)
            has_rubberband = "rubberband" in (chk.stdout or "")
        except Exception:
            has_rubberband = False

        if has_rubberband:
            af_args = ["-af", f"rubberband=pitch={pitch_ratio:.6f}"]
        else:
            af_args = ["-af", f"asetrate=44100*{pitch_ratio:.6f},atempo={1.0/pitch_ratio:.6f}"]
        af_cpu_args = ["-af", f"asetrate=44100*{pitch_ratio:.6f},atempo={1.0/pitch_ratio:.6f}"]

    cmd = [
        "ffmpeg", "-y",
        *input_args,
        "-vf", vf,
        "-c:v", video_encoder,
        *encoder_args,
        *af_args,
        "-c:a", "aac",
        "-b:a", "320k",
        "-pix_fmt", "yuv420p",
        "-r", str(fps),
        "-shortest",
        str(out_file)
    ]

    logger.info(f"Rendering video with FFmpeg ({gpu_label}) [Pitch transpose: {pitch_semitones} semitones]: {' '.join(cmd)}")
    
    if progress_callback:
        progress_callback(90, f"Đang xuất video MP4 Karaoke (Tăng tốc {gpu_label})...")

    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace")
    
    # If primary encoding or audio filter fails, attempt universal safe CPU libx264 fallback
    if res.returncode != 0:
        logger.warning(f"Primary video render with {gpu_label} failed ({res.stderr[:200]}). Falling back to safe CPU libx264...")
        cpu_tune = ["-tune", "stillimage"] if not is_video_bg else []
        cmd_cpu = [
            "ffmpeg", "-y",
            *input_args,
            "-vf", vf,
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-crf", "22",
            *cpu_tune,
            "-threads", "0",
            *af_cpu_args,
            "-c:a", "aac",
            "-b:a", "320k",
            "-pix_fmt", "yuv420p",
            "-r", str(fps),
            "-shortest",
            str(out_file)
        ]
        res_cpu = subprocess.run(cmd_cpu, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace")
        if res_cpu.returncode != 0:
            raise RuntimeError(f"FFmpeg render error: {res_cpu.stderr}")

    if progress_callback:
        progress_callback(100, "Xuất video Karaoke thành công!")

    return str(out_file)
