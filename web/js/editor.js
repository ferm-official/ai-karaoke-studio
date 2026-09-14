/**
 * AI Karaoke Studio Pro — Lyrics Editor & Timing Sync Module
 * Handles lyric table editing, acoustic realign, word badges, live tap-to-sync, and auto-split.
 */

import { state, beatAudio, vocalAudio, dom } from "./state.js";
import { formatTimeMs, parseTimeMs, roundNum, hexToAssColor, showToastNotification } from "./utils.js";
import { updateKaraokeStage } from "./stage.js";

export function ensureConciseSegments(segments, maxWords = 6, maxChars = 28, maxDur = 4.0) {
    if (!segments || !segments.length) return [];
    segments = segments.filter(s => (s.text || "").trim().length > 0);
    if (!segments.length) return [];
    let out = [];

    function splitSingleSeg(seg) {
        let words = seg.words || [];
        const text = (seg.text || "").trim();

        // If words is empty or missing, synthesize word tokens from text
        if (!words.length && text) {
            const wList = text.split(/\s+/);
            if (wList.length <= maxWords && text.length <= maxChars) return [seg];
            const st = parseFloat(seg.start || 0);
            const en = parseFloat(seg.end || st + 3);
            const dur = Math.max(0.2, en - st);
            const step = dur / Math.max(1, wList.length);
            words = wList.map((w, idx) => ({
                word: w,
                start: +(st + idx * step).toFixed(3),
                end: +(st + (idx + 1) * step).toFixed(3),
                probability: 1.0
            }));
            seg.words = words;
        }

        const numWords = words.length;
        const dur = (seg.end || 0) - (seg.start || 0);
        const numChars = text.length;

        let shouldSplit = false;
        if (numWords > maxWords || numChars > maxChars || dur > maxDur) {
            shouldSplit = true;
        } else if (numWords >= 5) {
            // Check for middle capital word, punctuation, or acoustic silence gap
            for (let i = 2; i < numWords - 1; i++) {
                const w = (words[i].word || "").trim();
                const prevW = (words[i - 1].word || "").trim();
                if (w && /^[A-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠƯ]/.test(w) && !w.startsWith("I'")) {
                    shouldSplit = true;
                    break;
                }
                if (/[,\.;:\-—!\?]/.test(prevW)) {
                    shouldSplit = true;
                    break;
                }
                const gap = (words[i].start || 0) - (words[i - 1].end || 0);
                if (gap >= 0.15) {
                    shouldSplit = true;
                    break;
                }
            }
        }

        if (!shouldSplit || numWords < 4) {
            return [seg];
        }

        const minSplit = Math.max(2, Math.floor(numWords * 0.28));
        const maxSplit = Math.min(numWords - 2, Math.ceil(numWords * 0.72));

        let bestIdx = Math.floor(numWords / 2);
        let bestScore = -999;

        for (let i = minSplit; i <= maxSplit; i++) {
            const prevW = words[i - 1];
            const currW = words[i];
            let score = 0;

            const prevWord = (prevW.word || "").trim();
            const currWord = (currW.word || "").trim();

            // 1. Capitalized current word (start of new clause)
            if (currWord && /^[A-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠƯ]/.test(currWord) && !currWord.startsWith("I'")) {
                score += 16;
            }

            // 2. Punctuation at end of previous word
            if (/[.;:\-—!\?]/.test(prevWord)) {
                score += 16;
            } else if (prevWord.endsWith(",")) {
                score += 10;
            }

            // 3. Acoustic silence gap
            const gap = (currW.start || 0) - (prevW.end || 0);
            if (gap >= 0.12) score += Math.min(20, gap * 28);

            // 4. Clause connectors
            const cleanCurr = currWord.toLowerCase().replace(/[,\.;:\-—!\?']/g, "");
            if (["và", "mà", "thì", "nhưng", "rồi", "khi", "để", "cho", "anh", "em", "người", "tôi", "like", "to", "with", "for", "in", "goin", "living"].includes(cleanCurr)) {
                score += 5;
            }

            // Midpoint preference
            score -= Math.abs(i - (numWords / 2)) * 0.5;

            if (score > bestScore) {
                bestScore = score;
                bestIdx = i;
            }
        }

        const wordsA = words.slice(0, bestIdx);
        const wordsB = words.slice(bestIdx);

        if (!wordsA.length || !wordsB.length) return [seg];

        // Capitalize first word of second segment if lowercase
        if (wordsB[0] && wordsB[0].word) {
            const w0 = wordsB[0].word;
            if (w0 && /^[a-zàáâãèéêìíòóôõùúăđĩũơư]/.test(w0)) {
                wordsB[0] = { ...wordsB[0], word: w0.charAt(0).toUpperCase() + w0.slice(1) };
            }
        }

        const segA = {
            id: seg.id || 0,
            start: wordsA[0].start,
            end: wordsA[wordsA.length - 1].end,
            text: wordsA.map(w => w.word).join(" "),
            words: wordsA
        };
        const segB = {
            id: seg.id || 0,
            start: wordsB[0].start,
            end: wordsB[wordsB.length - 1].end,
            text: wordsB.map(w => w.word).join(" "),
            words: wordsB
        };

        return [...splitSingleSeg(segA), ...splitSingleSeg(segB)];
    }

    segments.forEach(s => {
        out.push(...splitSingleSeg(s));
    });

    out.forEach((s, i) => { s.id = i; });
    return out;
}

export function renderEditorTable(segments) {
    const tableBody = dom.lyricsTableBody;
    if (!tableBody) return;
    tableBody.innerHTML = "";

    segments.forEach((seg, idx) => {
        const tr = document.createElement("tr");

        // STT
        const tdIdx = document.createElement("td");
        tdIdx.textContent = idx + 1;
        tr.appendChild(tdIdx);

        // Start Time
        const tdStart = document.createElement("td");
        tdStart.innerHTML = `<input type="text" class="time-input seg-start" value="${formatTimeMs(seg.start)}" data-idx="${idx}">`;
        tr.appendChild(tdStart);

        // End Time
        const tdEnd = document.createElement("td");
        tdEnd.innerHTML = `<input type="text" class="time-input seg-end" value="${formatTimeMs(seg.end)}" data-idx="${idx}">`;
        tr.appendChild(tdEnd);

        // Duet Role Selector
        const tdRole = document.createElement("td");
        const curRole = seg.role || "all";
        tdRole.innerHTML = `
            <div class="role-btn-group">
                <button type="button" class="role-chip role-all ${curRole === 'all' ? 'active' : ''}" onclick="setSegmentRole(${idx}, 'all')" title="Chung">Chung</button>
                <button type="button" class="role-chip role-male ${curRole === 'male' ? 'active' : ''}" onclick="setSegmentRole(${idx}, 'male')" title="Nam">Nam</button>
                <button type="button" class="role-chip role-female ${curRole === 'female' ? 'active' : ''}" onclick="setSegmentRole(${idx}, 'female')" title="Nữ">Nữ</button>
                <button type="button" class="role-chip role-duet ${curRole === 'duet' ? 'active' : ''}" onclick="setSegmentRole(${idx}, 'duet')" title="Song ca">Đôi</button>
            </div>
        `;
        tr.appendChild(tdRole);

        // Text & Word Chips
        const tdText = document.createElement("td");
        const textInput = document.createElement("input");
        textInput.type = "text";
        textInput.className = "line-text-input";
        textInput.value = seg.text;
        textInput.dataset.idx = idx;
        textInput.addEventListener("change", (e) => {
            updateSegmentText(idx, e.target.value);
        });
        tdText.appendChild(textInput);

        const chipsWrap = document.createElement("div");
        chipsWrap.className = "words-chip-list";
        (seg.words || []).forEach((w) => {
            const chip = document.createElement("span");
            chip.className = "word-chip";
            chip.textContent = `${w.word} (${formatTimeMs(w.start)})`;
            chip.title = "Click để nghe từ này";
            chip.addEventListener("click", () => {
                beatAudio.currentTime = w.start;
                vocalAudio.currentTime = w.start;
                if (!state.isPlaying && typeof window.togglePlayPause === "function") {
                    window.togglePlayPause();
                }
            });
            chipsWrap.appendChild(chip);
        });
        tdText.appendChild(chipsWrap);
        tr.appendChild(tdText);

        // Action
        const tdAction = document.createElement("td");
        tdAction.innerHTML = `
            <div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
                <button class="btn-micro-step" onclick="playSegmentAudition(${seg.start}, ${seg.end}, false)" title="Phát riêng câu này">Nghe</button>
                <button class="btn-micro-step" onclick="nudgeSingleSegment(${idx}, -50, false)" title="Chữ câu này sớm hơn 50ms">-50ms</button>
                <button class="btn-micro-step" onclick="nudgeSingleSegment(${idx}, 50, false)" title="Chữ câu này trễ hơn 50ms">+50ms</button>
                <button class="btn-micro-step" onclick="nudgeSingleSegment(${idx}, 50, true)" title="Đẩy tất cả câu sau +50ms" style="color: var(--gold-accent); border-color: rgba(255, 226, 89, 0.4);">Đẩy sau</button>
                <button class="btn-micro-step" onclick="deleteSegment(${idx})" title="Xóa câu này" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.4);">Xóa</button>
            </div>
        `;
        tr.appendChild(tdAction);

        tableBody.appendChild(tr);
    });
}

export function renderLyricJumpList(segments) {
    const listEl = document.getElementById("lyricJumpList");
    if (!listEl) return;
    listEl.innerHTML = "";

    if (!segments || !segments.length) {
        listEl.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-dim);">Chưa có danh sách câu hát</div>`;
        return;
    }

    segments.forEach((seg, idx) => {
        const item = document.createElement("div");
        item.className = "lyric-jump-item";
        item.dataset.idx = idx;

        const curRole = seg.role || "all";
        item.innerHTML = `
            <div class="jump-item-header" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px;">
                <span class="jump-item-num" style="font-weight: 800; color: var(--cyan-accent);">#${idx + 1}</span>
                <span class="jump-item-time" style="font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: #94A3B8;">${formatTimeMs(seg.start)} - ${formatTimeMs(seg.end)}</span>
                <div class="role-btn-group">
                    <button type="button" class="role-chip role-all ${curRole === 'all' ? 'active' : ''}" onclick="setSegmentRole(${idx}, 'all')" title="Chung">Chung</button>
                    <button type="button" class="role-chip role-male ${curRole === 'male' ? 'active' : ''}" onclick="setSegmentRole(${idx}, 'male')" title="Nam">Nam</button>
                    <button type="button" class="role-chip role-female ${curRole === 'female' ? 'active' : ''}" onclick="setSegmentRole(${idx}, 'female')" title="Nữ">Nữ</button>
                    <button type="button" class="role-chip role-duet ${curRole === 'duet' ? 'active' : ''}" onclick="setSegmentRole(${idx}, 'duet')" title="Song ca">Đôi</button>
                </div>
            </div>
            <div class="jump-item-text" onclick="playSegmentAudio(${seg.start})" title="Bấm để nhảy tới câu này" style="font-size: 0.9rem; font-weight: 600; cursor: pointer; padding: 4px 0; color: #F1F5F9;">${seg.text}</div>
            <div class="jump-item-actions" style="display: flex; gap: 4px; margin-top: 6px; flex-wrap: wrap;">
                <button class="btn-micro-step" onclick="playSegmentAudition(${seg.start}, ${seg.end}, false)">Nghe thử</button>
                <button class="btn-micro-step" onclick="playSegmentAudition(${seg.start}, ${seg.end}, true)">Lặp lại</button>
                <button class="btn-micro-step" onclick="nudgeSingleSegment(${idx}, -50, false)">-50ms</button>
                <button class="btn-micro-step" onclick="nudgeSingleSegment(${idx}, 50, false)">+50ms</button>
                <button class="btn-micro-step" onclick="deleteSegment(${idx})" title="Xóa câu này" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.4);">Xóa</button>
            </div>
        `;
        listEl.appendChild(item);
    });
}

export function setSegmentRole(segIdx, newRole) {
    if (!state.currentProject || !state.currentProject.segments) return;
    const seg = state.currentProject.segments[segIdx];
    if (!seg) return;
    seg.role = newRole;
    renderLyricJumpList(state.currentProject.segments);
    renderEditorTable(state.currentProject.segments);
    updateKaraokeStage(beatAudio.currentTime);
    if (typeof window.saveProjectStageSettings === "function") {
        window.saveProjectStageSettings();
    }
    showToastNotification(`Đã gán vai câu #${segIdx + 1}: ${newRole === 'male' ? 'Nam' : newRole === 'female' ? 'Nữ' : newRole === 'duet' ? 'Song ca' : 'Chung'}`);
}

export function playSegmentAudition(start, end, loop = false) {
    beatAudio.currentTime = start;
    vocalAudio.currentTime = start;
    if (!state.isPlaying && typeof window.togglePlayPause === "function") {
        window.togglePlayPause();
    }

    if (loop) {
        clearInterval(window._auditionInterval);
        window._auditionInterval = setInterval(() => {
            if (beatAudio.currentTime >= end) {
                beatAudio.currentTime = start;
                vocalAudio.currentTime = start;
            }
        }, 80);
    }
}

export function nudgeSingleSegment(segIdx, deltaMs, propagate = false) {
    if (!state.currentProject || !state.currentProject.segments) return;
    const deltaSec = deltaMs / 1000.0;
    const segments = state.currentProject.segments;

    if (propagate) {
        for (let i = segIdx; i < segments.length; i++) {
            const s = segments[i];
            s.start = Math.max(0, s.start + deltaSec);
            s.end = Math.max(0.1, s.end + deltaSec);
            (s.words || []).forEach(w => {
                w.start = Math.max(0, w.start + deltaSec);
                w.end = Math.max(0.1, w.end + deltaSec);
            });
        }
    } else {
        const s = segments[segIdx];
        s.start = Math.max(0, s.start + deltaSec);
        s.end = Math.max(0.1, s.end + deltaSec);
        (s.words || []).forEach(w => {
            w.start = Math.max(0, w.start + deltaSec);
            w.end = Math.max(0.1, w.end + deltaSec);
        });
    }

    renderEditorTable(segments);
    renderLyricJumpList(segments);
    updateKaraokeStage(beatAudio.currentTime);
}

export function playSegmentAudio(startTime) {
    beatAudio.currentTime = startTime;
    vocalAudio.currentTime = startTime;
    if (!state.isPlaying && typeof window.togglePlayPause === "function") {
        window.togglePlayPause();
    }
}

export async function deleteSegment(segIdx) {
    if (!state.currentProject || !state.currentProject.segments) return;
    const segments = state.currentProject.segments;
    if (segIdx < 0 || segIdx >= segments.length) return;

    const removed = segments.splice(segIdx, 1)[0];
    segments.forEach((s, i) => { s.id = i; });

    state._memoizedPairs = null;
    state._memoizedSegsRef = null;

    const kLine1 = document.getElementById("kLine1");
    const kLine2 = document.getElementById("kLine2");
    if (kLine1) {
        kLine1.classList.remove("editing-text");
        kLine1.dataset.segIdx = "";
    }
    if (kLine2) {
        kLine2.classList.remove("editing-text");
        kLine2.dataset.segIdx = "";
    }

    renderEditorTable(segments);
    renderLyricJumpList(segments);
    updateKaraokeStage(beatAudio.currentTime);

    try {
        await fetch(`/api/update-lyrics/${state.currentProject.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                segments: segments,
                font_name: state.fontName || "Tahoma",
                font_size: state.fontSizeLine1 || 54
            })
        });
        showToastNotification(`Đã xóa câu #${segIdx + 1} ("${removed.text || 'trống'}") khỏi bài hát!`);
    } catch (err) {
        console.error("Delete segment error:", err);
        showToastNotification(`Lỗi khi lưu bài hát: ${err.message}`);
    }
}

export async function updateSegmentText(segIdx, newText) {
    if (!state.currentProject || !state.currentProject.segments) return;
    const segments = state.currentProject.segments;
    if (segIdx < 0 || segIdx >= segments.length) return;

    const trimmed = (newText || "").trim();
    if (!trimmed) {
        await deleteSegment(segIdx);
        return;
    }

    const seg = segments[segIdx];
    seg.text = trimmed;

    // Parse and redistribute words
    const newWordStrings = trimmed.split(/\s+/).filter(w => w.length > 0);
    const oldWords = seg.words || [];

    if (newWordStrings.length === oldWords.length && oldWords.length > 0) {
        newWordStrings.forEach((wStr, i) => {
            oldWords[i].word = wStr;
        });
    } else if (newWordStrings.length > 0) {
        const totalDur = Math.max(0.2, seg.end - seg.start);
        const timePerWord = totalDur / newWordStrings.length;
        seg.words = newWordStrings.map((wStr, i) => ({
            word: wStr,
            start: Math.round((seg.start + i * timePerWord) * 1000) / 1000,
            end: Math.round((seg.start + (i + 1) * timePerWord) * 1000) / 1000,
            probability: 1.0
        }));
    }

    state._memoizedPairs = null;
    state._memoizedSegsRef = null;

    renderEditorTable(segments);
    renderLyricJumpList(segments);
    updateKaraokeStage(beatAudio.currentTime);

    try {
        await fetch(`/api/update-lyrics/${state.currentProject.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                segments: segments,
                font_name: state.fontName || "Tahoma",
                font_size: state.fontSizeLine1 || 54
            })
        });
        showToastNotification(`Đã lưu câu #${segIdx + 1}: "${trimmed}"`);
    } catch (err) {
        console.error("Save lyrics error:", err);
    }
}

export async function autoSplitProjectSegments(maxWords = 5, maxChars = 24) {
    if (!state.currentProject || !state.currentProject.segments || !state.currentProject.segments.length) {
        showToastNotification("Vui lòng mở một bài hát trước khi cắt dòng!");
        return;
    }

    const btnStudio = document.getElementById("btnAutoSplitInStudio");
    const btnEditor = document.getElementById("btnAutoSplitLongLines");
    const origStudioHtml = btnStudio ? btnStudio.innerHTML : "";
    const origEditorText = btnEditor ? btnEditor.textContent : "";

    if (btnStudio) {
        btnStudio.disabled = true;
        btnStudio.innerHTML = `<span>Đang Cắt Dòng...</span>`;
    }
    if (btnEditor) {
        btnEditor.disabled = true;
        btnEditor.textContent = "Đang Cắt Dòng...";
    }

    try {
        let newSegments = null;
        const projId = state.currentProject.id;
        if (projId) {
            try {
                const res = await fetch(`/api/split-long-segments/${projId}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ max_words: maxWords, max_chars: maxChars })
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.segments && data.segments.length) {
                        newSegments = data.segments;
                    }
                }
            } catch (apiErr) {
                console.warn("Backend split API error, falling back to local:", apiErr);
            }
        }

        if (!newSegments) {
            newSegments = ensureConciseSegments(state.currentProject.segments, maxWords, maxChars, 3.6);
            if (typeof window.saveProjectStageSettings === "function") {
                await window.saveProjectStageSettings();
            }
        }

        state.currentProject.segments = newSegments;
        state._memoizedTimeline = null;
        state._memoizedTimelineSegsRef = null;
        state._memoizedPairs = null;
        state._memoizedSegsRef = null;
        state._cachedSongSafeSize = null;
        state._cachedSongSafeSizeSegsRef = null;

        renderEditorTable(newSegments);
        renderLyricJumpList(newSegments);
        updateKaraokeStage(beatAudio.currentTime || 0);

        showToastNotification(`Đã tự động cắt câu dài thành ${newSegments.length} dòng ngắn gọn chuẩn KTV!`);
    } catch (err) {
        console.error("Split error:", err);
        showToastNotification("Lỗi cắt dòng: " + err.message);
    } finally {
        if (btnStudio) {
            btnStudio.disabled = false;
            btnStudio.innerHTML = origStudioHtml;
        }
        if (btnEditor) {
            btnEditor.disabled = false;
            btnEditor.textContent = origEditorText;
        }
    }
}

export async function handleSaveLyrics() {
    if (!state.currentProject) return;

    const projectId = state.currentProject.id;
    const rows = dom.lyricsTableBody ? dom.lyricsTableBody.querySelectorAll("tr") : [];
    const updatedSegments = [];

    rows.forEach((r, idx) => {
        const startVal = parseTimeMs(r.querySelector(".seg-start").value);
        const endVal = parseTimeMs(r.querySelector(".seg-end").value);
        const lineText = r.querySelector(".line-text-input").value.trim();
        
        const originalWords = state.currentProject.segments[idx]?.words || [];
        const wordsArr = lineText.split(/\s+/);
        const newWords = [];

        const totalWords = wordsArr.length;
        const timeDelta = Math.max(0.1, endVal - startVal) / Math.max(1, totalWords);

        wordsArr.forEach((w, wIdx) => {
            const orig = originalWords[wIdx];
            newWords.push({
                word: w,
                start: orig ? orig.start : roundNum(startVal + wIdx * timeDelta),
                end: orig ? orig.end : roundNum(startVal + (wIdx + 1) * timeDelta),
                probability: 1.0
            });
        });

        const origRole = state.currentProject.segments[idx]?.role || "all";
        updatedSegments.push({
            id: idx,
            start: startVal,
            end: endVal,
            text: lineText,
            words: newWords,
            role: origRole
        });
    });

    try {
        const res = await fetch(`/api/update-lyrics/${projectId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                segments: updatedSegments,
                font_name: state.fontName || "Tahoma",
                font_size: state.fontSizeLine1 || 54,
                primary_color: hexToAssColor(state.colorInactive || "#ffffff"),
                karaoke_color: hexToAssColor(state.colorActive || "#0038FF"),
                subtitle_pos_y: state.subtitlePosY || 0.75
            })
        });

        const data = await res.json();
        if (res.ok) {
            state.currentProject.segments = updatedSegments;
            state._memoizedPairs = null;
            state._memoizedSegsRef = null;
            state._cachedSongSafeSize = null;
            state._cachedSongSafeSizeSegsRef = null;
            updateKaraokeStage(beatAudio.currentTime);
            alert("Đã cập nhật lời và phụ đề Karaoke thành công!");
        } else {
            alert(`Lỗi: ${data.detail}`);
        }
    } catch (e) {
        alert(`Lỗi lưu: ${e.message}`);
    }
}

export function setupTapToSync() {
    let tapSyncState = {
        isActive: false,
        queue: [],
        currentIndex: 0
    };

    const btnStart = document.getElementById("btnStartTapSync");
    const masterCard = document.getElementById("tapSyncMasterCard");
    const btnFinish = document.getElementById("btnFinishTapSync");
    const btnCancel = document.getElementById("btnCancelTapSync");
    const btnTapBig = document.getElementById("btnTapSpaceBig");
    const lblSentence = document.getElementById("tapCurrentSentence");
    const lblWord = document.getElementById("tapWordHighlight");

    btnStart?.addEventListener("click", () => {
        if (!state.currentProject || !state.currentProject.segments?.length) {
            alert("Chưa có bài hát để gõ nhịp!");
            return;
        }

        const queue = [];
        state.currentProject.segments.forEach((seg, sIdx) => {
            (seg.words || []).forEach((w, wIdx) => {
                queue.push({
                    segIdx: sIdx,
                    wordIdx: wIdx,
                    word: w.word,
                    sentence: seg.text || seg.words.map(x => x.word).join(" ")
                });
            });
        });

        if (!queue.length) {
            alert("Không có từ nào trong bài hát!");
            return;
        }

        tapSyncState.isActive = true;
        tapSyncState.queue = queue;
        tapSyncState.currentIndex = 0;

        if (masterCard) {
            masterCard.style.display = "block";
            masterCard.scrollIntoView({ behavior: "smooth" });
        }
        updateTapSyncUI();

        beatAudio.currentTime = 0;
        vocalAudio.currentTime = 0;
        beatAudio.play();
        vocalAudio.play();
    });

    function registerTap() {
        if (!tapSyncState.isActive) return;
        const curTime = beatAudio.currentTime;
        const curIdx = tapSyncState.currentIndex;
        const item = tapSyncState.queue[curIdx];
        if (!item) return;

        const seg = state.currentProject.segments[item.segIdx];
        if (seg && seg.words && seg.words[item.wordIdx]) {
            seg.words[item.wordIdx].start = Math.max(0, curTime);
            if (item.wordIdx === 0) {
                seg.start = curTime;
            }

            if (curIdx > 0) {
                const prevItem = tapSyncState.queue[curIdx - 1];
                const prevSeg = state.currentProject.segments[prevItem.segIdx];
                if (prevSeg && prevSeg.words && prevSeg.words[prevItem.wordIdx]) {
                    prevSeg.words[prevItem.wordIdx].end = curTime;
                    if (prevItem.wordIdx === prevSeg.words.length - 1) {
                        prevSeg.end = curTime;
                    }
                }
            }
        }

        btnTapBig?.classList.add("tapped");
        setTimeout(() => btnTapBig?.classList.remove("tapped"), 120);

        tapSyncState.currentIndex++;
        if (tapSyncState.currentIndex >= tapSyncState.queue.length) {
            showToastNotification("Đã gõ nhịp hết toàn bộ bài hát!");
            finishTapSync();
        } else {
            updateTapSyncUI();
        }
    }

    function updateTapSyncUI() {
        const item = tapSyncState.queue[tapSyncState.currentIndex];
        if (!item) {
            if (lblSentence) lblSentence.textContent = "Hoàn tất!";
            if (lblWord) lblWord.textContent = "Đã xong";
            return;
        }
        if (lblSentence) lblSentence.textContent = `Câu ${item.segIdx + 1}: ${item.sentence}`;
        if (lblWord) lblWord.textContent = `${item.word} (${tapSyncState.currentIndex + 1}/${tapSyncState.queue.length})`;
    }

    function finishTapSync() {
        tapSyncState.isActive = false;
        if (masterCard) masterCard.style.display = "none";
        renderEditorTable(state.currentProject.segments);
        renderLyricJumpList(state.currentProject.segments);
        handleSaveLyrics();
        showToastNotification("Đã lưu nhịp mới vào bài hát!");
    }

    btnTapBig?.addEventListener("click", registerTap);

    window.addEventListener("keydown", (e) => {
        if (tapSyncState.isActive && e.code === "Space") {
            e.preventDefault();
            registerTap();
        }
    });

    btnFinish?.addEventListener("click", finishTapSync);
    btnCancel?.addEventListener("click", () => {
        tapSyncState.isActive = false;
        if (masterCard) masterCard.style.display = "none";
    });
}

export function setupEditor() {
    dom.btnSaveLyrics?.addEventListener("click", handleSaveLyrics);
    dom.btnReloadAI?.addEventListener("click", () => {
        if (state.currentProject) {
            renderEditorTable(state.currentProject.segments || []);
        }
    });

    const btnRealignAcoustic = document.getElementById("btnRealignAcoustic");
    btnRealignAcoustic?.addEventListener("click", async () => {
        if (!state.currentProject || !state.currentProject.id) {
            alert("Vui lòng mở một bài hát trước khi căn lại nhịp!");
            return;
        }
        const projId = state.currentProject.id;
        const originalText = btnRealignAcoustic.textContent;
        btnRealignAcoustic.disabled = true;
        btnRealignAcoustic.textContent = "Đang khớp nhịp AI...";

        try {
            const resp = await fetch(`/api/realign-lyrics/${projId}`, { method: "POST" });
            const resData = await resp.json();
            if (!resp.ok) {
                throw new Error(resData.detail || "Lỗi khi căn lại nhịp");
            }
            if (resData.data && resData.data.segments) {
                state.currentProject.segments = resData.data.segments;
                renderEditorTable(state.currentProject.segments);
                renderLyricJumpList(state.currentProject.segments);
                alert(`Đã khớp lại chính xác ${resData.data.segments.length} câu theo giọng hát thực tế của ca sĩ!`);
            }
        } catch (err) {
            alert(`Không thể khớp nhịp: ${err.message}`);
        } finally {
            btnRealignAcoustic.disabled = false;
            btnRealignAcoustic.textContent = originalText;
        }
    });

    // Gemini Alignment
    const btnAlignGemini = document.getElementById("btnAlignGemini");
    const geminiAlignModal = document.getElementById("geminiAlignModal");
    const closeGeminiAlignModalBtn = document.getElementById("closeGeminiAlignModalBtn");
    const cancelGeminiAlignModalBtn = document.getElementById("cancelGeminiAlignModalBtn");
    const startGeminiAlignBtn = document.getElementById("startGeminiAlignBtn");
    const geminiAlignLyricsInput = document.getElementById("geminiAlignLyricsInput");
    const geminiAlignModelSelect = document.getElementById("geminiAlignModelSelect");
    const geminiAlignStatusMsg = document.getElementById("geminiAlignStatusMsg");
    const btnCleanSunoLyricsPrompt = document.getElementById("btnCleanSunoLyricsPrompt");

    btnAlignGemini?.addEventListener("click", () => {
        if (!state.currentProject || !state.currentProject.id) {
            alert("Vui lòng mở một bài hát trong Studio trước khi dùng tính năng này!");
            return;
        }
        if (geminiAlignLyricsInput) {
            const segs = state.currentProject.segments || [];
            if (segs.length > 0) {
                geminiAlignLyricsInput.value = segs.map(s => s.text || "").filter(Boolean).join("\n");
            }
        }
        if (geminiAlignStatusMsg) {
            geminiAlignStatusMsg.style.display = "none";
            geminiAlignStatusMsg.textContent = "";
        }
        if (geminiAlignModal) geminiAlignModal.style.display = "flex";
    });

    closeGeminiAlignModalBtn?.addEventListener("click", () => { if (geminiAlignModal) geminiAlignModal.style.display = "none"; });
    cancelGeminiAlignModalBtn?.addEventListener("click", () => { if (geminiAlignModal) geminiAlignModal.style.display = "none"; });

    btnCleanSunoLyricsPrompt?.addEventListener("click", () => {
        if (!geminiAlignLyricsInput) return;
        let text = geminiAlignLyricsInput.value;
        text = text.replace(/\[(?:verse|chorus|bridge|pre-chorus|post-chorus|hook|intro|outro|solo|instrumental|drop|break|interlude|fade out|ending|refrain|style|bpm|key|vocal)[^\]]*?\]/gi, "");
        text = text.replace(/\[.*?\]/g, "");
        text = text.replace(/\((?:verse|chorus|solo|instrumental|intro|outro|bridge)[^\)]*?\)/gi, "");
        text = text.split("\n").map(l => l.trim()).filter(Boolean).join("\n");
        geminiAlignLyricsInput.value = text;
        showToastNotification("Đã lọc sạch các nhãn tag của Suno!");
    });

    startGeminiAlignBtn?.addEventListener("click", async () => {
        if (!state.currentProject || !state.currentProject.id) return;
        const lyrics = geminiAlignLyricsInput ? geminiAlignLyricsInput.value.trim() : "";
        if (!lyrics) {
            alert("Vui lòng nhập hoặc dán lời bài hát để Gemini canh nhịp!");
            return;
        }

        const model = geminiAlignModelSelect ? geminiAlignModelSelect.value : "gemini-2.5-flash";
        const projId = state.currentProject.id;

        if (startGeminiAlignBtn) {
            startGeminiAlignBtn.disabled = true;
            startGeminiAlignBtn.textContent = "Đang gửi lên Gemini...";
        }
        if (geminiAlignStatusMsg) {
            geminiAlignStatusMsg.style.display = "block";
            geminiAlignStatusMsg.innerHTML = "🧠 Đang tải file vocal và phân tích nhịp bằng Gemini AI... Vui lòng đợi trong giây lát!";
        }

        const formData = new FormData();
        formData.append("custom_lyrics", lyrics);
        formData.append("model_name", model);

        try {
            const resp = await fetch(`/api/projects/${projId}/align-gemini`, {
                method: "POST",
                body: formData
            });
            const data = await resp.json();
            if (!resp.ok) {
                throw new Error(data.detail || data.message || "Lỗi khi gọi Gemini AI");
            }

            if (data.data && data.data.segments) {
                state.currentProject = data.data;
                renderEditorTable(state.currentProject.segments);
                renderLyricJumpList(state.currentProject.segments);
                showToastNotification(data.message || `Đã khớp nhịp thành công ${data.data.segments.length} câu!`);
                if (geminiAlignModal) geminiAlignModal.style.display = "none";
            }
        } catch (err) {
            if (geminiAlignStatusMsg) {
                geminiAlignStatusMsg.style.display = "block";
                geminiAlignStatusMsg.innerHTML = `⚠️ Lỗi: ${err.message}`;
            }
            alert(`Lỗi: ${err.message}`);
        } finally {
            if (startGeminiAlignBtn) {
                startGeminiAlignBtn.disabled = false;
                startGeminiAlignBtn.textContent = "Bắt Đầu Khớp Nhịp Gemini";
            }
        }
    });

    const btnAutoSplitLongLines = document.getElementById("btnAutoSplitLongLines");
    btnAutoSplitLongLines?.addEventListener("click", () => autoSplitProjectSegments(5, 24));

    const btnImportSubFile = document.getElementById("btnImportSubFile");
    const importSubFileInput = document.getElementById("importSubFileInput");
    if (btnImportSubFile && importSubFileInput) {
        btnImportSubFile.addEventListener("click", () => importSubFileInput.click());
        importSubFileInput.addEventListener("change", async (e) => {
            if (e.target.files.length > 0 && state.currentProject) {
                const file = e.target.files[0];
                const formData = new FormData();
                formData.append("file", file);

                try {
                    const res = await fetch(`/api/import-subtitles/${state.currentProject.id}`, {
                        method: "POST",
                        body: formData
                    });
                    const data = await res.json();
                    if (res.ok) {
                        state.currentProject = data.data;
                        renderEditorTable(data.data.segments || []);
                        renderLyricJumpList(data.data.segments || []);
                        alert(`Đã nạp thành công ${data.segments_count} câu từ file ${file.name}!`);
                    } else {
                        alert(`Lỗi: ${data.detail}`);
                    }
                } catch (err) {
                    alert(`Lỗi nạp file: ${err.message}`);
                }
            }
        });
    }

    setupTapToSync();
}
