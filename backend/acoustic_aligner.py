import re
import difflib
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

def clean_text_for_matching(text: str) -> str:
    """Normalizes text for fuzzy alignment (lowercase, no punctuation)."""
    text = text.lower()
    text = re.sub(r"[^\w\s]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text

def split_long_segment_data(seg: Dict[str, Any], max_words: int = 5, max_duration: float = 3.2) -> List[Dict[str, Any]]:
    """Recursively splits a segment into concise 4-5 word sub-segments."""
    words = seg.get("words", [])
    num_words = len(words)
    dur = seg.get("end", 0) - seg.get("start", 0)

    if num_words <= max_words and dur <= max_duration:
        return [seg]

    if num_words < 4:
        return [seg]

    # Find best split point (punctuation near middle or natural midpoint)
    split_idx = num_words // 2
    for i in range(max(1, int(num_words * 0.3)), min(num_words - 1, int(num_words * 0.7) + 1)):
        w_text = words[i].get("word", "")
        if any(w_text.endswith(p) for p in [",", ".", ";", "-", "!", "?"]):
            split_idx = i + 1
            break
        # Or check silence gap
        if i < num_words - 1:
            gap = words[i+1].get("start", 0) - words[i].get("end", 0)
            if gap >= 0.15:
                split_idx = i + 1
                break

    words_a = words[:split_idx]
    words_b = words[split_idx:]

    if not words_a or not words_b:
        return [seg]

    seg_a = {
        "id": seg.get("id", 0),
        "start": words_a[0]["start"],
        "end": words_a[-1]["end"],
        "text": " ".join(w["word"] for w in words_a),
        "words": words_a
    }
    seg_b = {
        "id": seg.get("id", 0),
        "start": words_b[0]["start"],
        "end": words_b[-1]["end"],
        "text": " ".join(w["word"] for w in words_b),
        "words": words_b
    }

    results = []
    results.extend(split_long_segment_data(seg_a, max_words, max_duration))
    results.extend(split_long_segment_data(seg_b, max_words, max_duration))
    return results


def chunk_line_words(text: str, max_words: int = 5) -> List[str]:
    """Splits a lyric sentence into concise 3-5 word karaoke phrases."""
    words = text.split()
    if len(words) <= max_words:
        return [text]

    for delim in [",", " - ", ";", "/", ".", " — ", "!", "?"]:
        if delim in text:
            parts = [p.strip() for p in text.split(delim) if p.strip()]
            if len(parts) >= 2 and all(len(p.split()) >= 2 for p in parts):
                res = []
                for p in parts:
                    res.extend(chunk_line_words(p, max_words))
                return res

    num_chunks = max(2, (len(words) + max_words - 1) // max_words)
    chunk_size = (len(words) + num_chunks - 1) // num_chunks
    chunks = []
    for i in range(0, len(words), chunk_size):
        chunk_words = words[i:i+chunk_size]
        if chunk_words:
            chunks.append(" ".join(chunk_words))
    return chunks


def align_lyrics_with_vocal_audio(
    official_lyric_lines: List[str],
    whisper_vocal_segments: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Aligns clean/official lyrics text to the ACTUAL acoustic timestamps 
    detected by Whisper AI on the isolated vocal stem.
    """
    if not whisper_vocal_segments:
        logger.warning("No vocal segments detected in audio.")
        return []

    # If no official lyrics, return whisper segments with 4-5 word splitting
    if not official_lyric_lines:
        res = []
        for s in whisper_vocal_segments:
            res.extend(split_long_segment_data(s, max_words=5, max_duration=3.2))
        for idx, s in enumerate(res):
            s["id"] = idx
        return res

    clean_official = [l.strip() for l in official_lyric_lines if l.strip()]
    if not clean_official:
        res = []
        for s in whisper_vocal_segments:
            res.extend(split_long_segment_data(s, max_words=5, max_duration=3.2))
        for idx, s in enumerate(res):
            s["id"] = idx
        return res

    # Split lines into concise 4-5 word phrases
    expanded_official = []
    for raw_line in clean_official:
        expanded_official.extend(chunk_line_words(raw_line, max_words=5))

    aligned_segments = []
    
    # Flatten whisper words with acoustic timestamps
    all_whisper_words = []
    for seg in whisper_vocal_segments:
        for w in seg.get("words", []):
            if w.get("word", "").strip():
                all_whisper_words.append(w)

    w_idx = 0
    total_w = len(all_whisper_words)

    for line_idx, line in enumerate(expanded_official):
        line_words = line.split()
        num_words = len(line_words)
        
        if num_words == 0:
            continue

        # Find best matching window in acoustic vocal words
        if w_idx < total_w:
            matched_start = all_whisper_words[w_idx]["start"]
            
            # Advance cursor by number of words
            end_w_idx = min(total_w - 1, w_idx + num_words - 1)
            matched_end = all_whisper_words[end_w_idx]["end"]
            w_idx = min(total_w, end_w_idx + 1)
        else:
            # Fallback for remaining lines: extrapolate from last end
            last_end = aligned_segments[-1]["end"] if aligned_segments else 0.0
            matched_start = last_end + 1.0
            matched_end = matched_start + max(2.0, num_words * 0.4)

        if matched_end <= matched_start:
            matched_end = matched_start + max(1.5, num_words * 0.35)

        # Distribute word timestamps across actual acoustic span
        total_dur = matched_end - matched_start
        dur_per_word = max(0.08, total_dur / num_words)

        words_data = []
        for word_i, word_text in enumerate(line_words):
            w_s = round(matched_start + word_i * dur_per_word, 3)
            w_e = round(min(matched_end, w_s + dur_per_word), 3)
            words_data.append({
                "word": word_text,
                "start": w_s,
                "end": w_e,
                "probability": 1.0
            })

        aligned_segments.append({
            "id": line_idx,
            "start": round(matched_start, 3),
            "end": round(matched_end, 3),
            "text": line,
            "words": words_data
        })

    return aligned_segments
