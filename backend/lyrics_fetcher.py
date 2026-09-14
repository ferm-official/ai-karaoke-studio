import os
import re
import json
import logging
import urllib.request
import urllib.parse
from typing import Dict, Any, Optional, Tuple, List

logger = logging.getLogger(__name__)

def clean_song_title(raw_title: str) -> str:
    """
    Cleans raw video/file titles to extract pure song title and artist.
    Examples:
    - 'SƠN TÙNG M-TP | ĐỪNG LÀM TRÁI TIM ANH ĐAU | OFFICIAL MUSIC VIDEO' -> 'SƠN TÙNG M-TP - ĐỪNG LÀM TRÁI TIM ANH ĐAU'
    - '01. Cắt Đôi Nỗi Sầu - Tăng Duy Tân (Cover by Hương Ly) [320kbps].mp3' -> 'Cắt Đôi Nỗi Sầu - Tăng Duy Tân'
    - 'y2mate.com - Waiting For You - MONO.mp3' -> 'Waiting For You - MONO'
    """
    t = raw_title.strip()

    # Remove file extensions
    t = re.sub(r"\.(mp3|wav|m4a|flac|aac|mp4|webm|ogg)$", "", t, flags=re.I)

    # Remove common downloader prefixes
    t = re.sub(r"^(y2mate\.com|snapsave\.app|savefrom|tikmate|x2download)[_\s\-]+", "", t, flags=re.I)

    # Remove leading track numbering (e.g. '01. ', '1 - ', '01_')
    t = re.sub(r"^\d+[\s._\-]+", "", t)

    # Replace fancy vertical bars or dashes with standard dash
    t = t.replace("｜", "-").replace("|", "-").replace("—", "-").replace("–", "-")

    # Remove any brackets containing video, audio, or TikTok / live show noise
    bracket_noise = (
        r"\[[^\]]*(karaoke|beat|instrumental|remake|tone\s*nam|tone\s*nữ|acoustic|phối\s*khí|official|music\s*video|\bmv\b|audio|lyric|video|visualizer|hq|hd|4k|320kbps|lossless|tiktok|trend|hot|sped\s*up|speed\s*up|remix|asia\s*\d+|pbn\s*\d+|paris\s*by\s*night|thúy\s*nga|thuý\s*nga|liveshow)[^\]]*\]|"
        r"\([^)]*(karaoke|beat|instrumental|remake|tone\s*nam|tone\s*nữ|acoustic|phối\s*khí|official|music\s*video|\bmv\b|audio|lyric|video|visualizer|hq|hd|4k|320kbps|lossless|cover|live|tiktok|trend|hot|sped\s*up|speed\s*up|remix|slowed|nightcore|ringtone|chuông|asia\s*\d+|pbn\s*\d+|paris\s*by\s*night|thúy\s*nga|thuý\s*nga|liveshow)[^)]*\)"
    )
    t = re.sub(bracket_noise, "", t, flags=re.I)

    # Remove standalone keywords
    for kw in [
        r"\bkaraoke\b", r"\bbeat\b", r"\binstrumental\b", r"\bremake\b",
        r"\btone\s*nam\b", r"\btone\s*nữ\b", r"\bacoustic\b", r"\bphối\s*khí\b",
        r"\bai\s+cover\b", r"\bcover\b", r"\b4k\b", r"\bhd\b", r"\bhq\b",
        r"official\s+music\s+video", r"official\s+mv", r"official\s+audio",
        r"lyric(s)?\s+video", r"live\s+at\s+[^\-]+", r"full\s+audio",
        r"karaoke\s+beat", r"beat\s+chuẩn", r"beat\s+karaoke",
        r"hot\s+tiktok", r"trend\s+tiktok", r"nhạc\s+tiktok", r"nhạc\s+hot\s+tiktok",
        r"tiktok\s+remix", r"remix\s+tiktok", r"sped\s+up", r"speed\s+up",
        r"nhạc\s+chuông", r"ringtone",
        r"\basia\s*\d+\b", r"\bpbn\s*\d+\b", r"\bparis\s+by\s+night(\s*\d+)?\b",
        r"\bthúy\s+nga\b", r"\bthuý\s+nga\b", r"\bliveshow\b"
    ]:
        t = re.sub(kw, "", t, flags=re.I)

    # Clean empty brackets if any remained
    t = re.sub(r"\(\s*\)|\[\s*\]", "", t)
    t = re.sub(r"\s+", " ", t).strip()
    t = re.sub(r"\s*-\s*-+\s*", " - ", t)

    # Filter out pure noise segments separated by dashes, e.g. "Say một đời vì em - AI Cover - 4K"
    if " - " in t:
        parts = [p.strip() for p in t.split(" - ") if p.strip()]
        valid_parts = []
        for p in parts:
            p_test = re.sub(r"^(ai\s+cover|cover|4k|hd|hq|audio|video|mv|official|lossless|remix|karaoke|beat|instrumental|remake|\+)$", "", p, flags=re.I).strip()
            if p_test:
                valid_parts.append(p)
        if valid_parts:
            t = " - ".join(valid_parts)

    t = t.strip(" -_|#+")
    return t or raw_title.strip()


