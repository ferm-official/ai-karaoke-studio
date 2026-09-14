import re
import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

def parse_lrc_to_segments(lrc_text: str) -> List[Dict[str, Any]]:
    """Parses standard/enhanced LRC text into structured segments with word timestamps."""
    lines = lrc_text.strip().split("\n")
    lrc_entries = []
    pattern = re.compile(r"\[(\d{1,2}):(\d{2})[.:,](\d{2,3})\](.*)")

    for line in lines:
        line_clean = line.strip()
        if not line_clean:
            continue
        m = pattern.match(line_clean)
        if m:
            min_val = int(m.group(1))
            sec_val = int(m.group(2))
            ms_str = m.group(3)
            ms_val = int(ms_str) * 10 if len(ms_str) == 2 else int(ms_str[:3])
            total_sec = min_val * 60 + sec_val + ms_val / 1000.0
            text = m.group(4).strip()
            # Clean parenthesized backing vocal annotations, e.g. "(đi tìm theo học đàn)" or "[hát 2 lần]"
            text = re.sub(r"\(.*?\)", "", text)
            text = re.sub(r"\[.*?\]", "", text)
            text = re.sub(r"\s+", " ", text).strip()
            if text:
                lrc_entries.append({"time": round(total_sec, 3), "text": text})

    lrc_entries.sort(key=lambda x: x["time"])
    segments = []

    for i, entry in enumerate(lrc_entries):
        start = entry["time"]
        if i + 1 < len(lrc_entries):
            end = round(min(lrc_entries[i+1]["time"] - 0.15, start + 6.0), 3)
        else:
            end = round(start + 4.5, 3)

        if end <= start:
            end = round(start + 2.0, 3)

        words = entry["text"].split()
        total_dur = end - start
        dur_per_word = max(0.08, total_dur / max(1, len(words)))
        
        words_data = []
        for w_idx, w in enumerate(words):
            w_start = round(start + w_idx * dur_per_word, 3)
            w_end = round(min(end, w_start + dur_per_word), 3)
            words_data.append({
                "word": w,
                "start": w_start,
                "end": w_end,
                "probability": 1.0
            })

        segments.append({
            "id": i,
            "start": start,
            "end": end,
            "text": entry["text"],
            "words": words_data
        })

    return segments


def parse_srt_to_segments(srt_text: str) -> List[Dict[str, Any]]:
    """Parses user-pasted SRT format into structured segments with word timestamps."""
    blocks = srt_text.strip().replace("\r\n", "\n").split("\n\n")
    time_pat = re.compile(r"(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})")
    segments = []
    seg_idx = 0

    for block in blocks:
        lines = [l.strip() for l in block.split("\n") if l.strip()]
        if len(lines) >= 2:
            time_match = None
            text_lines = []
            for l in lines:
                m = time_pat.search(l)
                if m:
                    time_match = m
                elif not l.isdigit():
                    text_lines.append(l)

            if time_match and text_lines:
                g = [int(x) for x in time_match.groups()]
                start_sec = g[0]*3600 + g[1]*60 + g[2] + g[3]/1000.0
                end_sec = g[4]*3600 + g[5]*60 + g[6] + g[7]/1000.0
                
                full_text = " ".join(text_lines)
                full_text = re.sub(r"\(.*?\)", "", full_text)
                full_text = re.sub(r"\[.*?\]", "", full_text)
                full_text = re.sub(r"\s+", " ", full_text).strip()
                if not full_text:
                    continue
                words = full_text.split()
                from backend.gemini_service import distribute_words_in_timespan
                words_data = distribute_words_in_timespan(words, start_sec, end_sec)

                segments.append({
                    "id": seg_idx,
                    "start": round(start_sec, 3),
                    "end": round(end_sec, 3),
                    "text": full_text,
                    "words": words_data
                })
                seg_idx += 1

    try:
        from backend.acoustic_aligner import split_long_segment_data
        split_segments = []
        for s in segments:
            split_segments.extend(split_long_segment_data(s, max_words=8, max_chars=38, max_duration=5.5))
        for idx, s in enumerate(split_segments):
            s["id"] = idx
        return split_segments
    except Exception:
        return segments
