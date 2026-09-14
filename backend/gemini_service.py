import os
import re
import json
import time
import logging
from pathlib import Path
from typing import Optional, Dict, Any, List

logger = logging.getLogger("KaraokeStudio.Gemini")

CONFIG_PATH = Path(__file__).parent.parent / "storage" / "config.json"


def get_gemini_config() -> Dict[str, Any]:
    """Load Gemini configuration from storage/config.json or environment."""
    config = {
        "gemini_api_key": "",
        "gemini_model": "gemini-2.5-flash",
        "has_key": False
    }

    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                saved = json.load(f)
                config.update(saved)
        except Exception as e:
            logger.warning(f"Failed to read config.json: {e}")

    # Fallback to environment variables if not saved in config.json
    if not config.get("gemini_api_key"):
        env_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or os.environ.get("GOOGLE_GENAI_API_KEY")
        if env_key:
            config["gemini_api_key"] = env_key

    api_key = config.get("gemini_api_key", "").strip()
    config["has_key"] = bool(api_key)
    # Mask key for frontend safety
    if api_key:
        if len(api_key) > 8:
            config["masked_key"] = f"{api_key[:4]}...{api_key[-4:]}"
        else:
            config["masked_key"] = "***"
    else:
        config["masked_key"] = ""

    return config


def save_gemini_config(api_key: Optional[str] = None, model: Optional[str] = None) -> Dict[str, Any]:
    """Persist Gemini configuration to storage/config.json."""
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    current = {}
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                current = json.load(f)
        except Exception:
            current = {}

    if api_key is not None:
        current["gemini_api_key"] = api_key.strip()
    if model is not None:
        current["gemini_model"] = model.strip()

    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(current, f, ensure_ascii=False, indent=2)

    return get_gemini_config()


def _parse_srt_timestamp(ts: str) -> float:
    """
    Converts various timestamp formats into seconds (float):
    - 00:01:23,456 or 00:01:23.456 (HH:MM:SS,mmm)
    - 00:09:282 (MM:SS:mmm - Gemini format)
    - 01:23,456 or 01:23.456 (MM:SS,mmm)
    - 00:00:09:282 (HH:MM:SS:mmm)
    - 9.282 or 123.456 (seconds)
    """
    ts = ts.strip().split()[0].replace(",", ".")
    # If ends with colon followed by 1 to 3 digits (e.g. 00:09:282 or 00:09:50)
    # where the preceding part is seconds, change that colon to period
    if re.search(r":\d{1,3}$", ts):
        colon_idx = ts.rfind(":")
        if ":" in ts[:colon_idx]:
            ts = ts[:colon_idx] + "." + ts[colon_idx + 1:]

    parts = ts.split(":")
    if len(parts) == 4:
        h, m, s, ms = parts
        return float(h) * 3600 + float(m) * 60 + float(s) + float(ms) / 1000.0
    elif len(parts) == 3:
        h, m, s = parts
        return float(h) * 3600 + float(m) * 60 + float(s)
    elif len(parts) == 2:
        m, s = parts
        return float(m) * 60 + float(s)
    elif len(parts) == 1:
        return float(parts[0])
    return 0.0


def clean_suno_lyrics(raw_lyrics: str) -> str:
    """
    Cleans structural metadata tags commonly found in Suno AI / Udio / Song prompts,
    such as [Verse], [Chorus], [Bridge], [Guitar Solo], (Instrumental), etc.,
    leaving only the actual lyrics text intended to be sung.
    """
    if not raw_lyrics:
        return ""

    lines = raw_lyrics.replace("\r\n", "\n").split("\n")
    cleaned_lines = []

    tag_keywords = [
        "verse", "chorus", "bridge", "pre-chorus", "post-chorus", "hook",
        "intro", "outro", "instrumental", "solo", "drop", "break", "interlude",
        "fade out", "ending", "refrain", "style:", "bpm:", "key:", "genre:",
        "vocal:", "male vocal", "female vocal", "duet"
    ]

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        lower_line = stripped.lower()

        # Check if entire line is a bracket tag like [Verse 1] or (Chorus) or [Guitar Solo]
        is_pure_tag = False
        if (stripped.startswith("[") and stripped.endswith("]")) or (stripped.startswith("(") and stripped.endswith(")")):
            inner = stripped[1:-1].strip().lower()
            if any(k in inner for k in tag_keywords):
                is_pure_tag = True

        # Check if line matches prompt metadata like "Style: Acoustic Pop"
        if any(lower_line.startswith(meta) for meta in ["style:", "bpm:", "key:", "genre:", "tags:"]):
            is_pure_tag = True

        if is_pure_tag:
            continue

        # Clean any inline tags like "[Chorus] Gió đông về" -> "Gió đông về"
        inline_cleaned = re.sub(r"\[(?:[^\]]*?)\]", "", stripped)
        inline_cleaned = re.sub(r"\((?:verse|chorus|solo|instrumental|intro|outro|bridge)[^\)]*?\)", "", inline_cleaned, flags=re.IGNORECASE)
        inline_cleaned = " ".join(inline_cleaned.split()).strip()

        if inline_cleaned:
            cleaned_lines.append(inline_cleaned)

    return "\n".join(cleaned_lines)


