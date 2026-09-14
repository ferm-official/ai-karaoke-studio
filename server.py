import os
os.environ["PYTHONIOENCODING"] = "utf-8"
os.environ["PYTHONUTF8"] = "1"
os.environ["HF_HUB_DISABLE_SYMLINKS"] = "1"
import sys
import uuid
import json
import time
import shutil
import asyncio
import logging
import re
import stat
import gc
import threading
from pathlib import Path
from typing import Optional, Dict, Any, List

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import subprocess
import platform
import uvicorn
import torch

from backend.separator import separate_audio
from backend.transcriber import transcribe_vocals
from backend.subtitle_gen import generate_ass_subtitles, generate_lrc, generate_json_lyrics
from backend.video_renderer import render_karaoke_video
from backend.lyrics_parser import parse_srt_to_segments, parse_lrc_to_segments
from backend.downloader import download_audio_from_url
from backend.lyrics_fetcher import clean_song_title, fetch_online_lyrics, detect_text_language, get_audio_file_duration, is_likely_vietnamese

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("KaraokeStudio")

BASE_DIR = Path(__file__).parent.resolve()
STORAGE_DIR = BASE_DIR / "storage"
PROJECTS_DIR = STORAGE_DIR / "projects"
WEB_DIR = BASE_DIR / "web"

PROJECTS_DIR.mkdir(parents=True, exist_ok=True)

JOB_STATUS: Dict[str, Dict[str, Any]] = {}