VIETNAMESE_DIACRITICS_RE = re.compile(
    r"[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]",
    re.IGNORECASE
)

COMMON_VIETNAMESE_WORDS = {
    "anh", "em", "yeu", "thuong", "nho", "say", "doi", "vi", "khong", "nguoi",
    "tinh", "ta", "mua", "dem", "ngay", "cho", "ve", "mot", "hai", "ba", "bon",
    "nam", "chuyen", "qua", "co", "la", "de", "minh", "nhau", "nay", "duong", "loi"
}

def is_likely_vietnamese(text: str) -> bool:
    """Checks if text contains Vietnamese diacritics or characteristic syllables."""
    if not text:
        return False
    if VIETNAMESE_DIACRITICS_RE.search(text):
        return True
    cleaned_words = set(re.sub(r"[^\w\s]", "", text.lower()).split())
    if len(cleaned_words.intersection(COMMON_VIETNAMESE_WORDS)) >= 2:
        return True
    return False


def detect_text_language(text: str) -> str:
    """Detects primary language of lyrics text based on unique character sets."""
    if not text:
        return "vi"

    if is_likely_vietnamese(text):
        return "vi"

    # Chinese characters
    if re.search(r"[\u4e00-\u9fff]", text):
        return "zh"

    # Japanese Hiragana / Katakana
    if re.search(r"[\u3040-\u30ff]", text):
        return "ja"

    # Korean Hangul
    if re.search(r"[\uac00-\ud7af]", text):
        return "ko"

    return "en"


import subprocess

