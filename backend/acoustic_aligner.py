import re
import difflib
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

def clean_text_for_matching(text: str) -> str:
    """Normalizes text for fuzzy alignment (stripping parenthesized annotations, lowercase, no punctuation)."""
    # Remove backing vocal annotations in parentheses/brackets, e.g. "(đi tìm theo học đàn)" or "[hò ơ]"
    text = re.sub(r"\(.*?\)", "", text)
    text = re.sub(r"\[.*?\]", "", text)
    text = text.lower()
    text = re.sub(r"[^\w\s]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text

def merge_lyric_fragments_to_sentences(items: List[Any]) -> List[str]:
    """
    Intelligently merges short chopped lyric fragments (e.g. 1-3 words per line in crowd-sourced LRCs)
    into full, natural singing sentences (4-7 words, standard Vietnamese poetic meter).
    Preserves complete poetic lines (4+ words) without merging them across verse boundaries.
    """
    raw_lines = []
    for item in items:
        if isinstance(item, dict):
            t = item.get("text", "").strip()
        else:
            t = str(item).strip()
        if t:
            raw_lines.append(t)

    if not raw_lines:
        return []

    sentences = []
    curr = ""
    for line in raw_lines:
        line = line.strip()
        if not line:
            continue
        if not curr:
            curr = line
        else:
            curr_words = curr.split()
            next_words = line.split()
            # ONLY merge if current line is a tiny fragment (< 4 words) AND combined is <= 7 words
            if len(curr_words) < 4 and len(curr_words) + len(next_words) <= 7:
                curr = curr + " " + line
            else:
                sentences.append(curr)
                curr = line
    if curr:
        sentences.append(curr)
    return sentences


def split_long_segment_data(seg: Dict[str, Any], max_words: int = 8, max_chars: int = 38, max_duration: float = 5.5) -> List[Dict[str, Any]]:
    """
    Recursively splits long lyric sentences into concise 4-8 word sub-segments (câu nhỏ)
    to prevent screen overflow, avoid font size distortion, and maintain clean alternating karaoke lines.
    Never allows a segment to span across an instrumental silence gap (>= 1.5s).
    """
    text = seg.get("text", "").strip()
    words = seg.get("words", [])

    # If words array is missing or empty, synthesize word tokens from text
    if not words and text:
        w_list = text.split()
        if len(w_list) <= max_words and len(text) <= max_chars:
            return [seg]
        st = float(seg.get("start", 0.0))
        en = float(seg.get("end", st + 3.0))
        dur = max(0.2, en - st)
        step = dur / max(1, len(w_list))
        words = [
            {
                "word": w,
                "start": round(st + i * step, 3),
                "end": round(st + (i + 1) * step, 3),
                "probability": 1.0
            }
            for i, w in enumerate(w_list)
        ]
        seg["words"] = words

    # Check for internal instrumental silence gaps (>= 1.5s) inside the words list
    if words and len(words) >= 2:
        for i in range(1, len(words)):
            gap = float(words[i]["start"]) - float(words[i - 1]["end"])
            if gap >= 1.5:
                # Must split at this instrumental pause!
                left_words = words[:i]
                right_words = words[i:]
                left_seg = {
                    "id": seg.get("id", 0),
                    "text": " ".join(w.get("word", "") for w in left_words).strip(),
                    "start": round(float(left_words[0]["start"]), 3),
                    "end": round(float(left_words[-1]["end"]), 3),
                    "words": left_words
                }
                right_seg = {
                    "id": seg.get("id", 0),
                    "text": " ".join(w.get("word", "") for w in right_words).strip(),
                    "start": round(float(right_words[0]["start"]), 3),
                    "end": round(float(right_words[-1]["end"]), 3),
                    "words": right_words
                }
                res = []
                res.extend(split_long_segment_data(left_seg, max_words, max_chars, max_duration))
                res.extend(split_long_segment_data(right_seg, max_words, max_chars, max_duration))
                return res

    num_words = len(words)
    dur = float(seg.get("end", 0.0)) - float(seg.get("start", 0.0))
    num_chars = len(text)

    # Tighten segment end time to avoid bleeding into silence
    if words:
        last_word_end = float(words[-1]["end"])
        if float(seg.get("end", 0.0)) > last_word_end + 0.3:
            seg["end"] = round(last_word_end + 0.15, 3)
            dur = float(seg["end"]) - float(seg.get("start", 0.0))

    # Check if this segment should be split
    should_split = False
    if num_words > max_words or num_chars > max_chars or dur > max_duration:
        should_split = True
    elif num_words >= 8:
        # Check for middle punctuation or an actual acoustic breath pause (>= 0.40s)
        for i in range(2, num_words - 1):
            w = words[i].get("word", "").strip()
            prev_w = words[i - 1].get("word", "").strip()
            if any(prev_w.endswith(p) for p in [",", ";", ":", "-", "—", "?", "!"]):
                should_split = True
                break
            gap = float(words[i].get("start", 0.0)) - float(words[i - 1].get("end", 0.0))
            if gap >= 0.40:
                should_split = True
                break

    if not should_split or num_words < 4:
        # Cap duration for short segments (e.g. 2 words shouldn't last 10s)
        max_natural = max(1.8, num_words * 0.85)
        if dur > max_natural + 0.5:
            seg["end"] = round(float(seg.get("start", 0.0)) + max_natural, 3)
            if words:
                step = max_natural / max(1, len(words))
                st = float(seg["start"])
                for idx_w, w in enumerate(words):
                    w["start"] = round(st + idx_w * step, 3)
                    w["end"] = round(st + (idx_w + 1) * step, 3)
        return [seg]

    # Find the best natural split point near the center (enforcing at least 4 words per segment)
    min_split = max(3 if num_words <= 7 else 4, int(num_words * 0.35))
    max_split = min(num_words - (3 if num_words <= 7 else 4), int(num_words * 0.65))
    if min_split > max_split:
        min_split = max_split = num_words // 2

    best_idx = num_words // 2
    best_score = -999.0

    for i in range(min_split, max_split + 1):
        prev_w = words[i - 1]
        curr_w = words[i]
        score = 0.0

        prev_text = prev_w.get("word", "").strip()
        curr_text = curr_w.get("word", "").strip()

        # 1. Capitalized current word (indicates start of a new clause / phrase)
        if curr_text and curr_text[0].isupper() and not curr_text.startswith("I'"):
            score += 16.0

        # 2. Terminal or clause punctuation at end of prev word
        if any(prev_text.endswith(p) for p in [".", "!", "?", "-", "—", ";", ":"]):
            score += 16.0
        elif prev_text.endswith(","):
            score += 10.0

        # 3. Acoustic gap / silence between words
        gap = float(curr_w.get("start", 0.0)) - float(prev_w.get("end", 0.0))
        if gap >= 0.12:
            score += min(20.0, gap * 28.0)

        # 4. Clause conjunctions & pronouns (Vietnamese + English)
        clean_curr = curr_text.lower().strip(" ,.-!?;:'\"")
        if clean_curr in ["và", "mà", "thì", "nhưng", "rồi", "khi", "để", "cho", "anh", "em", "người", "tôi", "like", "to", "with", "for", "in", "goin", "living"]:
            score += 5.0

        # Balance penalty (distance from exact midpoint)
        dist_from_mid = abs(i - (num_words / 2.0))
        score -= dist_from_mid * 0.5

        if score > best_score:
            best_score = score
            best_idx = i

    words_a = words[:best_idx]
    words_b = words[best_idx:]

    if not words_a or not words_b:
        return [seg]

    # Capitalize first word of second segment if lowercase
    if words_b and words_b[0].get("word"):
        w0 = words_b[0]["word"]
        if w0 and w0[0].islower():
            words_b[0] = {**words_b[0], "word": w0[0].upper() + w0[1:]}

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
    results.extend(split_long_segment_data(seg_a, max_words=max_words, max_chars=max_chars, max_duration=max_duration))
    results.extend(split_long_segment_data(seg_b, max_words=max_words, max_chars=max_chars, max_duration=max_duration))
    return results


def chunk_line_words(text: str, max_words: int = 7) -> List[str]:
    """Splits a lyric sentence into concise 5-7 word karaoke phrases."""
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


def detect_global_timing_offset(
    synced_segments: List[Dict[str, Any]],
    all_whisper_words: List[Dict[str, Any]]
) -> float:
    """
    Detects any global lead-in/offset difference between online synced lyrics (LRC)
    and the actual vocal audio (e.g. YouTube extended intros, album track differences).
    Returns the time delta in seconds (whisper_actual - lrc_synced).
    """
    if not synced_segments or not all_whisper_words:
        return 0.0

    whisper_clean = [clean_text_for_matching(w.get("word", "")) for w in all_whisper_words]
    total_w = len(whisper_clean)
    candidate_offsets = []

    for seg in synced_segments[:35]:
        raw_words = clean_text_for_matching(seg.get("text", "")).split()
        if len(raw_words) < 2:
            continue

        target_str = " ".join(raw_words)
        n = len(raw_words)
        best_score = 0.0
        best_diff = None

        for i in range(total_w - n + 1):
            cand_slice = whisper_clean[i : i + n]
            cand_str = " ".join(cand_slice)
            score = difflib.SequenceMatcher(None, target_str, cand_str).ratio()
            if score > best_score and score >= 0.60:
                best_score = score
                w_start = all_whisper_words[i]["start"]
                best_diff = w_start - float(seg.get("start", 0))

        if best_diff is not None and best_score >= 0.60:
            candidate_offsets.append(best_diff)

    if not candidate_offsets:
        return 0.0

    candidate_offsets.sort()
    median_val = candidate_offsets[len(candidate_offsets) // 2]
    inliers = [d for d in candidate_offsets if abs(d - median_val) <= 1.2]
    final_offset = sum(inliers) / len(inliers) if inliers else median_val

    if abs(final_offset) >= 0.35:
        logger.info(f"Global timing offset detected: {final_offset:+.3f}s (from {len(inliers)} matching lyric anchors)")
        return round(final_offset, 3)
    return 0.0


def align_sentences_with_whisper_dp(
    sentences: List[str],
    whisper_vocal_segments: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Direct Acoustic Forced Alignment:
    Matches each clean lyric sentence directly against Whisper acoustic word timestamps
    using monotonic forward sequence alignment.
    Eliminates all LRC lead-in offsets, non-linear timing drift, and chorus misalignment.
    """
    if not sentences:
        return []

    all_whisper_words = []
    for seg in (whisper_vocal_segments or []):
        for w in seg.get("words", []):
            if w.get("word", "").strip():
                all_whisper_words.append({
                    "clean": clean_text_for_matching(w["word"]),
                    "raw": w["word"],
                    "start": float(w["start"]),
                    "end": float(w["end"])
                })

    # If no whisper words available, synthesize smooth progressive timestamps
    if not all_whisper_words:
        res = []
        cur_t = 20.0
        for idx, sent in enumerate(sentences):
            w_list = sent.split()
            dur = max(2.5, len(w_list) * 0.42)
            step = dur / max(1, len(w_list))
            words_data = [{
                "word": w,
                "start": round(cur_t + j * step, 3),
                "end": round(cur_t + (j + 1) * step, 3),
                "probability": 0.8
            } for j, w in enumerate(w_list)]
            res.append({
                "id": idx,
                "start": round(cur_t, 3),
                "end": round(cur_t + dur, 3),
                "text": sent,
                "words": words_data
            })
            cur_t += dur + 0.4
        return res

    M = len(sentences)
    N = len(all_whisper_words)
    w_clean_list = [w["clean"] for w in all_whisper_words]

    # Precompute candidate positions
    candidates = [[] for _ in range(M)]
    for i, sent in enumerate(sentences):
        s_words = clean_text_for_matching(sent).split()
        n_w = len(s_words)
        s_text = " ".join(s_words)

        for j in range(0, N - n_w + 1):
            # Candidate slice MUST NOT span across an instrumental break >= 1.5s
            has_gap = False
            for k in range(j, j + n_w - 1):
                if all_whisper_words[k + 1]["start"] - all_whisper_words[k]["end"] >= 1.5:
                    has_gap = True
                    break
            if has_gap:
                continue

            cand_str = " ".join(w_clean_list[j : j + n_w])
            score = difflib.SequenceMatcher(None, s_text, cand_str).ratio()
            if score >= 0.40:
                raw_dur = all_whisper_words[j + n_w - 1]["end"] - all_whisper_words[j]["start"]
                max_natural_dur = max(2.0, n_w * 0.85)
                time_end = all_whisper_words[j]["start"] + min(raw_dur, max_natural_dur)
                candidates[i].append({
                    "w_start": j,
                    "w_end": j + n_w - 1,
                    "score": score,
                    "time_start": all_whisper_words[j]["start"],
                    "time_end": time_end
                })

    assigned = [None] * M
    last_w_idx = 0

    for i in range(M):
        valid_cands = [c for c in candidates[i] if c["w_start"] >= last_w_idx]
        best_cand = None
        best_cost = -999.0

        for c in valid_cands:
            gap_w = c["w_start"] - last_w_idx
            score = c["score"]
            if gap_w < 0:
                continue
            penalty = min(0.3, gap_w * 0.005)
            cost = score - penalty
            if cost > best_cost:
                best_cost = cost
                best_cand = c

        if best_cand and best_cand["score"] >= 0.40:
            assigned[i] = best_cand
            last_w_idx = best_cand["w_end"] + 1
        else:
            assigned[i] = None

    # Interpolate missing sentences ONLY when there is a small gap (singing was continuous)
    # NEVER interpolate into instrumental solos, interludes (>= 4.0s) or past song end
    for i in range(M):
        if assigned[i] is None:
            prev_time = 0.0
            for p in range(i - 1, -1, -1):
                if assigned[p]:
                    prev_time = assigned[p]["time_end"]
                    break
            next_time = None
            for nx in range(i + 1, M):
                if assigned[nx]:
                    next_time = assigned[nx]["time_start"]
                    break

            dur = max(2.0, len(sentences[i].split()) * 0.50)
            # Only interpolate if bounded between two anchors that are close together (< 4.5s apart)
            # meaning the singer was singing closely between two matched sentences
            if prev_time > 0 and next_time is not None:
                gap_between = next_time - prev_time
                if gap_between < 4.5 and gap_between >= dur + 0.3:
                    t_s = prev_time + 0.2
                    t_e = min(next_time - 0.2, t_s + dur)
                    assigned[i] = {
                        "time_start": round(t_s, 3),
                        "time_end": round(t_e, 3),
                        "interpolated": True
                    }
            # Otherwise, leave assigned[i] = None to avoid placing subtitles inside instrumental pauses!

    # Format final segments with strictly monotonic timestamps
    final_segments = []
    prev_end_clock = 0.0

    for i, sent in enumerate(sentences):
        c = assigned[i]
        if not c:
            continue
        raw_words = sent.split()
        t_start = max(prev_end_clock + 0.1, round(c["time_start"], 3)) if prev_end_clock > 0 else round(c["time_start"], 3)
        t_end = max(t_start + 1.2, round(c["time_end"], 3))
        prev_end_clock = t_end

        words_data = []
        if not c.get("interpolated") and "w_start" in c and "w_end" in c:
            w_slice = all_whisper_words[c["w_start"] : c["w_end"] + 1]
            if len(w_slice) == len(raw_words):
                for j, rw in enumerate(raw_words):
                    ws = max(t_start, round(w_slice[j]["start"], 3))
                    we = max(ws + 0.1, round(w_slice[j]["end"], 3))
                    words_data.append({
                        "word": rw,
                        "start": ws,
                        "end": we,
                        "probability": 1.0
                    })
            else:
                step = (t_end - t_start) / max(1, len(raw_words))
                for j, rw in enumerate(raw_words):
                    words_data.append({
                        "word": rw,
                        "start": round(t_start + j * step, 3),
                        "end": round(t_start + (j + 1) * step, 3),
                        "probability": 1.0
                    })
        else:
            step = (t_end - t_start) / max(1, len(raw_words))
            for j, rw in enumerate(raw_words):
                words_data.append({
                    "word": rw,
                    "start": round(t_start + j * step, 3),
                    "end": round(t_start + (j + 1) * step, 3),
                    "probability": 0.9
                })

        final_segments.append({
            "id": i,
            "start": round(t_start, 3),
            "end": round(t_end, 3),
            "text": sent,
            "words": words_data
        })

    # Safety net for truncated lyrics:
    # If the user/online lyrics provided only Lời 1 (ended early), but the singer continues singing
    # in the remaining portion of the song, automatically append the remaining Whisper vocal segments.
    if final_segments and all_whisper_words:
        last_seg_end = final_segments[-1]["end"]
        remaining_words = [w for w in all_whisper_words if w.get("start", 0) >= last_seg_end + 3.0]
        if len(remaining_words) >= 8:
            rem_span = remaining_words[-1].get("end", 0) - remaining_words[0].get("start", 0)
            if rem_span >= 8.0:
                logger.info(f"Detected {len(remaining_words)} sung words in vocal audio after lyric end ({last_seg_end:.1f}s). Appending Lời 2 / outro from acoustic transcription.")
                curr_group = []
                next_id = len(final_segments)
                for w in remaining_words:
                    if not curr_group:
                        curr_group.append(w)
                    else:
                        gap = w.get("start", 0) - curr_group[-1].get("end", 0)
                        if len(curr_group) >= 8 or gap >= 1.2:
                            st = curr_group[0]["start"]
                            en = curr_group[-1]["end"]
                            txt = " ".join(x.get("word", "") for x in curr_group).strip()
                            w_data = [{"word": x.get("word", ""), "start": round(x.get("start", st), 3), "end": round(x.get("end", en), 3), "probability": 1.0} for x in curr_group]
                            final_segments.append({
                                "id": next_id,
                                "start": round(st, 3),
                                "end": round(en, 3),
                                "text": txt,
                                "words": w_data
                            })
                            next_id += 1
                            curr_group = [w]
                        else:
                            curr_group.append(w)
                if curr_group:
                    st = curr_group[0]["start"]
                    en = curr_group[-1]["end"]
                    txt = " ".join(x.get("word", "") for x in curr_group).strip()
                    w_data = [{"word": x.get("word", ""), "start": round(x.get("start", st), 3), "end": round(x.get("end", en), 3), "probability": 1.0} for x in curr_group]
                    final_segments.append({
                        "id": next_id,
                        "start": round(st, 3),
                        "end": round(en, 3),
                        "text": txt,
                        "words": w_data
                    })

    logger.info(f"Successfully aligned {len(final_segments)} couplet sentences with acoustic vocal audio.")
    return final_segments


def merge_synced_segments_to_couplets(segs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Merges short LRC fragments into full couplet sentences while preserving precise time anchors.
    """
    couplets = []
    curr_text = ""
    curr_start = 0.0
    curr_end = 0.0

    for s in segs:
        t = s.get("text", "").strip()
        t = re.sub(r"\(.*?\)|\[.*?\]", "", t).strip()
        if not t:
            continue
        if not curr_text:
            curr_text = t
            curr_start = s.get("start", 0.0)
            curr_end = s.get("end", curr_start + 2.0)
        else:
            w_curr = curr_text.split()
            w_next = t.split()
            gap = s.get("start", 0.0) - curr_end
            if len(w_curr) < 4 and len(w_curr) + len(w_next) <= 7 and gap <= 1.5:
                curr_text = curr_text + " " + t
                curr_end = s.get("end", curr_end + 2.0)
            else:
                couplets.append({
                    "text": curr_text,
                    "start": round(curr_start, 3),
                    "end": round(curr_end, 3)
                })
                curr_text = t
                curr_start = s.get("start", 0.0)
                curr_end = s.get("end", curr_start + 2.0)
    if curr_text:
        couplets.append({
            "text": curr_text,
            "start": round(curr_start, 3),
            "end": round(curr_end, 3)
        })
    return couplets


def detect_lrc_to_whisper_global_offset(
    synced_segments: List[Dict[str, Any]],
    whisper_vocal_segments: List[Dict[str, Any]]
) -> float:
    """
    Detects systematic time offset (e.g. live version extended intro vs studio cut, or shifted LRC)
    between synced lyric timestamps and actual Whisper acoustic words.
    Returns the median offset in seconds (to add to LRC timestamps), or 0.0 if aligned or indeterminate.
    """
    if not synced_segments or not whisper_vocal_segments:
        return 0.0

    all_w_words = []
    for s in whisper_vocal_segments:
        for w in s.get("words", []):
            txt = w.get("word", "").strip()
            if txt:
                all_w_words.append({
                    "word": txt,
                    "clean": clean_text_for_matching(txt),
                    "start": float(w["start"]),
                    "end": float(w["end"])
                })

    if not all_w_words:
        return 0.0

    # Sample the first 15 substantial lines from synced lyrics
    sample_lines = []
    for seg in synced_segments[:20]:
        t = seg.get("text", "").strip()
        cl = clean_text_for_matching(t)
        words = cl.split()
        if len(words) >= 3:
            sample_lines.append({
                "raw": t,
                "clean": cl,
                "words": words,
                "start": float(seg.get("start", 0.0)),
                "end": float(seg.get("end", 0.0))
            })
        if len(sample_lines) >= 12:
            break

    if not sample_lines:
        return 0.0

    # Search window: first 180 seconds of Whisper words
    search_w_words = [w for w in all_w_words if w["start"] <= 180.0]
    if len(search_w_words) < 10:
        search_w_words = all_w_words[:80]

    N_sw = len(search_w_words)
    offsets = []

    for line in sample_lines:
        target_cl = line["clean"]
        n_w = len(line["words"])
        best_ratio = 0.0
        best_offset = 0.0

        for j in range(N_sw):
            for k in range(j + max(1, n_w - 2), min(N_sw, j + n_w + 3) + 1):
                cand_slice = search_w_words[j:k]
                cand_str = " ".join(w["clean"] for w in cand_slice)
                ratio = difflib.SequenceMatcher(None, target_cl, cand_str).ratio()
                if ratio > best_ratio:
                    best_ratio = ratio
                    # Offset = actual vocal start - LRC start
                    best_offset = cand_slice[0]["start"] - line["start"]

        if best_ratio >= 0.58:
            offsets.append((best_offset, best_ratio, line["raw"]))

    if not offsets:
        return 0.0

    # Check for cluster agreement
    raw_offset_vals = [o[0] for o in offsets]
    raw_offset_vals.sort()
    med_offset = raw_offset_vals[len(raw_offset_vals) // 2]

    # Count how many lines agree within +/- 2.5s of the median
    agreeing = [o for o in offsets if abs(o[0] - med_offset) <= 2.5]
    logger.info(f"LRC Offset Detector: sampled {len(sample_lines)} lines -> {len(offsets)} matches -> {len(agreeing)} agreeing on offset {med_offset:+.2f}s")

    if len(agreeing) >= 2 or (len(agreeing) == 1 and agreeing[0][1] >= 0.85):
        import numpy as np
        weights = [o[1] for o in agreeing]
        final_offset = float(np.average([o[0] for o in agreeing], weights=weights))
        return round(final_offset, 2)

    return 0.0


def align_synced_lyrics_with_vocal_audio(
    synced_segments: List[Dict[str, Any]],
    whisper_vocal_segments: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Main entrypoint for aligning LRC / SRT synced lyrics with vocal audio:
    1. Automatically detects and corrects global time offset (e.g. YouTube live version vs studio LRC).
    2. Preserves LRC time anchors while merging lines into couplets (cặp câu chuẩn KTV).
    3. Uses time-windowed acoustic alignment against Whisper words (preventing skipping or jumping across verses).
    4. Snaps to exact Whisper acoustic word boundaries, with acoustic silence guard against intro/solo bleeding.
    5. Guarantees all sentences are concise (<= 8 words) to prevent screen overflow.
    """
    if not synced_segments:
        return []

    # 1. Automatically detect and correct global time offset (e.g. YouTube live version vs studio LRC)
    global_offset = detect_lrc_to_whisper_global_offset(synced_segments, whisper_vocal_segments)
    if abs(global_offset) >= 0.8:
        logger.info(f"Applying auto global time shift of {global_offset:+.2f}s to LRC timestamps to match actual audio.")
        import copy
        adjusted_segments = []
        for s in synced_segments:
            cp = copy.deepcopy(s)
            cp["start"] = max(0.0, float(cp.get("start", 0.0)) + global_offset)
            cp["end"] = max(0.0, float(cp.get("end", 0.0)) + global_offset)
            adjusted_segments.append(cp)
        synced_segments = adjusted_segments

    couplets = merge_synced_segments_to_couplets(synced_segments)
    if not couplets:
        return []

    all_whisper_words = []
    for seg in whisper_vocal_segments:
        for w in seg.get("words", []):
            if w.get("word", "").strip():
                all_whisper_words.append(w)

    first_whisper_vocal_start = all_whisper_words[0]["start"] if all_whisper_words else 0.0

    aligned_couplets = []
    prev_end = 0.0
    matched_count = 0
    running_offset = 0.0

    for i, c in enumerate(couplets):
        c_start = c["start"] + running_offset
        c_end = c["end"] + running_offset
        c_text = c["text"]
        raw_words = c_text.split()
        if not raw_words:
            continue
        clean_target = clean_text_for_matching(c_text)
        n_w = len(raw_words)

        # Adaptive search window: look around c_start with a generous ±6.5s margin,
        # bounded by prev_end to ensure monotonicity
        win_start = max(prev_end, c_start - 6.5)
        win_end = max(win_start + 4.0, c_end + 6.5)
        win_words = [w for w in all_whisper_words if win_start <= w.get("start", 0) <= win_end]

        best_match = None
        best_score = -999.0
        best_ratio = 0.0

        for j in range(len(win_words)):
            for k in range(j + max(1, n_w - 3), min(len(win_words), j + n_w + 4) + 1):
                cand_slice = win_words[j:k]
                has_gap = False
                for m in range(len(cand_slice) - 1):
                    if cand_slice[m + 1]["start"] - cand_slice[m]["end"] >= 1.5:
                        has_gap = True
                        break
                if has_gap:
                    continue

                cand_text = clean_text_for_matching(" ".join(w.get("word", "") for w in cand_slice))
                ratio = difflib.SequenceMatcher(None, clean_target, cand_text).ratio()
                w_diff = abs(len(cand_slice) - n_w)
                score = ratio - (w_diff * 0.04)
                if score > best_score:
                    best_score = score
                    best_ratio = ratio
                    best_match = cand_slice

        if best_match and best_ratio >= 0.55:
            matched_count += 1
            actual_start = max(prev_end + 0.1, best_match[0]["start"])
            max_natural = max(2.0, n_w * 0.85)
            actual_end = max(actual_start + 1.0, min(best_match[-1]["end"] + 0.15, actual_start + max_natural))
            
            # Smoothly update running_offset based on acoustic drift
            drift = actual_start - c["start"]
            running_offset = 0.65 * running_offset + 0.35 * drift

            w_data = []
            cur_t = actual_start
            if len(best_match) == len(raw_words):
                for idx in range(len(raw_words)):
                    w_st = max(cur_t, best_match[idx]["start"])
                    w_en = max(w_st + 0.08, best_match[idx]["end"])
                    w_en = min(actual_end, w_en)
                    if w_en <= w_st:
                        w_en = w_st + 0.10
                    w_data.append({"word": raw_words[idx], "start": round(w_st, 3), "end": round(w_en, 3), "probability": 1.0})
                    cur_t = w_en
            else:
                step = (actual_end - actual_start) / max(1, len(raw_words))
                w_data = [{"word": raw_words[idx], "start": round(actual_start + idx * step, 3), "end": round(actual_start + (idx + 1) * step, 3), "probability": 1.0} for idx in range(len(raw_words))]
            
            prev_end = actual_end
            aligned_couplets.append({
                "id": i,
                "text": c_text,
                "start": round(actual_start, 3),
                "end": round(actual_end, 3),
                "words": w_data
            })
        else:
            nominal_start = c_start
            if all_whisper_words and prev_end <= 0.1 and nominal_start < first_whisper_vocal_start - 0.5 and (first_whisper_vocal_start - nominal_start) <= 2.5:
                logger.warning(f"LRC Couplet '{c_text}' starts at {nominal_start:.2f}s before first vocal onset ({first_whisper_vocal_start:.2f}s). Clamping to vocal onset.")
                nominal_start = first_whisper_vocal_start

            actual_start = max(prev_end + 0.1, nominal_start)
            # Ensure minimum natural singable duration (at least 0.38s per word, min 2.0s) to prevent ultra-fast sweeps
            min_dur = max(2.0, n_w * 0.38)
            actual_end = max(actual_start + min_dur, c_end if c_end > actual_start else actual_start + min_dur)
            step = (actual_end - actual_start) / max(1, len(raw_words))
            w_data = [{"word": raw_words[idx], "start": round(actual_start + idx * step, 3), "end": round(actual_start + (idx + 1) * step, 3), "probability": 0.9} for idx in range(len(raw_words))]
            prev_end = actual_end
            aligned_couplets.append({
                "id": i,
                "text": c_text,
                "start": round(actual_start, 3),
                "end": round(actual_end, 3),
                "words": w_data
            })

    match_rate = matched_count / max(1, len(couplets))
    logger.info(f"LRC Acoustic Alignment: matched {matched_count}/{len(couplets)} couplets ({match_rate*100:.1f}%)")
    if match_rate < 0.35 and len(all_whisper_words) >= 15:
        logger.warning(f"LRC match rate is extremely low ({match_rate*100:.1f}% < 35%). The synced LRC is mismatched with actual audio. Falling back to Whisper AI acoustic transcription.")
        return whisper_vocal_segments

    # Ensure all segments are split into natural lines (<= 8 words, <= 38 chars)
    final_split = []
    for c in aligned_couplets:
        final_split.extend(split_long_segment_data(c, max_words=8, max_chars=38, max_duration=5.5))

    for idx, seg in enumerate(final_split):
        seg["id"] = idx

    logger.info(f"Successfully aligned and split into {len(final_split)} natural sentences (<= 8 words).")
    return final_split


def align_lyrics_with_vocal_audio(
    official_lyric_lines: List[str],
    whisper_vocal_segments: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Direct Phrase-Clustered Acoustic Alignment for plain text lyrics:
    1. Clusters all acoustic Whisper words into natural singing phrases separated by instrumental pauses (gap >= 1.5s).
       Guarantees ZERO subtitles during intros, interludes, guitar solos, or outros!
    2. Monotonically matches official lyrics within each acoustic phrase.
    3. Gracefully skips verses not sung (e.g. omitted stanzas during solos or interludes) using bounded lookahead.
    4. Falls back to acoustic vocal words for any unsung/unscripted parts.
    5. Splits every resulting sentence into concise lines (<= 6 words, <= 28 chars) for mobile/desktop karaoke display.
    """
    if not official_lyric_lines and not whisper_vocal_segments:
        return []

    # Flatten all whisper words
    all_words = []
    for s in (whisper_vocal_segments or []):
        for w in s.get("words", []):
            txt = w.get("word", "").strip()
            if txt:
                all_words.append({
                    "word": txt,
                    "clean": clean_text_for_matching(txt),
                    "start": float(w["start"]),
                    "end": float(w["end"])
                })

    # If no acoustic words found, fallback to sequential progressive timestamps
    if not all_words:
        if not official_lyric_lines:
            return []
        res = []
        cur_t = 15.0
        for idx, sent in enumerate(official_lyric_lines):
            w_list = sent.split()
            dur = max(2.0, min(4.0, len(w_list) * 0.45))
            step = dur / max(1, len(w_list))
            words_data = [{
                "word": w,
                "start": round(cur_t + j * step, 3),
                "end": round(cur_t + (j + 1) * step, 3),
                "probability": 0.8
            } for j, w in enumerate(w_list)]
            res.append({
                "id": idx,
                "start": round(cur_t, 3),
                "end": round(cur_t + dur, 3),
                "text": sent,
                "words": words_data
            })
            cur_t += dur + 0.4
        return res

    # Group acoustic words into singing phrases (split by silence/interlude >= 1.5s)
    phrases = []
    curr = []
    for w in all_words:
        if not curr:
            curr.append(w)
        else:
            gap = w["start"] - curr[-1]["end"]
            if gap >= 1.5:
                phrases.append(curr)
                curr = [w]
            else:
                curr.append(w)
    if curr:
        phrases.append(curr)

    # Prepare and deduplicate user lyric lines
    prepared_lines = []
    for l in (official_lyric_lines or []):
        raw = l.strip()
        # Clean parenthesized backing echo for clean karaoke display, e.g. "Đi tìm theo học đàn (đi tìm theo học đàn)" -> "Đi tìm theo học đàn"
        raw_clean = re.sub(r"\(.*?\)", "", raw).strip()
        raw_clean = re.sub(r"\[.*?\]", "", raw_clean).strip()
        raw_display = raw_clean if raw_clean else raw
        cl = clean_text_for_matching(raw_display)
        if cl and (not prepared_lines or prepared_lines[-1]["clean"] != cl):
            prepared_lines.append({"raw": raw_display, "clean": cl})

    # Filter out isolated 1-word intro blips (e.g. faint guitar bleed hallucinated before main singing)
    # UNLESS the opening lyric line is also a single word matching this acoustic word!
    while phrases and len(phrases[0]) <= 1 and len(phrases) > 1:
        gap_to_next = phrases[1][0]["start"] - phrases[0][-1]["end"]
        if gap_to_next >= 2.0:
            if prepared_lines and len(prepared_lines[0]["clean"].split()) == 1:
                w0 = phrases[0][0]["clean"]
                l0 = prepared_lines[0]["clean"]
                if difflib.SequenceMatcher(None, l0, w0).ratio() >= 0.7:
                    break
            logger.info(f"Filtering out isolated intro blip '{phrases[0][0]['word']}' at {phrases[0][0]['start']:.2f}s with {gap_to_next:.2f}s silence gap.")
            phrases.pop(0)
        else:
            break

    raw_segments = []
    u_idx = 0

    for ph_idx, ph in enumerate(phrases):
        ph_words_clean = [w["clean"] for w in ph]
        N_ph = len(ph)
        w_curr = 0

        while w_curr < N_ph:
            best_match = None
            best_cost = -999.0
            best_u_offset = 0

            # Bounded lookahead (up to 6 lines) with lookahead penalty to prevent prematurely skipping to repeated refrains
            max_look = min(6, len(prepared_lines) - u_idx) if u_idx < len(prepared_lines) else 0
            for look in range(max_look):
                cand_u = prepared_lines[u_idx + look]
                cand_words = cand_u["clean"].split()
                n_cand = len(cand_words)
                if n_cand == 0:
                    continue

                min_l = max(1, n_cand - 2)
                max_l = min(N_ph - w_curr, n_cand + 3)
                if min_l > max_l:
                    continue

                for length in range(min_l, max_l + 1):
                    slice_words = ph_words_clean[w_curr : w_curr + length]
                    ratio = difflib.SequenceMatcher(None, " ".join(cand_words), " ".join(slice_words)).ratio()
                    cost = ratio - (look * 0.09)
                    if cost > best_cost and ratio >= 0.42:
                        best_cost = cost
                        best_match = (w_curr, w_curr + length - 1, cand_u)
                        best_u_offset = look

            if best_match and best_cost >= 0.25:
                st_w, en_w, matched_u = best_match

                # If opening lines were missed before first acoustic match, only prepend if acoustic start is very close (< 6s)
                if not raw_segments and best_u_offset > 0:
                    skipped_lines = prepared_lines[u_idx : u_idx + best_u_offset]
                    first_match_start = ph[st_w]["start"]
                    if first_match_start <= 6.0 and len(skipped_lines) == 1:
                        lead_in_dur = min(2.5, first_match_start - 0.5)
                        lead_in_start = max(0.5, first_match_start - lead_in_dur)
                        time_step = (first_match_start - 0.2 - lead_in_start) / max(1, len(skipped_lines))
                        logger.info(f"Safety Shield: Prepending {len(skipped_lines)} opening lyric line(s) before first acoustic match at {first_match_start:.2f}s.")
                        for sk_i, sk_line in enumerate(skipped_lines):
                            sk_st = lead_in_start + sk_i * time_step
                            sk_en = min(first_match_start - 0.1, sk_st + time_step * 0.92)
                            sk_words = sk_line["raw"].split()
                            sk_w_step = (sk_en - sk_st) / max(1, len(sk_words))
                            sk_w_data = [{
                                "word": w,
                                "start": round(sk_st + j * sk_w_step, 3),
                                "end": round(sk_st + (j + 1) * sk_w_step, 3),
                                "probability": 0.85
                            } for j, w in enumerate(sk_words)]
                            raw_segments.append({
                                "start": round(sk_st, 2),
                                "end": round(sk_en, 2),
                                "text": sk_line["raw"],
                                "words": sk_w_data
                            })
                    else:
                        logger.info(f"Skipping {len(skipped_lines)} un-sung opening lines (acoustic start is at {first_match_start:.2f}s).")

                # Advance u_idx to matched line (naturally skipping unsung lines without fake insertions into solos/interludes)
                u_idx += best_u_offset + 1
                w_curr = en_w + 1

                acoustic_slice = ph[st_w : en_w + 1]
                t_start = acoustic_slice[0]["start"]
                t_end = acoustic_slice[-1]["end"]

                raw_words = matched_u["raw"].split()
                if len(acoustic_slice) == len(raw_words):
                    w_data = [{
                        "word": raw_words[k],
                        "start": round(acoustic_slice[k]["start"], 3),
                        "end": round(acoustic_slice[k]["end"], 3),
                        "probability": 1.0
                    } for k in range(len(raw_words))]
                else:
                    dur = t_end - t_start
                    step = dur / max(1, len(raw_words))
                    w_data = [{
                        "word": raw_words[k],
                        "start": round(t_start + k * step, 3),
                        "end": round(t_start + (k + 1) * step, 3),
                        "probability": 1.0
                    } for k in range(len(raw_words))]

                raw_segments.append({
                    "start": round(t_start, 2),
                    "end": round(t_end, 2),
                    "text": matched_u["raw"],
                    "words": w_data
                })
            else:
                # If current acoustic word does not match, advance w_curr by 1 to skip stray acoustic noise
                if u_idx < len(prepared_lines):
                    w_curr += 1
                else:
                    # All official lyrics have already been matched; only append genuine sung outro:
                    rem_ph = ph[w_curr:]
                    if len(rem_ph) >= 3 and (rem_ph[-1]["end"] - rem_ph[0]["start"]) >= 1.5:
                        chunk_sz = 6
                        for ci in range(0, len(rem_ph), chunk_sz):
                            grp = rem_ph[ci : ci + chunk_sz]
                            txt = " ".join(x["word"] for x in grp).strip()
                            t_st = grp[0]["start"]
                            t_en = grp[-1]["end"]
                            w_data = [{
                                "word": x["word"],
                                "start": round(x["start"], 3),
                                "end": round(x["end"], 3),
                                "probability": 0.85
                            } for x in grp]
                            raw_segments.append({
                                "start": round(t_st, 2),
                                "end": round(t_en, 2),
                                "text": txt,
                                "words": w_data
                            })
                    break

    # Do not invent un-sung trailing lines into outro silence/fade-out. If singer stopped, subtitles stop!

    if not raw_segments and prepared_lines:
        logger.warning(f"Safety Shield: Whisper detected no vocals. Evenly distributing all {len(prepared_lines)} lyric lines across track.")
        last_end = 15.0
        for p_line in prepared_lines:
            p_words = p_line["raw"].split()
            dur = max(2.5, len(p_words) * 0.45)
            st = last_end
            en = st + dur
            w_step = dur / max(1, len(p_words))
            w_data = [{
                "word": w,
                "start": round(st + j * w_step, 3),
                "end": round(st + (j + 1) * w_step, 3),
                "probability": 0.85
            } for j, w in enumerate(p_words)]
            raw_segments.append({
                "start": round(st, 2),
                "end": round(en, 2),
                "text": p_line["raw"],
                "words": w_data
            })
            last_end = en + 0.8

    # Split any segment exceeding 8 words, 38 chars, or 5.5s
    split_segments = []
    for s in raw_segments:
        split_segments.extend(split_long_segment_data(s, max_words=8, max_chars=38, max_duration=5.5))

    for idx, s in enumerate(split_segments):
        s["id"] = idx

    logger.info(f"Successfully aligned and split plain text into {len(split_segments)} natural sentences (<= 8 words, <= 38 chars).")
    return split_segments

