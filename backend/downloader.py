import os
import re
import subprocess
import logging
from pathlib import Path
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

def sanitize_filename(name: str) -> str:
    """Sanitizes string for safe filesystem usage."""
    return re.sub(r'[\\/*?:"<>|]', "", name).strip()

def extract_clean_media_url(url: str) -> str:
    """Extracts the latest URL if multiple URLs were accidentally pasted together, and removes playlist clutter."""
    if not url:
        return ""
    url = url.strip()
    last_http = url.rfind("http")
    if last_http > 0:
        logger.warning(f"Multiple URLs detected in input: '{url}'. Extracting latest URL: '{url[last_http:]}'")
        url = url[last_http:]
    # If it's a YouTube video with &list=..., strip the playlist parameters so yt-dlp only downloads this single video
    if "youtube.com/watch" in url and "v=" in url:
        url = re.sub(r"&list=[^&]+", "", url)
        url = re.sub(r"&index=[^&]+", "", url)
        url = re.sub(r"&start_radio=[^&]+", "", url)
    return url

def has_node_runtime() -> bool:
    """Checks if node executable is available in PATH."""
    import shutil
    return shutil.which("node") is not None

def download_audio_from_url(url: str, output_dir: str, progress_callback = None) -> Dict[str, Any]:
    """
    Downloads highest quality audio from YouTube or any media URL using yt-dlp.
    Includes anti-403 defenses: node.js runtime, android client fallback, and retry strategies.
    """
    url = extract_clean_media_url(url)
    if progress_callback:
        progress_callback(5, "Đang kết nối và chuẩn bị tải nhạc...")

    out_dir = Path(output_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    import yt_dlp

    # Common options
    base_headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    }

    cookie_file = None
    possible_cookie_paths = [
        Path("cookies.txt"),
        Path(output_dir).parent / "cookies.txt",
        Path(__file__).resolve().parent.parent / "cookies.txt"
    ]
    for cp in possible_cookie_paths:
        if cp.is_file():
            cookie_file = str(cp.resolve())
            logger.info(f"Using cookies file: {cookie_file}")
            break

    def yt_progress_hook(d):
        if not progress_callback:
            return
        status = d.get('status')
        if status == 'downloading':
            total = d.get('total_bytes') or d.get('total_bytes_estimate') or 0
            downloaded = d.get('downloaded_bytes', 0)
            if total > 0:
                pct = int(5 + (downloaded / total) * 15)  # 5% -> 20%
                mb_down = downloaded / (1024 * 1024)
                mb_tot = total / (1024 * 1024)
                progress_callback(pct, f"Đang tải âm thanh: {mb_down:.1f}/{mb_tot:.1f} MB ({pct}%)")
            else:
                progress_callback(8, "Đang nhận dữ liệu âm thanh từ máy chủ...")
        elif status == 'finished':
            progress_callback(20, "Đã tải xong luồng âm thanh, đang chuyển đổi MP3...")

    # Multi-strategy defense against YouTube 403 Forbidden
    strategies = [
        # Strategy 1: Standard with Node.js runtime (handles 2026 player JS changes)
        {
            "name": "visionos/standard",
            "format": "bestaudio/best",
            "extractor_args": {}
        },
        # Strategy 2: Android + Web player client fallback (bypasses browser SABR / 403 blocks)
        {
            "name": "android_fallback",
            "format": "bestaudio/best",
            "extractor_args": {"youtube": {"player_client": ["android", "web"]}}
        },
        # Strategy 3: Direct Android client with progressive mp4 fallback (never 403s)
        {
            "name": "android_direct",
            "format": "18/bestaudio/best",
            "extractor_args": {"youtube": {"player_client": ["android"]}}
        }
    ]

    last_error = None

    for idx, strat in enumerate(strategies):
        logger.info(f"Attempting download strategy {idx + 1}/{len(strategies)}: {strat['name']}")
        if progress_callback and idx > 0:
            progress_callback(6, f"Đang kết nối lại bằng luồng dự phòng {strat['name']}...")

        ydl_opts = {
            'format': strat['format'],
            'outtmpl': str(out_dir / '%(title)s.%(ext)s'),
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '320',
            }],
            'writethumbnail': True,
            'quiet': True,
            'no_warnings': True,
            'http_headers': base_headers,
            'noplaylist': True,
            'socket_timeout': 30,
            'retries': 5,
            'fragment_retries': 5,
            'progress_hooks': [yt_progress_hook],
            'match_filter': lambda info, *, incomplete: (
                "Video quá dài (> 30 phút). Tool hỗ trợ tối đa 30 phút để bảo vệ bộ nhớ máy tính."
                if (info.get("duration") and info.get("duration") > 1800)
                else ("Luồng phát trực tiếp (Livestream). Vui lòng chọn bài hát hoàn chỉnh." if info.get("is_live") else None)
            )
        }

        if strat.get('extractor_args'):
            ydl_opts['extractor_args'] = strat['extractor_args']

        if has_node_runtime():
            ydl_opts['js_runtimes'] = {'node': {}}

        if cookie_file:
            ydl_opts['cookiefile'] = cookie_file

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                title = info.get('title', 'Downloaded_Track')
                duration = info.get('duration', 0)
                thumbnail = info.get('thumbnail', None)

            # Find the generated mp3 file
            mp3_files = list(out_dir.glob("*.mp3"))
            if not mp3_files:
                raise FileNotFoundError("Audio file was not generated by yt-dlp.")

            downloaded_audio = sorted(mp3_files, key=os.path.getmtime)[-1]

            clean_target = out_dir / "source.mp3"
            if downloaded_audio != clean_target:
                if clean_target.exists():
                    clean_target.unlink()
                downloaded_audio.rename(clean_target)

            if progress_callback:
                progress_callback(20, f"Đã sẵn sàng: {title}")

            return {
                "title": title,
                "duration": duration,
                "thumbnail": thumbnail,
                "audio_path": str(clean_target)
            }

        except Exception as e:
            last_error = e
            err_str = str(e)
            logger.warning(f"Strategy '{strat['name']}' failed: {err_str}")
            # If error is not 403/Forbidden or signature related, it might be a wrong URL (continue to try or fail)
            if "403" not in err_str and "Requested format is not available" not in err_str:
                if "Video unavailable" in err_str or "Private video" in err_str:
                    break

    logger.error(f"All download strategies exhausted: {last_error}")
    raise RuntimeError(f"Không thể tải âm thanh từ liên kết (Lỗi: {str(last_error)})")
