import os
import sys
import uuid
import json
import time
import shutil
import asyncio
import logging
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


async def run_pipeline_task(
    project_id: str,
    audio_path: str,
    title: str = "",
    custom_lyrics: Optional[str] = None,
    language: Optional[str] = "auto",
    model_size: str = "large-v3",
    demucs_model: str = "htdemucs",
    use_cache: bool = True,
    device_mode: str = "gpu"
):
    """Full background pipeline: Demucs -> Synced Lyrics / Whisper -> Subtitle Generation with Smart Caching"""
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

        # Step 2: User custom lyrics text (if manually pasted in upload form)
        if custom_lyrics and custom_lyrics.strip():
            if "-->" in custom_lyrics:
                parsed_srt = parse_srt_to_segments(custom_lyrics)
                official_text_lines = [s["text"] for s in parsed_srt]
            elif re.search(r"\[\d{2}:\d{2}", custom_lyrics):
                parsed_lrc = parse_lrc_to_segments(custom_lyrics)
                official_text_lines = [s["text"] for s in parsed_lrc]
            else:
                official_text_lines = [l.strip() for l in custom_lyrics.strip().split("\n") if l.strip()]

        # Step 3: Run Faster-Whisper directly on isolated VOCALS.WAV to get exact acoustic word timestamps
        prompt_text = "\n".join(official_text_lines) if official_text_lines else custom_lyrics
        update_progress(55, f"Đang nhận diện giọng hát thực tế trên {hw_label} bằng Faster-Whisper AI...")

        from backend.acoustic_aligner import align_lyrics_with_vocal_audio

        transcription = transcribe_vocals(
            vocal_audio_path=stems["vocals_wav"],
            model_size=model_size,
            language=language,
            custom_prompt=prompt_text,
            device=whisper_device,
            use_cache=use_cache,
            progress_callback=update_progress
        )

        raw_whisper_segments = transcription.get("segments", [])
        meta["language"] = transcription.get("language", "vi")
        meta["duration"] = transcription.get("duration", 0)

        # Step 4: If official text is available, align it to the REAL vocal timestamps!
        if official_text_lines and raw_whisper_segments:
            update_progress(75, "Đang khớp lời chuẩn vào giọng hát thực tế của bài...")
            segments = align_lyrics_with_vocal_audio(official_text_lines, raw_whisper_segments)
            lyrics_source = "hybrid_acoustic_aligned"
        else:
            segments = raw_whisper_segments
            lyrics_source = "whisper_ai"

        meta["lyrics_source"] = lyrics_source
        meta["segments"] = segments

        # Step 3: Subtitle Generation
        update_progress(80, "Đang khởi tạo phụ đề Karaoke ASS và LRC...")
        subs_dir = proj_dir / "subtitles"
        subs_dir.mkdir(parents=True, exist_ok=True)

        ass_path = subs_dir / "karaoke.ass"
        lrc_path = subs_dir / "karaoke.lrc"
        json_path = subs_dir / "karaoke.json"

        generate_ass_subtitles(segments, str(ass_path))
        generate_lrc(segments, str(lrc_path))
        generate_json_lyrics(segments, str(json_path))

        meta["subtitles"] = {
            "ass": f"/storage/projects/{project_id}/subtitles/karaoke.ass",
            "lrc": f"/storage/projects/{project_id}/subtitles/karaoke.lrc",
            "json": f"/storage/projects/{project_id}/subtitles/karaoke.json"
        }
        meta["status"] = "ready"
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


@app.get("/api/system-info")
async def get_system_info():
    is_macos = (sys.platform == "darwin")
    has_cuda = torch.cuda.is_available()
    has_mps = hasattr(torch.backends, "mps") and torch.backends.mps.is_available()

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
        gpu_name = f"CPU ({platform.processor() or 'Multi-Core'})"
        vram_gb = 0.0
        engine_str = "Meta Demucs v4 + Faster-Whisper (CPU Mode)"
        gpu_available = False

    return {
        "cuda_available": gpu_available,
        "gpu_name": gpu_name,
        "vram_gb": vram_gb,
        "engine": engine_str,
        "os_platform": sys.platform
    }


@app.post("/api/upload")
async def upload_audio_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    custom_lyrics: Optional[str] = Form(None),
    language: str = Form("auto"),
    whisper_model: str = Form("large-v3"),
    demucs_model: str = Form("htdemucs"),
    use_cache: bool = Form(True),
    device_mode: str = Form("gpu")
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
        "device_mode": device_mode
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
        device_mode=device_mode
    )

    return {"project_id": project_id, "status": "processing"}


