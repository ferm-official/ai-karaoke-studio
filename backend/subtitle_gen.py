import json
from pathlib import Path
from typing import List, Dict, Any

def format_ass_time(seconds: float) -> str:
    """Formats seconds into ASS timestamp: H:MM:SS.cs (centiseconds)."""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    cs = int(round((seconds - int(seconds)) * 100))
    if cs >= 100:
        cs = 99
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"

def format_lrc_time(seconds: float) -> str:
    """Formats seconds into LRC timestamp: [mm:ss.xx]."""
    m = int(seconds // 60)
    s = int(seconds % 60)
    cs = int(round((seconds - int(seconds)) * 100))
    if cs >= 100:
        cs = 99
    return f"[{m:02d}:{s:02d}.{cs:02d}]"

def get_stroke_color_for_fill(fill_bgr: str) -> str:
    """Returns &H00FFFFFF& (white stroke) for dark/saturated fill colors, or &H00000000& (black stroke) for light fills."""
    clean = fill_bgr.replace("&H", "").replace("&", "").zfill(8)
    try:
        bb = int(clean[2:4], 16)
        gg = int(clean[4:6], 16)
        rr = int(clean[6:8], 16)
        lum = 0.299 * rr + 0.587 * gg + 0.114 * bb
        return "&H00FFFFFF&" if lum < 185 else "&H00000000&"
    except Exception:
        return "&H00FFFFFF&"

def generate_ass_subtitles(
    segments: List[Dict[str, Any]],
    output_ass_path: str,
    font_name: str = "Tahoma",
    font_size: int = 54,
    primary_color: str = "&H00FFFFFF",     # Inactive unsung text (White in BGR)
    karaoke_color: str = "&H00FF3800",     # Active sung text (Royal Blue #0038FF in BGR)
    outline_color: str = "&H00000000",     # Outline (Solid Black)
    shadow_color: str = "&H80000000",      # Shadow (Black)
    video_width: int = 1920,
    video_height: int = 1080,
    subtitle_pos_y: float = None,          # Legacy or unified percentage
    line1_pos_y: float = None,             # Custom top percentage for Line 1 (e.g. 0.65)
    line2_pos_y: float = None,             # Custom top percentage for Line 2 (e.g. 0.76)
    line1_pos_x: float = None,             # Custom left percentage for Line 1 (e.g. 0.08)
    line2_pos_x: float = None,             # Custom left percentage for Line 2 (e.g. 0.45)
    font_size_line1: int = None,           # Custom font size for Line 1
    font_size_line2: int = None,           # Custom font size for Line 2
    align_line1: str = "left",             # Alignment: "left", "center", "right"
    align_line2: str = "right",            # Alignment: "left", "center", "right"
    layout_preset: str = "center",         # Layout preset: "center", "staggered", "autofit_all"
    display_mode: str = "pingpong"         # Subtitle timing mode: "pingpong" (alternating rolling) or "couplet" (paired)
) -> str:
    r"""
    Generates a professional 2-line alternating Karaoke ASS subtitle file with \kf tags (smooth fill)
    and independent drag & drop 2D (X, Y) placement and font sizes for Line 1 and Line 2.
    Supports both Ping-Pong (rolling alternating so le) and Couplet (static pairs) display modes.
    """
    # Sanitize font name for ASS specification (remove CSS fallbacks and quotes)
    if font_name:
        font_name = font_name.split(",")[0].strip().strip("'\"")
    if not font_name:
        font_name = "Tahoma"

    # Calculate adaptive margins based on resolution, aspect ratio and custom vertical positions
    is_vertical = video_height > video_width
    scale_factor = video_height / (1920.0 if is_vertical else 1080.0)
    line_gap = int(75 * scale_factor)

    fs1 = int(round((font_size_line1 or font_size) * (1.0 if not is_vertical else scale_factor)))
    fs2 = int(round((font_size_line2 or font_size) * (1.0 if not is_vertical else scale_factor)))

    margin_lr = int(video_width * (0.06 if is_vertical else 0.05))
    outline_val = round(4.0 * scale_factor, 1)
    shadow_val = round(3.0 * scale_factor, 1)

    # 2D X position margin calculation
    x1 = float(line1_pos_x if line1_pos_x is not None else 0.08)
    x2 = float(line2_pos_x if line2_pos_x is not None else 0.92)
    x1 = max(0.02, min(0.98, x1))
    x2 = max(0.02, min(0.98, x2))
    margin_l1 = max(10, int(video_width * x1))
    margin_l2 = max(10, int(video_width * x2))

    if line1_pos_y is not None or line2_pos_y is not None:
        p1 = float(line1_pos_y if line1_pos_y is not None else ((subtitle_pos_y or 0.75) - 0.08))
        p2 = float(line2_pos_y if line2_pos_y is not None else (subtitle_pos_y or 0.75))
        p1 = max(0.08, min(0.92, p1))
        p2 = max(0.08, min(0.92, p2))
        margin_v1 = max(20, int(video_height * (1.0 - p1)))
        margin_v2 = max(20, int(video_height * (1.0 - p2)))
    elif subtitle_pos_y is not None:
        pos_y = max(0.12, min(0.90, float(subtitle_pos_y)))
        margin_v2 = max(30, int(video_height * (1.0 - pos_y)))
        margin_v1 = margin_v2 + line_gap
    else:
        if is_vertical:
            margin_v1 = int(video_height * 0.25)
            margin_v2 = int(video_height * 0.17)
        else:
            margin_v1 = int(140 * scale_factor)
            margin_v2 = int(60 * scale_factor)

    # Determine alignment (1=Left, 2=Center, 3=Right in ASS)
    is_center1 = (align_line1 == "center") or (abs(x1 - 0.50) < 0.06)
    is_center2 = (align_line2 == "center") or (abs(x2 - 0.50) < 0.06)

    is_right1 = (align_line1 == "right") or (x1 >= 0.78)
    is_right2 = (align_line2 == "right") or (layout_preset == "staggered") or (x2 >= 0.78)

    align1_val = 2 if is_center1 else (3 if is_right1 else 1)
    align2_val = 2 if is_center2 else (3 if is_right2 else 1)

    if is_center1 or is_right1:
        margin_l1 = margin_lr
    if is_center2 or is_right2:
        margin_l2 = margin_lr

    # Colors for Duet roles (ASS uses &HAABBGGRR format)
    color_male = "&H00FF3800"     # Royal Blue #0038FF (Chuẩn KTV)
    color_female = "&H008C75FF"   # Pink #FF758C
    color_duet = "&H0059E2FF"     # Gold #FFE259
    cd_fs = max(24, int(fs1 * 0.55))
    margin_cd = margin_v1 + int(fs1 * 0.9)

    header = f"""[Script Info]
; Script generated by Local AI Karaoke Studio
Title: Karaoke AI
ScriptType: v4.00+
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.601
PlayResX: {video_width}
PlayResY: {video_height}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: KaraokeLine1_All,{font_name},{fs1},{karaoke_color},{primary_color},{outline_color},{shadow_color},-1,0,0,0,100,100,1,0,1,{outline_val},{shadow_val},{align1_val},{margin_l1},{margin_lr},{margin_v1},1
Style: KaraokeLine2_All,{font_name},{fs2},{karaoke_color},{primary_color},{outline_color},{shadow_color},-1,0,0,0,100,100,1,0,1,{outline_val},{shadow_val},{align2_val},{margin_l2},{margin_lr},{margin_v2},1
Style: KaraokeLine1_Male,{font_name},{fs1},{color_male},{primary_color},{outline_color},{shadow_color},-1,0,0,0,100,100,1,0,1,{outline_val},{shadow_val},{align1_val},{margin_l1},{margin_lr},{margin_v1},1
Style: KaraokeLine2_Male,{font_name},{fs2},{color_male},{primary_color},{outline_color},{shadow_color},-1,0,0,0,100,100,1,0,1,{outline_val},{shadow_val},{align2_val},{margin_l2},{margin_lr},{margin_v2},1
Style: KaraokeLine1_Female,{font_name},{fs1},{color_female},{primary_color},{outline_color},{shadow_color},-1,0,0,0,100,100,1,0,1,{outline_val},{shadow_val},{align1_val},{margin_l1},{margin_lr},{margin_v1},1
Style: KaraokeLine2_Female,{font_name},{fs2},{color_female},{primary_color},{outline_color},{shadow_color},-1,0,0,0,100,100,1,0,1,{outline_val},{shadow_val},{align2_val},{margin_l2},{margin_lr},{margin_v2},1
Style: KaraokeLine1_Duet,{font_name},{fs1},{color_duet},{primary_color},{outline_color},{shadow_color},-1,0,0,0,100,100,1,0,1,{outline_val},{shadow_val},{align1_val},{margin_l1},{margin_lr},{margin_v1},1
Style: KaraokeLine2_Duet,{font_name},{fs2},{color_duet},{primary_color},{outline_color},{shadow_color},-1,0,0,0,100,100,1,0,1,{outline_val},{shadow_val},{align2_val},{margin_l2},{margin_lr},{margin_v2},1
Style: CountdownDotStyle,{font_name},{cd_fs},&H66FFFFFF,{color_duet},{outline_color},{shadow_color},-1,0,0,0,100,100,1,0,1,2,1,2,{margin_lr},{margin_lr},{margin_cd},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = []

    # Pre-calculate global uniform safe font scale for the ENTIRE song
    safe_boundary_w = video_width * 0.82
    global_song_scale = 1.0
    for seg in segments:
        words = seg.get("words", [])
        txt = seg.get("text", "".join(w.get("word", "") for w in words)).strip()
        w_cnt = max(1, len(txt.split()))
        est_w = (len(txt) * fs1 * 0.60) + (w_cnt * 8) + 36
        if est_w > safe_boundary_w and safe_boundary_w > 200:
            sc = safe_boundary_w / est_w
            if sc < global_song_scale:
                global_song_scale = sc

    # Helper to generate Dialogue line for a segment
    def build_line_event(seg, line_num, disp_start, disp_end):
        role = seg.get("role", "all").capitalize()
        if role not in ["All", "Male", "Female", "Duet"]:
            role = "All"

        style_name = f"KaraokeLine1_{role}" if line_num == 1 else f"KaraokeLine2_{role}"
        cur_fs = fs1 if line_num == 1 else fs2

        role_fill = {
            "Male": color_male,
            "Female": color_female,
            "Duet": color_duet,
            "All": karaoke_color
        }.get(role, karaoke_color)
        active_stroke = get_stroke_color_for_fill(role_fill)

        words = seg.get("words", [])
        k_text_parts = []
        if global_song_scale < 1.0:
            scaled_fs = max(26, int(cur_fs * global_song_scale))
            k_text_parts.append(f"{{\\fs{scaled_fs}}}")

        # Lead-in pause before singing starts (holds text in unwiped primary color)
        lead_in = max(0.0, seg["start"] - disp_start)
        if lead_in > 0.05:
            lead_in_cs = int(round(lead_in * 100))
            k_text_parts.append(f"{{\\k{lead_in_cs}}}")

        current_cursor = seg["start"]
        for w_idx, w in enumerate(words):
            w_start = w["start"]
            w_end = w["end"]
            w_text = w["word"]

            lead_gap = max(0.0, w_start - current_cursor)
            if lead_gap >= 0.05:
                gap_cs = int(round(lead_gap * 100))
                if gap_cs > 0:
                    k_text_parts.append(f"{{\\k{gap_cs}}}")

            w_duration = max(0.05, w_end - w_start)
            dur_cs = int(round(w_duration * 100))
            
            t_start_ms = max(0, int(round((w_start - disp_start) * 1000)))
            t_end_ms = max(t_start_ms + 10, int(round((w_end - disp_start) * 1000)))

            if active_stroke != "&H00000000&":
                k_text_parts.append(f"{{\\3c&H00000000&\\t({t_start_ms},{t_end_ms},\\3c{active_stroke})\\kf{dur_cs}}}{w_text} ")
            else:
                k_text_parts.append(f"{{\\kf{dur_cs}}}{w_text} ")

            current_cursor = w_end

        karaoke_line = "".join(k_text_parts)
        start_ass = format_ass_time(disp_start)
        end_ass = format_ass_time(disp_end)
        return f"Dialogue: 0,{start_ass},{end_ass},{style_name},,0,0,0,,{karaoke_line}"

    if display_mode == "couplet":
        # Legacy Couplet Pairs (Cặp câu đồng bộ)
        couplet_pairs = []
        curr_pair = []
        for i, seg in enumerate(segments):
            words = seg.get("words", [])
            if not words:
                continue
            gap = (seg["start"] - segments[i - 1]["end"]) if i > 0 else 0
            if gap >= 5.0 and curr_pair:
                couplet_pairs.append(curr_pair)
                curr_pair = []
            curr_pair.append(seg)
            if len(curr_pair) == 2:
                couplet_pairs.append(curr_pair)
                curr_pair = []
        if curr_pair:
            couplet_pairs.append(curr_pair)

        for p_idx, pair in enumerate(couplet_pairs):
            segA = pair[0]
            segB = pair[1] if len(pair) > 1 else None

            prev_end = couplet_pairs[p_idx - 1][-1]["end"] if p_idx > 0 else 0.0
            lead_in_a = max(0.0, segA["start"] - 2.5)
            pair_lead_in = max(prev_end, lead_in_a) if p_idx > 0 else lead_in_a

            pair_sing_end = segB["end"] if segB else segA["end"]
            next_start = couplet_pairs[p_idx + 1][0]["start"] if p_idx < len(couplet_pairs) - 1 else 99999.0
            gap_to_next = next_start - pair_sing_end
            pair_retention = 0.8 if gap_to_next >= 1.0 else max(0.15, gap_to_next - 0.2)
            pair_display_end = pair_sing_end + pair_retention

            # Countdown dots
            lead_in_sec_a = max(0.0, segA["start"] - pair_lead_in)
            if lead_in_sec_a >= 2.0:
                cd_start = max(pair_lead_in, segA["start"] - 2.0)
                cd_end = segA["start"]
                events.append(f"Dialogue: 1,{format_ass_time(cd_start)},{format_ass_time(cd_end)},CountdownDotStyle,,0,0,0,,{{\\k50}}● {{\\k50}}● {{\\k50}}● {{\\k50}}●")

            events.append(build_line_event(segA, 1, pair_lead_in, pair_display_end))
            if segB:
                events.append(build_line_event(segB, 2, pair_lead_in, pair_display_end))
    else:
        # Default: Professional Alternating Ping-Pong Mode (So le luân phiên cuốn chiếu)
        valid_segs = [s for s in segments if s.get("words")]
        stanzas = []
        curr_stanza = []
        for i, seg in enumerate(valid_segs):
            gap = (seg["start"] - valid_segs[i - 1]["end"]) if i > 0 else 0.0
            if gap >= 5.0 and len(curr_stanza) >= 2:
                stanzas.append(curr_stanza)
                curr_stanza = []
            curr_stanza.append(seg)
        if curr_stanza:
            stanzas.append(curr_stanza)

        prev_stanza_end = 0.0
        for st_idx, stanza in enumerate(stanzas):
            s0 = stanza[0]
            s0_lead = max(0.0, s0["start"] - 2.5)
            stanza_entry = max(prev_stanza_end + 0.1, s0_lead) if st_idx > 0 else s0_lead

            # Lead-in Countdown Dots Event (● ● ● ●) for long intros / interludes
            if (s0["start"] - stanza_entry) >= 1.8:
                cd_start = max(stanza_entry, s0["start"] - 2.0)
                cd_end = s0["start"]
                events.append(f"Dialogue: 1,{format_ass_time(cd_start)},{format_ass_time(cd_end)},CountdownDotStyle,,0,0,0,,{{\\k50}}● {{\\k50}}● {{\\k50}}● {{\\k50}}●")

            slot1_segs = []  # Even indices within stanza (Hàng 1)
            slot2_segs = []  # Odd indices within stanza (Hàng 2)

            for j, seg in enumerate(stanza):
                if j % 2 == 0:
                    slot1_segs.append((j, seg))
                else:
                    slot2_segs.append((j, seg))

            retention = 0.25
            stanza_events = []

            # Process Slot 1 (Hàng 1 - Top)
            for idx_in_slot, (j, seg) in enumerate(slot1_segs):
                is_first = (idx_in_slot == 0)
                is_last = (idx_in_slot == len(slot1_segs) - 1)

                if is_first:
                    disp_start = stanza_entry
                else:
                    prev_seg = slot1_segs[idx_in_slot - 1][1]
                    disp_start = min(prev_seg["end"] + retention, seg["start"] - 0.15)

                disp_end = (seg["end"] + retention) if not is_last else (seg["end"] + 0.60)
                stanza_events.append((disp_start, 1, build_line_event(seg, 1, disp_start, disp_end)))

            # Process Slot 2 (Hàng 2 - Bottom)
            for idx_in_slot, (j, seg) in enumerate(slot2_segs):
                is_first = (idx_in_slot == 0)
                is_last = (idx_in_slot == len(slot2_segs) - 1)

                if is_first:
                    disp_start = stanza_entry  # Appears along with Slot 1 so singer previews both lines
                else:
                    prev_seg = slot2_segs[idx_in_slot - 1][1]
                    disp_start = min(prev_seg["end"] + retention, seg["start"] - 0.15)

                disp_end = (seg["end"] + retention) if not is_last else (seg["end"] + 0.60)
                stanza_events.append((disp_start, 2, build_line_event(seg, 2, disp_start, disp_end)))

            stanza_events.sort(key=lambda x: (x[0], x[1]))
            for ev in stanza_events:
                events.append(ev[2])

            prev_stanza_end = max(s["end"] for s in stanza)

    ass_content = header + "\n".join(events) + "\n"

    out_path = Path(output_ass_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(ass_content, encoding="utf-8")

    return str(out_path)

def generate_lrc(segments: List[Dict[str, Any]], output_lrc_path: str) -> str:
    """Generates standard and word-synced LRC file."""
    lines = []
    lines.append("[ti:AI Karaoke Track]")
    lines.append("[by:Local AI Karaoke Studio]")
    
    for seg in segments:
        words = seg.get("words", [])
        if not words:
            continue
        
        line_start = format_lrc_time(seg["start"])
        word_parts = []
        for w in words:
            w_time = format_lrc_time(w["start"])
            word_parts.append(f"{w_time}{w['word']}")
        
        lines.append(f"{line_start} " + " ".join(word_parts))

    lrc_content = "\n".join(lines) + "\n"
    out_path = Path(output_lrc_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(lrc_content, encoding="utf-8")
    return str(out_path)

def generate_json_lyrics(segments: List[Dict[str, Any]], output_json_path: str) -> str:
    """Saves formatted segments to JSON for real-time web player interaction."""
    out_path = Path(output_json_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(segments, ensure_ascii=False, indent=2), encoding="utf-8")
    return str(out_path)