def distribute_words_in_timespan(words_raw: List[str], start_sec: float, end_sec: float) -> List[Dict[str, Any]]:
    """
    Distributes word durations using syllable-weighted interpolation:
    - Words with more characters receive proportional elongation.
    - The final word of each phrase receives an elongation bonus (1.35x) to model human singing cadences.
    """
    if not words_raw:
        return []
    total_dur = max(0.2, end_sec - start_sec)

    weights = []
    for i, w in enumerate(words_raw):
        w_len = len(w.strip())
        w_weight = 1.0 + min(0.6, w_len * 0.08)
        if i == len(words_raw) - 1 and len(words_raw) > 1:
            w_weight *= 1.35  # Singer holds final word of phrase
        weights.append(w_weight)

    sum_weights = sum(weights)
    curr_t = start_sec
    words_data = []
    for i, w in enumerate(words_raw):
        w_dur = (weights[i] / sum_weights) * total_dur
        w_start = round(curr_t, 3)
        w_end = round(curr_t + w_dur, 3)
        words_data.append({
            "word": w,
            "start": w_start,
            "end": w_end,
            "probability": 0.95
        })
        curr_t += w_dur

    if words_data:
        words_data[-1]["end"] = round(end_sec, 3)

    return words_data


def parse_srt_to_karaoke_segments(srt_content: str) -> List[Dict[str, Any]]:
    """
    Parses an SRT string into karaoke segments with calculated word-level timings.
    Handles standard SRT, Gemini formats, inline timestamps, and robust line-by-line parsing.
    """
    matches = []
    lines = srt_content.replace("\r\n", "\n").split("\n")
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if "-->" in line:
            time_parts = line.split("-->")
            start_str = time_parts[0].strip().split()[-1]
            end_raw = time_parts[1].strip().split(None, 1)
            end_str = end_raw[0].strip()
            text_lines = []
            if len(end_raw) > 1 and end_raw[1].strip():
                text_lines.append(end_raw[1].strip())
            
            i += 1
            while i < len(lines):
                cur_l = lines[i].strip()
                if not cur_l:
                    break
                if "-->" in cur_l:
                    break
                if cur_l.isdigit() and i + 1 < len(lines) and "-->" in lines[i+1]:
                    break
                text_lines.append(cur_l)
                i += 1
            
            text_block = " ".join(text_lines)
            matches.append(("", start_str, end_str, text_block))
            continue
        i += 1

    segments = []

    for idx, start_str, end_str, text_block in matches:
        try:
            start_sec = _parse_srt_timestamp(start_str)
            end_sec = _parse_srt_timestamp(end_str)
        except Exception as ex:
            logger.warning(f"Could not parse timestamps '{start_str}' -> '{end_str}': {ex}")
            continue

        cleaned_text = re.sub(r'<[^>]+>', '', text_block).strip()  # remove HTML tags
        cleaned_text = " ".join(cleaned_text.split())  # normalize whitespaces

        if not cleaned_text or end_sec <= start_sec:
            continue

        words_raw = cleaned_text.split()
        if not words_raw:
            continue

        words_data = distribute_words_in_timespan(words_raw, start_sec, end_sec)

        seg = {
            "id": len(segments),
            "start": round(start_sec, 3),
            "end": round(end_sec, 3),
            "text": cleaned_text,
            "words": words_data
        }
        segments.append(seg)

    # Secondary check: Apply split_long_segment_data if any segment still exceeds 8 words
    try:
        from backend.acoustic_aligner import split_long_segment_data
        final_segments = []
        for seg in segments:
            split_list = split_long_segment_data(seg, max_words=8, max_chars=38, max_duration=5.5)
            final_segments.extend(split_list)
        for i, s in enumerate(final_segments):
            s["id"] = i
        return final_segments
    except Exception as e:
        logger.warning(f"split_long_segment_data fallback: {e}")
        return segments


