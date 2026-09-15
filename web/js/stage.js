/**
 * AI Karaoke Studio Pro — Stage Rendering, 60 FPS Progressive Wipe, Auto-Fit & Timing Animation
 */

import { state, beatAudio, vocalAudio } from './state.js';
import { showToastNotification } from './utils.js';

let _measureCanvas = null;

export function measureKaraokeTextWidth(text, fontSize, fontFamily) {
    if (!text) return 0;
    if (!_measureCanvas) _measureCanvas = document.createElement("canvas");
    const ctx = _measureCanvas.getContext("2d");
    if (!ctx) return text.length * fontSize * 0.62;
    const cleanFont = (fontFamily || state.fontName || "Tahoma").replace(/['"]/g, "").split(",")[0].trim();
    ctx.font = `800 ${fontSize}px ${cleanFont}, sans-serif`;
    return ctx.measureText(text).width;
}

export function getLineSafeAvailableWidth(lineEl, stageW) {
    const safeMargin = Math.round(stageW * 0.06);
    const maxSafeW = Math.max(200, stageW - (safeMargin * 2));
    if (!lineEl) return maxSafeW;

    const isCenter = lineEl.classList.contains("align-center") || lineEl.dataset.align === "center";
    if (isCenter) return maxSafeW;

    const isRight = lineEl.classList.contains("align-right") || lineEl.dataset.align === "right";
    if (isRight) return maxSafeW;

    const leftPx = lineEl.offsetLeft;
    const avail = (stageW - safeMargin) - leftPx;
    return Math.max(120, Math.min(maxSafeW, avail));
}

export function getSongGlobalSafeFontSize() {
    if (state._cachedSongSafeSize && state._cachedSongSafeSizeSegsRef === state.currentProject?.segments) {
        return state._cachedSongSafeSize;
    }

    const segments = state.currentProject?.segments || [];
    if (!segments.length) return 88;

    const stageScreen = document.getElementById("stageScreen");
    const stageW = stageScreen?.clientWidth || 1200;
    const maxSafeW = Math.round(stageW * 0.82);
    const font = (state.fontName || "Tahoma").replace(/['"]/g, "").split(",")[0].trim();

    const testSize = 52;
    let minFit = 115;

    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const text = (seg.text || "").trim();
        if (!text) continue;
        const w = measureKaraokeTextWidth(text, testSize, font);
        const wordCount = text.split(/\s+/).length;
        const adjustedW = w + (wordCount * 8) + 36;
        if (adjustedW > 0) {
            const fit = Math.floor((maxSafeW / adjustedW) * testSize);
            if (fit < minFit) {
                minFit = fit;
            }
        }
    }

    const result = Math.max(26, Math.min(115, minFit));
    state._cachedSongSafeSize = result;
    state._cachedSongSafeSizeSegsRef = segments;
    return result;
}

export function calculateCoupletMaxSafeSize(k1, k2, stageW) {
    return (state.isAutoFitEnabled !== false) ? getSongGlobalSafeFontSize() : 115;
}

export function calculateGlobalMaxSafeFontSize(notify = false) {
    const size = getSongGlobalSafeFontSize();
    if (typeof window.applyMasterFontSize === "function") {
        window.applyMasterFontSize(size);
    }
    if (notify) {
        showToastNotification(`Đã tự động tính cỡ chữ an toàn cho cả bài hát: ${size}px`);
    }
    return size;
}

export function synchronizeLinesAutoFit(kLine1, kLine2) {
    const stageScreen = document.getElementById("stageScreen");
    if (!stageScreen) return;
    const stageW = stageScreen.clientWidth || 800;
    const safeMargin = Math.round(stageW * 0.06);
    const maxSafeW = Math.round(stageW * 0.82);

    kLine1 = kLine1 || document.getElementById("kLine1");
    kLine2 = kLine2 || document.getElementById("kLine2");
    if (!kLine1 || !kLine2) return;

    const content1 = kLine1.querySelector(".line-content") || kLine1;
    const content2 = kLine2.querySelector(".line-content") || kLine2;

    const baseFontSize = (state.fontSizeLine1 || state.fontSizeLine2 || 52);
    let uniformFontSize = baseFontSize;

    if (content1) content1.style.fontSize = `${uniformFontSize}px`;
    if (content2) content2.style.fontSize = `${uniformFontSize}px`;

    if (state.isAutoFitEnabled !== false) {
        let curW1 = content1 ? (content1.scrollWidth || 0) : 0;
        let curW2 = content2 ? (content2.scrollWidth || 0) : 0;
        let steps = 0;
        while ((curW1 > maxSafeW || curW2 > maxSafeW) && uniformFontSize > 22 && steps < 16) {
            uniformFontSize -= 2;
            if (content1) content1.style.fontSize = `${uniformFontSize}px`;
            if (content2) content2.style.fontSize = `${uniformFontSize}px`;
            curW1 = content1 ? (content1.scrollWidth || 0) : 0;
            curW2 = content2 ? (content2.scrollWidth || 0) : 0;
            steps++;
        }
    }

    if (state.layoutPreset === "staggered") {
        kLine1.style.left = (state.line1PosX !== undefined ? `${Math.round(state.line1PosX * 100)}%` : "8%");
        kLine1.style.right = "auto";
        kLine1.style.transform = "none";
        kLine1.style.textAlign = "left";

        kLine2.style.left = "auto";
        const rightPct = state.line2PosX !== undefined ? Math.round((1.0 - state.line2PosX) * 100) : 8;
        kLine2.style.right = `${rightPct}%`;
        kLine2.style.transform = "none";
        kLine2.style.textAlign = "right";
    } else if (state.layoutPreset === "center") {
        kLine1.style.left = "50%";
        kLine1.style.right = "auto";
        kLine1.style.transform = "translateX(-50%)";
        kLine1.style.textAlign = "center";

        kLine2.style.left = "50%";
        kLine2.style.right = "auto";
        kLine2.style.transform = "translateX(-50%)";
        kLine2.style.textAlign = "center";
    }

    [kLine1, kLine2].forEach(lineEl => {
        if (!lineEl) return;
        const isCenter = lineEl.classList.contains("align-center") || lineEl.dataset.align === "center";
        if (isCenter) return;

        const leftPx = lineEl.offsetLeft;
        const width = lineEl.offsetWidth || lineEl.scrollWidth || 0;

        if (leftPx < safeMargin) {
            lineEl.style.left = `${safeMargin}px`;
            lineEl.style.right = "auto";
        } else if (leftPx + width > stageW - safeMargin) {
            const correctedLeft = Math.max(safeMargin, (stageW - safeMargin) - width);
            lineEl.style.left = `${correctedLeft}px`;
            lineEl.style.right = "auto";
        }
    });

    const hud1 = document.getElementById("kLine1HudSize");
    const hud2 = document.getElementById("kLine2HudSize");
    const isAutoScaled = uniformFontSize < baseFontSize;
    const tag = isAutoScaled ? ` (${uniformFontSize}px Đồng đều)` : "";
    if (hud1) hud1.textContent = `${uniformFontSize}px${tag}`;
    if (hud2) hud2.textContent = `${uniformFontSize}px${tag}`;
}

export function adjustLineAutoFit(container, lineNum, baseFontSize) {
    const k1 = document.getElementById("kLine1");
    const k2 = document.getElementById("kLine2");
    synchronizeLinesAutoFit(k1, k2);
}

export function applyStageFont(fontFamily) {
    if (!fontFamily) return;
    const formattedFont = fontFamily.includes(",") ? fontFamily : `"${fontFamily}", sans-serif`;
    state.fontName = formattedFont;

    const kLine1 = document.getElementById("kLine1");
    const kLine2 = document.getElementById("kLine2");
    const kLine1Content = document.getElementById("kLine1Content");
    const kLine2Content = document.getElementById("kLine2Content");

    if (kLine1) kLine1.style.fontFamily = formattedFont;
    if (kLine2) kLine2.style.fontFamily = formattedFont;
    if (kLine1Content) kLine1Content.style.fontFamily = formattedFont;
    if (kLine2Content) kLine2Content.style.fontFamily = formattedFont;

    document.querySelectorAll(".text-layer-base, .text-layer-active, .k-word-unit, .line-placeholder").forEach(el => {
        el.style.fontFamily = formattedFont;
    });

    const sel = document.getElementById("stageFontSelect");
    if (sel && sel.value !== fontFamily) {
        for (let i = 0; i < sel.options.length; i++) {
            if (sel.options[i].value === fontFamily || formattedFont.includes(sel.options[i].value)) {
                sel.selectedIndex = i;
                break;
            }
        }
    }

    state._cachedSongSafeSize = null;
    state._cachedSongSafeSizeSegsRef = null;
    if (typeof window.saveProjectStageSettings === "function") {
        window.saveProjectStageSettings();
    }
}

export function applyStageActiveColor(colorHex) {
    if (!colorHex) return;
    state.colorActive = colorHex;
    document.documentElement.style.setProperty("--color-active", colorHex);
    document.documentElement.style.setProperty("--karaoke-fill-color", colorHex);

    document.querySelectorAll(".text-layer-active, .karaoke-active").forEach(el => {
        el.style.color = colorHex;
    });

    const picker = document.getElementById("colorPickerActive");
    if (picker) picker.value = colorHex;
    const pickerOld = document.getElementById("colorActive");
    if (pickerOld) pickerOld.value = colorHex;

    document.querySelectorAll(".color-preset-pill").forEach(pill => {
        pill.classList.toggle("active", (pill.dataset.color || "").toLowerCase() === colorHex.toLowerCase());
    });

    if (typeof window.saveProjectStageSettings === "function") {
        window.saveProjectStageSettings();
    }
}

export function applyStageInactiveColor(colorHex) {
    if (!colorHex) return;
    state.colorInactive = colorHex;
    document.documentElement.style.setProperty("--color-inactive", colorHex);

    document.querySelectorAll(".text-layer-base").forEach(el => {
        el.style.color = colorHex;
    });

    const picker = document.getElementById("colorInactive");
    if (picker) picker.value = colorHex;

    if (typeof window.saveProjectStageSettings === "function") {
        window.saveProjectStageSettings();
    }
}

export function getAlternatingTimeline(segments) {
    if (!segments || !segments.length) return [];
    if (state._memoizedTimeline && state._memoizedTimelineSegsRef === segments) {
        return state._memoizedTimeline;
    }

    const validSegs = segments.filter(s => s && (s.words?.length || s.text));
    if (!validSegs.length) return [];

    const interludeThreshold = 5.0;
    const retention = 0.25;
    const defaultLeadIn = 2.5;

    const stanzas = [];
    let currStanza = [];
    for (let i = 0; i < validSegs.length; i++) {
        const seg = validSegs[i];
        const gap = i > 0 ? (seg.start - validSegs[i - 1].end) : 0;
        if (gap >= interludeThreshold && currStanza.length >= 2) {
            stanzas.push(currStanza);
            currStanza = [];
        }
        currStanza.push(seg);
    }
    if (currStanza.length > 0) {
        stanzas.push(currStanza);
    }

    const timeline = [];
    let prevStanzaEnd = 0.0;

    for (let stIdx = 0; stIdx < stanzas.length; stIdx++) {
        const stanza = stanzas[stIdx];
        const s0 = stanza[0];
        const s0Lead = Math.max(0.0, s0.start - defaultLeadIn);
        const stanzaEntry = stIdx > 0 ? Math.max(prevStanzaEnd + 0.1, s0Lead) : 0.0;

        const slot1Segs = [];
        const slot2Segs = [];

        for (let j = 0; j < stanza.length; j++) {
            if (j % 2 === 0) {
                slot1Segs.push({ j, seg: stanza[j] });
            } else {
                slot2Segs.push({ j, seg: stanza[j] });
            }
        }

        for (let k = 0; k < slot1Segs.length; k++) {
            const { j, seg } = slot1Segs[k];
            const isFirst = (k === 0);
            const isLast = (k === slot1Segs.length - 1);

            const dispStart = isFirst
                ? stanzaEntry
                : Math.min(slot1Segs[k - 1].seg.end + retention, seg.start - 0.15);
            const dispEnd = isLast
                ? (seg.end + 0.60)
                : (seg.end + retention);

            timeline.push({
                seg,
                slot: 1,
                stanzaIdx: stIdx,
                idxInStanza: j,
                displayStart: dispStart,
                displayEnd: dispEnd
            });
        }

        for (let k = 0; k < slot2Segs.length; k++) {
            const { j, seg } = slot2Segs[k];
            const isFirst = (k === 0);
            const isLast = (k === slot2Segs.length - 1);

            const dispStart = isFirst
                ? stanzaEntry
                : Math.min(slot2Segs[k - 1].seg.end + retention, seg.start - 0.15);
            const dispEnd = isLast
                ? (seg.end + 0.60)
                : (seg.end + retention);

            timeline.push({
                seg,
                slot: 2,
                stanzaIdx: stIdx,
                idxInStanza: j,
                displayStart: dispStart,
                displayEnd: dispEnd
            });
        }

        prevStanzaEnd = Math.max(...stanza.map(s => s.end));
    }

    timeline.sort((a, b) => a.displayStart - b.displayStart);
    state._memoizedTimeline = timeline;
    state._memoizedTimelineSegsRef = segments;
    return timeline;
}

export function getCoupletPairs(segments) {
    if (!segments || !segments.length) return [];
    if (state._memoizedPairs && state._memoizedSegsRef === segments) {
        return state._memoizedPairs;
    }

    const pairs = [];
    let curr = [];

    for (let i = 0; i < segments.length; i++) {
        const s = segments[i];
        if (!s || !(s.text || (s.words && s.words.length))) continue;
        const gap = i > 0 && segments[i - 1] ? (s.start - segments[i - 1].end) : 0;

        if (gap >= 5.0 && curr.length > 0) {
            pairs.push(curr);
            curr = [];
        }

        curr.push(s);
        if (curr.length === 2) {
            pairs.push(curr);
            curr = [];
        }
    }

    if (curr.length > 0) {
        pairs.push(curr);
    }

    state._memoizedPairs = pairs;
    state._memoizedSegsRef = segments;
    return pairs;
}

export function updateKaraokeStageCouplet(currentTime, segments) {
    const pairs = getCoupletPairs(segments);
    if (!pairs.length) return;

    let activePair = null;
    let nextPair = null;
    let prevPair = null;

    for (let pIdx = 0; pIdx < pairs.length; pIdx++) {
        const p = pairs[pIdx];
        const segA = p[0];
        const segB = p.length > 1 ? p[1] : null;

        const prevEnd = pIdx > 0 ? (pairs[pIdx - 1][pairs[pIdx - 1].length - 1].end) : 0.0;
        const pairLeadIn = pIdx === 0 ? 0.0 : Math.max(prevEnd, segA.start - 2.5);
        
        const pairSingEnd = segB ? segB.end : segA.end;
        const nextStart = pIdx < pairs.length - 1 ? pairs[pIdx + 1][0].start : 99999.0;
        const gapToNext = nextStart - pairSingEnd;
        
        let pairRetention = 0.8;
        if (gapToNext < 1.0) {
            pairRetention = Math.max(0.15, gapToNext - 0.2);
        }
        const pairExit = pairSingEnd + pairRetention;

        if (currentTime >= pairLeadIn && currentTime <= pairExit) {
            activePair = p;
            break;
        }

        if (pairExit < currentTime) {
            prevPair = p;
        }
        if (pairLeadIn > currentTime && !nextPair) {
            nextPair = p;
        }
    }

    if (!activePair) {
        if (pairs.length > 0 && currentTime < pairs[0][0].start) {
            activePair = pairs[0];
        } else if (nextPair) {
            const timeToNext = nextPair[0].start - currentTime;
            if (timeToNext <= 8.0) {
                activePair = nextPair;
            } else if (prevPair && (currentTime - prevPair[prevPair.length - 1].end) <= 1.5) {
                activePair = prevPair;
            } else {
                activePair = nextPair;
            }
        } else if (prevPair) {
            activePair = prevPair;
        } else if (pairs.length > 0) {
            activePair = pairs[0];
        }
    }

    const line1Seg = activePair ? activePair[0] : null;
    const line2Seg = (activePair && activePair.length > 1) ? activePair[1] : null;

    const kLine1 = document.getElementById("kLine1");
    const kLine2 = document.getElementById("kLine2");

    renderKaraokeLine(kLine1, line1Seg, currentTime);
    renderKaraokeLine(kLine2, line2Seg, currentTime);
    synchronizeLinesAutoFit(kLine1, kLine2);
}

export function updateKaraokeStage(currentTime) {
    const segments = state.currentProject?.segments || [];
    const kLine1 = document.getElementById("kLine1");
    const kLine2 = document.getElementById("kLine2");

    if (!segments.length) {
        if (kLine1) {
            kLine1.dataset.segIdx = "";
            const c1 = kLine1.querySelector(".line-content") || kLine1;
            if (!c1.querySelector(".line-placeholder")) {
                c1.innerHTML = `<span class="line-placeholder">Chưa có lời bài hát (Bấm vào Chỉnh Sửa Lời để thêm)</span>`;
            }
        }
        if (kLine2) {
            kLine2.dataset.segIdx = "";
            const c2 = kLine2.querySelector(".line-content") || kLine2;
            c2.innerHTML = "";
        }
        return;
    }

    renderCountdownDots(currentTime, segments);

    if (state.stageDisplayMode === "couplet") {
        updateKaraokeStageCouplet(currentTime, segments);
        return;
    }

    const timeline = getAlternatingTimeline(segments);
    if (!timeline.length) return;

    let slot1Seg = null;
    let slot2Seg = null;

    for (let i = 0; i < timeline.length; i++) {
        const item = timeline[i];
        if (currentTime >= item.displayStart && currentTime <= item.displayEnd) {
            if (item.slot === 1 && !slot1Seg) {
                slot1Seg = item.seg;
            } else if (item.slot === 2 && !slot2Seg) {
                slot2Seg = item.seg;
            }
        }
        if (slot1Seg && slot2Seg) break;
    }

    if (!slot1Seg && !slot2Seg && timeline.length > 0) {
        if (currentTime < timeline[0].seg.start) {
            for (let i = 0; i < timeline.length; i++) {
                const item = timeline[i];
                if (item.stanzaIdx === 0) {
                    if (item.slot === 1 && !slot1Seg) slot1Seg = item.seg;
                    if (item.slot === 2 && !slot2Seg) slot2Seg = item.seg;
                }
            }
        }
    }

    renderKaraokeLine(kLine1, slot1Seg, currentTime);
    renderKaraokeLine(kLine2, slot2Seg, currentTime);
    synchronizeLinesAutoFit(kLine1, kLine2);
}

export function renderCountdownDots(currentTime, segments) {
    const wrap = document.getElementById("stageCountdownWrap");
    if (!wrap) return;

    // Render tone badge if enabled
    const toneBadge = document.getElementById("stageToneBadge");
    if (toneBadge) {
        if (state.showToneBadge) {
            const pitch = state.currentPitchSemitones || 0;
            let toneText = "Tone Gốc";
            if (pitch < 0) {
                toneText = pitch === -1 ? "Tone Nam" : `Tone Nam (${pitch})`;
            } else if (pitch > 0) {
                toneText = pitch === 1 ? "Tone Nữ" : `Tone Nữ (+${pitch})`;
            }
            toneBadge.textContent = toneText;
            toneBadge.style.display = "block";
        } else {
            toneBadge.style.display = "none";
        }
    }

    if (state.showCountdownDots === false) {
        wrap.style.display = "none";
        return;
    }

    let nextUpcoming = null;
    let prevEnd = 0;
    for (let i = 0; i < segments.length; i++) {
        if (segments[i].start > currentTime) {
            nextUpcoming = segments[i];
            prevEnd = i > 0 ? segments[i - 1].end : 0;
            break;
        }
    }

    if (!nextUpcoming) {
        wrap.style.display = "none";
        return;
    }

    const timeLeft = nextUpcoming.start - currentTime;
    const gapDuration = nextUpcoming.start - prevEnd;
    const count = state.countdownCount === 3 ? 3 : 4;
    const totalLeadTime = count === 3 ? 1.8 : 2.4;

    if ((prevEnd <= 1.0 || gapDuration >= 2.8) && timeLeft > 0.05 && timeLeft <= totalLeadTime) {
        const kLine1 = document.getElementById("kLine1");
        const stage = document.getElementById("stageScreen");
        const stageW = stage ? stage.clientWidth : 800;

        // Position countdown directly above Line 1
        if (kLine1) {
            wrap.style.top = `${Math.max(16, kLine1.offsetTop - 38)}px`;
            
            // Align horizontally with Line 1
            const isCenter = state.line1Align === "center" || state.layoutPreset === "center" || kLine1.classList.contains("align-center");
            if (isCenter) {
                wrap.style.left = "50%";
                wrap.style.transform = "translateX(-50%)";
                wrap.style.justifyContent = "center";
            } else {
                const line1Left = kLine1.offsetLeft || (stageW * 0.08);
                wrap.style.left = `${line1Left}px`;
                wrap.style.transform = "none";
                wrap.style.justifyContent = "flex-start";
            }
        }

        wrap.style.display = "flex";

        // Rebuild items if count or style changed
        const style = state.countdownStyle || "hearts";
        const container = document.getElementById("stageCountdownDots") || wrap;
        if (container.dataset.renderedStyle !== style || container.dataset.renderedCount !== String(count)) {
            container.dataset.renderedStyle = style;
            container.dataset.renderedCount = String(count);
            container.innerHTML = "";

            for (let i = 0; i < count; i++) {
                const item = document.createElement("span");
                item.dataset.index = i;

                if (style === "hearts") {
                    item.className = "cd-item cd-heart";
                    item.innerHTML = `<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;
                } else if (style === "smileys") {
                    item.className = "cd-item cd-smiley";
                    item.innerHTML = `<svg viewBox="0 0 32 32" width="28" height="28"><circle cx="16" cy="16" r="14" fill="#FFD233" stroke="#1e293b" stroke-width="1.8"/><path d="M9 13 Q11 10 13 13" stroke="#1e293b" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M19 13 Q21 10 23 13" stroke="#1e293b" stroke-width="2" fill="none" stroke-linecap="round"/><ellipse cx="8.5" cy="17" rx="2" ry="1.2" fill="#ff7675" opacity="0.85"/><ellipse cx="23.5" cy="17" rx="2" ry="1.2" fill="#ff7675" opacity="0.85"/><path d="M11 18 Q16 23 21 18" stroke="#1e293b" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;
                } else if (style === "dots") {
                    item.className = "cd-item cd-dot";
                } else {
                    item.className = "cd-item cd-number";
                    item.textContent = String(count - i);
                }
                container.appendChild(item);
            }
        }

        // Sequential beat lighting
        const items = container.querySelectorAll(".cd-item");
        for (let i = 0; i < count; i++) {
            const threshold = totalLeadTime * ((count - i) / count);
            const isActive = timeLeft <= threshold;
            items[i]?.classList.toggle("active", isActive);
        }
    } else {
        wrap.style.display = "none";
        const items = wrap.querySelectorAll(".cd-item");
        items.forEach(it => it.classList.remove("active"));
    }
}

export function renderKaraokeLine(container, segment, currentTime) {
    if (!container) return;
    if (container.classList.contains("editing-text")) return;

    const contentEl = container.querySelector(".line-content") || container;
    if (!segment) {
        container.dataset.segIdx = "";
        contentEl.innerHTML = "";
        return;
    }

    const segId = String(segment.id !== undefined ? segment.id : "");
    let words = segment.words;
    if (!words || !words.length) {
        const wArr = (segment.text || "").trim().split(/\s+/).filter(Boolean);
        const dur = Math.max(0.2, (segment.end || 1) - (segment.start || 0));
        const step = dur / Math.max(1, wArr.length);
        words = wArr.map((wStr, idx) => ({
            word: wStr,
            start: (segment.start || 0) + idx * step,
            end: (segment.start || 0) + (idx + 1) * step
        }));
    }

    const role = segment.role || "all";
    const roleClass = role !== "all" ? `role-${role}` : "";

    if (container.dataset.segIdx !== segId || !contentEl.querySelector(".text-layer-active")) {
        container.dataset.segIdx = segId;
        const wordsHtml = words.map((w, wIdx) => `<span class="k-word-unit" data-widx="${wIdx}">${w.word}</span>`).join(" ");
        contentEl.innerHTML = `
            <div class="karaoke-text-container">
                <div class="text-layer-base">${wordsHtml}</div>
                <div class="text-layer-active ${roleClass}">${wordsHtml}</div>
            </div>
        `;

        if (state.fontName) {
            contentEl.querySelectorAll(".text-layer-base, .text-layer-active").forEach(el => {
                el.style.fontFamily = state.fontName;
            });
        }

        const baseFontSize = (state.fontSizeLine1 || state.fontSizeLine2 || 54);
        contentEl.style.fontSize = `${baseFontSize}px`;
    }

    const baseLayer = contentEl.querySelector(".text-layer-base");
    const activeLayer = contentEl.querySelector(".text-layer-active");
    if (!baseLayer || !activeLayer) return;

    let revealPct = 0;
    const firstWord = words[0];
    const lastWord = words[words.length - 1];

    if (currentTime >= lastWord.end) {
        revealPct = 100;
    } else if (currentTime <= firstWord.start) {
        revealPct = 0;
    } else {
        const baseSpans = baseLayer.querySelectorAll(".k-word-unit");
        const totalLineWidth = baseLayer.offsetWidth;

        if (totalLineWidth > 0) {
            for (let i = 0; i < words.length; i++) {
                const w = words[i];
                const span = baseSpans[i];
                if (currentTime >= w.end) {
                    if (i === words.length - 1) {
                        revealPct = 100;
                        break;
                    }
                    continue;
                }
                if (currentTime >= w.start && currentTime < w.end) {
                    const dur = Math.max(0.04, w.end - w.start);
                    const prog = Math.max(0, Math.min(1, (currentTime - w.start) / dur));
                    const wordLeft = span ? span.offsetLeft : 0;
                    const wordWidth = span ? span.offsetWidth : 0;
                    const curX = wordLeft + prog * wordWidth;
                    revealPct = (curX / totalLineWidth) * 100;
                    break;
                }
                if (currentTime < w.start) {
                    const span = baseSpans[i];
                    const curX = span ? span.offsetLeft : 0;
                    revealPct = (curX / totalLineWidth) * 100;
                    break;
                }
            }
        }
    }

    revealPct = Math.max(0, Math.min(100, revealPct));
    activeLayer.style.clipPath = `inset(0 ${Math.max(0, 100 - revealPct).toFixed(2)}% 0 0)`;
}

export function startStageInlineEdit(lineNum) {
    const lineEl = document.getElementById(lineNum === 1 ? "kLine1" : "kLine2");
    if (!lineEl || !state.currentProject || !state.currentProject.segments) return;

    let segIdx = state.currentProject.segments.findIndex(s => String(s.id) === String(lineEl.dataset.segIdx));
    if (segIdx < 0) {
        const parsed = parseInt(lineEl.dataset.segIdx);
        if (!isNaN(parsed) && parsed >= 0 && parsed < state.currentProject.segments.length) {
            segIdx = parsed;
        } else {
            segIdx = lineNum === 1 ? 0 : Math.min(1, state.currentProject.segments.length - 1);
        }
    }

    const seg = state.currentProject.segments[segIdx];
    if (!seg) return;

    if (state.isPlaying) {
        beatAudio.pause();
        vocalAudio.pause();
        state.isPlaying = false;
        const playIconText = document.getElementById("playIconText");
        if (playIconText) playIconText.textContent = "Phát";
    }

    lineEl.classList.add("editing-text");
    const contentEl = lineEl.querySelector(".line-content") || lineEl;

    contentEl.innerHTML = `
        <div class="stage-inline-edit-wrap">
            <input type="text" class="stage-inline-input" id="stageInlineInput_${lineNum}" value="${seg.text || ''}" placeholder="Nhập lời mới hoặc để trống để xóa câu..." />
            <div class="stage-inline-actions">
                <button type="button" class="btn-stage-save" id="btnStageSave_${lineNum}">Lưu</button>
                <button type="button" class="btn-stage-delete" id="btnStageDelete_${lineNum}" title="Xóa hẳn câu này khỏi bài hát">Xóa câu</button>
                <button type="button" class="btn-stage-cancel" id="btnStageCancel_${lineNum}">Hủy</button>
            </div>
        </div>
    `;

    const input = document.getElementById(`stageInlineInput_${lineNum}`);
    const btnSave = document.getElementById(`btnStageSave_${lineNum}`);
    const btnDelete = document.getElementById(`btnStageDelete_${lineNum}`);
    const btnCancel = document.getElementById(`btnStageCancel_${lineNum}`);

    if (input) {
        input.focus();
        input.select();

        const doSave = async () => {
            const val = input.value;
            lineEl.classList.remove("editing-text");
            lineEl.dataset.segIdx = "";
            if (typeof window.updateSegmentText === "function") {
                await window.updateSegmentText(segIdx, val);
            }
        };

        const doDelete = async () => {
            lineEl.classList.remove("editing-text");
            lineEl.dataset.segIdx = "";
            if (typeof window.deleteSegment === "function") {
                await window.deleteSegment(segIdx);
            }
        };

        const doCancel = () => {
            lineEl.classList.remove("editing-text");
            lineEl.dataset.segIdx = "";
            updateKaraokeStage(beatAudio.currentTime);
        };

        btnSave?.addEventListener("click", (e) => {
            e.stopPropagation();
            doSave();
        });

        btnDelete?.addEventListener("click", (e) => {
            e.stopPropagation();
            doDelete();
        });

        btnCancel?.addEventListener("click", (e) => {
            e.stopPropagation();
            doCancel();
        });

        input.addEventListener("click", (e) => e.stopPropagation());

        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                doSave();
            } else if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                doCancel();
            }
        });
    }
}