@app.post("/api/from-url")
async def process_url(
    background_tasks: BackgroundTasks,
    url: str = Form(...),
    custom_lyrics: Optional[str] = Form(None),
    language: str = Form("auto"),
    whisper_model: str = Form("large-v3"),
    demucs_model: str = Form("htdemucs"),
    use_cache: bool = Form(True),
    device_mode: str = Form("gpu")
):
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
            dl_info = download_audio_from_url(url, str(proj_dir))
            audio_path = dl_info["audio_path"]
            title = dl_info.get("title", "Online Track")
            meta = {
                "id": project_id,
                "title": title,
                "thumbnail": dl_info.get("thumbnail"),
                "created_at": time.time(),
                "status": "processing",
                "input_file": audio_path,
                "language": language,
                "whisper_model": whisper_model,
                "demucs_model": demucs_model,
                "use_cache": use_cache,
                "device_mode": device_mode
            }
            save_project_metadata(project_id, meta)
            
            run_pipeline_task(
                project_id=project_id,
                audio_path=audio_path,
                title=title,
                custom_lyrics=custom_lyrics,
                language=language,
                model_size=whisper_model,
                demucs_model=demucs_model,
                use_cache=use_cache,
                device_mode=device_mode
            )
        except Exception as e:
            logger.error(f"URL process error: {e}")
            JOB_STATUS[project_id] = {
                "status": "error",
                "progress": 0,
                "message": str(e),
                "error": str(e)
            }

    background_tasks.add_task(download_and_run)
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

    generate_ass_subtitles(segments, str(ass_path))
    generate_lrc(segments, str(lrc_path))
    generate_json_lyrics(segments, str(json_path))

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
    font_name = payload.get("font_name") or settings.get("font_name", "Outfit")
    font_size = int(payload.get("font_size") or settings.get("font_size", 54))
    primary_color = payload.get("primary_color") or settings.get("primary_color", "&H00FFFFFF")
    karaoke_color = payload.get("karaoke_color") or settings.get("karaoke_color", "&H0000E5FF")

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
            font_name=settings.get("font_name", "Outfit"),
            font_size=int(settings.get("font_size", 54)),
            primary_color=settings.get("primary_color", "&H00FFFFFF"),
            karaoke_color=settings.get("karaoke_color", "&H0000E5FF"),
            line1_pos_y=settings.get("line1_pos_y"),
            line2_pos_y=settings.get("line2_pos_y"),
            line1_pos_x=settings.get("line1_pos_x"),
            line2_pos_x=settings.get("line2_pos_x"),
            font_size_line1=settings.get("font_size_line1"),
            font_size_line2=settings.get("font_size_line2"),
            align_line1=settings.get("align_line1", "left"),
            align_line2=settings.get("align_line2", "right")
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
    font_name = payload.get("font_name") or settings.get("font_name", "Outfit")
    font_size = int(payload.get("font_size") or settings.get("font_size", 54))
    primary_color = payload.get("primary_color") or settings.get("primary_color", "&H00FFFFFF")
    karaoke_color = payload.get("karaoke_color") or settings.get("karaoke_color", "&H0000E5FF")
    
    subtitle_pos_y = payload.get("subtitle_pos_y") or meta.get("subtitle_pos_y")
    line1_pos_y = payload.get("line1_pos_y") or settings.get("line1_pos_y") or meta.get("line1_pos_y")
    line2_pos_y = payload.get("line2_pos_y") or settings.get("line2_pos_y") or meta.get("line2_pos_y")
    line1_pos_x = payload.get("line1_pos_x") or settings.get("line1_pos_x") or meta.get("line1_pos_x")
    line2_pos_x = payload.get("line2_pos_x") or settings.get("line2_pos_x") or meta.get("line2_pos_x")
    font_size_line1 = payload.get("font_size_line1") or settings.get("font_size_line1") or meta.get("font_size_line1")
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
            align_line2=align_line2
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
        render_karaoke_video(
            audio_path=str(instrumental_wav),
            ass_subtitle_path=str(ass_path),
            output_video_path=str(output_video),
            background_path=bg_path,
            resolution=resolution,
            use_gpu=torch.cuda.is_available()
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


@app.delete("/api/project/{project_id}")
async def delete_project(project_id: str):
    proj_dir = PROJECTS_DIR / project_id
    if not proj_dir.exists():
        raise HTTPException(status_code=404, detail="Project not found")
    try:
        shutil.rmtree(proj_dir)
        if project_id in JOB_STATUS:
            del JOB_STATUS[project_id]
        return {"status": "success", "message": f"Đã xóa dự án {project_id}"}
    except Exception as e:
        logger.error(f"Delete project error: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi khi xóa bài hát: {str(e)}")


if __name__ == "__main__":
    logger.info("Starting Local AI Karaoke Studio on http://127.0.0.1:8008")
    try:
        uvicorn.run(app, host="127.0.0.1", port=8008, log_level="info")
    except Exception as e:
        logger.error(f"Server error: {e}")