app = FastAPI(title="Local AI Karaoke Studio", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_no_cache_header(request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/static") or request.url.path == "/":
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

app.mount("/static", StaticFiles(directory=str(WEB_DIR)), name="static")
app.mount("/storage", StaticFiles(directory=str(STORAGE_DIR)), name="storage")


def save_project_metadata(project_id: str, data: dict):
    proj_dir = PROJECTS_DIR / project_id
    proj_dir.mkdir(parents=True, exist_ok=True)
    meta_path = proj_dir / "project.json"
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def load_project_metadata(project_id: str) -> Optional[dict]:
    meta_path = PROJECTS_DIR / project_id / "project.json"
    if meta_path.exists():
        with open(meta_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return None


def run_pipeline_task(
    project_id: str,
    audio_path: str,
    title: str = "",
    custom_lyrics: Optional[str] = None,
    language: Optional[str] = "auto",
    model_size: str = "small",
    demucs_model: str = "htdemucs",
    use_cache: bool = True,
    device_mode: str = "cpu",
    transcription_engine: str = "whisper",
    idea_prompt: str = ""
):
    """Full background pipeline: Demucs -> Synced Lyrics / Whisper / Gemini AI -> Subtitle Generation with Smart Caching"""
    try:
        proj_dir = PROJECTS_DIR / project_id
        meta = load_project_metadata(project_id) or {}
        
        def update_progress(pct: int, msg: str):
            JOB_STATUS[project_id] = {
                "status": "processing",
                "progress": pct,
                "message": msg,
                "error": None
            }
            logger.info(f"[{project_id}] {pct}% - {msg}")

        # Determine target device
        is_gpu = (device_mode == "gpu") and torch.cuda.is_available()
        demucs_device = "cuda" if is_gpu else "cpu"
        whisper_device = "cuda" if is_gpu else "cpu"
        whisper_compute = "float16" if is_gpu else "int8"
        hw_label = "GPU CUDA" if is_gpu else "CPU Đa Luồng"

        update_progress(5, f"Đang kiểm tra Cache & khởi tạo AI ({hw_label})...")

        # Step 1: Demucs Stem Separation with Cache
        stems_dir = proj_dir / "stems"
        stems = separate_audio(
            input_audio_path=audio_path,
            output_dir=str(stems_dir),
            model_name=demucs_model,
            device=demucs_device,
            use_cache=use_cache,
            progress_callback=update_progress
        )

        meta["stems"] = {
            "vocals_wav": str(stems["vocals_wav"]),
            "instrumental_wav": str(stems["instrumental_wav"]),
            "vocals_mp3": f"/storage/projects/{project_id}/stems/vocals.mp3",
            "instrumental_mp3": f"/storage/projects/{project_id}/stems/instrumental.mp3",
            "cache_hit": stems.get("cache_hit", False),
            "device_mode": device_mode
        }
        save_project_metadata(project_id, meta)

        segments = []
        lyrics_source = "whisper_ai"
        official_text_lines = []

        parsed_synced_segments = None

        # Step 2: User custom lyrics text (if manually pasted in upload form or auto-fetched)
        if custom_lyrics and custom_lyrics.strip():
            if "-->" in custom_lyrics:
                parsed_synced_segments = parse_srt_to_segments(custom_lyrics)
            elif re.search(r"\[\d{2}:\d{2}", custom_lyrics):
                parsed_synced_segments = parse_lrc_to_segments(custom_lyrics)
            else:
                official_text_lines = [l.strip() for l in custom_lyrics.strip().split("\n") if l.strip()]

        from backend.acoustic_aligner import align_lyrics_with_vocal_audio, align_synced_lyrics_with_vocal_audio

        # Step 3: Transcription - Gemini AI or Whisper AI
        if transcription_engine == "gemini":
            from backend.gemini_service import get_gemini_config
            gem_cfg = get_gemini_config()
            if not gem_cfg.get("has_key"):
                logger.info(f"[{project_id}] Chưa cấu hình Gemini API Key. Tự động chuyển sang Faster-Whisper AI...")
                update_progress(52, "ℹ️ Chưa cấu hình Gemini API Key, tự động chuyển sang Whisper AI...")
                transcription_engine = "whisper"
            else:
                update_progress(50, "🧠 Đang phân tích Video / Âm thanh bằng Google Gemini AI...")
                try:
                    from backend.gemini_service import analyze_media_with_gemini
                    # Prioritize isolated vocal track for pristine lyric alignment if available
                    target_media = audio_path
                    vocal_mp3_candidate = proj_dir / "stems" / "vocals.mp3"
                    if vocal_mp3_candidate.exists() and vocal_mp3_candidate.stat().st_size > 1000:
                        target_media = str(vocal_mp3_candidate)
                    elif stems.get("vocals_wav") and Path(stems["vocals_wav"]).exists():
                        target_media = str(stems["vocals_wav"])

                    gem_res = analyze_media_with_gemini(
                        media_path=target_media,
                        idea_prompt=idea_prompt,
                        custom_lyrics=custom_lyrics or "",
                        progress_callback=update_progress
                    )
                    gem_segs = gem_res.get("segments", [])
                    meta["gemini_model"] = gem_res.get("model")
                    meta["idea_prompt"] = idea_prompt
                    lyrics_source = "gemini_ai"
                    segments = gem_segs
                    logger.info(f"[{project_id}] Gemini returned {len(segments)} segments successfully")
                except Exception as gem_err:
                    logger.error(f"Gemini transcription error: {gem_err}. Falling back to Whisper AI...")
                    update_progress(55, f"⚠️ Gemini gặp lỗi ({gem_err}), tự động chuyển sang Whisper AI...")
                    transcription_engine = "whisper"

        if transcription_engine != "gemini":
            effective_model = model_size
            if whisper_device == "cpu" and model_size in ["large-v3", "large"]:
                if official_text_lines or parsed_synced_segments:
                    logger.info(f"[{project_id}] CPU Mode with known lyrics -> Using 'tiny' (~3s) for ultra-fast boundary detection.")
                    effective_model = "tiny"
                else:
                    logger.info(f"[{project_id}] CPU Mode without lyrics -> Using 'base' (~8s) for balanced speed and accuracy.")
                    effective_model = "base"

            update_progress(55, f"Đang nhận diện giọng hát thực tế trên {hw_label} bằng Faster-Whisper AI ({effective_model})...")
            transcription = transcribe_vocals(
                vocal_audio_path=stems["vocals_wav"],
                model_size=effective_model,
                language=language,
                custom_prompt="",
                device=whisper_device,
                use_cache=use_cache,
                progress_callback=update_progress
            )

            raw_whisper_segments = transcription.get("segments", [])
            meta["language"] = transcription.get("language", "vi")
            meta["duration"] = transcription.get("duration", 0)

            # Step 4: If official/synced text is available, align it to the REAL vocal timestamps!
            if parsed_synced_segments and raw_whisper_segments:
                update_progress(75, "Đang khớp nhịp lời đồng bộ vào giọng hát thực tế của bài...")
                segments = align_synced_lyrics_with_vocal_audio(parsed_synced_segments, raw_whisper_segments)
                lyrics_source = "synced_lrc_aligned"
                if not segments:
                    segments = parsed_synced_segments
                    lyrics_source = "synced_lrc"
            elif official_text_lines and raw_whisper_segments:
                update_progress(75, "Đang khớp lời chuẩn vào giọng hát thực tế của bài...")
                segments = align_lyrics_with_vocal_audio(official_text_lines, raw_whisper_segments)
                lyrics_source = "hybrid_acoustic_aligned"
                if not segments and official_text_lines:
                    dur = meta.get("duration") or 180.0
                    step = dur / max(1, len(official_text_lines))
                    segments = []
                    for i, l in enumerate(official_text_lines):
                        st = max(5.0, i * step)
                        en = st + step * 0.92
                        w_list = l.split()
                        w_step = (en - st) / max(1, len(w_list))
                        words = [{"word": w, "start": round(st + j * w_step, 2), "end": round(st + (j+1) * w_step, 2), "probability": 0.8} for j, w in enumerate(w_list)]
                        segments.append({"id": i, "start": round(st, 2), "end": round(en, 2), "text": l, "words": words})
                    lyrics_source = "distributed_lyrics"
            elif parsed_synced_segments:
                segments = parsed_synced_segments
                lyrics_source = "synced_lrc"
            elif raw_whisper_segments:
                segments = raw_whisper_segments
                lyrics_source = "whisper_ai"
            elif custom_lyrics and custom_lyrics.strip():
                logger.warning(f"[{project_id}] Whisper returned 0 segments, falling back to parsed lyrics")
                if re.search(r"\[\d{2}:\d{2}", custom_lyrics):
                    segments = parse_lrc_to_segments(custom_lyrics)
                    lyrics_source = "synced_lrc"
                elif "-->" in custom_lyrics:
                    segments = parse_srt_to_segments(custom_lyrics)
                    lyrics_source = "srt"
                else:
                    dur = meta.get("duration") or 180.0
                    lines = [l.strip() for l in custom_lyrics.strip().split("\n") if l.strip()]
                    segments = []
                    if lines:
                        step = dur / max(1, len(lines))
                        for i, l in enumerate(lines):
                            st = i * step
                            en = st + step * 0.92
                            w_list = l.split()
                            w_step = (en - st) / max(1, len(w_list))
                            words = [{"word": w, "start": round(st + j * w_step, 2), "end": round(st + (j+1) * w_step, 2), "probability": 0.8} for j, w in enumerate(w_list)]
                            segments.append({"id": i, "start": round(st, 2), "end": round(en, 2), "text": l, "words": words})
                    lyrics_source = "distributed_lyrics"
            else:
                segments = []
                lyrics_source = "none"

        # Step 3b: Ensure all segments are split into natural lines (<= 8 words, <= 38 chars)
        from backend.acoustic_aligner import split_long_segment_data
        split_segments = []
        for s in segments:
            split_segments.extend(split_long_segment_data(s, max_words=8, max_chars=38, max_duration=5.5))
        for idx, s in enumerate(split_segments):
            s["id"] = idx
        segments = split_segments

        meta["lyrics_source"] = lyrics_source
        meta["segments"] = segments

        # Step 4: Subtitle Generation (ASS, LRC, JSON, SRT)
        update_progress(80, "Đang khởi tạo phụ đề Karaoke ASS, LRC, JSON và SRT...")
        subs_dir = proj_dir / "subtitles"
        subs_dir.mkdir(parents=True, exist_ok=True)

        ass_path = subs_dir / "karaoke.ass"
        lrc_path = subs_dir / "karaoke.lrc"
        json_path = subs_dir / "karaoke.json"
        srt_path = subs_dir / "karaoke.srt"

        generate_ass_subtitles(segments, str(ass_path))
        generate_lrc(segments, str(lrc_path))
        generate_json_lyrics(segments, str(json_path))

        from backend.gemini_service import segments_to_srt
        with open(srt_path, "w", encoding="utf-8") as f:
            f.write(segments_to_srt(segments))

        meta["subtitles"] = {
            "ass": f"/storage/projects/{project_id}/subtitles/karaoke.ass",
            "lrc": f"/storage/projects/{project_id}/subtitles/karaoke.lrc",
            "json": f"/storage/projects/{project_id}/subtitles/karaoke.json",
            "srt": f"/storage/projects/{project_id}/subtitles/karaoke.srt"
        }

        # Ensure background parallel MP3 encoding completes before opening studio
        if stems.get("mp3_thread") and stems["mp3_thread"].is_alive():
            logger.info(f"[{project_id}] Awaiting background MP3 encoding completion...")
            stems["mp3_thread"].join(timeout=30)

        meta["status"] = "ready"
        meta.pop("error", None)
        save_project_metadata(project_id, meta)

        JOB_STATUS[project_id] = {
            "status": "ready",
            "progress": 100,
            "message": "Hoàn tất tách beat và canh nhịp lời bài hát!",
            "data": meta,
            "error": None
        }

    except Exception as e:
        logger.exception(f"Pipeline error for project {project_id}: {e}")
        JOB_STATUS[project_id] = {
            "status": "error",
            "progress": 0,
            "message": f"Lỗi xử lý: {str(e)}",
            "error": str(e)
        }
        if meta:
            meta["status"] = "error"
            meta["error"] = str(e)
            save_project_metadata(project_id, meta)


@app.get("/", response_class=HTMLResponse)
async def serve_index():
    index_path = WEB_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return HTMLResponse("<h2>Karaoke Studio Web UI is loading...</h2>")


def get_friendly_cpu_name() -> str:
    threads = os.cpu_count() or 4
    name = None
    if sys.platform == "win32":
        try:
            import winreg
            key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"HARDWARE\DESCRIPTION\System\CentralProcessor\0")
            val, _ = winreg.QueryValueEx(key, "ProcessorNameString")
            winreg.CloseKey(key)
            if val and val.strip():
                name = val.strip()
        except Exception:
            pass
    elif sys.platform == "darwin":
        try:
            res = subprocess.run(["sysctl", "-n", "machdep.cpu.brand_string"], capture_output=True, text=True)
            if res.returncode == 0 and res.stdout.strip():
                name = res.stdout.strip()
        except Exception:
            pass
    elif sys.platform.startswith("linux"):
        try:
            with open("/proc/cpuinfo") as f:
                for line in f:
                    if "model name" in line:
                        name = line.split(":", 1)[1].strip()
                        break
        except Exception:
            pass
    if not name:
        name = platform.processor() or "Multi-Core CPU"
    return f"{name} ({threads} Luồng)"


def check_has_qsv() -> bool:
    if sys.platform == "win32" and not torch.cuda.is_available():
        try:
            res = subprocess.run(
                ["ffmpeg", "-f", "lavfi", "-i", "color=c=black:s=64x64:d=0.1", "-c:v", "h264_qsv", "-f", "null", "-"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=2
            )
            return (res.returncode == 0)
        except Exception:
            return False
    return False


@app.get("/api/system-info")
async def get_system_info():
    is_macos = (sys.platform == "darwin")
    has_cuda = torch.cuda.is_available()
    has_mps = hasattr(torch.backends, "mps") and torch.backends.mps.is_available()
    has_qsv = check_has_qsv()

    if is_macos and has_mps:
        chip_name = "Apple Silicon (MPS)"
        try:
            res = subprocess.run(["sysctl", "-n", "machdep.cpu.brand_string"], capture_output=True, text=True)
            if res.returncode == 0 and res.stdout.strip():
                chip_name = res.stdout.strip()
        except Exception:
            pass
        gpu_name = f"{chip_name} [Metal GPU]"
        vram_gb = "Unified"
        engine_str = "Meta Demucs v4 + Faster-Whisper + VideoToolbox"
        gpu_available = True
    elif has_cuda:
        gpu_name = torch.cuda.get_device_name(0)
        vram_gb = round(torch.cuda.get_device_properties(0).total_memory / (1024**3), 1)
        engine_str = "Meta Demucs v4 + Faster-Whisper + FFmpeg NVENC"
        gpu_available = True
    else:
        cpu_str = get_friendly_cpu_name()
        qsv_tag = " • Tăng Tốc Intel QSV" if has_qsv else ""
        gpu_name = f"{cpu_str}{qsv_tag}"
        vram_gb = 0.0
        engine_str = "Meta Demucs v4 (CPU Optimized) + Faster-Whisper (int8)"
        gpu_available = False

    recommended_profile = "gpu_studio" if (has_cuda or (is_macos and has_mps)) else ("intel_qsv_fast" if has_qsv else "cpu_fast")
    recommended_whisper = "large-v3" if (has_cuda or (is_macos and has_mps)) else "tiny"

    return {
        "cuda_available": gpu_available,
        "has_qsv": has_qsv,
        "gpu_name": gpu_name,
        "vram_gb": vram_gb,
        "engine": engine_str,
        "os_platform": sys.platform,
        "recommended_profile": recommended_profile,
        "recommended_whisper": recommended_whisper
    }


@app.get("/api/search-lyrics")
async def search_lyrics_api(query: str, duration: Optional[float] = 0.0, artist: Optional[str] = ""):
    """Fetches clean lyrics online from LRCLIB for a given song title/artist, ranked by duration."""
    if not query or not query.strip():
        raise HTTPException(status_code=400, detail="Query không được để trống")
    res = await asyncio.to_thread(fetch_online_lyrics, query.strip(), artist=artist or "", target_duration=duration or 0.0)
    return res


@app.post("/api/upload")
async def upload_audio_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    custom_lyrics: Optional[str] = Form(None),
    language: str = Form("auto"),
    whisper_model: str = Form("small"),
    demucs_model: str = Form("htdemucs"),
    use_cache: bool = Form(True),
    device_mode: str = Form("cpu"),
    transcription_engine: str = Form("whisper"),
    idea_prompt: Optional[str] = Form("")
):
    project_id = str(uuid.uuid4())[:8]
    proj_dir = PROJECTS_DIR / project_id
    proj_dir.mkdir(parents=True, exist_ok=True)

    original_filename = file.filename
    ext = Path(original_filename).suffix or ".mp3"
    input_file_path = proj_dir / f"source{ext}"

    with open(input_file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    song_title = Path(original_filename).stem

    # Determine proper language: prioritize Vietnamese for Vietnamese titles/lyrics
    if language == "auto" or not language:
        if is_likely_vietnamese(song_title) or (custom_lyrics and is_likely_vietnamese(custom_lyrics)):
            language = "vi"
        else:
            language = "vi"

    # Auto-fetch online lyrics if user didn't paste custom lyrics
    if not custom_lyrics or not custom_lyrics.strip():
        audio_dur = get_audio_file_duration(str(input_file_path))
        clean_q = clean_song_title(song_title)
        l_res = await asyncio.to_thread(fetch_online_lyrics, clean_q, target_duration=audio_dur)
        if l_res.get("status") == "found":
            cand_lang = l_res.get("language")
            # If the song title is Vietnamese, NEVER accept an English or foreign match!
            if is_likely_vietnamese(song_title) and cand_lang and cand_lang != "vi":
                logger.warning(f"Rejected non-Vietnamese online lyrics ({cand_lang}) for Vietnamese title: '{song_title}'")
            else:
                synced = l_res.get("synced_lyrics")
                plain = l_res.get("plain_lyrics")
                if synced and synced.strip() and not l_res.get("is_synced_truncated"):
                    custom_lyrics = synced.strip()
                elif plain and plain.strip():
                    custom_lyrics = plain.strip()
                else:
                    custom_lyrics = ""
                logger.info(f"Auto-applied verified online lyrics for uploaded file '{clean_q}' (Duration: {audio_dur:.1f}s)")
                if cand_lang:
                    language = cand_lang

    meta = {
        "id": project_id,
        "title": song_title,
        "created_at": time.time(),
        "status": "processing",
        "input_file": str(input_file_path),
        "language": language,
        "whisper_model": whisper_model,
        "demucs_model": demucs_model,
        "use_cache": use_cache,
        "device_mode": device_mode,
        "transcription_engine": transcription_engine,
        "idea_prompt": idea_prompt or ""
    }
    save_project_metadata(project_id, meta)

    JOB_STATUS[project_id] = {
        "status": "processing",
        "progress": 5,
        "message": "Đang kiểm tra bộ nhớ đệm (Cache) & khởi động AI...",
        "error": None
    }

    background_tasks.add_task(
        run_pipeline_task,
        project_id=project_id,
        audio_path=str(input_file_path),
        title=song_title,
        custom_lyrics=custom_lyrics,
        language=language,
        model_size=whisper_model,
        demucs_model=demucs_model,
        use_cache=use_cache,
        device_mode=device_mode,
        transcription_engine=transcription_engine,
        idea_prompt=idea_prompt or ""
    )

    return {"project_id": project_id, "status": "processing"}


@app.post("/api/from-url")
async def process_url(
    background_tasks: BackgroundTasks,
    url: str = Form(...),
    custom_lyrics: Optional[str] = Form(None),
    language: str = Form("auto"),
    whisper_model: str = Form("small"),
    demucs_model: str = Form("htdemucs"),
    use_cache: bool = Form(True),
    device_mode: str = Form("cpu"),
    transcription_engine: str = Form("whisper"),
    idea_prompt: Optional[str] = Form("")
):
    from backend.downloader import extract_clean_media_url
    url = extract_clean_media_url(url)

    project_id = str(uuid.uuid4())[:8]
    proj_dir = PROJECTS_DIR / project_id
    proj_dir.mkdir(parents=True, exist_ok=True)

    JOB_STATUS[project_id] = {
        "status": "processing",
        "progress": 2,
        "message": "Đang kết nối và tải âm thanh từ liên kết...",
        "error": None
    }

    def download_and_run():
        try:
            def update_progress(pct: int, msg: str):
                JOB_STATUS[project_id] = {
                    "status": "processing",
                    "progress": pct,
                    "message": msg,
                    "error": None
                }
                logger.info(f"[{project_id}] {pct}% - {msg}")

            dl_info = download_audio_from_url(url, str(proj_dir), progress_callback=update_progress)
            audio_path = dl_info["audio_path"]
            title = dl_info.get("title", "Online Track")
            track_dur = float(dl_info.get("duration") or 0.0)
            if track_dur <= 0:
                track_dur = get_audio_file_duration(audio_path)

            active_lyrics = custom_lyrics
            active_lang = language

            if active_lang == "auto" or not active_lang:
                if is_likely_vietnamese(title) or (active_lyrics and is_likely_vietnamese(active_lyrics)):
                    active_lang = "vi"
                else:
                    active_lang = "vi"

            if not active_lyrics or not active_lyrics.strip():
                clean_q = clean_song_title(title)
                l_res = fetch_online_lyrics(clean_q, target_duration=track_dur)
                if l_res.get("status") == "found":
                    cand_lang = l_res.get("language")
                    if is_likely_vietnamese(title) and cand_lang and cand_lang != "vi":
                        logger.warning(f"Rejected non-Vietnamese online lyrics ({cand_lang}) for Vietnamese title: '{title}'")
                    else:
                        synced = l_res.get("synced_lyrics")
                        plain = l_res.get("plain_lyrics")
                        if synced and synced.strip() and not l_res.get("is_synced_truncated"):
                            active_lyrics = synced.strip()
                        elif plain and plain.strip():
                            active_lyrics = plain.strip()
                        else:
                            active_lyrics = ""
                        logger.info(f"Auto-applied verified online lyrics for URL '{clean_q}' (Duration: {track_dur:.1f}s)")
                        if cand_lang:
                            active_lang = cand_lang

            update_progress(8, f"Đã tải xong '{title}'. Bắt đầu xử lý AI...")
            meta = {
                "id": project_id,
                "title": title,
                "thumbnail": dl_info.get("thumbnail"),
                "created_at": time.time(),
                "status": "processing",
                "input_file": audio_path,
                "language": active_lang,
                "whisper_model": whisper_model,
                "demucs_model": demucs_model,
                "use_cache": use_cache,
                "device_mode": device_mode,
                "transcription_engine": transcription_engine,
                "idea_prompt": idea_prompt or ""
            }
            save_project_metadata(project_id, meta)
            
            run_pipeline_task(
                project_id=project_id,
                audio_path=audio_path,
                title=title,
                custom_lyrics=active_lyrics,
                language=active_lang,
                model_size=whisper_model,
                demucs_model=demucs_model,
                use_cache=use_cache,
                device_mode=device_mode,
                transcription_engine=transcription_engine,
                idea_prompt=idea_prompt or ""
            )
        except Exception as e:
            logger.error(f"URL process error: {e}")
            JOB_STATUS[project_id] = {
                "status": "failed",
                "progress": 0,
                "message": str(e),
                "error": str(e)
            }

    background_tasks.add_task(download_and_run)
    return {"project_id": project_id, "status": "processing"}


@app.post("/api/upload-stems")
async def upload_stems_endpoint(
    background_tasks: BackgroundTasks,
    instrumental_file: UploadFile = File(...),
    vocal_file: Optional[UploadFile] = File(None),
    song_title: Optional[str] = Form(""),
    custom_lyrics: Optional[str] = Form(None),
    language: str = Form("auto"),
    whisper_model: str = Form("small"),
    transcription_engine: str = Form("whisper"),
    idea_prompt: Optional[str] = Form("")
):
    """Directly uploads pre-separated Beat and Vocal stems, skipping Demucs entirely!"""
    project_id = str(uuid.uuid4())[:8]
    proj_dir = PROJECTS_DIR / project_id
    stems_dir = proj_dir / "stems"
    stems_dir.mkdir(parents=True, exist_ok=True)

    title = (song_title or "").strip()
    if not title:
        raw_name = Path(instrumental_file.filename).stem
        for pfx in ["instrumental", "beat", "karaoke", "no_vocals", "minus_vocals", "vocal_remover"]:
            raw_name = re.sub(rf"(?i)[\s_\-]*{pfx}[\s_\-]*", " ", raw_name)
        title = " ".join(raw_name.split()) or "Bài Hát Tách Sẵn"

    inst_ext = Path(instrumental_file.filename).suffix.lower() or ".mp3"
    saved_inst = stems_dir / f"instrumental{inst_ext}"
    with open(saved_inst, "wb") as f:
        shutil.copyfileobj(instrumental_file.file, f)

    inst_wav = stems_dir / "instrumental.wav"
    inst_mp3 = stems_dir / "instrumental.mp3"
    if inst_ext == ".wav":
        if saved_inst != inst_wav:
            shutil.copy2(saved_inst, inst_wav)
        subprocess.run(["ffmpeg", "-y", "-i", str(inst_wav), "-b:a", "320k", str(inst_mp3)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    else:
        if saved_inst != inst_mp3:
            shutil.copy2(saved_inst, inst_mp3)
        subprocess.run(["ffmpeg", "-y", "-i", str(inst_mp3), str(inst_wav)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    has_vocal = False
    vocal_wav = stems_dir / "vocals.wav"
    vocal_mp3 = stems_dir / "vocals.mp3"
    if vocal_file and vocal_file.filename:
        has_vocal = True
        voc_ext = Path(vocal_file.filename).suffix.lower() or ".mp3"
        saved_voc = stems_dir / f"vocals{voc_ext}"
        with open(saved_voc, "wb") as f:
            shutil.copyfileobj(vocal_file.file, f)
        if voc_ext == ".wav":
            if saved_voc != vocal_wav:
                shutil.copy2(saved_voc, vocal_wav)
            subprocess.run(["ffmpeg", "-y", "-i", str(vocal_wav), "-b:a", "256k", str(vocal_mp3)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            if saved_voc != vocal_mp3:
                shutil.copy2(saved_voc, vocal_mp3)
            subprocess.run(["ffmpeg", "-y", "-i", str(vocal_mp3), str(vocal_wav)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    else:
        # Fallback: copy instrumental to vocal paths so player won't fail
        shutil.copy2(inst_wav, vocal_wav)
        shutil.copy2(inst_mp3, vocal_mp3)

    meta = {
        "id": project_id,
        "title": title,
        "created_at": time.time(),
        "status": "processing",
        "input_file": str(inst_mp3),
        "language": language,
        "transcription_engine": transcription_engine,
        "idea_prompt": idea_prompt or "",
        "whisper_model": whisper_model,
        "stems": {
            "vocals_wav": str(vocal_wav),
            "instrumental_wav": str(inst_wav),
            "vocals_mp3": f"/storage/projects/{project_id}/stems/vocals.mp3",
            "instrumental_mp3": f"/storage/projects/{project_id}/stems/instrumental.mp3",
            "pre_separated": True
        }
    }
    save_project_metadata(project_id, meta)

    JOB_STATUS[project_id] = {
        "status": "processing",
        "progress": 45,
        "message": "⚡ Đã nạp Beat & Vocal có sẵn! Bắt đầu nhận diện lời & phụ đề...",
        "error": None
    }

    def run_stems_transcription():
        try:
            def update_progress(pct: int, msg: str):
                JOB_STATUS[project_id] = {
                    "status": "processing",
                    "progress": pct,
                    "message": msg,
                    "error": None
                }
                logger.info(f"[{project_id}] {pct}% - {msg}")

            segments = []
            lyrics_source = "pre_separated"

            parsed_synced = None
            official_text_lines = []
            if not custom_lyrics or not custom_lyrics.strip():
                clean_q = clean_song_title(title)
                dur = get_audio_file_duration(str(inst_wav))
                l_res = fetch_online_lyrics(clean_q, target_duration=dur)
                if l_res.get("status") == "found":
                    synced = l_res.get("synced_lyrics")
                    plain = l_res.get("plain_lyrics")
                    if synced and synced.strip() and not l_res.get("is_synced_truncated"):
                        custom_lyrics = synced.strip()
                    elif plain and plain.strip():
                        custom_lyrics = plain.strip()

            if custom_lyrics and custom_lyrics.strip():
                if "-->" in custom_lyrics:
                    parsed_synced = parse_srt_to_segments(custom_lyrics)
                elif re.search(r"\[\d{2}:\d{2}", custom_lyrics):
                    parsed_synced = parse_lrc_to_segments(custom_lyrics)
                else:
                    official_text_lines = [l.strip() for l in custom_lyrics.strip().split("\n") if l.strip()]

            effective_whisper_model = whisper_model
            if not torch.cuda.is_available() and whisper_model in ["large-v3", "large"]:
                logger.warning(f"[{project_id}] Whisper large-v3 on CPU detected in stem upload. Using 'small' model.")
                effective_whisper_model = "small"

            if transcription_engine == "gemini":
                from backend.gemini_service import get_gemini_config
                gem_cfg = get_gemini_config()
                if not gem_cfg.get("has_key"):
                    logger.info(f"[{project_id}] Chưa cấu hình Gemini API Key. Tự động chuyển sang Whisper AI...")
                    update_progress(55, "ℹ️ Chưa cấu hình Gemini API Key, tự động chuyển sang Whisper AI...")
                    transcription_engine = "whisper"
                else:
                    update_progress(55, "🧠 Đang phân tích âm thanh bằng Google Gemini AI...")
                    try:
                        from backend.gemini_service import analyze_media_with_gemini
                        audio_target = str(vocal_mp3 if has_vocal else inst_mp3)
                        gem_res = analyze_media_with_gemini(
                            media_path=audio_target,
                            idea_prompt=idea_prompt or "",
                            custom_lyrics=custom_lyrics or "",
                            progress_callback=update_progress
                        )
                        segments = gem_res.get("segments", [])
                        lyrics_source = "gemini_ai"
                    except Exception as e:
                        logger.error(f"Gemini error: {e}, falling back to Whisper")
                        update_progress(60, f"Gemini gặp lỗi ({e}), chuyển sang Whisper AI ({effective_whisper_model})...")
                        transcription_engine = "whisper"

            if transcription_engine != "gemini":
                update_progress(55, f"Đang nhận diện giọng hát bằng Whisper AI ({effective_whisper_model})...")
                transcription = transcribe_vocals(str(vocal_wav), model_size=effective_whisper_model, language=language, custom_prompt="", progress_callback=update_progress)
                segments = transcription.get("segments", [])

            if parsed_synced and segments:
                from backend.acoustic_aligner import align_synced_lyrics_with_vocal_audio
                segments = align_synced_lyrics_with_vocal_audio(parsed_synced, segments)
            elif official_text_lines and segments:
                from backend.acoustic_aligner import align_lyrics_with_vocal_audio
                segments = align_lyrics_with_vocal_audio(official_text_lines, segments)

            # Ensure natural lines (<= 8 words, <= 38 chars)
            from backend.acoustic_aligner import split_long_segment_data
            split_segs = []
            for s in segments:
                split_segs.extend(split_long_segment_data(s, max_words=8, max_chars=38, max_duration=5.5))
            for i, s in enumerate(split_segs):
                s["id"] = i
            segments = split_segs

            meta["segments"] = segments
            meta["lyrics_source"] = lyrics_source

            # Subtitles
            subs_dir = proj_dir / "subtitles"
            subs_dir.mkdir(parents=True, exist_ok=True)
            generate_ass_subtitles(segments, str(subs_dir / "karaoke.ass"))
            generate_lrc(segments, str(subs_dir / "karaoke.lrc"))
            generate_json_lyrics(segments, str(subs_dir / "karaoke.json"))
            from backend.gemini_service import segments_to_srt
            with open(subs_dir / "karaoke.srt", "w", encoding="utf-8") as f:
                f.write(segments_to_srt(segments))

            meta["subtitles"] = {
                "ass": f"/storage/projects/{project_id}/subtitles/karaoke.ass",
                "lrc": f"/storage/projects/{project_id}/subtitles/karaoke.lrc",
                "json": f"/storage/projects/{project_id}/subtitles/karaoke.json",
                "srt": f"/storage/projects/{project_id}/subtitles/karaoke.srt"
            }
            meta["status"] = "ready"
            meta.pop("error", None)
            save_project_metadata(project_id, meta)

            JOB_STATUS[project_id] = {
                "status": "ready",
                "progress": 100,
                "message": "Hoàn tất xử lý bài hát!",
                "data": meta,
                "error": None
            }
        except Exception as e:
            logger.error(f"Stems transcription error: {e}")
            JOB_STATUS[project_id] = {
                "status": "error",
                "progress": 0,
                "message": f"Lỗi xử lý: {str(e)}",
                "error": str(e)
            }
            if meta:
                meta["status"] = "error"
                meta["error"] = str(e)
                save_project_metadata(project_id, meta)

    background_tasks.add_task(run_stems_transcription)
    return {"project_id": project_id, "status": "processing"}




@app.post("/api/import-subtitles/{project_id}")
async def import_subtitles_endpoint(
    project_id: str,
    file: UploadFile = File(...)
):
    """Imports an external SRT or LRC file and converts it into Karaoke ASS format."""
    meta = load_project_metadata(project_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Project not found")

    content_bytes = await file.read()
    sub_text = content_bytes.decode("utf-8", errors="replace")

    if "-->" in sub_text:
        segments = parse_srt_to_segments(sub_text)
    else:
        segments = parse_lrc_to_segments(sub_text)

    if not segments:
        raise HTTPException(status_code=400, detail="Không thể nhận diện định dạng phụ đề SRT/LRC")

    meta["segments"] = segments
    meta["lyrics_source"] = "imported_file"

    proj_dir = PROJECTS_DIR / project_id
    subs_dir = proj_dir / "subtitles"
    subs_dir.mkdir(parents=True, exist_ok=True)

    ass_path = subs_dir / "karaoke.ass"
    lrc_path = subs_dir / "karaoke.lrc"
    json_path = subs_dir / "karaoke.json"
    srt_path = subs_dir / "karaoke.srt"

    settings = meta.get("settings", {})
    generate_ass_subtitles(
        segments,
        str(ass_path),
        font_name=settings.get("font_name", "Tahoma"),
        font_size=int(settings.get("font_size", 54)),
        primary_color=settings.get("primary_color", "&H00FFFFFF"),
        karaoke_color=settings.get("karaoke_color", "&H00F51800"),
        line1_pos_y=settings.get("line1_pos_y"),
        line2_pos_y=settings.get("line2_pos_y"),
        line1_pos_x=settings.get("line1_pos_x"),
        line2_pos_x=settings.get("line2_pos_x"),
        font_size_line1=settings.get("font_size_line1"),
        font_size_line2=settings.get("font_size_line2"),
        align_line1=settings.get("align_line1", "left"),
        align_line2=settings.get("align_line2", "right")
    )
    generate_lrc(segments, str(lrc_path))
    generate_json_lyrics(segments, str(json_path))
    from backend.gemini_service import segments_to_srt
    with open(srt_path, "w", encoding="utf-8") as f:
        f.write(segments_to_srt(segments))

    save_project_metadata(project_id, meta)
    return {"status": "success", "segments_count": len(segments), "data": meta}


@app.get("/api/status/{project_id}")
async def get_project_status(project_id: str):
    meta = load_project_metadata(project_id)
    if project_id in JOB_STATUS:
        res = JOB_STATUS[project_id].copy()
        if meta:
            res["data"] = meta
        return res

    if meta:
        return {
            "status": meta.get("status", "ready"),
            "progress": 100 if meta.get("status") == "ready" else 0,
            "message": "Sẵn sàng",
            "data": meta,
            "error": meta.get("error")
        }

    raise HTTPException(status_code=404, detail="Project not found")


@app.post("/api/update-lyrics/{project_id}")
async def update_lyrics(
    project_id: str,
    payload: Dict[str, Any]
):
    meta = load_project_metadata(project_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Project not found")

    new_segments = payload.get("segments", [])
    settings = meta.get("settings", {})
    font_name = payload.get("font_name") or settings.get("font_name", "Tahoma")
    font_size = int(payload.get("font_size") or settings.get("font_size", 54))
    primary_color = payload.get("primary_color") or settings.get("primary_color", "&H00FFFFFF")
    karaoke_color = payload.get("karaoke_color") or settings.get("karaoke_color", "&H00F51800")

    meta["segments"] = new_segments
    
    proj_dir = PROJECTS_DIR / project_id
    subs_dir = proj_dir / "subtitles"
    subs_dir.mkdir(parents=True, exist_ok=True)

    ass_path = subs_dir / "karaoke.ass"
    lrc_path = subs_dir / "karaoke.lrc"
    json_path = subs_dir / "karaoke.json"

    generate_ass_subtitles(
        new_segments,
        str(ass_path),
        font_name=font_name,
        font_size=font_size,
        primary_color=primary_color,
        karaoke_color=karaoke_color,
        line1_pos_y=settings.get("line1_pos_y"),
        line2_pos_y=settings.get("line2_pos_y"),
        line1_pos_x=settings.get("line1_pos_x"),
        line2_pos_x=settings.get("line2_pos_x"),
        font_size_line1=settings.get("font_size_line1"),
        font_size_line2=settings.get("font_size_line2"),
        align_line1=settings.get("align_line1", "left"),
        align_line2=settings.get("align_line2", "right")
    )
    generate_lrc(new_segments, str(lrc_path))
    generate_json_lyrics(new_segments, str(json_path))

    save_project_metadata(project_id, meta)
    return {"status": "success", "message": "Đã cập nhật phụ đề và nhịp lời thành công!"}


@app.post("/api/split-long-segments/{project_id}")
async def split_long_segments_api(project_id: str, payload: Optional[Dict[str, Any]] = None):
    meta = load_project_metadata(project_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Project not found")

    from backend.acoustic_aligner import split_long_segment_data
    max_words = int((payload or {}).get("max_words", 6))
    max_chars = int((payload or {}).get("max_chars", 28))

    current_segments = meta.get("segments", [])
    if not current_segments:
        proj_dir = PROJECTS_DIR / project_id
        json_path = proj_dir / "subtitles" / "karaoke.json"
        if json_path.exists():
            with open(json_path, "r", encoding="utf-8") as f:
                d = json.load(f)
                current_segments = d if isinstance(d, list) else d.get("segments", [])

    split_segs = []
    for s in current_segments:
        split_segs.extend(split_long_segment_data(s, max_words=max_words, max_chars=max_chars, max_duration=4.2))

    for idx, s in enumerate(split_segs):
        s["id"] = idx

    meta["segments"] = split_segs

    proj_dir = PROJECTS_DIR / project_id
    subs_dir = proj_dir / "subtitles"
    subs_dir.mkdir(parents=True, exist_ok=True)

    ass_path = subs_dir / "karaoke.ass"
    lrc_path = subs_dir / "karaoke.lrc"
    json_path = subs_dir / "karaoke.json"

    settings = meta.get("settings", {})
    generate_ass_subtitles(
        split_segs,
        str(ass_path),
        font_name=settings.get("font_name", "Tahoma"),
        font_size=settings.get("font_size", 54),
        primary_color=settings.get("primary_color", "&H00FFFFFF"),
        karaoke_color=settings.get("karaoke_color", "&H00F51800"),
        line1_pos_y=settings.get("line1_pos_y"),
        line2_pos_y=settings.get("line2_pos_y"),
        line1_pos_x=settings.get("line1_pos_x"),
        line2_pos_x=settings.get("line2_pos_x"),
        font_size_line1=settings.get("font_size_line1"),
        font_size_line2=settings.get("font_size_line2"),
        align_line1=settings.get("align_line1", "left"),
        align_line2=settings.get("align_line2", "right")
    )
    generate_lrc(split_segs, str(lrc_path))
    generate_json_lyrics(split_segs, str(json_path))

    save_project_metadata(project_id, meta)
    return {
        "status": "success",
        "message": f"Đã chia nhỏ các câu dài thành {len(split_segs)} câu ngắn (≤{max_words} chữ)!",
        "segments": split_segs
    }


@app.post("/api/projects/{project_id}/realign")
@app.post("/api/realign/{project_id}")
@app.post("/api/realign-lyrics/{project_id}")
async def realign_project_api(project_id: str):
    """Re-aligns the project lyrics with the vocal audio using forced acoustic DP alignment."""
    meta = load_project_metadata(project_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Project not found")

    proj_dir = PROJECTS_DIR / project_id
    vocals_wav = proj_dir / "stems" / "vocals.wav"
    if not vocals_wav.exists():
        vocals_wav_str = meta.get("stems", {}).get("vocals_wav")
        if vocals_wav_str and Path(vocals_wav_str).exists():
            vocals_wav = Path(vocals_wav_str)

    if not vocals_wav.exists():
        raise HTTPException(status_code=400, detail="Không tìm thấy file vocal stem để căn nhịp.")

    from backend.transcriber import transcribe_vocals
    from backend.acoustic_aligner import align_synced_lyrics_with_vocal_audio

    # Transcribe or use cached transcription
    transcription = transcribe_vocals(
        vocal_audio_path=str(vocals_wav),
        model_size=meta.get("whisper_model", "small"),
        language=meta.get("language", "vi"),
        device=meta.get("device_mode", "cpu"),
        use_cache=True
    )
    raw_whisper = transcription.get("segments", [])

    existing_segments = meta.get("segments", [])
    if not existing_segments:
        raise HTTPException(status_code=400, detail="Dự án không có dữ liệu lời bài hát để căn nhịp.")

    # Re-align with DP acoustic forced aligner + fragment merger
    new_segments = align_synced_lyrics_with_vocal_audio(existing_segments, raw_whisper)
    meta["segments"] = new_segments
    meta["lyrics_source"] = "synced_lrc_aligned"

    # Regenerate subtitles
    subs_dir = proj_dir / "subtitles"
    subs_dir.mkdir(parents=True, exist_ok=True)
    ass_path = subs_dir / "karaoke.ass"
    lrc_path = subs_dir / "karaoke.lrc"
    json_path = subs_dir / "karaoke.json"

    settings = meta.get("settings", {})
    generate_ass_subtitles(
        new_segments,
        str(ass_path),
        font_name=settings.get("font_name", "Tahoma"),
        font_size=int(settings.get("font_size", 54)),
        primary_color=settings.get("primary_color", "&H00FFFFFF"),
        karaoke_color=settings.get("karaoke_color", "&H00F51800"),
        line1_pos_y=settings.get("line1_pos_y"),
        line2_pos_y=settings.get("line2_pos_y"),
        line1_pos_x=settings.get("line1_pos_x"),
        line2_pos_x=settings.get("line2_pos_x"),
        font_size_line1=settings.get("font_size_line1"),
        font_size_line2=settings.get("font_size_line2"),
        align_line1=settings.get("align_line1", "left"),
        align_line2=settings.get("align_line2", "right")
    )
    generate_lrc(new_segments, str(lrc_path))
    generate_json_lyrics(new_segments, str(json_path))

    save_project_metadata(project_id, meta)
    return {
        "status": "success",
        "message": f"Đã tự động căn lại nhịp và ghép {len(new_segments)} câu chuẩn KTV thành công!",
        "data": meta
    }


@app.post("/api/projects/{project_id}/align-gemini")
@app.post("/api/align-gemini/{project_id}")
async def align_gemini_project_api(
    project_id: str,
    custom_lyrics: Optional[str] = Form(None),
    model_name: Optional[str] = Form(None)
):
    """
    Aligns song lyrics using Google Gemini Multimodal Audio (ideal for Suno AI & new releases).
    Takes project vocal track + lyrics text, calls Gemini to get timed SRT,
    and converts to KTV Karaoke ASS/LRC/JSON/SRT.
    """
    meta = load_project_metadata(project_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài hát.")

    proj_dir = PROJECTS_DIR / project_id

    # 1. Locate best audio stem for Gemini (vocals.mp3 > vocals.wav > original audio)
    vocal_media = None
    vocal_mp3 = proj_dir / "stems" / "vocals.mp3"
    vocal_wav = proj_dir / "stems" / "vocals.wav"
    if vocal_mp3.exists() and vocal_mp3.stat().st_size > 1000:
        vocal_media = vocal_mp3
    elif vocal_wav.exists() and vocal_wav.stat().st_size > 1000:
        vocal_media = vocal_wav
    else:
        orig_audio = meta.get("audio_path")
        if orig_audio and Path(orig_audio).exists():
            vocal_media = Path(orig_audio)
        else:
            for f in proj_dir.glob("input_audio.*"):
                vocal_media = f
                break

    if not vocal_media or not vocal_media.exists():
        raise HTTPException(status_code=400, detail="Không tìm thấy file âm thanh hoặc giọng hát của dự án.")

    # 2. Check Gemini config
    from backend.gemini_service import get_gemini_config, analyze_media_with_gemini, clean_suno_lyrics, segments_to_srt
    gem_cfg = get_gemini_config()
    if not gem_cfg.get("has_key"):
        raise HTTPException(
            status_code=400,
            detail="Chưa cấu hình Gemini API Key! Vui lòng vào Cài Đặt và nhập Gemini API Key (miễn phí tại https://aistudio.google.com/)."
        )

    # 3. Determine lyrics text
    lyrics_text = (custom_lyrics or "").strip()
    if not lyrics_text:
        existing_segs = meta.get("segments", [])
        if existing_segs:
            lyrics_text = "\n".join(s.get("text", "") for s in existing_segs if s.get("text"))

    if not lyrics_text:
        raise HTTPException(status_code=400, detail="Vui lòng cung cấp lời bài hát từ Suno hoặc lời chuẩn để Gemini canh nhịp.")

    logger.info(f"[{project_id}] Running Gemini alignment on {vocal_media.name} with {len(lyrics_text.splitlines())} lines of lyrics...")

    try:
        gem_res = await asyncio.to_thread(
            analyze_media_with_gemini,
            media_path=str(vocal_media),
            custom_lyrics=lyrics_text,
            model_name=model_name
        )
    except Exception as e:
        logger.error(f"[{project_id}] Gemini alignment failed: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi Gemini AI: {str(e)}")

    new_segments = gem_res.get("segments", [])
    if not new_segments:
        raise HTTPException(status_code=500, detail="Gemini không trả về câu phụ đề nào.")

    # Apply 2-line alternating split if needed
    from backend.acoustic_aligner import split_long_segment_data
    split_segs = []
    for s in new_segments:
        split_segs.extend(split_long_segment_data(s, max_words=8, max_chars=38, max_duration=5.5))
    for i, s in enumerate(split_segs):
        s["id"] = i
    new_segments = split_segs

    meta["segments"] = new_segments
    meta["lyrics_source"] = "gemini_ai"
    meta["gemini_model"] = gem_res.get("model")

    # Regenerate all subtitles (preserving user styling)
    subs_dir = proj_dir / "subtitles"
    subs_dir.mkdir(parents=True, exist_ok=True)
    ass_path = subs_dir / "karaoke.ass"
    lrc_path = subs_dir / "karaoke.lrc"
    json_path = subs_dir / "karaoke.json"
    srt_path = subs_dir / "karaoke.srt"

    settings = meta.get("settings", {})
    generate_ass_subtitles(
        new_segments,
        str(ass_path),
        font_name=settings.get("font_name", "Tahoma"),
        font_size=int(settings.get("font_size", 54)),
        primary_color=settings.get("primary_color", "&H00FFFFFF"),
        karaoke_color=settings.get("karaoke_color", "&H00F51800"),
        line1_pos_y=settings.get("line1_pos_y"),
        line2_pos_y=settings.get("line2_pos_y"),
        line1_pos_x=settings.get("line1_pos_x"),
        line2_pos_x=settings.get("line2_pos_x"),
        font_size_line1=settings.get("font_size_line1"),
        font_size_line2=settings.get("font_size_line2"),
        align_line1=settings.get("align_line1", "left"),
        align_line2=settings.get("align_line2", "right")
    )
    generate_lrc(new_segments, str(lrc_path))
    generate_json_lyrics(new_segments, str(json_path))
    with open(srt_path, "w", encoding="utf-8") as f:
        f.write(segments_to_srt(new_segments))

    save_project_metadata(project_id, meta)
    return {
        "status": "success",
        "message": f"Gemini AI đã khớp chuẩn xác {len(new_segments)} câu hát theo nhịp vocal!",
        "data": meta,
        "segments": new_segments
    }


@app.post("/api/upload-background/{project_id}")
async def upload_custom_background(
    project_id: str,
    file: UploadFile = File(...)
):
    proj_dir = PROJECTS_DIR / project_id
    if not proj_dir.exists():
        raise HTTPException(status_code=404, detail="Project not found")

    ext = Path(file.filename).suffix or ".jpg"
    bg_path = proj_dir / f"custom_bg{ext}"

    with open(bg_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    meta = load_project_metadata(project_id) or {}
    meta["custom_background"] = str(bg_path)
    meta["custom_background_url"] = f"/storage/projects/{project_id}/custom_bg{ext}"
    save_project_metadata(project_id, meta)

    return {"status": "success", "url": meta["custom_background_url"]}


@app.post("/api/project-settings/{project_id}")
async def save_project_settings(
    project_id: str,
    payload: Dict[str, Any]
):
    meta = load_project_metadata(project_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Project not found")

    settings = meta.get("settings", {})
    for k, v in payload.items():
        settings[k] = v

    meta["settings"] = settings
    if "line1_pos_y" in settings:
        meta["line1_pos_y"] = float(settings["line1_pos_y"])
    if "line2_pos_y" in settings:
        meta["line2_pos_y"] = float(settings["line2_pos_y"])
    if "line1_pos_x" in settings:
        meta["line1_pos_x"] = float(settings["line1_pos_x"])
    if "line2_pos_x" in settings:
        meta["line2_pos_x"] = float(settings["line2_pos_x"])
    if "font_size_line1" in settings:
        meta["font_size_line1"] = int(settings["font_size_line1"])
    if "font_size_line2" in settings:
        meta["font_size_line2"] = int(settings["font_size_line2"])
    if "align_line1" in settings:
        meta["align_line1"] = str(settings["align_line1"])
    if "align_line2" in settings:
        meta["align_line2"] = str(settings["align_line2"])

    proj_dir = PROJECTS_DIR / project_id
    subs_dir = proj_dir / "subtitles"
    subs_dir.mkdir(parents=True, exist_ok=True)
    ass_path = subs_dir / "karaoke.ass"

    segments = meta.get("segments", [])
    if segments:
        generate_ass_subtitles(
            segments=segments,
            output_ass_path=str(ass_path),
            font_name=settings.get("font_name", "Tahoma"),
            font_size=int(settings.get("font_size", 54)),
            primary_color=settings.get("primary_color", "&H00FFFFFF"),
            karaoke_color=settings.get("karaoke_color", "&H00F51800"),
            line1_pos_y=settings.get("line1_pos_y"),
            line2_pos_y=settings.get("line2_pos_y"),
            line1_pos_x=settings.get("line1_pos_x"),
            line2_pos_x=settings.get("line2_pos_x"),
            font_size_line1=settings.get("font_size_line1"),
            font_size_line2=settings.get("font_size_line2"),
            align_line1=settings.get("align_line1", "left"),
            align_line2=settings.get("align_line2", "right"),
            layout_preset=settings.get("layout_preset", "center"),
            display_mode=settings.get("display_mode", "pingpong")
        )

    save_project_metadata(project_id, meta)
    return {"status": "success", "message": "Đã lưu cấu hình bài hát thành công!", "settings": settings}


@app.post("/api/render-video/{project_id}")
async def render_video_endpoint(
    project_id: str,
    payload: Dict[str, Any] = {}
):
    meta = load_project_metadata(project_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Project not found")

    proj_dir = PROJECTS_DIR / project_id
    subs_dir = proj_dir / "subtitles"
    subs_dir.mkdir(parents=True, exist_ok=True)
    ass_path = subs_dir / "karaoke.ass"
    
    settings = meta.get("settings", {})
    segments = meta.get("segments", [])
    font_name = payload.get("font_name") or settings.get("font_name", "Tahoma")
    font_size = int(payload.get("font_size") or settings.get("font_size", 54))
    primary_color = payload.get("primary_color") or settings.get("primary_color", "&H00FFFFFF")
    karaoke_color = payload.get("karaoke_color") or settings.get("karaoke_color", "&H00F51800")
    pitch_semitones = int(payload.get("pitch_semitones") if payload.get("pitch_semitones") is not None else settings.get("pitch_semitones", 0))
    
    subtitle_pos_y = payload.get("subtitle_pos_y") or meta.get("subtitle_pos_y")
    line1_pos_y = payload.get("line1_pos_y") or settings.get("line1_pos_y") or meta.get("line1_pos_y")
    line2_pos_y = payload.get("line2_pos_y") or settings.get("line2_pos_y") or meta.get("line2_pos_y")
    line1_pos_x = payload.get("line1_pos_x") or settings.get("line1_pos_x") or meta.get("line1_pos_x")
    line2_pos_x = payload.get("line2_pos_x") or settings.get("line2_pos_x") or meta.get("line2_pos_x")
    font_size_line1 = payload.get("font_size_line1") or settings.get("font_size_line1") or meta.get("font_size_line1")
    font_size_line2 = payload.get("font_size_line2") or settings.get("font_size_line2") or meta.get("font_size_line2")
    align_line1 = payload.get("align_line1") or settings.get("align_line1") or meta.get("align_line1")
    align_line2 = payload.get("align_line2") or settings.get("align_line2") or meta.get("align_line2")
    layout_preset = payload.get("layout_preset") or settings.get("layout_preset") or "center"

    if layout_preset == "center" or (line1_pos_x is not None and abs(float(line1_pos_x) - 0.50) < 0.06):
        align_line1 = "center"
        align_line2 = "center"
    else:
        if not align_line1: align_line1 = "left"
        if not align_line2: align_line2 = "right"

    resolution = payload.get("resolution", "1920x1080")
    try:
        vid_w, vid_h = map(int, resolution.split("x"))
    except Exception:
        vid_w, vid_h = 1920, 1080

    # Generate custom ASS with user-selected font, colors and aspect ratio
    if segments:
        generate_ass_subtitles(
            segments=segments,
            output_ass_path=str(ass_path),
            font_name=font_name,
            font_size=font_size,
            primary_color=primary_color,
            karaoke_color=karaoke_color,
            video_width=vid_w,
            video_height=vid_h,
            subtitle_pos_y=subtitle_pos_y,
            line1_pos_y=line1_pos_y,
            line2_pos_y=line2_pos_y,
            line1_pos_x=line1_pos_x,
            line2_pos_x=line2_pos_x,
            font_size_line1=font_size_line1,
            font_size_line2=font_size_line2,
            align_line1=align_line1,
            align_line2=align_line2,
            layout_preset=layout_preset,
            display_mode=payload.get("display_mode") or settings.get("display_mode", "pingpong")
        )
    
    instrumental_wav = proj_dir / "stems" / "instrumental.wav"
    if not instrumental_wav.exists():
        instrumental_wav = Path(meta.get("input_file", ""))

    if not instrumental_wav.exists():
        raise HTTPException(status_code=400, detail="Instrumental audio stem missing")

    output_video = proj_dir / "karaoke_video.mp4"
    bg_path = payload.get("background_path") or meta.get("custom_background")
    resolution = payload.get("resolution", "1920x1080")

    try:
        await asyncio.to_thread(
            render_karaoke_video,
            audio_path=str(instrumental_wav),
            ass_subtitle_path=str(ass_path),
            output_video_path=str(output_video),
            background_path=bg_path,
            resolution=resolution,
            use_gpu=torch.cuda.is_available(),
            pitch_semitones=pitch_semitones
        )

        meta["video_url"] = f"/storage/projects/{project_id}/karaoke_video.mp4"
        save_project_metadata(project_id, meta)

        return {
            "status": "success",
            "video_url": meta["video_url"],
            "download_url": meta["video_url"],
            "local_path": str(output_video.resolve()),
            "folder_path": str(proj_dir.resolve())
        }
    except Exception as e:
        logger.error(f"Render error: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi xuất video: {str(e)}")


@app.post("/api/open-folder/{project_id}")
async def open_project_folder(project_id: str):
    proj_dir = PROJECTS_DIR / project_id
    if not proj_dir.exists():
        raise HTTPException(status_code=404, detail="Project not found")
    try:
        resolved_path = str(proj_dir.resolve())
        if sys.platform == "darwin":
            subprocess.run(["open", resolved_path])
        elif sys.platform.startswith("win"):
            os.startfile(resolved_path)
        else:
            subprocess.run(["xdg-open", resolved_path])
        return {"status": "success", "path": resolved_path}
    except Exception as e:
        return {"status": "error", "message": str(e), "path": str(proj_dir.resolve())}


@app.get("/api/projects")
async def list_projects():
    projects = []
    if PROJECTS_DIR.exists():
        for p_dir in sorted(PROJECTS_DIR.iterdir(), key=os.path.getmtime, reverse=True):
            if p_dir.is_dir():
                meta = load_project_metadata(p_dir.name)
                if meta:
                    projects.append({
                        "id": meta.get("id", p_dir.name),
                        "title": meta.get("title", p_dir.name),
                        "created_at": meta.get("created_at", 0),
                        "status": meta.get("status", "unknown"),
                        "duration": meta.get("duration", 0),
                        "language": meta.get("language", "vi"),
                        "lyrics_source": meta.get("lyrics_source", "whisper_ai"),
                        "instrumental_mp3": meta.get("stems", {}).get("instrumental_mp3"),
                        "video_url": meta.get("video_url")
                    })
    return {"projects": projects}


def _handle_remove_readonly(func, path, exc_info):
    """Fallback error handler to remove read-only flags on Windows files."""
    try:
        os.chmod(path, stat.S_IWRITE)
        func(path)
    except Exception:
        pass


def _on_exc_readonly(func, path, exc):
    """Python 3.12+ error handler for shutil.rmtree on Windows."""
    try:
        os.chmod(path, stat.S_IWRITE)
        func(path)
    except Exception:
        pass


def safe_rmtree(target_dir: Path, retries: int = 5, delay: float = 0.3) -> bool:
    """
    Safely delete a directory tree on Windows.
    Handles [WinError 32] (file locked by media streaming, browser, or OneDrive sync)
    and [WinError 5] (access denied) with automatic garbage collection, retries,
    and safe fallback renaming to a trash queue.
    """
    if not target_dir.exists():
        return True

    gc.collect()

    for attempt in range(retries):
        try:
            if sys.version_info >= (3, 12):
                shutil.rmtree(target_dir, onexc=_on_exc_readonly)
            else:
                shutil.rmtree(target_dir, onerror=_handle_remove_readonly)
            return True
        except (PermissionError, OSError) as e:
            if attempt < retries - 1:
                time.sleep(delay)
                gc.collect()
            else:
                # If direct deletion still fails due to temporary file lock (e.g. OneDrive or media stream),
                # move/rename directory to a temporary trash folder so the project vanishes from library immediately.
                try:
                    trash_dir = target_dir.parent / f"_trash_{target_dir.name}_{int(time.time())}"
                    target_dir.rename(trash_dir)

                    def bg_cleanup():
                        time.sleep(2.5)
                        try:
                            if sys.version_info >= (3, 12):
                                shutil.rmtree(trash_dir, onexc=_on_exc_readonly)
                            else:
                                shutil.rmtree(trash_dir, onerror=_handle_remove_readonly)
                        except Exception:
                            pass

                    threading.Thread(target=bg_cleanup, daemon=True).start()
                    return True
                except Exception as rename_err:
                    logger.warning(f"Could not rename locked directory to trash: {rename_err}")
                raise e
    return True


def cleanup_trash_folders():
    """Clean up any leftover temporary trash folders on server startup."""
    try:
        for trash in PROJECTS_DIR.glob("_trash_*"):
            try:
                if sys.version_info >= (3, 12):
                    shutil.rmtree(trash, onexc=_on_exc_readonly)
                else:
                    shutil.rmtree(trash, onerror=_handle_remove_readonly)
            except Exception:
                pass
    except Exception:
        pass


@app.on_event("startup")
async def startup_event():
    cleanup_trash_folders()


@app.delete("/api/project/{project_id}")
async def delete_project(project_id: str):
    proj_dir = PROJECTS_DIR / project_id
    if not proj_dir.exists():
        raise HTTPException(status_code=404, detail="Không tìm thấy bài hát cần xóa")
    try:
        # Run deletion asynchronously in threadpool to prevent blocking the event loop
        await asyncio.to_thread(safe_rmtree, proj_dir)
        if project_id in JOB_STATUS:
            del JOB_STATUS[project_id]
        return {"status": "success", "message": f"Đã xóa thành công bài hát {project_id}"}
    except Exception as e:
        logger.error(f"Delete project error: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi khi xóa bài hát: {str(e)}")


@app.post("/api/clear-cache")
async def api_clear_cache():
    """Cleans all stems and transcripts cache to free disk space."""
    try:
        from backend.cache_manager import clear_all_cache
        res = await asyncio.to_thread(clear_all_cache)
        return {
            "status": "success",
            "message": f"Đã xóa sạch {res['deleted_files']} tệp cache, giải phóng {res['reclaimed_mb']} MB bộ nhớ!",
            "data": res
        }
    except Exception as e:
        logger.error(f"Clear cache error: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi khi xóa cache: {str(e)}")


@app.get("/api/config")
async def get_system_config():
    """Get system and Gemini AI configuration."""
    from backend.gemini_service import get_gemini_config
    return get_gemini_config()


@app.post("/api/config")
async def update_system_config(
    gemini_api_key: Optional[str] = Form(None),
    gemini_model: Optional[str] = Form(None)
):
    """Save or update Gemini AI configuration."""
    try:
        from backend.gemini_service import save_gemini_config
        new_config = save_gemini_config(api_key=gemini_api_key, model=gemini_model)
        return {
            "status": "success",
            "message": "Đã lưu cài đặt Gemini thành công!",
            "config": new_config
        }
    except Exception as e:
        logger.error(f"Save config error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/gemini/video-to-srt")
async def gemini_video_to_srt(
    file: Optional[UploadFile] = File(None),
    url: Optional[str] = Form(None),
    idea_prompt: Optional[str] = Form(""),
    model_name: Optional[str] = Form(None)
):
    """Directly converts any uploaded video/audio file or URL into standardized SRT karaoke using Gemini AI."""
    temp_dir = STORAGE_DIR / "temp" / f"gemini_{uuid.uuid4().hex[:8]}"
    temp_dir.mkdir(parents=True, exist_ok=True)
    media_path = None
    try:
        if file and file.filename:
            media_path = temp_dir / file.filename
            with open(media_path, "wb") as f:
                shutil.copyfileobj(file.file, f)
        elif url and url.strip():
            from backend.downloader import download_audio_from_url
            dl = await asyncio.to_thread(download_audio_from_url, url.strip(), str(temp_dir))
            media_path = Path(dl["audio_path"])
        else:
            raise HTTPException(status_code=400, detail="Vui lòng cung cấp file video/audio hoặc đường link URL.")

        from backend.gemini_service import analyze_media_with_gemini
        res = await asyncio.to_thread(
            analyze_media_with_gemini,
            media_path=str(media_path),
            idea_prompt=idea_prompt or "",
            model_name=model_name
        )
        return res
    except Exception as e:
        logger.error(f"Gemini video-to-srt error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try:
            shutil.rmtree(temp_dir, ignore_errors=True)
        except Exception:
            pass




if __name__ == "__main__":
    logger.info("Starting Local AI Karaoke Studio on http://127.0.0.1:8008")
    try:
        uvicorn.run(app, host="127.0.0.1", port=8008, log_level="info")
    except Exception as e:
        logger.error(f"Server error: {e}")
