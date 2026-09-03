import os
import hashlib
import json
import shutil
import logging
from pathlib import Path
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

CACHE_DIR = Path(__file__).parent.parent / "storage" / "cache"
STEMS_CACHE_DIR = CACHE_DIR / "stems"
TRANSCRIPT_CACHE_DIR = CACHE_DIR / "transcripts"

STEMS_CACHE_DIR.mkdir(parents=True, exist_ok=True)
TRANSCRIPT_CACHE_DIR.mkdir(parents=True, exist_ok=True)

def compute_file_hash(file_path: str, chunk_size: int = 65536) -> str:
    """Computes a SHA-256 hash of a file for exact duplicate detection."""
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(chunk_size):
            sha256.update(chunk)
    return sha256.hexdigest()[:16]

def get_cached_stems(file_hash: str, model_name: str) -> Optional[Dict[str, str]]:
    """Checks if separated stems already exist in cache."""
    cache_key = f"{file_hash}_{model_name}"
    cached_folder = STEMS_CACHE_DIR / cache_key

    vocals_wav = cached_folder / "vocals.wav"
    instrumental_wav = cached_folder / "instrumental.wav"
    vocals_mp3 = cached_folder / "vocals.mp3"
    instrumental_mp3 = cached_folder / "instrumental.mp3"

    if vocals_wav.exists() and instrumental_wav.exists():
        logger.info(f"Stem Cache HIT for {cache_key}")
        return {
            "vocals_wav": str(vocals_wav),
            "instrumental_wav": str(instrumental_wav),
            "vocals_mp3": str(vocals_mp3) if vocals_mp3.exists() else None,
            "instrumental_mp3": str(instrumental_mp3) if instrumental_mp3.exists() else None
        }
    return None

def save_stems_to_cache(file_hash: str, model_name: str, stems_dict: Dict[str, str]):
    """Saves generated stems to persistent cache directory."""
    cache_key = f"{file_hash}_{model_name}"
    cached_folder = STEMS_CACHE_DIR / cache_key
    cached_folder.mkdir(parents=True, exist_ok=True)

    for stem_name, file_path in stems_dict.items():
        if file_path and Path(file_path).exists():
            target = cached_folder / Path(file_path).name
            if not target.exists():
                shutil.copy2(file_path, target)

def get_cached_transcription(file_hash: str, model_size: str, language: str, prompt: str = "") -> Optional[Dict[str, Any]]:
    """Checks if transcription with same parameters is cached."""
    prompt_hash = hashlib.md5((prompt or "").encode("utf-8")).hexdigest()[:8]
    cache_key = f"{file_hash}_{model_size}_{language}_{prompt_hash}.json"
    cache_file = TRANSCRIPT_CACHE_DIR / cache_key

    if cache_file.exists():
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                logger.info(f"Transcription Cache HIT for {cache_key}")
                return json.load(f)
        except Exception:
            return None
    return None

def save_transcription_to_cache(file_hash: str, model_size: str, language: str, prompt: str, data: Dict[str, Any]):
    """Saves transcription segments to persistent cache."""
    prompt_hash = hashlib.md5((prompt or "").encode("utf-8")).hexdigest()[:8]
    cache_key = f"{file_hash}_{model_size}_{language}_{prompt_hash}.json"
    cache_file = TRANSCRIPT_CACHE_DIR / cache_key
    try:
        with open(cache_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"Failed to write transcript cache: {e}")
