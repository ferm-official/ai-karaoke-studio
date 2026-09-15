import os
os.environ["HF_HUB_DISABLE_SYMLINKS"] = "1"
import re
import subprocess
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
import torch

from backend.cache_manager import compute_file_hash, get_cached_transcription, save_transcription_to_cache

logger = logging.getLogger(__name__)

_CACHED_MODEL = None
_CACHED_MODEL_KEY = None
_CACHED_BATCHED_PIPELINE = None


def get_whisper_model(
    model_size: str = "small",
    device: str = None,
    compute_type: str = None
):
    global _CACHED_MODEL, _CACHED_MODEL_KEY
    from faster_whisper import WhisperModel

    if device is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"
    
    if compute_type is None:
        compute_type = "float16" if device == "cuda" else "int8"

    cache_key = f"{model_size}_{device}_{compute_type}"
    if _CACHED_MODEL is not None and _CACHED_MODEL_KEY == cache_key:
        return _CACHED_MODEL

    logger.info(f"Loading Faster-Whisper model: {model_size} on {device} ({compute_type})...")
    cpu_threads = min(max((os.cpu_count() or 4) // 2, 4), 8) if device == "cpu" else 0
    model = WhisperModel(model_size, device=device, compute_type=compute_type, cpu_threads=cpu_threads)
    _CACHED_MODEL = model
    _CACHED_MODEL_KEY = cache_key
    return model


def get_whisper_batched_pipeline(model):
    """Caches and returns BatchedInferencePipeline for high-throughput vectorized CPU/GPU transcription."""
    global _CACHED_BATCHED_PIPELINE
    from faster_whisper import BatchedInferencePipeline

    if _CACHED_BATCHED_PIPELINE is not None and getattr(_CACHED_BATCHED_PIPELINE, "model", None) is model:
        return _CACHED_BATCHED_PIPELINE

    _CACHED_BATCHED_PIPELINE = BatchedInferencePipeline(model=model)
    return _CACHED_BATCHED_PIPELINE


def prepare_16k_mono_audio(audio_path: Path) -> Path:
    """
    Fast pre-conversion of vocal stem to 16kHz 16-bit mono PCM WAV using FFmpeg SIMD resampler.
    Bypasses costly in-memory decoding and resampling inside Python/PyAV.
    """
    if not audio_path.exists():
        return audio_path

    target_16k = audio_path.parent / f"{audio_path.stem}_16k.wav"
    if target_16k.exists() and target_16k.stat().st_size > 1000:
        return target_16k

    from backend.video_renderer import get_ffmpeg_bin
    cmd = [
        get_ffmpeg_bin(), "-y",
        "-i", str(audio_path),
        "-ar", "16000",
        "-ac", "1",
        "-c:a", "pcm_s16le",
        str(target_16k)
    ]
    try:
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        if target_16k.exists() and target_16k.stat().st_size > 1000:
            return target_16k
    except Exception as e:
        logger.warning(f"16kHz audio pre-conversion failed ({e}), using original: {audio_path}")

    return audio_path


HALLUCINATION_PATTERNS = re.compile(
    r"(subscribe|ghiền mì gõ|mì gõ|đăng ký kênh|like và share|like and subscribe|"
    r"bấm chuông|nhấn chuông|cảm ơn các bạn đã|chúc các bạn nghe nhạc|hãy like|"
    r"nhớ like|sub kênh|xem video|chia sẻ video|kênh youtube|theo dõi kênh|"
    r"tạm biệt và hẹn|chúc các bạn một ngày|hãy subscribe|để không bỏ lỡ|video hấp dẫn)",
    re.IGNORECASE
)

def is_hallucinated_text(text: str) -> bool:
    """Detects YouTube intro/outro spam hallucinations common in Whisper Vietnamese training data."""
    if not text:
        return True
    return bool(HALLUCINATION_PATTERNS.search(text.strip()))


def transcribe_vocals(
    vocal_audio_path: str,
    model_size: str = "small",
    language: Optional[str] = None,
    custom_prompt: Optional[str] = None,
    device: Optional[str] = None,
    use_cache: bool = True,
    progress_callback = None
) -> Dict[str, Any]:
    """
    Transcribes vocals with smart word-level timestamp caching and anti-hallucination filtering.
    """
    vocal_file = Path(vocal_audio_path).resolve()
    file_hash = compute_file_hash(str(vocal_file))
    lang_key = language or "auto"

    # Check Transcription Cache (universal per vocal audio, model and language)
    if use_cache:
        cached = get_cached_transcription(file_hash, model_size, lang_key, "")
        if cached:
            if progress_callback:
                progress_callback(78, "⚡ Tìm thấy nhịp lời trong Cache! Nạp tức thì (0.05s)...")
            return cached

    size_desc = (
        "~75MB (Siêu Tốc ~3s)" if "tiny" in model_size else (
            "~145MB (Nhanh ~8s)" if "base" in model_size else (
                "~460MB" if "small" in model_size else (
                    "~1.5GB" if "medium" in model_size else "~3.1GB"
                )
            )
        )
    )
    if progress_callback:
        progress_callback(55, f"Đang nạp AI Whisper ({model_size} {size_desc}). Lần đầu chạy sẽ tải từ máy chủ ({size_desc}), vui lòng đợi...")

    if device is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"

    compute_type = "float16" if device == "cuda" else "int8"
    model = get_whisper_model(model_size, device=device, compute_type=compute_type)

    if progress_callback:
        progress_callback(65, "AI đang phân tích và bắt nhịp từng từ (Word-level alignment)...")

    lang_param = language if language and language != "auto" else None
    
    # Use custom_prompt if provided; avoid hardcoded prompt that triggers YouTube spam hallucination
    initial_prompt = custom_prompt.strip() if (custom_prompt and custom_prompt.strip()) else None

    effective_audio_file = prepare_16k_mono_audio(vocal_file)

    beam_size = 1 if device == "cpu" else 5

    # Direct high-speed sequential transcription with context continuation enabled
    segments_generator, info = model.transcribe(
        str(effective_audio_file),
        word_timestamps=True,
        language=lang_param,
        vad_filter=False,
        initial_prompt=initial_prompt,
        beam_size=beam_size,
        temperature=0.0,
        condition_on_previous_text=False
    )

    detected_lang = info.language
    detected_lang_prob = info.language_probability
    duration = getattr(info, "duration", 0.0)

    formatted_segments = []
    seg_idx = 0

    for segment in segments_generator:
        seg_text = segment.text.strip()
        # Drop zero/near-zero duration collapse hallucination
        if float(segment.end) - float(segment.start) <= 0.08:
            continue

        # Drop consecutive identical hallucinated segments
        if formatted_segments and seg_text.lower() == formatted_segments[-1]["text"].lower():
            continue

        # Drop hallucinated YouTube promo spam phrases
        if is_hallucinated_text(seg_text):
            logger.warning(f"🚫 Filtered out Whisper hallucination: '{seg_text}' at {segment.start:.2f}s - {segment.end:.2f}s")
            continue

        words_data = []
        if segment.words:
            for w in segment.words:
                cleaned_word = w.word.strip()
                if cleaned_word and not is_hallucinated_text(cleaned_word) and (float(w.end) - float(w.start) >= 0.01):
                    words_data.append({
                        "word": cleaned_word,
                        "start": round(float(w.start), 3),
                        "end": round(float(w.end), 3),
                        "probability": round(float(w.probability), 3)
                    })

        if not words_data and seg_text:
            raw_words = seg_text.split()
            seg_len = max(0.1, float(segment.end) - float(segment.start))
            time_per_word = seg_len / len(raw_words)
            for i, rw in enumerate(raw_words):
                w_start = float(segment.start) + i * time_per_word
                w_end = w_start + time_per_word
                words_data.append({
                    "word": rw,
                    "start": round(float(w_start), 3),
                    "end": round(float(w_end), 3),
                    "probability": 0.9
                })

        if words_data:
            # Split segment whenever consecutive words have a silence gap >= 1.5s (instrumental pauses/solos)
            sub_chunks = []
            curr_chunk = [words_data[0]]
            for w in words_data[1:]:
                if w["start"] - curr_chunk[-1]["end"] >= 1.5:
                    sub_chunks.append(curr_chunk)
                    curr_chunk = [w]
                else:
                    curr_chunk.append(w)
            if curr_chunk:
                sub_chunks.append(curr_chunk)

            for chunk in sub_chunks:
                txt = " ".join(x["word"] for x in chunk).strip()
                st = chunk[0]["start"]
                en = chunk[-1]["end"]
                formatted_segments.append({
                    "id": seg_idx,
                    "start": round(float(st), 3),
                    "end": round(float(en), 3),
                    "text": txt,
                    "words": chunk
                })
                seg_idx += 1

    # Safety fallback: if VAD filter dropped all vocals, retry without VAD filter
    if not formatted_segments:
        logger.warning("VAD filter returned 0 vocal segments; retrying Whisper without VAD filter...")
        retry_generator, _ = model.transcribe(
            str(effective_audio_file),
            word_timestamps=True,
            language=lang_param,
            vad_filter=False,
            beam_size=(1 if device == "cpu" else 5),
            temperature=0.0,
            condition_on_previous_text=False
        )
        for segment in retry_generator:
            seg_text = segment.text.strip()
            if is_hallucinated_text(seg_text):
                continue
            words_data = []
            if segment.words:
                for w in segment.words:
                    cleaned_word = w.word.strip()
                    if cleaned_word and not is_hallucinated_text(cleaned_word):
                        words_data.append({
                            "word": cleaned_word,
                            "start": round(float(w.start), 3),
                            "end": round(float(w.end), 3),
                            "probability": round(float(w.probability), 3)
                        })
            if words_data:
                sub_chunks = []
                curr_chunk = [words_data[0]]
                for w in words_data[1:]:
                    if w["start"] - curr_chunk[-1]["end"] >= 1.5:
                        sub_chunks.append(curr_chunk)
                        curr_chunk = [w]
                    else:
                        curr_chunk.append(w)
                if curr_chunk:
                    sub_chunks.append(curr_chunk)

                for chunk in sub_chunks:
                    txt = " ".join(x["word"] for x in chunk).strip()
                    st = chunk[0]["start"]
                    en = chunk[-1]["end"]
                    formatted_segments.append({
                        "id": seg_idx,
                        "start": round(float(st), 3),
                        "end": round(float(en), 3),
                        "text": txt,
                        "words": chunk
                    })
                    seg_idx += 1
        


    # Apply natural line splitting for excessively long sentences (> 8 words or > 5.5s)
    from backend.acoustic_aligner import split_long_segment_data
    split_segments = []
    for s in formatted_segments:
        split_segments.extend(split_long_segment_data(s, max_words=8, max_chars=38, max_duration=5.5))
    
    for idx, s in enumerate(split_segments):
        s["id"] = idx

    result = {
        "language": detected_lang,
        "language_probability": round(float(detected_lang_prob), 3),
        "duration": round(float(duration), 3) if duration else 0.0,
        "segments": split_segments
    }

    # Save to Cache (universal per audio stem)
    save_transcription_to_cache(file_hash, model_size, lang_key, "", result)

    if progress_callback:
        progress_callback(80, f"Đã nhận diện thành công {len(split_segments)} đoạn lời ({detected_lang.upper()})!")

    return result