def segments_to_srt(segments: List[Dict[str, Any]]) -> str:
    """Converts segments list to standard SubRip (.srt) format."""
    lines = []
    for i, seg in enumerate(segments, 1):
        s_sec = seg["start"]
        e_sec = seg["end"]

        s_h = int(s_sec // 3600)
        s_m = int((s_sec % 3600) // 60)
        s_s = int(s_sec % 60)
        s_ms = int(round((s_sec - int(s_sec)) * 1000))

        e_h = int(e_sec // 3600)
        e_m = int((e_sec % 3600) // 60)
        e_s = int(e_sec % 60)
        e_ms = int(round((e_sec - int(e_sec)) * 1000))

        start_str = f"{s_h:02d}:{s_m:02d}:{s_s:02d},{s_ms:03d}"
        end_str = f"{e_h:02d}:{e_m:02d}:{e_s:02d},{e_ms:03d}"

        lines.append(f"{i}\n{start_str} --> {end_str}\n{seg['text']}\n")

    return "\n".join(lines)


def analyze_media_with_gemini(
    media_path: str,
    idea_prompt: str = "",
    custom_lyrics: str = "",
    model_name: Optional[str] = None,
    api_key: Optional[str] = None,
    progress_callback = None
) -> Dict[str, Any]:
    """
    Uploads audio or video to Gemini File API, analyzes speech/visuals with Gemini 2.5 Flash / 3.7 Flash,
    and returns standardized SRT string and segments.
    """
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        raise RuntimeError("Thư viện google-genai chưa được cài đặt. Vui lòng chạy: pip install google-genai")

    config = get_gemini_config()
    final_key = (api_key or config.get("gemini_api_key") or "").strip()

    if not final_key:
        raise ValueError(
            "Chưa cấu hình Gemini API Key! Vui lòng vào Cài Đặt và nhập API Key của bạn (miễn phí tại Google AI Studio: https://aistudio.google.com/)."
        )

    target_model = (model_name or config.get("gemini_model") or "gemini-2.5-flash").strip()

    client = genai.Client(api_key=final_key)

    p_media = Path(media_path)
    if not p_media.exists():
        raise FileNotFoundError(f"Không tìm thấy file phương tiện: {media_path}")

    if progress_callback:
        progress_callback(10, "⚡ Đang tải video/âm thanh lên Google Gemini Cloud...")

    logger.info(f"Uploading {p_media.name} ({p_media.stat().st_size / (1024*1024):.2f} MB) to Gemini...")
    file_ref = client.files.upload(file=str(p_media))
    logger.info(f"Uploaded file name: {file_ref.name}, initial state: {file_ref.state.name}")

    try:
        # Wait until file is ACTIVE (important for video files)
        max_wait = 180  # 3 minutes max
        elapsed = 0
        while file_ref.state.name == "PROCESSING" and elapsed < max_wait:
            time.sleep(2)
            elapsed += 2
            file_ref = client.files.get(name=file_ref.name)
            if progress_callback:
                progress_callback(min(25, 10 + int(elapsed / 4)), "Google Gemini đang tiền xử lý video...")

        if file_ref.state.name == "FAILED":
            raise RuntimeError("Google Gemini báo lỗi khi phân tích định dạng tệp đa phương tiện này.")

        if progress_callback:
            progress_callback(30, "🧠 Gemini AI đang lắng nghe và phân tích nhịp bài hát...")

        system_instruction = (
            "You are an expert audio-visual transcriber and professional karaoke lyricist.\n"
            "Your task is to accurately transcribe and align the sung lyrics from the provided media, "
            "with precise timestamps in standard SubRip (.srt) subtitle format.\n\n"
            "Strict rules to obey:\n"
            "1. FORMAT: Return ONLY valid SubRip (.srt) format text. Start directly with '1' and timestamps. "
            "Do NOT include conversational chatter or markdown fences if possible (or use ```srt).\n"
            "2. TIMESTAMPS: Use standard 00:00:00,000 --> 00:00:00,000 format. Start and end timestamps must strictly match when the singer is actively singing each phrase.\n"
            "3. NO EMPTY GAPS OR INTRO/OUTRO: Absolute silence policy. Do NOT output any subtitle cues for musical intros, guitar solos, EDM drops, instrumental interludes, or spoken outro chatter. "
            "A subtitle must ONLY appear when the singer is vocalizing words, and MUST end immediately when the sung phrase stops.\n"
            "4. CONCISE KARAOKE PHRASES: Each subtitle cue MUST have between 4 to 8 words (ideally 5-7 words, standard Vietnamese poetic meter). "
            "If a sentence is longer than 8 words, split it naturally into two separate consecutive subtitle cues.\n"
            "5. HANDLE REPETITIONS: In songs (especially AI songs like Suno/Udio), chorus or verses may be sung repeatedly. "
            "Generate distinct, chronological subtitle cues for EVERY repetition at its exact singing time.\n"
            "6. ACCURACY: If lyrics are provided, prioritize the exact spelling and words provided, aligning them to the true vocal audio."
        )

        user_content_parts = [file_ref]
        instructions = []

        cleaned_input_lyrics = clean_suno_lyrics(custom_lyrics) if custom_lyrics else ""

        if cleaned_input_lyrics and cleaned_input_lyrics.strip():
            instructions.append(
                f"ĐÂY LÀ LỜI BÀI HÁT GỐC ĐÃ ĐƯỢC LÀM SẠCH (OFFICIAL / SUNO AI LYRICS):\n\"\"\"\n{cleaned_input_lyrics.strip()}\n\"\"\"\n\n"
                "QUY TẮC BẮT BUỘC:\n"
                "1. Hãy khớp CHÍNH XÁC các câu từ lời bài hát trên vào thời điểm ca sĩ thực tế hát trong audio/video.\n"
                "2. CHỈ tạo mốc thời gian khi ca sĩ ĐANG THỰC SỰ HÁT câu đó. BỎ QUA toàn bộ các đoạn nhạc dạo đầu, dạo giữa bài, solo nhạc cụ, và nhạc dạo kết thúc (TUYỆT ĐỐI KHÔNG xuất subtitle trong đoạn chỉ có nhạc không có lời!).\n"
                "3. XỬ LÝ ĐOẠN ĐIỆP KHÚC / LẶP LẠI: Nếu ca sĩ hát lặp lại một câu hoặc một khổ nhiều lần (rất phổ biến trong nhạc Suno), hãy tạo mốc thời gian riêng cho TỪNG LẦN HÁT theo thứ tự thời gian trong bài.\n"
                "4. Nếu trong lời bài hát trên có câu/đoạn mà bản nhạc này KHÔNG HÁT (bị ca sĩ cắt bớt), hãy BỎ QUA những câu đó, KHÔNG được tự ý gán vào các đoạn nhạc dạo.\n"
                "5. Mỗi dòng phụ đề từ 4 đến tối đa 8 từ để hiển thị chuẩn màn hình Karaoke 2 dòng."
            )

        if idea_prompt and idea_prompt.strip():
            instructions.append(f"Yêu cầu / Ý tưởng bổ sung từ người dùng:\n\"{idea_prompt.strip()}\"")
        elif not cleaned_input_lyrics:
            instructions.append(
                "Hãy phân tích bài hát/video này và tạo ra phụ đề karaoke chuẩn .srt "
                "(chỉ chứa lời hát thực tế, mốc thời gian chuẩn xác, mỗi câu 4-8 từ. Bỏ qua hoàn toàn các đoạn nhạc dạo đầu/giữa/kết không có lời)."
            )

        user_content_parts.append("\n\n".join(instructions))

        logger.info(f"Calling Gemini ({target_model}) generate_content...")
        response = client.models.generate_content(
            model=target_model,
            contents=user_content_parts,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.2,
            )
        )

        raw_text = response.text or ""
        logger.info(f"Gemini responded with {len(raw_text)} characters")

        # Strip markdown ```srt code blocks if present
        cleaned_srt = re.sub(r"^```(?:srt)?\s*", "", raw_text.strip(), flags=re.IGNORECASE)
        cleaned_srt = re.sub(r"\s*```$", "", cleaned_srt.strip())

        if not cleaned_srt:
            raise RuntimeError("Gemini không trả về kết quả lời bài hát nào.")

        if progress_callback:
            progress_callback(40, "🎯 Chuẩn hóa cấu trúc câu & phân giải nhịp phụ đề...")

        segments = parse_srt_to_karaoke_segments(cleaned_srt)
        if not segments:
            raise ValueError(f"Không thể phân tích cấu trúc SRT từ phản hồi của Gemini:\n{cleaned_srt[:300]}")

        # Re-generate standardized SRT from normalized segments
        standardized_srt = segments_to_srt(segments)

        return {
            "status": "success",
            "model": target_model,
            "srt_text": standardized_srt,
            "raw_srt": cleaned_srt,
            "segments": segments,
            "segment_count": len(segments),
            "idea_prompt": idea_prompt
        }

    finally:
        # Always clean up uploaded file in Google Cloud
        try:
            client.files.delete(name=file_ref.name)
            logger.info(f"Cleaned up remote file {file_ref.name} from Gemini Cloud")
        except Exception as e:
            logger.warning(f"Could not delete remote file {file_ref.name}: {e}")
