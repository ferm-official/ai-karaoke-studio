import os
import re
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
import torch

from backend.cache_manager import compute_file_hash, get_cached_transcription, save_transcription_to_cache

logger = logging.getLogger(__name__)

_CACHED_MODEL = None
_CACHED_MODEL_KEY = None

def get_whisper_model(
    model_size: str = "large-v3",
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
    model = WhisperModel(model_size, device=device, compute_type=compute_type)
    _CACHED_MODEL = model
    _CACHED_MODEL_KEY = cache_key
    return model

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
    model_size: str = "large-v3",
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

    # Check Transcription Cache
    if use_cache:
        cached = get_cached_transcription(file_hash, model_size, lang_key, custom_prompt or "")
        if cached:
            if progress_callback:
                progress_callback(78, "⚡ Tìm thấy nhịp lời trong Cache! Nạp tức thì (0.05s)...")
            return cached

    if progress_callback:
        progress_callback(55, f"Đang khởi động AI nhận diện lời ({model_size})...")

    if device is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"

    compute_type = "float16" if device == "cuda" else "int8"
    model = get_whisper_model(model_size, device=device, compute_type=compute_type)

    if progress_callback:
        progress_callback(65, "AI đang phân tích và bắt nhịp từng từ (Word-level alignment)...")

    lang_param = language if language and language != "auto" else None
    initial_prompt = custom_prompt if custom_prompt else None

    segments_generator, info = model.transcribe(
        str(vocal_file),
        word_timestamps=True,
        language=lang_param,
        vad_filter=True,
        vad_parameters=dict(
            threshold=0.5,
            min_speech_duration_ms=250,
            min_silence_duration_ms=400,
            speech_pad_ms=200
        ),
        initial_prompt=initial_prompt,
        beam_size=5,
        temperature=0.0,
        condition_on_previous_text=False,
        compression_ratio_threshold=2.4,
        log_prob_threshold=-1.0,
        no_speech_threshold=0.6,
        hallucination_silence_threshold=2.0
    )

    detected_lang = info.language
    detected_lang_prob = info.language_probability
    duration = info.duration

    formatted_segments = []
    seg_idx = 0

    for segment in segments_generator:
        seg_text = segment.text.strip()
        # Drop hallucinated YouTube promo spam phrases
        if is_hallucinated_text(seg_text):
            logger.warning(f"🚫 Filtered out Whisper hallucination: '{seg_text}' at {segment.start:.2f}s - {segment.end:.2f}s")
            continue

        words_data = []
        if segment.words:
            for w in segment.words:
                cleaned_word = w.word.strip()
                if cleaned_word and not is_hallucinated_text(cleaned_word):
                    words_data.append({
                        "word": cleaned_word,
                        "start": round(w.start, 3),
                        "end": round(w.end, 3),
                        "probability": round(w.probability, 3)
                    })
        
        if not words_data and seg_text:
            raw_words = seg_text.split()
            seg_len = max(0.1, segment.end - segment.start)
            time_per_word = seg_len / len(raw_words)
            for i, rw in enumerate(raw_words):
                w_start = segment.start + i * time_per_word
                w_end = w_start + time_per_word
                words_data.append({
                    "word": rw,
                    "start": round(w_start, 3),
                    "end": round(w_end, 3),
                    "probability": 0.9
                })

        if words_data:
            formatted_segments.append({
                "id": seg_idx,
                "start": round(segment.start, 3),
                "end": round(segment.end, 3),
                "text": seg_text,
                "words": words_data
            })
            seg_idx += 1

    # Apply 2-line alternating split for any long sentences (over 5 words or > 3.2s)
    from backend.acoustic_aligner import split_long_segment_data
    split_segments = []
    for s in formatted_segments:
        split_segments.extend(split_long_segment_data(s, max_words=5, max_duration=3.2))
    
    for idx, s in enumerate(split_segments):
        s["id"] = idx

    result = {
        "language": detected_lang,
        "language_probability": round(detected_lang_prob, 3),
        "duration": round(duration, 3) if duration else 0.0,
        "segments": split_segments
    }

    # Save to Cache
    save_transcription_to_cache(file_hash, model_size, lang_key, custom_prompt or "", result)

    if progress_callback:
        progress_callback(80, f"Đã nhận diện thành công {len(split_segments)} đoạn lời ({detected_lang.upper()})!")

    return result