def get_audio_file_duration(file_path: str) -> float:
    """Uses ffprobe to quickly extract the exact duration of an audio file in seconds."""
    if not file_path or not os.path.exists(file_path):
        return 0.0
    try:
        cmd = [
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            file_path
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
        if res.returncode == 0 and res.stdout.strip():
            return float(res.stdout.strip())
    except Exception as e:
        logger.debug(f"ffprobe duration probe error: {e}")
    return 0.0


TIKTOK_CLIP_PATTERNS = [
    r"\btik\s*tok\b",
    r"\bdouyin\b",
    r"\bsped\s*up\b",
    r"\bspeed\s*up\b",
    r"\bslowed\b",
    r"\bnightcore\b",
    r"\breverb\b",
    r"\bshort\s*(ver(sion)?)?\b",
    r"\bsnippet\b",
    r"\bteaser\b",
    r"\bringtone\b",
    r"\bchuông\b",
    r"\bnhạc\s*chuông\b",
    r"\bedit\b",
    r"\btrend\b"
]

def is_repetitive_loop_lyrics(synced_lyrics: str) -> bool:
    """Detects if a lyrics candidate is just a short 4-8 line verse looped repeatedly (common in lofi/tiktok cuts)."""
    if not synced_lyrics:
        return False
    lines = [re.sub(r"^\[.*?\]\s*", "", l).strip().lower() for l in synced_lyrics.splitlines() if re.sub(r"^\[.*?\]\s*", "", l).strip()]
    if len(lines) >= 12:
        for chunk_len in [4, 6, 8]:
            if len(lines) >= chunk_len * 3:
                b1 = lines[:chunk_len]
                b2 = lines[chunk_len:chunk_len*2]
                b3 = lines[chunk_len*2:chunk_len*3]
                if b1 == b2 and b2 == b3:
                    return True
    return False


def titles_match_query(candidate_title: str, query_clean: str) -> bool:
    """Ensures online lyrics candidate title actually relates to query title."""
    if not candidate_title or not query_clean:
        return False
    c_norm = re.sub(r"[^\w\s]", "", candidate_title.lower()).strip()
    q_norm = re.sub(r"[^\w\s]", "", query_clean.lower()).strip()
    c_words = set(c_norm.split())
    q_words = set(q_norm.split())
    noise = {"cover", "ai", "4k", "hd", "hq", "audio", "video", "mv", "remix", "karaoke", "beat", "official"}
    c_words -= noise
    q_words -= noise
    if not c_words or not q_words:
        return False
    # If any significant words match
    overlap = c_words.intersection(q_words)
    if len(overlap) >= 1 and (len(overlap) / len(q_words) >= 0.3 or len(overlap) / len(c_words) >= 0.3):
        return True
    from difflib import SequenceMatcher
    return SequenceMatcher(None, c_norm, q_norm).ratio() >= 0.38


def is_unwanted_karaoke_item(item: Dict[str, Any], query_clean: str, target_dur: float = 0.0) -> Tuple[bool, str]:
    """
    Identifies and rejects non-karaoke versions:
    - TikTok cuts / soundbites
    - Sped-up, slowed+reverb, nightcore
    - Short edits / ringtones / snippets
    - Unsolicited remixes or lofi cuts (unless query specifically requests a remix/lofi)
    - Repetitive verse loops (e.g. chillhop looping verse 1 multiple times)
    - Truncated audio (< 110s or < 135s when target audio is full length)
    """
    track = (item.get("trackName") or "").lower()
    album = (item.get("albumName") or "").lower()
    artist = (item.get("artistName") or "").lower()
    full_meta = f"{track} {album} {artist}"
    dur = float(item.get("duration") or 0.0)

    # 0. Relevance check: Candidate track name MUST be related to user query!
    if not titles_match_query(track, query_clean):
        return True, f"Track title '{track}' does not match query title '{query_clean}'"

    # 1. Any TikTok / sped-up / short cut keywords
    for pat in TIKTOK_CLIP_PATTERNS:
        if re.search(pat, full_meta, re.I):
            return True, f"TikTok / Sped-up / Short edit detected ('{pat}')"

    # 2. Unsolicited remix or lofi check: if user didn't write 'remix' or 'lofi' in query, reject remixes & lofi cuts
    query_lower = query_clean.lower()
    user_explicitly_wants_remix = any(k in query_lower for k in ["remix", "vinahouse", "house", "mashup", "dj", "lofi", "lo-fi", "chill"])
    if not user_explicitly_wants_remix:
        if re.search(r"\b(remix|remixed|vinahouse|house\s*remix|dj\s*remix|lofi|lo-fi|chill|chillhop)\b", full_meta, re.I):
            return True, "Unsolicited remix/lofi version (user requested standard karaoke)"

    # 3. Repetitive looped verse check (e.g. lofi loop repeating verse 1 over and over)
    synced = item.get("syncedLyrics") or ""
    if synced and is_repetitive_loop_lyrics(synced):
        return True, "Repetitive looped verse detected (lofi/loop cut, not authentic full lyrics)"

    # 4. Truncated duration check: standard karaoke songs are at least 2.5 - 3 minutes (150s+)
    if dur > 0:
        if dur < 110.0 and (target_dur == 0 or target_dur >= 130.0):
            return True, f"Duration too short for karaoke song ({dur:.0f}s < 110s)"
        if target_dur >= 140.0 and dur < 135.0:
            return True, f"Truncated clip ({dur:.0f}s vs target {target_dur:.0f}s)"

    # 5. Low line count check (full songs have >= 12 lines)
    synced = item.get("syncedLyrics") or ""
    plain = item.get("plainLyrics") or ""
    lines_count = len(synced.splitlines()) if synced else len(plain.splitlines())
    if lines_count > 0 and lines_count < 12 and (target_dur == 0 or target_dur >= 120.0):
        return True, f"Too few lyric lines ({lines_count} lines)"

    return False, "OK"


def score_lrclib_item(item: Dict[str, Any], target_dur: float, query_clean: str, preferred_artist: str = "") -> float:
    """
    Ranks lyrics candidates:
    1. Rewards complete songs with both Lời 1 & Lời 2 (high line count & late synced timestamp).
    2. Severely penalizes shortened cuts / TikTok clips (duration mismatch > 45s).
    3. Rewards matching audio file duration (within ±15s).
    """
    score = 0.0
    synced = item.get("syncedLyrics") or ""
    plain = item.get("plainLyrics") or ""
    item_dur = float(item.get("duration") or 0.0)

    if synced:
        score += 20.0
    if plain:
        score += 10.0

    # Synced coverage (last timestamp in seconds)
    last_sec = 0.0
    if synced:
        time_matches = re.findall(r"\[(\d{2}):(\d{2})\.(\d{2,3})\]", synced)
        if time_matches:
            last_m, last_s, _ = time_matches[-1]
            last_sec = int(last_m) * 60 + int(last_s)
            score += min(35.0, (last_sec / 240.0) * 35.0)

    # Line count bonus: full songs typically have 45-90 lines
    num_lines = len(synced.splitlines()) if synced else len(plain.splitlines())
    score += min(20.0, (num_lines / 60.0) * 20.0)

    # Duration comparison
    if target_dur > 0 and item_dur > 0:
        dur_diff = abs(item_dur - target_dur)
        if dur_diff <= 8.0:
            score += 55.0  # Outstanding match!
        elif dur_diff <= 20.0:
            score += 35.0
        elif dur_diff <= 40.0:
            score += 15.0
        elif dur_diff > 60.0:
            score -= 50.0  # Penalize shortened cuts, TikTok clips, truncated verses
    elif target_dur == 0:
        # Standard pop song length preference
        if 170.0 <= item_dur <= 320.0:
            score += 25.0
        elif item_dur < 135.0:
            score -= 35.0

    # Artist match bonus
    cand_artist = (item.get("artistName") or "").lower()
    if preferred_artist:
        pref = preferred_artist.lower().strip()
        if pref and (pref in cand_artist or cand_artist in pref):
            score += 60.0
    if " - " in query_clean:
        parts = [p.strip().lower() for p in query_clean.split(" - ") if p.strip()]
        for p in parts:
            if len(p) >= 3 and (p in cand_artist or cand_artist in p):
                score += 50.0
                break
    elif query_clean.lower() in cand_artist:
        score += 25.0

    # Heavy penalties for TikTok, sped-up, or unsolicited remixes
    track = (item.get("trackName") or "").lower()
    album = (item.get("albumName") or "").lower()
    full_meta = f"{track} {album}"
    for pat in TIKTOK_CLIP_PATTERNS:
        if re.search(pat, full_meta, re.I):
            score -= 80.0
            break

    query_lower = query_clean.lower()
    if not any(k in query_lower for k in ["remix", "vinahouse", "house", "mashup"]):
        if re.search(r"\b(remix|remixed|vinahouse|house\s*remix)\b", full_meta, re.I):
            score -= 45.0

    return score


def fetch_online_lyrics(query: str, artist: str = "", target_duration: float = 0.0) -> Dict[str, Any]:
    """
    Searches for synchronized or plain text lyrics from LRCLIB open community API.
    Filters out TikTok soundbites and short remixes to ensure authentic full-length karaoke lyrics.
    """
    clean_q = clean_song_title(query)
    if not clean_q:
        return {"status": "not_found", "message": "Tiêu đề bài hát trống"}

    # Auto-extract artist from clean_q if not provided
    if not artist and " - " in clean_q:
        parts = [p.strip() for p in clean_q.split(" - ") if p.strip()]
        if len(parts) >= 2 and len(parts[1]) <= 35:
            artist = parts[1]

    logger.info(f"Fetching online lyrics for: '{clean_q}' (Target Duration: {target_duration:.1f}s, Artist: '{artist}')")

    # Try exact clean query first, then variations
    queries_to_try = [clean_q]
    if " - " in clean_q:
        parts = [p.strip() for p in clean_q.split(" - ") if p.strip()]
        if len(parts) >= 2:
            queries_to_try.append(f"{parts[0]} {parts[1]}")
            queries_to_try.append(f"{parts[1]} {parts[0]}")
            queries_to_try.append(parts[1])  # Title only
            queries_to_try.append(parts[0])  # Artist only
        if len(parts) >= 3:
            queries_to_try.append(f"{parts[0]} - {parts[1]}")
            queries_to_try.append(f"{parts[1]} - {parts[0]}")

    for q in queries_to_try:
        try:
            encoded_q = urllib.parse.quote(q)
            api_url = f"https://lrclib.net/api/search?q={encoded_q}"
            req = urllib.request.Request(
                api_url,
                headers={"User-Agent": "LocalAIKaraokeStudio/1.2"}
            )
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status == 200:
                    results = json.loads(response.read().decode("utf-8"))
                    if results and isinstance(results, list):
                        # Filter out TikTok clips, sped-up, and unsolicited remixes
                        karaoke_candidates = []
                        for it in results:
                            rejected, reason = is_unwanted_karaoke_item(it, query_clean=clean_q, target_dur=target_duration)
                            if not rejected:
                                karaoke_candidates.append(it)
                            else:
                                logger.info(f"Filtered out non-karaoke candidate '{it.get('trackName')} - {it.get('artistName')}' ({it.get('duration')}s): {reason}")

                        if not karaoke_candidates:
                            logger.info(f"No title-matched karaoke candidate for '{q}'")
                            continue

                        candidates_to_score = karaoke_candidates

                        sorted_results = sorted(
                            candidates_to_score,
                            key=lambda it: score_lrclib_item(it, target_dur=target_duration, query_clean=clean_q, preferred_artist=artist),
                            reverse=True
                        )
                        best = sorted_results[0]
                        
                        plain_lyrics = best.get("plainLyrics") or ""
                        synced_lyrics = best.get("syncedLyrics") or ""
                        item_dur = float(best.get("duration") or 0.0)

                        # Check if plain is empty but synced exists
                        if not plain_lyrics and synced_lyrics:
                            plain_lines = []
                            for line in synced_lyrics.splitlines():
                                clean_line = re.sub(r"^\[.*?\]\s*", "", line).strip()
                                if clean_line:
                                    plain_lines.append(clean_line)
                            plain_lyrics = "\n".join(plain_lines)

                        # Check if synced lyrics appears prematurely cut off (e.g. only Verse 1)
                        is_synced_truncated = False
                        if synced_lyrics and (target_duration > 0 or item_dur > 0):
                            check_dur = target_duration if target_duration > 0 else item_dur
                            last_sec = 0.0
                            time_matches = re.findall(r"\[(\d{2}):(\d{2})\.(\d{2,3})\]", synced_lyrics)
                            if time_matches:
                                last_m, last_s, _ = time_matches[-1]
                                last_sec = int(last_m) * 60 + int(last_s)
                            if last_sec > 0 and last_sec < check_dur * 0.65:
                                if plain_lyrics and len(plain_lyrics.splitlines()) >= len(synced_lyrics.splitlines()) * 1.3:
                                    logger.warning(f"Synced lyrics cut off early ({last_sec:.1f}s vs {check_dur:.1f}s). Flagging to use full plain lyrics.")
                                    is_synced_truncated = True

                        if plain_lyrics or synced_lyrics:
                            track_name = best.get("trackName") or clean_q
                            artist_name = best.get("artistName") or ""
                            full_title = f"{track_name} - {artist_name}".strip(" -")
                            lang = detect_text_language(plain_lyrics)

                            logger.info(f"Found online lyrics for '{full_title}' (Duration: {item_dur:.1f}s, Language: {lang})")
                            return {
                                "status": "found",
                                "title": track_name,
                                "artist": artist_name,
                                "full_title": full_title,
                                "plain_lyrics": plain_lyrics.strip(),
                                "synced_lyrics": synced_lyrics.strip() if synced_lyrics else None,
                                "is_synced_truncated": is_synced_truncated,
                                "duration": item_dur,
                                "language": lang,
                                "source": "lrclib"
                            }
        except Exception as e:
            logger.debug(f"Search attempt failed for '{q}': {e}")
            continue

    logger.info(f"No online lyrics found for: '{clean_q}'")
    return {
        "status": "not_found",
        "query": clean_q,
        "message": f"Không tìm thấy lời bài hát online cho '{clean_q}'"
    }
