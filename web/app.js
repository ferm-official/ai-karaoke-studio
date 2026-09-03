/**
 * AI Karaoke Studio Pro — Frontend Application Logic
 */

// Application State
const state = {
    currentProject: null,
    projectsList: [],
    audioContext: null,
    analyser: null,
    sourceBeat: null,
    sourceVocal: null,
    isPlaying: false,
    pollTimer: null,
    activeLineIndex: -1,
    uploadedBgFile: null,
    line1PosY: 0.65,
    line2PosY: 0.76,
    fontSizeLine1: 52,
    fontSizeLine2: 52,
    bgTheme: "nebula"
};

// Audio Elements (synchronized dual-track)
const beatAudio = new Audio();
const vocalAudio = new Audio();

beatAudio.preload = "auto";
vocalAudio.preload = "auto";

// DOM Elements
const sysInfoPill = document.getElementById("sysInfoPill");
const gpuStatusText = document.getElementById("gpuStatusText");

// Navigation
const navTabs = document.querySelectorAll(".nav-tab");
const tabPanes = document.querySelectorAll(".tab-pane");

// Mode Switch
const modeFileBtn = document.getElementById("modeFileBtn");
const modeUrlBtn = document.getElementById("modeUrlBtn");
const dropZone = document.getElementById("dropZone");
const urlZone = document.getElementById("urlZone");
const audioFileInput = document.getElementById("audioFileInput");
const selectedFilePill = document.getElementById("selectedFilePill");
const selectedFileName = document.getElementById("selectedFileName");
const clearFileBtn = document.getElementById("clearFileBtn");
const urlInput = document.getElementById("urlInput");
const clearUrlBtn = document.getElementById("clearUrlBtn");
const startProcessBtn = document.getElementById("startProcessBtn");

// Config inputs
const langSelect = document.getElementById("langSelect");
const whisperModelSelect = document.getElementById("whisperModelSelect");
const demucsModelSelect = document.getElementById("demucsModelSelect");

// Player Elements
const btnPlayPause = document.getElementById("btnPlayPause");
const playIcon = document.getElementById("playIcon");
const pauseIcon = document.getElementById("pauseIcon");
const btnRewind10 = document.getElementById("btnRewind10");
const btnForward10 = document.getElementById("btnForward10");
const trackSeekBar = document.getElementById("trackSeekBar");
const currentTimeLabel = document.getElementById("currentTimeLabel");
const durationLabel = document.getElementById("durationLabel");
const beatVolSlider = document.getElementById("beatVolSlider");
const vocalVolSlider = document.getElementById("vocalVolSlider");
const beatVolText = document.getElementById("beatVolText");
const vocalVolText = document.getElementById("vocalVolText");
const kLine1 = document.getElementById("kLine1");
const kLine2 = document.getElementById("kLine2");
const visualizerCanvas = document.getElementById("visualizerCanvas");

// Editor Elements
const lyricsTableBody = document.getElementById("lyricsTableBody");
const btnSaveLyrics = document.getElementById("btnSaveLyrics");
const btnReloadAI = document.getElementById("btnReloadAI");

// Export Elements
const themeBtns = document.querySelectorAll(".theme-btn");
const colorInactive = document.getElementById("colorInactive");
const colorActive = document.getElementById("colorActive");
const videoResolutionSelect = document.getElementById("videoResolutionSelect");
const btnSelectBgFile = document.getElementById("btnSelectBgFile");
const bgFileInput = document.getElementById("bgFileInput");
const bgStatusText = document.getElementById("bgStatusText");
const btnStartRender = document.getElementById("btnStartRender");
const emptyVideoPlaceholder = document.getElementById("emptyVideoPlaceholder");
const renderedVideoPlayer = document.getElementById("renderedVideoPlayer");

// Downloads
const dlVideoBtn = document.getElementById("dlVideoBtn");
const dlInstrumentalBtn = document.getElementById("dlInstrumentalBtn");
const dlVocalBtn = document.getElementById("dlVocalBtn");
const dlAssSubBtn = document.getElementById("dlAssSubBtn");
const dlLrcSubBtn = document.getElementById("dlLrcSubBtn");

// Library
const projectsGrid = document.getElementById("projectsGrid");
const btnRefreshLibrary = document.getElementById("btnRefreshLibrary");

// Modal
const processModal = document.getElementById("processModal");
const modalTitle = document.getElementById("modalTitle");
const modalSub = document.getElementById("modalSub");
const modalProgressFill = document.getElementById("modalProgressFill");
const modalProgressPct = document.getElementById("modalProgressPct");
const stepUpload = document.getElementById("stepUpload");
const stepDemucs = document.getElementById("stepDemucs");
const stepWhisper = document.getElementById("stepWhisper");
const stepSub = document.getElementById("stepSub");


/* ========================================================
   1. INITIALIZATION & HARDWARE STATUS
   ======================================================== */
document.addEventListener("DOMContentLoaded", () => {
    fetchSystemInfo();
    setupNavigation();
    setupUploadHandlers();
    setupPlayer();
    setupDraggableSubtitle();
    setupEditor();
    setupExport();
    loadProjectsList();
    initVisualizer();
});

async function fetchSystemInfo() {
    try {
        const res = await fetch("/api/system-info");
        const data = await res.json();
        if (data.cuda_available) {
            gpuStatusText.textContent = `${data.gpu_name} (${data.vram_gb} GB VRAM) • GPU CUDA Online`;
            gpuStatusText.style.color = "#10B981";
        } else {
            gpuStatusText.textContent = "Chế độ CPU (Không tìm thấy GPU)";
            gpuStatusText.style.color = "#F59E0B";
        }
    } catch (e) {
        gpuStatusText.textContent = "100% Local Server Connected";
    }
}


/* ========================================================
   2. TAB NAVIGATION
   ======================================================== */
function setupNavigation() {
    navTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            const targetId = tab.getAttribute("data-tab");
            switchTab(targetId);
        });
    });

    document.getElementById("btnGoToEditor")?.addEventListener("click", () => switchTab("editorTab"));
    document.getElementById("btnGoToExport")?.addEventListener("click", () => switchTab("exportTab"));
}

function switchTab(targetId) {
    navTabs.forEach(t => {
        t.classList.toggle("active", t.getAttribute("data-tab") === targetId);
    });
    tabPanes.forEach(p => {
        p.classList.toggle("active", p.id === targetId);
    });
    if (targetId === "libraryTab") {
        loadProjectsList();
    }
}


/* ========================================================
   3. UPLOAD & JOB PROCESSING
   ======================================================== */
let selectedFile = null;

function setupUploadHandlers() {
    modeFileBtn.addEventListener("click", () => {
        modeFileBtn.classList.add("active");
        modeUrlBtn.classList.remove("active");
        dropZone.style.display = "block";
        urlZone.style.display = "none";
    });

    modeUrlBtn.addEventListener("click", () => {
        modeUrlBtn.classList.add("active");
        modeFileBtn.classList.remove("active");
        urlZone.style.display = "block";
        dropZone.style.display = "none";
    });

    dropZone.addEventListener("click", () => audioFileInput.click());

    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.classList.add("dragover");
    });

    dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));

    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.classList.remove("dragover");
        if (e.dataTransfer.files.length > 0) {
            handleFileSelected(e.dataTransfer.files[0]);
        }
    });

    audioFileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
            handleFileSelected(e.target.files[0]);
        }
    });

    clearFileBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        selectedFile = null;
        audioFileInput.value = "";
        selectedFilePill.style.display = "none";
    });

    clearUrlBtn.addEventListener("click", () => {
        urlInput.value = "";
    });

    // Hardware Mode Toggle
    const hwGpuBtn = document.getElementById("hwGpuBtn");
    const hwCpuBtn = document.getElementById("hwCpuBtn");
    const hardwareModeInput = document.getElementById("hardwareModeInput");

    hwGpuBtn?.addEventListener("click", () => {
        hwGpuBtn.classList.add("active");
        hwCpuBtn.classList.remove("active");
        if (hardwareModeInput) hardwareModeInput.value = "gpu";
    });

    hwCpuBtn?.addEventListener("click", () => {
        hwCpuBtn.classList.add("active");
        hwGpuBtn.classList.remove("active");
        if (hardwareModeInput) hardwareModeInput.value = "cpu";
    });

    startProcessBtn.addEventListener("click", handleStartProcessing);
}

function handleFileSelected(file) {
    selectedFile = file;
    selectedFileName.textContent = `${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`;
    selectedFilePill.style.display = "inline-flex";
}

async function handleStartProcessing() {
    const isFileMode = modeFileBtn.classList.contains("active");
    const lang = langSelect.value;
    const whisperModel = whisperModelSelect.value;
    const demucsModel = demucsModelSelect.value;
    const customLyrics = document.getElementById("customLyricsInput")?.value.trim() || "";
    const useCache = document.getElementById("useCacheCheckbox")?.checked ?? true;
    const deviceMode = document.getElementById("hardwareModeInput")?.value || "gpu";

    let formData = new FormData();
    formData.append("language", lang);
    formData.append("whisper_model", whisperModel);
    formData.append("demucs_model", demucsModel);
    formData.append("use_cache", useCache ? "true" : "false");
    formData.append("device_mode", deviceMode);
    if (customLyrics) {
        formData.append("custom_lyrics", customLyrics);
    }

    let endpoint = "";

    if (isFileMode) {
        if (!selectedFile) {
            alert("Vui lòng chọn hoặc kéo thả 1 file âm thanh / video!");
            return;
        }
        formData.append("file", selectedFile);
        endpoint = "/api/upload";
    } else {
        const url = urlInput.value.trim();
        if (!url) {
            alert("Vui lòng nhập đường dẫn URL bài hát!");
            return;
        }
        formData.append("url", url);
        endpoint = "/api/from-url";
    }

    // Show Progress Modal
    showProgressModal();

    try {
        const res = await fetch(endpoint, {
            method: "POST",
            body: formData
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Không thể khởi động xử lý");
        }

        const data = await res.json();
        startPollingStatus(data.project_id);

    } catch (e) {
        alert(`Lỗi: ${e.message}`);
        hideProgressModal();
    }
}

function showProgressModal() {
    processModal.style.display = "flex";
    modalProgressFill.style.width = "5%";
    modalProgressPct.textContent = "5%";
    modalTitle.textContent = "AI Đang Xử Lý Bài Hát...";
    modalSub.textContent = "Đang tách Beat và nhận diện lời từng từ trên GPU RTX 3060...";
    
    stepUpload.className = "step-item active";
    stepDemucs.className = "step-item";
    stepWhisper.className = "step-item";
    stepSub.className = "step-item";
}

function hideProgressModal() {
    processModal.style.display = "none";
}

function startPollingStatus(projectId) {
    if (state.pollTimer) clearInterval(state.pollTimer);

    state.pollTimer = setInterval(async () => {
        try {
            const res = await fetch(`/api/status/${projectId}`);
            if (!res.ok) return;

            const job = await res.json();
            updateModalProgress(job);

            if (job.status === "ready") {
                clearInterval(state.pollTimer);
                hideProgressModal();
                loadProjectData(job.data);
                switchTab("playerTab");
            } else if (job.status === "error") {
                clearInterval(state.pollTimer);
                alert(`Xử lý thất bại: ${job.error || job.message}`);
                hideProgressModal();
            }
        } catch (e) {
            console.error("Poll error:", e);
        }
    }, 1000);
}

function updateModalProgress(job) {
    const pct = job.progress || 10;
    modalProgressFill.style.width = `${pct}%`;
    modalProgressPct.textContent = `${pct}%`;
    modalSub.textContent = job.message || "Đang xử lý...";

    if (pct < 20) {
        stepUpload.className = "step-item active";
    } else if (pct < 55) {
        stepUpload.className = "step-item done";
        stepDemucs.className = "step-item active";
    } else if (pct < 80) {
        stepDemucs.className = "step-item done";
        stepWhisper.className = "step-item active";
    } else {
        stepWhisper.className = "step-item done";
        stepSub.className = "step-item active";
    }
}


/* ========================================================
   4. LOAD PROJECT DATA & PREPARE STUDIO
   ======================================================== */
function ensureConciseSegments(segments, maxWords = 5) {
    if (!segments || !segments.length) return [];
    let out = [];

    function splitSingleSeg(seg) {
        const words = seg.words || [];
        if (words.length <= maxWords && (seg.end - seg.start) <= 3.2) {
            return [seg];
        }
        if (words.length < 4) return [seg];

        let splitIdx = Math.floor(words.length / 2);
        for (let i = Math.max(1, Math.floor(words.length * 0.3)); i <= Math.min(words.length - 2, Math.floor(words.length * 0.7)); i++) {
            const w = words[i].word || "";
            if (/[,\.;\-!\?]/.test(w)) {
                splitIdx = i + 1;
                break;
            }
        }

        const wordsA = words.slice(0, splitIdx);
        const wordsB = words.slice(splitIdx);

        if (!wordsA.length || !wordsB.length) return [seg];

        const segA = {
            id: 0,
            start: wordsA[0].start,
            end: wordsA[wordsA.length - 1].end,
            text: wordsA.map(w => w.word).join(" "),
            words: wordsA
        };
        const segB = {
            id: 0,
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

function loadProjectData(projectData) {
    state.currentProject = projectData;
    state.activeLineIndex = -1;

    // Load Audio Stems
    if (projectData.stems) {
        beatAudio.src = projectData.stems.instrumental_mp3;
        vocalAudio.src = projectData.stems.vocals_mp3;
    }

    // Set Download Links
    dlInstrumentalBtn.href = projectData.stems?.instrumental_mp3 || "#";
    dlVocalBtn.href = projectData.stems?.vocals_mp3 || "#";
    dlAssSubBtn.href = projectData.subtitles?.ass || "#";
    dlLrcSubBtn.href = projectData.subtitles?.lrc || "#";

    if (projectData.video_url) {
        renderedVideoPlayer.src = projectData.video_url;
        renderedVideoPlayer.style.display = "block";
        emptyVideoPlaceholder.style.display = "none";
        dlVideoBtn.href = projectData.video_url;
        dlVideoBtn.style.display = "flex";
    } else {
        renderedVideoPlayer.style.display = "none";
        emptyVideoPlaceholder.style.display = "flex";
        dlVideoBtn.style.display = "none";
    }

    // Ensure all loaded segments strictly conform to 3-5 words per line
    projectData.segments = ensureConciseSegments(projectData.segments || [], 5);
    state.currentProject.segments = projectData.segments;

    // Populate Editor Table & Lyric Jump Drawer
    renderEditorTable(projectData.segments || []);
    renderLyricJumpList(projectData.segments || []);

    // Restore Saved Project Settings or Default to Studio Center
    const saved = projectData.settings || {};
    const presetToApply = saved.layout_preset || ((saved.line1_pos_x === 0.5 || saved.line1_pos_x === undefined) ? "center" : "staggered");
    state.isAutoFitEnabled = saved.is_autofit !== undefined ? saved.is_autofit : true;
    const chkAutoFit = document.getElementById("chkAutoFit");
    if (chkAutoFit) chkAutoFit.checked = state.isAutoFitEnabled;

    if (presetToApply === "center") {
        applyLayoutPreset("center", false);
    } else {
        state.line1PosY = saved.line1_pos_y !== undefined ? parseFloat(saved.line1_pos_y) : (projectData.line1_pos_y !== undefined ? parseFloat(projectData.line1_pos_y) : 0.60);
        state.line2PosY = saved.line2_pos_y !== undefined ? parseFloat(saved.line2_pos_y) : (projectData.line2_pos_y !== undefined ? parseFloat(projectData.line2_pos_y) : 0.76);
        state.line1PosX = saved.line1_pos_x !== undefined ? parseFloat(saved.line1_pos_x) : (projectData.line1_pos_x !== undefined ? parseFloat(projectData.line1_pos_x) : 0.08);
        state.line2PosX = saved.line2_pos_x !== undefined ? parseFloat(saved.line2_pos_x) : (projectData.line2_pos_x !== undefined ? parseFloat(projectData.line2_pos_x) : 0.42);
        state.fontSizeLine1 = saved.font_size_line1 || projectData.font_size_line1 || 52;
        state.fontSizeLine2 = saved.font_size_line2 || projectData.font_size_line2 || 52;

        applyLinePositionX(1, state.line1PosX);
        applyLinePositionX(2, state.line2PosX);
        applyLinePositionY(1, state.line1PosY);
        applyLinePositionY(2, state.line2PosY);
        applyLineFontSize(1, state.fontSizeLine1);
        applyLineFontSize(2, state.fontSizeLine2);
        document.getElementById("btnPresetStaggered")?.classList.add("active");
    }

    state.bgTheme = saved.bg_theme || "nebula";

    const fontToApply = saved.font_name || projectData.font_name || "'Outfit', sans-serif";
    applyStageFont(fontToApply);

    // Reset Player
    beatAudio.currentTime = 0;
    vocalAudio.currentTime = 0;
    trackSeekBar.value = 0;
    currentTimeLabel.textContent = "00:00";
    durationLabel.textContent = formatTime(projectData.duration || 0);

    // Initial Stage Text
    const kLine1Content = document.getElementById("kLine1Content") || kLine1;
    const kLine2Content = document.getElementById("kLine2Content") || kLine2;
    kLine1Content.innerHTML = `<span class="line-placeholder">${projectData.title || "Bài Hát Đã Sẵn Sàng"}</span>`;
    kLine2Content.innerHTML = `<span class="line-placeholder">Nhấn Phát để bắt đầu hát Karaoke</span>`;
}

// State for segment looping
let activeLoopSegment = null;

function showToastNotification(msg) {
    let toast = document.getElementById("studioToast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "studioToast";
        toast.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            background: rgba(14, 20, 35, 0.95);
            border: 1px solid var(--cyan-accent);
            color: #fff;
            padding: 10px 18px;
            border-radius: 8px;
            font-size: 0.88rem;
            font-weight: 700;
            box-shadow: 0 4px 20px rgba(0, 242, 254, 0.35);
            z-index: 9999;
            transition: opacity 0.3s ease, transform 0.3s ease;
            backdrop-filter: blur(10px);
        `;
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(10px)";
    }, 3000);
}

async function updateSegmentText(segIdx, newText) {
    if (!state.currentProject || !state.currentProject.segments) return;
    const segments = state.currentProject.segments;
    if (segIdx < 0 || segIdx >= segments.length) return;

    const trimmed = (newText || "").trim();
    if (!trimmed) return;

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

    renderEditorTable(segments);
    renderLyricJumpList(segments);
    updateKaraokeStage(beatAudio.currentTime);

    // Save to backend in background
    try {
        await fetch(`/api/update-lyrics/${state.currentProject.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                segments: segments,
                font_name: state.fontName || "Outfit",
                font_size: state.fontSizeLine1 || 52
            })
        });
        showToastNotification(`Đã lưu câu #${segIdx + 1}: "${trimmed}"`);
    } catch (err) {
        console.error("Save lyrics error:", err);
    }
}

function startDrawerInlineEdit(cardEl, segIdx) {
    const seg = state.currentProject?.segments?.[segIdx];
    if (!seg) return;
    const previewEl = cardEl.querySelector(".seg-text-preview");
    if (!previewEl || cardEl.classList.contains("in-edit-mode")) return;

    cardEl.classList.add("in-edit-mode");

    previewEl.innerHTML = `
        <div class="drawer-inline-edit-wrap">
            <input type="text" class="drawer-inline-input" value="${seg.text}" />
            <div class="drawer-inline-actions">
                <button type="button" class="btn-drawer-save">Lưu</button>
                <button type="button" class="btn-drawer-cancel">Hủy</button>
            </div>
        </div>
    `;

    const input = previewEl.querySelector(".drawer-inline-input");
    const btnSave = previewEl.querySelector(".btn-drawer-save");
    const btnCancel = previewEl.querySelector(".btn-drawer-cancel");

    if (input) {
        input.focus();
        input.select();

        const doSave = () => {
            const val = input.value;
            cardEl.classList.remove("in-edit-mode");
            updateSegmentText(segIdx, val);
        };

        const doCancel = () => {
            cardEl.classList.remove("in-edit-mode");
            previewEl.innerHTML = `"${seg.text}"`;
        };

        btnSave?.addEventListener("click", (e) => {
            e.stopPropagation();
            doSave();
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

function startStageInlineEdit(lineNum) {
    const lineEl = document.getElementById(lineNum === 1 ? "kLine1" : "kLine2");
    if (!lineEl || !state.currentProject || !state.currentProject.segments) return;

    let segIdx = parseInt(lineEl.dataset.segIdx);
    if (isNaN(segIdx) || segIdx < 0 || segIdx >= state.currentProject.segments.length) {
        segIdx = lineNum === 1 ? 0 : Math.min(1, state.currentProject.segments.length - 1);
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
            <input type="text" class="stage-inline-input" id="stageInlineInput_${lineNum}" value="${seg.text}" />
            <div class="stage-inline-actions">
                <button type="button" class="btn-stage-save" id="btnStageSave_${lineNum}">Lưu</button>
                <button type="button" class="btn-stage-cancel" id="btnStageCancel_${lineNum}">Hủy</button>
            </div>
        </div>
    `;

    const input = document.getElementById(`stageInlineInput_${lineNum}`);
    const btnSave = document.getElementById(`btnStageSave_${lineNum}`);
    const btnCancel = document.getElementById(`btnStageCancel_${lineNum}`);

    if (input) {
        input.focus();
        input.select();

        const doSave = () => {
            const val = input.value;
            lineEl.classList.remove("editing-text");
            updateSegmentText(segIdx, val);
        };

        const doCancel = () => {
            lineEl.classList.remove("editing-text");
            updateKaraokeStage(beatAudio.currentTime);
        };

        btnSave?.addEventListener("click", (e) => {
            e.stopPropagation();
            doSave();
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

function renderLyricJumpList(segments) {
    const listEl = document.getElementById("lyricJumpList");
    if (!listEl) return;
    listEl.innerHTML = "";

    if (!segments || !segments.length) {
        listEl.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem; padding: 10px;">Chưa có lời bài hát</div>`;
        return;
    }

    segments.forEach((seg, idx) => {
        const item = document.createElement("div");
        item.className = "segment-sync-card";
        item.dataset.start = seg.start;
        item.dataset.idx = idx;

        const dur = (seg.end - seg.start).toFixed(2);
        const curRole = seg.role || "all";

        item.innerHTML = `
            <div class="seg-card-top">
                <div class="seg-badge-group">
                    <span class="seg-idx-pill">Câu #${idx + 1}</span>
                    <span class="seg-time-pill">${formatTimeMs(seg.start)} ➔ ${formatTimeMs(seg.end)}</span>
                    <span class="seg-dur-pill">(${dur}s)</span>
                    <div class="role-btn-group" style="margin-left: 6px;">
                        <button type="button" class="role-chip role-all ${curRole === 'all' ? 'active' : ''}" onclick="setSegmentRole(${idx}, 'all')" title="Chung">Chung</button>
                        <button type="button" class="role-chip role-male ${curRole === 'male' ? 'active' : ''}" onclick="setSegmentRole(${idx}, 'male')" title="Nam">Nam</button>
                        <button type="button" class="role-chip role-female ${curRole === 'female' ? 'active' : ''}" onclick="setSegmentRole(${idx}, 'female')" title="Nữ">Nữ</button>
                        <button type="button" class="role-chip role-duet ${curRole === 'duet' ? 'active' : ''}" onclick="setSegmentRole(${idx}, 'duet')" title="Song ca">Đôi</button>
                    </div>
                </div>
                <div class="seg-actions-group">
                    <button class="btn-seg-action btn-seg-edit" data-idx="${idx}" title="Sửa nội dung câu này">Sửa chữ</button>
                    <button class="btn-seg-action btn-seg-play" data-idx="${idx}" title="Phát riêng câu này">Nghe thử</button>
                    <button class="btn-seg-action btn-seg-loop" data-idx="${idx}" title="Phát lặp lại câu này liên tục">Lặp câu</button>
                </div>
            </div>
            
            <div class="seg-text-preview" data-idx="${idx}" title="Bấm 1 lần để nhảy tới, bấm đúp hoặc bấm [Sửa chữ] để sửa">
                "${seg.text}"
            </div>

            <div class="seg-nudge-bar">
                <span class="seg-nudge-tag">Nhích nhịp câu #${idx + 1}:</span>
                <div class="seg-nudge-btns">
                    <button class="btn-nudge-step btn-nudge" data-idx="${idx}" data-delta="-100">-100ms</button>
                    <button class="btn-nudge-step btn-nudge" data-idx="${idx}" data-delta="-50">-50ms</button>
                    <button class="btn-nudge-step btn-nudge" data-idx="${idx}" data-delta="-10">-10ms</button>
                    <button class="btn-nudge-step btn-nudge" data-idx="${idx}" data-delta="10">+10ms</button>
                    <button class="btn-nudge-step btn-nudge" data-idx="${idx}" data-delta="50">+50ms</button>
                    <button class="btn-nudge-step btn-nudge" data-idx="${idx}" data-delta="100">+100ms</button>
                </div>
                <button class="btn-shift-future btn-shift-forward" data-idx="${idx}" title="Áp dụng độ lệch này cho tất cả các câu tiếp theo">Đẩy các câu sau</button>
            </div>
        `;

        // Edit button
        item.querySelector(".btn-seg-edit")?.addEventListener("click", (e) => {
            e.stopPropagation();
            startDrawerInlineEdit(item, idx);
        });

        // Play single segment
        item.querySelector(".btn-seg-play")?.addEventListener("click", (e) => {
            e.stopPropagation();
            playSegmentAudition(seg.start, seg.end, false);
        });

        // Loop segment
        item.querySelector(".btn-seg-loop")?.addEventListener("click", (e) => {
            e.stopPropagation();
            if (activeLoopSegment && activeLoopSegment.idx === idx) {
                // Stop loop
                activeLoopSegment = null;
                e.target.style.background = "";
                e.target.style.color = "";
            } else {
                activeLoopSegment = { idx: idx, start: seg.start, end: seg.end };
                document.querySelectorAll(".btn-seg-loop").forEach(b => {
                    b.style.background = "";
                    b.style.color = "";
                });
                e.target.style.background = "var(--cyan-accent)";
                e.target.style.color = "#000";
                playSegmentAudition(seg.start, seg.end, true);
            }
        });

        // Single click: seek. Double click: edit.
        let clickTimeout = null;
        const textPreviewEl = item.querySelector(".seg-text-preview");

        textPreviewEl?.addEventListener("click", (e) => {
            if (item.classList.contains("in-edit-mode")) return;
            if (clickTimeout) {
                clearTimeout(clickTimeout);
                clickTimeout = null;
                startDrawerInlineEdit(item, idx);
            } else {
                clickTimeout = setTimeout(() => {
                    clickTimeout = null;
                    seekToTime(seg.start);
                    if (!state.isPlaying) togglePlayPause();
                }, 250);
            }
        });

        // Nudge single segment
        item.querySelectorAll(".btn-nudge").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const deltaMs = parseInt(btn.dataset.delta);
                nudgeSingleSegment(idx, deltaMs, false);
            });
        });

        // Shift forward
        item.querySelector(".btn-shift-forward")?.addEventListener("click", (e) => {
            e.stopPropagation();
            const deltaStr = prompt(`Nhập số mili-giây muốn đẩy TẤT CẢ các câu từ câu #${idx + 1} về sau:\n(Ví dụ: +100 để trễ hơn 100ms, hoặc -50 để sớm hơn 50ms):`, "50");
            if (deltaStr !== null) {
                const deltaMs = parseInt(deltaStr);
                if (!isNaN(deltaMs)) {
                    nudgeSingleSegment(idx, deltaMs, true);
                    alert(`Đã dịch chuyển ${deltaMs >= 0 ? '+' : ''}${deltaMs}ms cho câu #${idx + 1} và tất cả các câu tiếp theo!`);
                }
            }
        });

        listEl.appendChild(item);
    });
}

function playSegmentAudition(startTime, endTime, isLoop) {
    seekToTime(startTime);
    const playIconText = document.getElementById("playIconText");
    if (!state.isPlaying) {
        beatAudio.play();
        vocalAudio.play();
        state.isPlaying = true;
        if (playIconText) playIconText.textContent = "Tạm dừng";
    }

    const checkAuditionStop = () => {
        if (beatAudio.currentTime >= (endTime + 0.1)) {
            if (activeLoopSegment && isLoop) {
                seekToTime(startTime);
            } else {
                beatAudio.pause();
                vocalAudio.pause();
                state.isPlaying = false;
                if (playIconText) playIconText.textContent = "Phát";
                beatAudio.removeEventListener("timeupdate", checkAuditionStop);
            }
        }
    };
    beatAudio.addEventListener("timeupdate", checkAuditionStop);
}

function nudgeSingleSegment(segIdx, deltaMs, shiftFollowing) {
    if (!state.currentProject || !state.currentProject.segments) return;
    const deltaSec = deltaMs / 1000;
    const segments = state.currentProject.segments;

    const startIdx = segIdx;
    const endIdx = shiftFollowing ? (segments.length - 1) : segIdx;

    for (let i = startIdx; i <= endIdx; i++) {
        const seg = segments[i];
        seg.start = Math.max(0, Math.round((seg.start + deltaSec) * 1000) / 1000);
        seg.end = Math.max(seg.start + 0.3, Math.round((seg.end + deltaSec) * 1000) / 1000);
        (seg.words || []).forEach(w => {
            w.start = Math.max(0, Math.round((w.start + deltaSec) * 1000) / 1000);
            w.end = Math.max(w.start + 0.05, Math.round((w.end + deltaSec) * 1000) / 1000);
        });
    }

    renderEditorTable(segments);
    renderLyricJumpList(segments);
    updateKaraokeStage(beatAudio.currentTime);
}

function seekToTime(targetSeconds) {
    targetSeconds = Math.max(0, targetSeconds);
    beatAudio.currentTime = targetSeconds;
    vocalAudio.currentTime = targetSeconds;
    currentTimeLabel.textContent = formatTime(targetSeconds);
    const dur = beatAudio.duration || state.currentProject?.duration || 1;
    trackSeekBar.value = (targetSeconds / dur) * 100;
    updateKaraokeStage(targetSeconds);
}

/* ========================================================
   5. SYNCHRONIZED KARAOKE PLAYER & STAGE ANIMATION
   ======================================================== */
function setupPlayer() {
    btnPlayPause.addEventListener("click", togglePlayPause);
    btnRewind10.addEventListener("click", () => seekRelative(-10));
    btnForward10.addEventListener("click", () => seekRelative(10));

    // Timeline Scrubbing & Seeking
    let isDraggingSeek = false;
    trackSeekBar.addEventListener("mousedown", () => { isDraggingSeek = true; });
    trackSeekBar.addEventListener("touchstart", () => { isDraggingSeek = true; }, { passive: true });

    trackSeekBar.addEventListener("input", (e) => {
        const pct = parseFloat(e.target.value) / 100;
        const dur = beatAudio.duration || state.currentProject?.duration || 1;
        const targetTime = pct * dur;
        currentTimeLabel.textContent = formatTime(targetTime);
        beatAudio.currentTime = targetTime;
        vocalAudio.currentTime = targetTime;
        updateKaraokeStage(targetTime);
    });

    trackSeekBar.addEventListener("change", (e) => {
        const pct = parseFloat(e.target.value) / 100;
        const dur = beatAudio.duration || state.currentProject?.duration || 1;
        const targetTime = pct * dur;
        seekToTime(targetTime);
        isDraggingSeek = false;
    });

    trackSeekBar.addEventListener("mouseup", () => { isDraggingSeek = false; });
    trackSeekBar.addEventListener("touchend", () => { isDraggingSeek = false; });

    // Studio Sub-Dock Navigation Toolbar Hooks
    const btnToggleLyricJump = document.getElementById("btnToggleLyricJump");
    const lyricJumpDrawer = document.getElementById("lyricJumpDrawer");
    btnToggleLyricJump?.addEventListener("click", () => {
        if (lyricJumpDrawer) {
            const isHidden = lyricJumpDrawer.style.display === "none";
            lyricJumpDrawer.style.display = isHidden ? "flex" : "none";
            btnToggleLyricJump.classList.toggle("active", isHidden);
        }
    });

    const btnToggleVisualCustomizer = document.getElementById("btnToggleVisualCustomizer");
    const stageCustomizerDrawer = document.getElementById("stageCustomizerDrawer");
    btnToggleVisualCustomizer?.addEventListener("click", () => {
        if (stageCustomizerDrawer) {
            const isHidden = stageCustomizerDrawer.style.display === "none";
            stageCustomizerDrawer.style.display = isHidden ? "block" : "none";
            btnToggleVisualCustomizer.classList.toggle("active", isHidden);
        }
    });

    const btnGoToEditor = document.getElementById("btnGoToEditor");
    btnGoToEditor?.addEventListener("click", () => {
        switchTab("editorTab");
    });

    const btnGoToExport = document.getElementById("btnGoToExport");
    btnGoToExport?.addEventListener("click", () => {
        switchTab("exportTab");
    });

    // Volume Mixer
    beatVolSlider.addEventListener("input", (e) => {
        const val = parseFloat(e.target.value);
        beatAudio.volume = val;
        beatVolText.textContent = `${Math.round(val * 100)}%`;
    });

    vocalVolSlider.addEventListener("input", (e) => {
        const val = parseFloat(e.target.value);
        vocalAudio.volume = val;
        vocalVolText.textContent = `${Math.round(val * 100)}%`;
    });

    // Key Pitch Transpose (-6 to +6 semitones)
    let currentPitchSemitones = 0;
    const btnPitchDown = document.getElementById("btnPitchDown");
    const btnPitchUp = document.getElementById("btnPitchUp");
    const btnPitchReset = document.getElementById("btnPitchReset");
    const pitchValText = document.getElementById("pitchValText");

    function applyPitchShift(semitones) {
        currentPitchSemitones = Math.max(-6, Math.min(6, currentPitchSemitones + semitones));
        if (pitchValText) {
            if (currentPitchSemitones === 0) {
                pitchValText.textContent = "Gốc (0)";
            } else {
                pitchValText.textContent = `${currentPitchSemitones > 0 ? '+' : ''}${currentPitchSemitones} Tone`;
            }
        }
        // HTML5 Audio playbackRate pitch shifting (preservesPitch = false)
        const rate = Math.pow(2, currentPitchSemitones / 12);
        try {
            beatAudio.preservesPitch = false;
            beatAudio.mozPreservesPitch = false;
            beatAudio.webkitPreservesPitch = false;
            beatAudio.playbackRate = rate;

            vocalAudio.preservesPitch = false;
            vocalAudio.mozPreservesPitch = false;
            vocalAudio.webkitPreservesPitch = false;
            vocalAudio.playbackRate = rate;
        } catch (err) {
            console.error("Pitch shift error:", err);
        }
    }

    btnPitchDown?.addEventListener("click", () => applyPitchShift(-1));
    btnPitchUp?.addEventListener("click", () => applyPitchShift(1));
    btnPitchReset?.addEventListener("click", () => {
        currentPitchSemitones = 0;
        applyPitchShift(0);
    });

    // Time Update Sync
    beatAudio.addEventListener("timeupdate", () => {
        const cur = beatAudio.currentTime;
        const dur = beatAudio.duration || state.currentProject?.duration || 1;
        
        currentTimeLabel.textContent = formatTime(cur);
        durationLabel.textContent = formatTime(dur);
        if (!isDraggingSeek) {
            trackSeekBar.value = (cur / dur) * 100;
        }

        // Keep Vocal track in exact sync
        if (Math.abs(vocalAudio.currentTime - cur) > 0.08) {
            vocalAudio.currentTime = cur;
        }

        // Highlight active item in Lyric Jump list
        const jumpItems = document.querySelectorAll(".lyric-jump-item");
        jumpItems.forEach(item => {
            const itemTime = parseFloat(item.dataset.start);
            if (cur >= itemTime && cur < (itemTime + 4.5)) {
                item.classList.add("active-now");
            } else {
                item.classList.remove("active-now");
            }
        });

        // Animate Karaoke Words
        updateKaraokeStage(cur);
    });

    beatAudio.addEventListener("ended", () => {
        state.isPlaying = false;
        playIcon.style.display = "block";
        pauseIcon.style.display = "none";
    });

    // Professional Real-time Timing Offset Controls
    let globalOffsetMs = 0;
    const offsetValText = document.getElementById("offsetValText");
    const offsetRangeSlider = document.getElementById("offsetRangeSlider");
    const btnOffsetReset = document.getElementById("btnOffsetReset");
    const btnOffsetMinus200 = document.getElementById("btnOffsetMinus200");
    const btnOffsetMinus50 = document.getElementById("btnOffsetMinus50");
    const btnOffsetMinus10 = document.getElementById("btnOffsetMinus10");
    const btnOffsetPlus10 = document.getElementById("btnOffsetPlus10");
    const btnOffsetPlus50 = document.getElementById("btnOffsetPlus50");
    const btnOffsetPlus200 = document.getElementById("btnOffsetPlus200");
    const btnSaveOffset = document.getElementById("btnSaveOffset");

    function updateOffsetDisplay() {
        if (!offsetValText) return;
        const sign = globalOffsetMs > 0 ? "+" : "";
        const secVal = (globalOffsetMs / 1000).toFixed(2);
        offsetValText.textContent = `${sign}${globalOffsetMs} ms (${sign}${secVal}s)`;
        if (offsetRangeSlider) {
            offsetRangeSlider.value = globalOffsetMs;
        }
    }

    function applyOffsetDelta(deltaMs) {
        const deltaSec = deltaMs / 1000;
        globalOffsetMs += deltaMs;
        updateOffsetDisplay();
        
        if (state.currentProject && state.currentProject.segments) {
            state.currentProject.segments.forEach(seg => {
                seg.start = Math.max(0, Math.round((seg.start + deltaSec) * 1000) / 1000);
                seg.end = Math.max(seg.start + 0.3, Math.round((seg.end + deltaSec) * 1000) / 1000);
                (seg.words || []).forEach(w => {
                    w.start = Math.max(0, Math.round((w.start + deltaSec) * 1000) / 1000);
                    w.end = Math.max(w.start + 0.05, Math.round((w.end + deltaSec) * 1000) / 1000);
                });
            });
            renderEditorTable(state.currentProject.segments);
            renderLyricJumpList(state.currentProject.segments);
        }
    }

    function resetOffsetToZero() {
        if (globalOffsetMs === 0) return;
        applyOffsetDelta(-globalOffsetMs);
        globalOffsetMs = 0;
        updateOffsetDisplay();
    }

    btnOffsetMinus200?.addEventListener("click", () => applyOffsetDelta(-200));
    btnOffsetMinus50?.addEventListener("click", () => applyOffsetDelta(-50));
    btnOffsetMinus10?.addEventListener("click", () => applyOffsetDelta(-10));
    btnOffsetPlus10?.addEventListener("click", () => applyOffsetDelta(10));
    btnOffsetPlus50?.addEventListener("click", () => applyOffsetDelta(50));
    btnOffsetPlus200?.addEventListener("click", () => applyOffsetDelta(200));
    btnOffsetReset?.addEventListener("click", resetOffsetToZero);

    let lastSliderVal = 0;
    offsetRangeSlider?.addEventListener("input", (e) => {
        const currentVal = parseInt(e.target.value);
        const diff = currentVal - lastSliderVal;
        lastSliderVal = currentVal;
        applyOffsetDelta(diff);
    });

    btnSaveOffset?.addEventListener("click", () => {
        handleSaveLyrics();
    });
}

function togglePlayPause() {
    if (!state.currentProject) {
        alert("Chưa có bài hát nào được nạp vào Studio!");
        return;
    }

    const playIconText = document.getElementById("playIconText");

    if (state.isPlaying) {
        beatAudio.pause();
        vocalAudio.pause();
        state.isPlaying = false;
        if (playIconText) playIconText.textContent = "Phát";
    } else {
        beatAudio.play().then(() => {
            vocalAudio.play();
            state.isPlaying = true;
            if (playIconText) playIconText.textContent = "Tạm dừng";
        }).catch(err => {
            console.error("Playback error:", err);
        });
    }
}

function seekRelative(delta) {
    const cur = beatAudio.currentTime;
    const target = Math.max(0, cur + delta);
    beatAudio.currentTime = target;
    vocalAudio.currentTime = target;
}


/* ========================================================
   5b. INDEPENDENT DRAGGABLE KARAOKE LINES & PROJECT SETTINGS
   ======================================================== */
function applyStageFont(fontFamily) {
    if (!fontFamily) return;
    state.fontName = fontFamily;

    const kLine1 = document.getElementById("kLine1");
    const kLine2 = document.getElementById("kLine2");
    const kLine1Content = document.getElementById("kLine1Content");
    const kLine2Content = document.getElementById("kLine2Content");

    if (kLine1) kLine1.style.fontFamily = fontFamily;
    if (kLine2) kLine2.style.fontFamily = fontFamily;
    if (kLine1Content) kLine1Content.style.fontFamily = fontFamily;
    if (kLine2Content) kLine2Content.style.fontFamily = fontFamily;

    document.querySelectorAll(".draggable-karaoke-line, .draggable-karaoke-line .line-content, .k-word, .line-placeholder").forEach(el => {
        el.style.fontFamily = fontFamily;
    });

    const stageFontSelect = document.getElementById("stageFontSelect");
    if (stageFontSelect && stageFontSelect.value !== fontFamily) {
        stageFontSelect.value = fontFamily;
    }

    const exportFontSelect = document.getElementById("fontSelect");
    if (exportFontSelect && exportFontSelect.value !== fontFamily) {
        for (let opt of exportFontSelect.options) {
            if (opt.value === fontFamily) {
                exportFontSelect.value = fontFamily;
                break;
            }
        }
    }
}

function applyLinePositionX(lineNum, posXFraction) {
    const stageScreen = document.getElementById("stageScreen");
    const lineEl = document.getElementById(lineNum === 1 ? "kLine1" : "kLine2");
    if (!stageScreen || !lineEl) return;

    const clamped = Math.max(0.02, Math.min(0.85, parseFloat(posXFraction)));
    if (lineNum === 1) state.line1PosX = clamped;
    else state.line2PosX = clamped;

    const isCenter = Math.abs(clamped - 0.50) < 0.04;
    if (isCenter) {
        lineEl.classList.add("align-center");
        lineEl.dataset.align = "center";
        lineEl.style.left = "50%";
    } else {
        lineEl.classList.remove("align-center");
        delete lineEl.dataset.align;
        const stageW = stageScreen.clientWidth || 800;
        const lineW = lineEl.clientWidth || 200;
        const maxLeft = Math.max(20, stageW - lineW - 20);
        const targetLeft = Math.max(10, Math.min(maxLeft, stageW * clamped));
        lineEl.style.left = `${targetLeft}px`;
    }

    const textEl = document.getElementById(lineNum === 1 ? "stagePosX1Text" : "stagePosX2Text");
    const sliderEl = document.getElementById(lineNum === 1 ? "stagePosX1Slider" : "stagePosX2Slider");
    const pctX = Math.round(clamped * 100);
    if (textEl) textEl.textContent = isCenter ? "50% (Giữa)" : `${pctX}%`;
    if (sliderEl) sliderEl.value = pctX;

    // Update Floating HUD Badge position label
    const hudPosEl = document.getElementById(lineNum === 1 ? "kLine1HudPos" : "kLine2HudPos");
    const curY = lineNum === 1 ? (state.line1PosY || 0.60) : (state.line2PosY || 0.76);
    const pctY = Math.round(curY * 100);
    if (hudPosEl) hudPosEl.textContent = isCenter ? `Giữa (50%) • Y: ${pctY}%` : `X: ${pctX}% Y: ${pctY}%`;

    const btnSelector = lineNum === 1 ? ".posX1-btn" : ".posX2-btn";
    document.querySelectorAll(btnSelector).forEach(btn => {
        const btnPos = parseFloat(btn.dataset.posx);
        btn.classList.toggle("active", Math.abs(btnPos - clamped) < 0.08);
    });

    if (state.isAutoFitEnabled !== false) {
        adjustLineAutoFit(lineEl, lineNum, (lineNum === 1 ? state.fontSizeLine1 : state.fontSizeLine2) || 52);
    }
}

function applyLinePositionY(lineNum, posYFraction) {
    const stageScreen = document.getElementById("stageScreen");
    const lineEl = document.getElementById(lineNum === 1 ? "kLine1" : "kLine2");
    if (!stageScreen || !lineEl) return;

    const clamped = Math.max(0.08, Math.min(0.92, parseFloat(posYFraction)));
    if (lineNum === 1) state.line1PosY = clamped;
    else state.line2PosY = clamped;

    const stageH = stageScreen.clientHeight || 480;
    const lineH = lineEl.clientHeight || 50;
    const maxTop = stageH - lineH - 10;
    const targetTop = Math.max(10, Math.min(maxTop, stageH * clamped));

    lineEl.style.top = `${targetTop}px`;

    const textEl = document.getElementById(lineNum === 1 ? "stagePosY1Text" : "stagePosY2Text");
    const sliderEl = document.getElementById(lineNum === 1 ? "stagePosY1Slider" : "stagePosY2Slider");
    const pctY = Math.round(clamped * 100);
    if (textEl) textEl.textContent = `${pctY}%`;
    if (sliderEl) sliderEl.value = pctY;

    // Update Floating HUD Badge position label
    const hudPosEl = document.getElementById(lineNum === 1 ? "kLine1HudPos" : "kLine2HudPos");
    const curX = lineNum === 1 ? (state.line1PosX || 0.08) : (state.line2PosX || 0.42);
    const pctX = Math.round(curX * 100);
    const isCenter = Math.abs(curX - 0.50) < 0.04;
    if (hudPosEl) hudPosEl.textContent = isCenter ? `Giữa (50%) • Y: ${pctY}%` : `X: ${pctX}% Y: ${pctY}%`;

    const btnSelector = lineNum === 1 ? ".pos1-btn" : ".pos2-btn";
    document.querySelectorAll(btnSelector).forEach(btn => {
        const btnPos = parseFloat(btn.dataset.pos);
        btn.classList.toggle("active", Math.abs(btnPos - clamped) < 0.08);
    });
}

function applyLinePosition(lineNum, posFraction) {
    applyLinePositionY(lineNum, posFraction);
}

function applyLineFontSize(lineNum, sizePx) {
    const lineEl = document.getElementById(lineNum === 1 ? "kLine1" : "kLine2");
    const val = Math.max(24, Math.min(90, parseInt(sizePx) || 52));
    if (lineNum === 1) {
        state.fontSizeLine1 = val;
        const textEl = document.getElementById("stageFontSize1Text");
        const sliderEl = document.getElementById("stageFontSize1Slider");
        if (textEl) textEl.textContent = `${val}px`;
        if (sliderEl) sliderEl.value = val;
    } else {
        state.fontSizeLine2 = val;
        const textEl = document.getElementById("stageFontSize2Text");
        const sliderEl = document.getElementById("stageFontSize2Slider");
        if (textEl) textEl.textContent = `${val}px`;
        if (sliderEl) sliderEl.value = val;
    }

    // Update Floating HUD Badge font size
    const hudSizeEl = document.getElementById(lineNum === 1 ? "kLine1HudSize" : "kLine2HudSize");
    if (hudSizeEl) hudSizeEl.textContent = `${val}px`;

    if (lineEl) {
        const contentEl = lineEl.querySelector(".line-content") || lineEl;
        contentEl.style.fontSize = `${val}px`;
        if (state.isAutoFitEnabled !== false) {
            adjustLineAutoFit(lineEl, lineNum, val);
        }
    }
}

function adjustLineAutoFit(container, lineNum, baseFontSize) {
    if (!container) return;
    const contentEl = container.querySelector(".line-content") || container;
    const stageScreen = document.getElementById("stageScreen");
    if (!stageScreen || !contentEl) return;

    // Reset to base size to accurately measure natural content width
    contentEl.style.fontSize = `${baseFontSize}px`;

    const stageW = stageScreen.clientWidth || 800;
    const isCenter = container.classList.contains("align-center") || container.dataset.align === "center";
    const safeMargin = 28;

    let availableW;
    if (isCenter) {
        availableW = stageW - (safeMargin * 2);
    } else {
        const leftPx = container.offsetLeft;
        availableW = Math.max(100, stageW - leftPx - safeMargin);
    }

    const textW = contentEl.scrollWidth;

    if (textW > availableW && availableW > 120) {
        const scale = (availableW - 8) / textW;
        const fittedSize = Math.max(26, Math.floor(baseFontSize * scale));
        contentEl.style.fontSize = `${fittedSize}px`;

        const hudSizeEl = document.getElementById(lineNum === 1 ? "kLine1HudSize" : "kLine2HudSize");
        if (hudSizeEl && fittedSize < baseFontSize) {
            hudSizeEl.textContent = `${fittedSize}px (Tự co)`;
        }
    } else {
        contentEl.style.fontSize = `${baseFontSize}px`;
        const hudSizeEl = document.getElementById(lineNum === 1 ? "kLine1HudSize" : "kLine2HudSize");
        if (hudSizeEl) {
            hudSizeEl.textContent = `${baseFontSize}px`;
        }
    }
}

function applyLayoutPreset(presetName, notify = true) {
    const stageScreen = document.getElementById("stageScreen");
    const kLine1 = document.getElementById("kLine1");
    const kLine2 = document.getElementById("kLine2");
    if (!stageScreen || !kLine1 || !kLine2) return;

    document.querySelectorAll(".btn-preset-chip").forEach(btn => btn.classList.remove("active"));

    if (presetName === "center") {
        state.layoutPreset = "center";
        state.line1Align = "center";
        state.line2Align = "center";

        kLine1.classList.add("align-center");
        kLine2.classList.add("align-center");
        kLine1.dataset.align = "center";
        kLine2.dataset.align = "center";

        state.line1PosX = 0.50;
        state.line2PosX = 0.50;
        state.line1PosY = 0.58;
        state.line2PosY = 0.76;

        applyLinePositionY(1, 0.58);
        applyLinePositionY(2, 0.76);
        applyLineFontSize(1, state.fontSizeLine1 || 56);
        applyLineFontSize(2, state.fontSizeLine2 || 56);

        const hudPos1 = document.getElementById("kLine1HudPos");
        const hudPos2 = document.getElementById("kLine2HudPos");
        if (hudPos1) hudPos1.textContent = "Giữa (50%) • Y: 58%";
        if (hudPos2) hudPos2.textContent = "Giữa (50%) • Y: 76%";

        const sliderX1 = document.getElementById("stagePosX1Slider");
        const sliderX2 = document.getElementById("stagePosX2Slider");
        const textX1 = document.getElementById("stagePosX1Text");
        const textX2 = document.getElementById("stagePosX2Text");
        if (sliderX1) sliderX1.value = 50;
        if (sliderX2) sliderX2.value = 50;
        if (textX1) textX1.textContent = "50% (Giữa)";
        if (textX2) textX2.textContent = "50% (Giữa)";

        document.getElementById("btnPresetCenter")?.classList.add("active");

        updateKaraokeStage(beatAudio.currentTime);
        if (notify) showToastNotification("🎯 Đã bật bố cục Căn Giữa Chuẩn Studio (Hình 2)!");
    } else if (presetName === "staggered") {
        state.layoutPreset = "staggered";
        state.line1Align = "left";
        state.line2Align = "right";

        kLine1.classList.remove("align-center");
        kLine2.classList.remove("align-center");
        kLine1.dataset.align = "left";
        kLine2.dataset.align = "right";

        applyLinePositionX(1, 0.08);
        applyLinePositionY(1, 0.60);
        applyLinePositionX(2, 0.42);
        applyLinePositionY(2, 0.76);
        applyLineFontSize(1, state.fontSizeLine1 || 52);
        applyLineFontSize(2, state.fontSizeLine2 || 52);

        document.getElementById("btnPresetStaggered")?.classList.add("active");

        updateKaraokeStage(beatAudio.currentTime);
        if (notify) showToastNotification("📐 Đã bật bố cục So Le Trái - Phải!");
    } else if (presetName === "autofit_all") {
        document.getElementById("btnPresetAutoFit")?.classList.add("active");

        const segments = state.currentProject?.segments || [];
        let maxChars = 0;
        let maxWords = 0;
        segments.forEach(seg => {
            const txt = (seg.text || "").trim();
            if (txt.length > maxChars) maxChars = txt.length;
            const wCount = (seg.words || []).length || txt.split(/\s+/).length;
            if (wCount > maxWords) maxWords = wCount;
        });

        let optimalSize = 56;
        if (maxChars > 42 || maxWords > 8) optimalSize = 46;
        else if (maxChars > 32 || maxWords > 6) optimalSize = 52;
        else if (maxChars > 22 || maxWords > 4) optimalSize = 58;
        else optimalSize = 64;

        applyLineFontSize(1, optimalSize);
        applyLineFontSize(2, optimalSize);

        updateKaraokeStage(beatAudio.currentTime);
        if (notify) showToastNotification(`✨ Đã tự động tối ưu cỡ chữ toàn bài: ${optimalSize}px!`);
    }

    if (state.currentProject) {
        saveProjectStageSettings();
    }
}

async function saveProjectStageSettings() {
    if (!state.currentProject) return;
    const stageFontSelect = document.getElementById("stageFontSelect");
    const colorInactive = document.getElementById("colorInactive");
    const colorActive = document.getElementById("colorActive");

    const payload = {
        line1_pos_x: state.line1PosX !== undefined ? state.line1PosX : 0.50,
        line2_pos_x: state.line2PosX !== undefined ? state.line2PosX : 0.50,
        line1_pos_y: state.line1PosY !== undefined ? state.line1PosY : 0.58,
        line2_pos_y: state.line2PosY !== undefined ? state.line2PosY : 0.76,
        font_size_line1: state.fontSizeLine1 || 56,
        font_size_line2: state.fontSizeLine2 || 56,
        font_size: state.fontSizeLine1 || 56,
        align_line1: state.line1Align || "center",
        align_line2: state.line2Align || "center",
        layout_preset: state.layoutPreset || "center",
        is_autofit: state.isAutoFitEnabled !== false,
        font_name: stageFontSelect ? stageFontSelect.value : "Outfit",
        primary_color: colorInactive ? hexToAssColor(colorInactive.value) : "&H00FFFFFF",
        karaoke_color: colorActive ? hexToAssColor(colorActive.value) : "&H0000E5FF",
        bg_theme: state.bgTheme || "nebula"
    };

    try {
        await fetch(`/api/project-settings/${state.currentProject.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
    } catch (err) {
        console.error("Save project settings error:", err);
    }
}

function setupDraggableSubtitle() {
    const stageScreen = document.getElementById("stageScreen");
    const kLine1 = document.getElementById("kLine1");
    const kLine2 = document.getElementById("kLine2");

    if (!stageScreen || !kLine1 || !kLine2) return;

    function attachDraggableToLine(lineEl, lineNum) {
        let isDragging = false;
        let isResizing = false;
        let startX = 0, startY = 0;
        let initialTopPx = 0, initialLeftPx = 0;
        let initialSize = 52;

        // 1. Mouse Wheel Zoom
        lineEl.addEventListener("wheel", (e) => {
            e.preventDefault();
            const cur = lineNum === 1 ? (state.fontSizeLine1 || 52) : (state.fontSizeLine2 || 52);
            const delta = e.deltaY < 0 ? 3 : -3;
            const newSize = Math.max(24, Math.min(88, cur + delta));
            applyLineFontSize(lineNum, newSize);
        }, { passive: false });

        // 2. Interactive Resize Corner Handle
        const resizeHandle = lineEl.querySelector(".line-resize-handle");
        if (resizeHandle) {
            resizeHandle.addEventListener("mousedown", (e) => {
                isResizing = true;
                startX = e.clientX;
                startY = e.clientY;
                initialSize = (lineNum === 1 ? state.fontSizeLine1 : state.fontSizeLine2) || 52;
                lineEl.classList.add("resizing");
                e.stopPropagation();
                e.preventDefault();
            });

            resizeHandle.addEventListener("touchstart", (e) => {
                if (e.touches.length === 1) {
                    isResizing = true;
                    startX = e.touches[0].clientX;
                    startY = e.touches[0].clientY;
                    initialSize = (lineNum === 1 ? state.fontSizeLine1 : state.fontSizeLine2) || 52;
                    lineEl.classList.add("resizing");
                    e.stopPropagation();
                }
            }, { passive: true });
        }

        // 3. Move / Dragging Line Block
        lineEl.addEventListener("mousedown", (e) => {
            if (e.target.closest(".line-resize-handle") || e.target.closest(".hud-btn-zoom") || e.target.closest(".hud-btn-edit") || e.target.closest(".stage-inline-edit-wrap")) return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            initialTopPx = lineEl.offsetTop;
            initialLeftPx = lineEl.offsetLeft;
            lineEl.classList.add("dragging");
            stageScreen.classList.add("dragging-active");

            if (lineEl.classList.contains("align-center")) {
                lineEl.classList.remove("align-center");
                delete lineEl.dataset.align;
                lineEl.style.left = `${initialLeftPx}px`;
                document.querySelectorAll(".btn-preset-chip").forEach(b => b.classList.remove("active"));
            }
            e.preventDefault();
        });

        lineEl.addEventListener("touchstart", (e) => {
            if (e.target.closest(".line-resize-handle") || e.target.closest(".hud-btn-zoom") || e.target.closest(".hud-btn-edit") || e.target.closest(".stage-inline-edit-wrap")) return;
            if (e.touches.length === 1) {
                isDragging = true;
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
                initialTopPx = lineEl.offsetTop;
                initialLeftPx = lineEl.offsetLeft;
                lineEl.classList.add("dragging");
                stageScreen.classList.add("dragging-active");

                if (lineEl.classList.contains("align-center")) {
                    lineEl.classList.remove("align-center");
                    delete lineEl.dataset.align;
                    lineEl.style.left = `${initialLeftPx}px`;
                    document.querySelectorAll(".btn-preset-chip").forEach(b => b.classList.remove("active"));
                }
            }
        }, { passive: true });

        // Double-click on stage line to directly edit text
        lineEl.addEventListener("dblclick", (e) => {
            if (e.target.closest(".line-resize-handle") || e.target.closest(".hud-btn-zoom") || e.target.closest(".stage-inline-edit-wrap")) return;
            e.stopPropagation();
            startStageInlineEdit(lineNum);
        });

        // 4. Global Movement Listeners
        window.addEventListener("mousemove", (e) => {
            if (isResizing) {
                const delta = ((e.clientX - startX) + (e.clientY - startY)) * 0.35;
                const newSize = Math.max(24, Math.min(88, Math.round(initialSize + delta)));
                applyLineFontSize(lineNum, newSize);
                return;
            }

            if (!isDragging) return;
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            const stageW = stageScreen.clientWidth || 800;
            const stageH = stageScreen.clientHeight || 480;
            const lineW = lineEl.clientWidth || 200;
            const lineH = lineEl.clientHeight || 50;

            const maxLeft = Math.max(20, stageW - lineW - 16);
            const maxTop = stageH - lineH - 10;

            const newLeft = Math.max(10, Math.min(maxLeft, initialLeftPx + deltaX));
            const newTop = Math.max(10, Math.min(maxTop, initialTopPx + deltaY));

            applyLinePositionX(lineNum, newLeft / stageW);
            applyLinePositionY(lineNum, newTop / stageH);
        });

        window.addEventListener("touchmove", (e) => {
            if (isResizing && e.touches.length === 1) {
                const delta = ((e.touches[0].clientX - startX) + (e.touches[0].clientY - startY)) * 0.35;
                const newSize = Math.max(24, Math.min(88, Math.round(initialSize + delta)));
                applyLineFontSize(lineNum, newSize);
                return;
            }

            if (!isDragging || e.touches.length !== 1) return;
            const deltaX = e.touches[0].clientX - startX;
            const deltaY = e.touches[0].clientY - startY;
            const stageW = stageScreen.clientWidth || 800;
            const stageH = stageScreen.clientHeight || 480;
            const lineW = lineEl.clientWidth || 200;
            const lineH = lineEl.clientHeight || 50;

            const maxLeft = Math.max(20, stageW - lineW - 16);
            const maxTop = stageH - lineH - 10;

            const newLeft = Math.max(10, Math.min(maxLeft, initialLeftPx + deltaX));
            const newTop = Math.max(10, Math.min(maxTop, initialTopPx + deltaY));

            applyLinePositionX(lineNum, newLeft / stageW);
            applyLinePositionY(lineNum, newTop / stageH);
        }, { passive: true });

        window.addEventListener("mouseup", () => {
            if (isDragging) {
                isDragging = false;
                lineEl.classList.remove("dragging");
                stageScreen.classList.remove("dragging-active");
            }
            if (isResizing) {
                isResizing = false;
                lineEl.classList.remove("resizing");
            }
        });

        window.addEventListener("touchend", () => {
            if (isDragging) {
                isDragging = false;
                lineEl.classList.remove("dragging");
                stageScreen.classList.remove("dragging-active");
            }
            if (isResizing) {
                isResizing = false;
                lineEl.classList.remove("resizing");
            }
        });
    }

    attachDraggableToLine(kLine1, 1);
    attachDraggableToLine(kLine2, 2);

    // Quick Layout Presets Listeners
    document.getElementById("btnPresetCenter")?.addEventListener("click", () => applyLayoutPreset("center"));
    document.getElementById("btnPresetStaggered")?.addEventListener("click", () => applyLayoutPreset("staggered"));
    document.getElementById("btnPresetAutoFit")?.addEventListener("click", () => applyLayoutPreset("autofit_all"));

    const chkAutoFit = document.getElementById("chkAutoFit");
    chkAutoFit?.addEventListener("change", (e) => {
        state.isAutoFitEnabled = e.target.checked;
        updateKaraokeStage(beatAudio.currentTime);
        showToastNotification(e.target.checked ? "Đã BẬT Auto-Fit chống tràn viền" : "Đã TẮT Auto-Fit");
    });

    // Floating HUD Quick Zoom Buttons
    document.querySelectorAll(".hud-btn-zoom").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const lineNum = parseInt(btn.dataset.line);
            const action = btn.dataset.action;
            const curSize = (lineNum === 1 ? state.fontSizeLine1 : state.fontSizeLine2) || 52;
            const newSize = action === "zoom-in" ? (curSize + 4) : (curSize - 4);
            applyLineFontSize(lineNum, newSize);
        });
    });

    // Floating HUD Quick Edit Button
    document.querySelectorAll(".hud-btn-edit").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const lineNum = parseInt(btn.dataset.line);
            startStageInlineEdit(lineNum);
        });
    });

    // Font Selector Change Listener
    const stageFontSelect = document.getElementById("stageFontSelect");
    stageFontSelect?.addEventListener("change", (e) => {
        applyStageFont(e.target.value);
    });

    // Font Size Sliders
    const size1Slider = document.getElementById("stageFontSize1Slider");
    const size2Slider = document.getElementById("stageFontSize2Slider");

    size1Slider?.addEventListener("input", (e) => {
        applyLineFontSize(1, e.target.value);
    });

    size2Slider?.addEventListener("input", (e) => {
        applyLineFontSize(2, e.target.value);
    });

    // Quick Zoom Buttons in Drawer
    document.getElementById("btnZoomIn1")?.addEventListener("click", () => {
        applyLineFontSize(1, (state.fontSizeLine1 || 52) + 4);
    });
    document.getElementById("btnZoomOut1")?.addEventListener("click", () => {
        applyLineFontSize(1, (state.fontSizeLine1 || 52) - 4);
    });
    document.getElementById("btnZoomIn2")?.addEventListener("click", () => {
        applyLineFontSize(2, (state.fontSizeLine2 || 52) + 4);
    });
    document.getElementById("btnZoomOut2")?.addEventListener("click", () => {
        applyLineFontSize(2, (state.fontSizeLine2 || 52) - 4);
    });

    // 9-Point Grid Matrix Click Handlers
    document.querySelectorAll(".matrix-cell").forEach(cell => {
        cell.addEventListener("click", () => {
            const lineNum = parseInt(cell.dataset.line);
            const posX = parseFloat(cell.dataset.x);
            const posY = parseFloat(cell.dataset.y);

            const gridId = lineNum === 1 ? "matrixGridLine1" : "matrixGridLine2";
            document.querySelectorAll(`#${gridId} .matrix-cell`).forEach(c => c.classList.remove("active"));
            cell.classList.add("active");

            applyLinePositionX(lineNum, posX);
            applyLinePositionY(lineNum, posY);
            saveProjectStageSettings();
        });
    });

    // Inspector Tabs Switcher
    const tabBtnStyle = document.getElementById("tabBtnStyle");
    const tabBtnPosition = document.getElementById("tabBtnPosition");
    const paneStyle = document.getElementById("paneStyle");
    const panePosition = document.getElementById("panePosition");

    tabBtnStyle?.addEventListener("click", () => {
        tabBtnStyle.classList.add("active");
        tabBtnPosition?.classList.remove("active");
        if (paneStyle) paneStyle.style.display = "block";
        if (panePosition) panePosition.style.display = "none";
    });

    tabBtnPosition?.addEventListener("click", () => {
        tabBtnPosition.classList.add("active");
        tabBtnStyle?.classList.remove("active");
        if (panePosition) panePosition.style.display = "block";
        if (paneStyle) paneStyle.style.display = "none";
    });

    // Fine Sync Toggle
    const btnToggleFineSync = document.getElementById("btnToggleFineSync");
    const fineSyncDrawer = document.getElementById("fineSyncDrawer");
    btnToggleFineSync?.addEventListener("click", () => {
        if (fineSyncDrawer) {
            const isHidden = fineSyncDrawer.style.display === "none";
            fineSyncDrawer.style.display = isHidden ? "block" : "none";
            btnToggleFineSync.textContent = isHidden ? "▲" : "▼";
        }
    });

    // Cinema / Clean Immersion Mode Toggle
    const btnToggleCinema = document.getElementById("btnToggleCinema");
    btnToggleCinema?.addEventListener("click", () => {
        const stageWrapper = document.querySelector(".karaoke-stage-wrapper") || document.querySelector(".studio-main-col") || document.body;
        const isCinema = stageWrapper.classList.toggle("cinema-active");
        btnToggleCinema.classList.toggle("active", isCinema);
        btnToggleCinema.innerHTML = isCinema ? "<span>✖ Thoát Rạp</span>" : "<span>🔲 Rạp Chiếu</span>";
        showToastNotification(isCinema ? "🔲 Đã bật Chế độ Rạp Chiếu (Toàn màn hình sạch)" : "Đã trở về chế độ Studio");
    });

    // Save Project Settings Button
    const btnSaveProjectSettings = document.getElementById("btnSaveProjectSettings");
    const btnResetProjectSettings = document.getElementById("btnResetProjectSettings");
    const settingsSavedMsg = document.getElementById("settingsSavedMsg");

    btnSaveProjectSettings?.addEventListener("click", async () => {
        if (!state.currentProject) {
            alert("Chưa có bài hát nào được nạp!");
            return;
        }

        await saveProjectStageSettings();
        showToastNotification("✨ Đã lưu cấu hình bài hát thành công!");
    });

    btnResetProjectSettings?.addEventListener("click", () => {
        applyLayoutPreset("center");
        showToastNotification("↺ Đã đặt lại cấu hình mặc định!");
    });
}


/**
 * Seamless 2-Line Alternating Karaoke Stage Engine
 */
function updateKaraokeStage(currentTime) {
    const segments = state.currentProject?.segments || [];
    if (!segments.length) return;

    // 1. Lead-in Countdown Dots Check
    renderCountdownDots(currentTime, segments);

    // 2. Find current active segment (being sung or closest upcoming)
    let activeIdx = -1;
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (currentTime >= seg.start && currentTime <= (seg.end + 0.15)) {
            activeIdx = i;
            break;
        }
    }

    if (activeIdx === -1) {
        // Between lines or intro: find next upcoming segment
        for (let i = 0; i < segments.length; i++) {
            if (segments[i].start > currentTime) {
                activeIdx = i;
                break;
            }
        }
    }

    if (activeIdx === -1) {
        // Song ended: show last lines
        activeIdx = Math.max(0, segments.length - 1);
    }

    if (activeIdx % 2 === 0) {
        // Active line is EVEN (0, 2, 4...) -> Sung on Top Line (Line 1)
        renderKaraokeLine(kLine1, segments[activeIdx], currentTime, true);
        const nextSeg = segments[activeIdx + 1] || null;
        renderKaraokeLine(kLine2, nextSeg, currentTime, false);
    } else {
        // Active line is ODD (1, 3, 5...) -> Sung on Bottom Line (Line 2)
        renderKaraokeLine(kLine2, segments[activeIdx], currentTime, true);
        const nextSeg = segments[activeIdx + 1] || null;
        renderKaraokeLine(kLine1, nextSeg, currentTime, false);
    }
}

function renderCountdownDots(currentTime, segments) {
    const wrap = document.getElementById("stageCountdownWrap");
    if (!wrap) return;

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

    // Show countdown if intro or interlude >= 2.0s and within 2.0s before start
    if (gapDuration >= 2.0 && timeLeft > 0.05 && timeLeft <= 2.0) {
        wrap.style.display = "flex";
        const dots = wrap.querySelectorAll(".c-dot");
        if (dots.length >= 4) {
            dots[0].classList.toggle("active", timeLeft <= 2.0);
            dots[1].classList.toggle("active", timeLeft <= 1.5);
            dots[2].classList.toggle("active", timeLeft <= 1.0);
            dots[3].classList.toggle("active", timeLeft <= 0.5);
        }
    } else {
        wrap.style.display = "none";
        wrap.querySelectorAll(".c-dot").forEach(d => d.classList.remove("active"));
    }
}

function renderKaraokeLine(container, segment, currentTime, isCurrent) {
    if (!container) return;
    if (segment && segment.id !== undefined) {
        container.dataset.segIdx = segment.id;
    } else {
        container.dataset.segIdx = "";
    }

    if (container.classList.contains("editing-text")) {
        return; // Don't overwrite when user is editing text inline
    }

    const contentEl = container.querySelector(".line-content") || container;
    if (!segment) {
        contentEl.innerHTML = "";
        return;
    }

    const words = segment.words || [];
    const role = segment.role || "all";
    const roleClass = role !== "all" ? `role-${role}` : "";
    let html = "";

    words.forEach(w => {
        const isSung = isCurrent && (currentTime >= w.start);
        html += `<span class="k-word ${roleClass} ${isSung ? 'active-sung' : ''}">${w.word}</span> `;
    });

    contentEl.innerHTML = html;

    // Smart Auto-Fit per segment
    const lineNum = container.id === "kLine1" ? 1 : 2;
    const baseFontSize = (lineNum === 1 ? state.fontSizeLine1 : state.fontSizeLine2) || 52;

    if (state.isAutoFitEnabled !== false) {
        adjustLineAutoFit(container, lineNum, baseFontSize);
    } else {
        contentEl.style.fontSize = `${baseFontSize}px`;
    }
}


/* ========================================================
   6. LYRICS & TIMING EDITOR & DRAWER
   ======================================================== */
function setupEditor() {
    btnSaveLyrics.addEventListener("click", handleSaveLyrics);
    btnReloadAI.addEventListener("click", () => {
        if (state.currentProject) {
            renderEditorTable(state.currentProject.segments || []);
        }
    });

    const btnAutoSplitLongLines = document.getElementById("btnAutoSplitLongLines");
    btnAutoSplitLongLines?.addEventListener("click", () => {
        if (!state.currentProject || !state.currentProject.segments) {
            alert("Chưa có dữ liệu bài hát để chia câu!");
            return;
        }

        let originalSegments = state.currentProject.segments;
        let newSegments = [];

        function splitSegmentObj(seg) {
            const words = seg.words || [];
            if (words.length <= 5 && (seg.end - seg.start) <= 3.2) {
                return [seg];
            }
            if (words.length < 4) return [seg];

            let splitIdx = Math.floor(words.length / 2);
            for (let i = Math.max(1, Math.floor(words.length * 0.3)); i <= Math.min(words.length - 2, Math.floor(words.length * 0.7)); i++) {
                const w = words[i].word || "";
                if (/[,\.;\-!\?]/.test(w)) {
                    splitIdx = i + 1;
                    break;
                }
            }

            const wordsA = words.slice(0, splitIdx);
            const wordsB = words.slice(splitIdx);

            if (!wordsA.length || !wordsB.length) return [seg];

            const segA = {
                id: 0,
                start: wordsA[0].start,
                end: wordsA[wordsA.length - 1].end,
                text: wordsA.map(w => w.word).join(" "),
                words: wordsA,
                role: seg.role || "all"
            };
            const segB = {
                id: 0,
                start: wordsB[0].start,
                end: wordsB[wordsB.length - 1].end,
                text: wordsB.map(w => w.word).join(" "),
                words: wordsB,
                role: seg.role || "all"
            };

            return [...splitSegmentObj(segA), ...splitSegmentObj(segB)];
        }

        originalSegments.forEach(seg => {
            newSegments.push(...splitSegmentObj(seg));
        });

        newSegments.forEach((seg, idx) => { seg.id = idx; });
        state.currentProject.segments = newSegments;
        renderEditorTable(newSegments);
        renderLyricJumpList(newSegments);
        updateKaraokeStage(beatAudio.currentTime);
        alert(`Đã tự động chia các câu dài thành công! Hiện có ${newSegments.length} dòng.`);
    });

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

    // Drawer Toggles
    const btnToggleLyricJump = document.getElementById("btnToggleLyricJump");
    const btnToggleVisualCustomizer = document.getElementById("btnToggleVisualCustomizer");
    const lyricJumpDrawer = document.getElementById("lyricJumpDrawer");
    const stageCustomizerDrawer = document.getElementById("stageCustomizerDrawer");

    btnToggleLyricJump?.addEventListener("click", () => {
        if (lyricJumpDrawer) {
            const isHidden = lyricJumpDrawer.style.display === "none";
            lyricJumpDrawer.style.display = isHidden ? "block" : "none";
            if (stageCustomizerDrawer) stageCustomizerDrawer.style.display = "none";
            btnToggleLyricJump.classList.toggle("active", isHidden);
            btnToggleVisualCustomizer?.classList.remove("active");
        }
    });

    btnToggleVisualCustomizer?.addEventListener("click", () => {
        if (stageCustomizerDrawer) {
            const isHidden = stageCustomizerDrawer.style.display === "none";
            stageCustomizerDrawer.style.display = isHidden ? "block" : "none";
            if (lyricJumpDrawer) lyricJumpDrawer.style.display = "none";
            btnToggleVisualCustomizer.classList.toggle("active", isHidden);
            btnToggleLyricJump?.classList.remove("active");
        }
    });

    // Quick jump to editor/export
    document.getElementById("btnGoToEditor")?.addEventListener("click", () => switchTab("editorTab"));
    document.getElementById("btnGoToExport")?.addEventListener("click", () => switchTab("exportTab"));

    // Initialize Tap-to-Sync & Studio Mic
    setupTapToSync();
    setupStudioMic();
}

function renderEditorTable(segments) {
    if (!lyricsTableBody) return;
    lyricsTableBody.innerHTML = "";

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
                if (!state.isPlaying) togglePlayPause();
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
            </div>
        `;
        tr.appendChild(tdAction);

        lyricsTableBody.appendChild(tr);
    });
}

function renderLyricJumpList(segments) {
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
            <div class="jump-item-actions" style="display: flex; gap: 4px; margin-top: 6px;">
                <button class="btn-micro-step" onclick="playSegmentAudition(${seg.start}, ${seg.end}, false)">Nghe thử</button>
                <button class="btn-micro-step" onclick="playSegmentAudition(${seg.start}, ${seg.end}, true)">Lặp lại</button>
                <button class="btn-micro-step" onclick="nudgeSingleSegment(${idx}, -50, false)">-50ms</button>
                <button class="btn-micro-step" onclick="nudgeSingleSegment(${idx}, 50, false)">+50ms</button>
            </div>
        `;
        listEl.appendChild(item);
    });
}

window.setSegmentRole = function(segIdx, newRole) {
    if (!state.currentProject || !state.currentProject.segments) return;
    const seg = state.currentProject.segments[segIdx];
    if (!seg) return;
    seg.role = newRole;
    renderLyricJumpList(state.currentProject.segments);
    renderEditorTable(state.currentProject.segments);
    updateKaraokeStage(beatAudio.currentTime);
    saveProjectStageSettings();
    showToastNotification(`🎭 Đã gán vai câu #${segIdx + 1}: ${newRole === 'male' ? 'Nam' : newRole === 'female' ? 'Nữ' : newRole === 'duet' ? 'Song ca' : 'Chung'}`);
};

window.playSegmentAudition = function(start, end, loop = false) {
    beatAudio.currentTime = start;
    vocalAudio.currentTime = start;
    if (!state.isPlaying) togglePlayPause();

    if (loop) {
        clearInterval(window._auditionInterval);
        window._auditionInterval = setInterval(() => {
            if (beatAudio.currentTime >= end) {
                beatAudio.currentTime = start;
                vocalAudio.currentTime = start;
            }
        }, 80);
    }
};

window.nudgeSingleSegment = function(segIdx, deltaMs, propagate = false) {
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
};

window.playSegmentAudio = function(startTime) {
    beatAudio.currentTime = startTime;
    vocalAudio.currentTime = startTime;
    if (!state.isPlaying) togglePlayPause();
};

/* ========================================================
   LIVE TAP-TO-SYNC (SPACEBAR) ENGINE
   ======================================================== */
let tapSyncState = {
    isActive: false,
    queue: [],
    currentIndex: 0
};

function setupTapToSync() {
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
            showToastNotification("🎉 Đã gõ nhịp hết toàn bộ bài hát!");
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
        showToastNotification("✅ Đã lưu nhịp mới vào bài hát!");
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

/* ========================================================
   LIVE STUDIO MIC & ECHO/REVERB & RECORDING ENGINE
   ======================================================== */
let micContext = null;
let micStream = null;
let micSourceNode = null;
let micGainNode = null;
let micEchoGain = null;
let micReverbGain = null;
let micEchoDelay = null;
let micEchoFeedback = null;
let micConvolver = null;
let micRecorder = null;
let micRecChunks = [];
let micRecTimer = null;
let micRecSeconds = 0;

function setupStudioMic() {
    const btnToggleMic = document.getElementById("btnToggleMic");
    const micLiveIndicator = document.getElementById("micLiveIndicator");
    const btnRecordVocal = document.getElementById("btnRecordVocal");
    const recTimerBadge = document.getElementById("recTimerBadge");
    const btnDownloadRec = document.getElementById("btnDownloadRec");
    const micVolSlider = document.getElementById("micVolSlider");
    const micEchoSlider = document.getElementById("micEchoSlider");
    const micReverbSlider = document.getElementById("micReverbSlider");

    btnToggleMic?.addEventListener("click", async () => {
        if (micStream) {
            micStream.getTracks().forEach(t => t.stop());
            micStream = null;
            btnToggleMic.classList.remove("active");
            const toggleText = document.getElementById("micToggleText");
            if (toggleText) toggleText.textContent = "Bật Micro Hát Live";
            if (micLiveIndicator) micLiveIndicator.style.display = "none";
            showToastNotification("🎤 Đã tắt Micro");
            return;
        }

        try {
            micStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });

            if (!micContext) {
                micContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (micContext.state === "suspended") {
                await micContext.resume();
            }

            micSourceNode = micContext.createMediaStreamSource(micStream);
            micGainNode = micContext.createGain();
            micGainNode.gain.value = parseFloat(micVolSlider?.value || 1);

            // Echo Delay
            micEchoDelay = micContext.createDelay();
            micEchoDelay.delayTime.value = 0.28;
            micEchoFeedback = micContext.createGain();
            micEchoFeedback.gain.value = 0.40;
            micEchoGain = micContext.createGain();
            micEchoGain.gain.value = parseFloat(micEchoSlider?.value || 0.30);

            micEchoDelay.connect(micEchoFeedback);
            micEchoFeedback.connect(micEchoDelay);
            micEchoDelay.connect(micEchoGain);

            // Studio Reverb
            micConvolver = micContext.createConvolver();
            micConvolver.buffer = createStudioImpulseResponse(micContext, 2.0, 2.5);
            micReverbGain = micContext.createGain();
            micReverbGain.gain.value = parseFloat(micReverbSlider?.value || 0.35);
            micConvolver.connect(micReverbGain);

            micSourceNode.connect(micGainNode);
            micGainNode.connect(micContext.destination);
            micGainNode.connect(micEchoDelay);
            micGainNode.connect(micConvolver);
            micEchoGain.connect(micContext.destination);
            micReverbGain.connect(micContext.destination);

            btnToggleMic.classList.add("active");
            const toggleText = document.getElementById("micToggleText");
            if (toggleText) toggleText.textContent = "Tắt Micro Hát Live";
            if (micLiveIndicator) micLiveIndicator.style.display = "inline-block";
            showToastNotification("🎤 Đã bật Micro Hát Live (Echo & Reverb Studio)!");
        } catch (err) {
            console.error("Mic error:", err);
            alert("Không thể truy cập Micro: " + err.message);
        }
    });

    micVolSlider?.addEventListener("input", (e) => {
        const val = parseFloat(e.target.value);
        if (micGainNode) micGainNode.gain.value = val;
        const txt = document.getElementById("micVolText");
        if (txt) txt.textContent = `${Math.round(val * 100)}%`;
    });

    micEchoSlider?.addEventListener("input", (e) => {
        const val = parseFloat(e.target.value);
        if (micEchoGain) micEchoGain.gain.value = val;
        const txt = document.getElementById("micEchoText");
        if (txt) txt.textContent = `${Math.round(val * 100)}%`;
    });

    micReverbSlider?.addEventListener("input", (e) => {
        const val = parseFloat(e.target.value);
        if (micReverbGain) micReverbGain.gain.value = val;
        const txt = document.getElementById("micReverbText");
        if (txt) txt.textContent = `${Math.round(val * 100)}%`;
    });

    btnRecordVocal?.addEventListener("click", () => {
        if (!micStream) {
            alert("Vui lòng BẬT MICRO trước khi ghi âm!");
            return;
        }

        if (micRecorder && micRecorder.state === "recording") {
            micRecorder.stop();
            btnRecordVocal.classList.remove("recording");
            const recBtnText = document.getElementById("recBtnText");
            if (recBtnText) recBtnText.textContent = "Thu Âm Giọng Hát";
            clearInterval(micRecTimer);
            if (recTimerBadge) recTimerBadge.style.display = "none";
            showToastNotification("⏹️ Đã hoàn thành bản thu âm!");
            return;
        }

        micRecChunks = [];
        try {
            micRecorder = new MediaRecorder(micStream);
            micRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) micRecChunks.push(e.data);
            };
            micRecorder.onstop = () => {
                const blob = new Blob(micRecChunks, { type: "audio/webm" });
                const url = URL.createObjectURL(blob);
                if (btnDownloadRec) {
                    btnDownloadRec.href = url;
                    btnDownloadRec.style.display = "inline-flex";
                    btnDownloadRec.download = `karaoke_recording_${Date.now()}.webm`;
                }
            };
            micRecorder.start(100);

            btnRecordVocal.classList.add("recording");
            const recBtnText = document.getElementById("recBtnText");
            if (recBtnText) recBtnText.textContent = "Dừng Thu Âm";
            micRecSeconds = 0;
            if (recTimerBadge) {
                recTimerBadge.style.display = "inline-block";
                recTimerBadge.textContent = "00:00";
            }
            micRecTimer = setInterval(() => {
                micRecSeconds++;
                const mins = String(Math.floor(micRecSeconds / 60)).padStart(2, '0');
                const secs = String(micRecSeconds % 60).padStart(2, '0');
                if (recTimerBadge) recTimerBadge.textContent = `${mins}:${secs}`;
            }, 1000);

            if (beatAudio.paused) beatAudio.play();
            showToastNotification("🔴 Đang thu âm giọng hát...");
        } catch (err) {
            console.error("Recording error:", err);
            alert("Lỗi thu âm: " + err.message);
        }
    });
}

function createStudioImpulseResponse(ctx, duration = 2.0, decay = 2.0) {
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * duration;
    const impulse = ctx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
        const n = i / length;
        const e = Math.exp(-n * decay);
        left[i] = (Math.random() * 2 - 1) * e;
        right[i] = (Math.random() * 2 - 1) * e;
    }
    return impulse;
}

window.playSegmentAudio = function(startTime) {
    beatAudio.currentTime = startTime;
    vocalAudio.currentTime = startTime;
    if (!state.isPlaying) togglePlayPause();
};

async function handleSaveLyrics() {
    if (!state.currentProject) return;

    const projectId = state.currentProject.id;
    const rows = lyricsTableBody.querySelectorAll("tr");
    const updatedSegments = [];

    rows.forEach((r, idx) => {
        const startVal = parseTimeMs(r.querySelector(".seg-start").value);
        const endVal = parseTimeMs(r.querySelector(".seg-end").value);
        const lineText = r.querySelector(".line-text-input").value.trim();
        
        // Split line text into words and preserve timestamps
        const originalWords = state.currentProject.segments[idx]?.words || [];
        const wordsArr = lineText.split(/\s+/);
        const newWords = [];

        const totalWords = wordsArr.length;
        const timeDelta = Math.max(0.1, endVal - startVal) / Math.max(1, totalWords);

        wordsArr.forEach((w, wIdx) => {
            const orig = originalWords[wIdx];
            newWords.append = newWords.push({
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
                font_name: "Arial",
                font_size: 54,
                primary_color: hexToAssColor(colorInactive.value),
                karaoke_color: hexToAssColor(colorActive.value),
                subtitle_pos_y: state.subtitlePosY || 0.75
            })
        });

        const data = await res.json();
        if (res.ok) {
            state.currentProject.segments = updatedSegments;
            alert("Đã cập nhật lời và phụ đề Karaoke thành công!");
        } else {
            alert(`Lỗi: ${data.detail}`);
        }
    } catch (e) {
        alert(`Lỗi lưu: ${e.message}`);
    }
}


/* ========================================================
   7. VIDEO EXPORT & CUSTOMIZER
   ======================================================== */
function setupExport() {
    // Visual Customizer Drawer & Stage Theme Controls
    const btnToggleVisualCustomizer = document.getElementById("btnToggleVisualCustomizer");
    const stageCustomizerDrawer = document.getElementById("stageCustomizerDrawer");
    const stageFontSelect = document.getElementById("stageFontSelect");
    const exportFontSelect = document.getElementById("exportFontSelect");
    const stageFontSizeSlider = document.getElementById("stageFontSizeSlider");
    const stageFontSizeText = document.getElementById("stageFontSizeText");
    const bgChips = document.querySelectorAll(".bg-chip");
    const btnUploadStageBg = document.getElementById("btnUploadStageBg");
    const stageBgFileInput = document.getElementById("stageBgFileInput");
    const stageScreen = document.getElementById("stageScreen") || document.getElementById("karaokeScreen");

    btnToggleVisualCustomizer?.addEventListener("click", () => {
        if (stageCustomizerDrawer) {
            const isHidden = stageCustomizerDrawer.style.display === "none";
            stageCustomizerDrawer.style.display = isHidden ? "block" : "none";
        }
    });

    // Font change
    function updateStageFont(fontFamily, fontNameClean) {
        if (kLine1) kLine1.style.fontFamily = fontFamily;
        if (kLine2) kLine2.style.fontFamily = fontFamily;
        if (stageFontSelect && stageFontSelect.value !== fontFamily) stageFontSelect.value = fontFamily;
        if (exportFontSelect && exportFontSelect.value !== fontNameClean) exportFontSelect.value = fontNameClean;
    }

    stageFontSelect?.addEventListener("change", (e) => {
        const selectedFont = e.target.value;
        const fontName = selectedFont.split(",")[0].replace(/['"]/g, "").trim();
        updateStageFont(selectedFont, fontName);
    });

    exportFontSelect?.addEventListener("change", (e) => {
        const fontName = e.target.value;
        const fullFontFamily = `'${fontName}', sans-serif`;
        updateStageFont(fullFontFamily, fontName);
    });

    // Font size change
    stageFontSizeSlider?.addEventListener("input", (e) => {
        const sz = e.target.value;
        if (stageFontSizeText) stageFontSizeText.textContent = `${sz}px`;
        if (kLine1) kLine1.style.fontSize = `${sz}px`;
        if (kLine2) kLine2.style.fontSize = `${sz}px`;
    });

    // Preset background chips
    bgChips.forEach(chip => {
        chip.addEventListener("click", () => {
            bgChips.forEach(c => c.classList.remove("active"));
            chip.classList.add("active");
            const bgType = chip.dataset.bg;
            
            if (stageScreen) {
                // Remove existing custom bg media
                const existingMedia = stageScreen.querySelector(".stage-screen-bg-media");
                if (existingMedia) existingMedia.remove();

                // Clear classes
                stageScreen.className = "stage-screen";
                stageScreen.classList.add(`bg-${bgType}`);
            }
        });
    });

    // Upload custom background (Image or Video)
    btnUploadStageBg?.addEventListener("click", () => stageBgFileInput?.click());
    stageBgFileInput?.addEventListener("change", async (e) => {
        if (e.target.files.length > 0 && stageScreen) {
            const file = e.target.files[0];
            const isVideo = file.type.startsWith("video/");
            const mediaUrl = URL.createObjectURL(file);

            // Remove old media
            const existingMedia = stageScreen.querySelector(".stage-screen-bg-media");
            if (existingMedia) existingMedia.remove();

            let mediaEl;
            if (isVideo) {
                mediaEl = document.createElement("video");
                mediaEl.src = mediaUrl;
                mediaEl.autoplay = true;
                mediaEl.loop = true;
                mediaEl.muted = true;
                mediaEl.playsInline = true;
            } else {
                mediaEl = document.createElement("img");
                mediaEl.src = mediaUrl;
            }
            mediaEl.className = "stage-screen-bg-media";
            stageScreen.prepend(mediaEl);

            // If project is loaded, also upload to server
            if (state.currentProject) {
                const formData = new FormData();
                formData.append("file", file);
                try {
                    const res = await fetch(`/api/upload-background/${state.currentProject.id}`, {
                        method: "POST",
                        body: formData
                    });
                    const data = await res.json();
                    if (res.ok) {
                        state.customBgPath = data.url;
                        if (bgStatusText) bgStatusText.textContent = `Đã chọn: ${file.name}`;
                    }
                } catch (err) {
                    console.error("Upload BG failed:", err);
                }
            }
        }
    });

    // Theme buttons in Export Tab
    themeBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            themeBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const theme = btn.dataset.theme;
            applyThemeColors(theme);
        });
    });

    // Custom Background Upload in Export Tab
    btnSelectBgFile?.addEventListener("click", () => bgFileInput.click());
    bgFileInput?.addEventListener("change", async (e) => {
        if (e.target.files.length > 0 && state.currentProject) {
            const file = e.target.files[0];
            const formData = new FormData();
            formData.append("file", file);

            bgStatusText.textContent = `Đang tải: ${file.name}...`;

            try {
                const res = await fetch(`/api/upload-background/${state.currentProject.id}`, {
                    method: "POST",
                    body: formData
                });
                const data = await res.json();
                if (res.ok) {
                    state.customBgPath = data.url;
                    bgStatusText.textContent = `Đã chọn nền: ${file.name}`;
                    bgStatusText.style.color = "var(--green-accent)";
                } else {
                    bgStatusText.textContent = `Lỗi: ${data.detail}`;
                }
            } catch (err) {
                bgStatusText.textContent = `Lỗi tải lên: ${err.message}`;
            }
        }
    });

    btnStartRender.addEventListener("click", handleStartRender);
}

function applyThemeColors(theme) {
    if (theme === "gold") {
        colorInactive.value = "#ffffff";
        colorActive.value = "#FFE259";
    } else if (theme === "cyan") {
        colorInactive.value = "#ffffff";
        colorActive.value = "#00F2FE";
    } else if (theme === "pink") {
        colorInactive.value = "#ffffff";
        colorActive.value = "#FF758C";
    } else if (theme === "white") {
        colorInactive.value = "#888888";
        colorActive.value = "#FFFFFF";
    }
}

async function handleStartRender() {
    if (!state.currentProject) {
        alert("Chưa có bài hát nào được nạp để xuất video!");
        return;
    }

    const projectId = state.currentProject.id;
    const resolution = videoResolutionSelect.value;
    const fontName = exportFontSelect ? exportFontSelect.value : "Outfit";
    const fontSize = state.fontSizeLine1 || state.fontSizeLine2 || 54;
    const primColor = hexToAssColor(colorInactive.value);
    const sungColor = hexToAssColor(colorActive.value);

    btnStartRender.disabled = true;
    btnStartRender.innerHTML = `<span>Đang xuất video (${fontName} - GPU NVENC)...</span>`;

    try {
        const res = await fetch(`/api/render-video/${projectId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                resolution: resolution,
                font_name: fontName,
                font_size: fontSize,
                primary_color: primColor,
                karaoke_color: sungColor,
                line1_pos_x: state.line1PosX !== undefined ? state.line1PosX : 0.50,
                line2_pos_x: state.line2PosX !== undefined ? state.line2PosX : 0.50,
                line1_pos_y: state.line1PosY !== undefined ? state.line1PosY : 0.58,
                line2_pos_y: state.line2PosY !== undefined ? state.line2PosY : 0.76,
                font_size_line1: state.fontSizeLine1 || 56,
                font_size_line2: state.fontSizeLine2 || 56,
                align_line1: state.line1Align || "center",
                align_line2: state.line2Align || "center",
                layout_preset: state.layoutPreset || "center"
            })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Lỗi xuất video");

        renderedVideoPlayer.src = data.video_url;
        renderedVideoPlayer.style.display = "block";
        emptyVideoPlaceholder.style.display = "none";
        
        dlVideoBtn.href = data.download_url;
        dlVideoBtn.style.display = "flex";

        const btnOpenLocalFolder = document.getElementById("btnOpenLocalFolder");
        if (btnOpenLocalFolder) {
            btnOpenLocalFolder.style.display = "flex";
            btnOpenLocalFolder.onclick = async () => {
                try {
                    await fetch(`/api/open-folder/${projectId}`, { method: "POST" });
                } catch (err) {
                    console.error("Open folder failed:", err);
                }
            };
        }

        alert("Xuất Video Karaoke MP4 thành công! Bạn có thể xem thử trực tiếp, bấm Tải về, hoặc bấm Mở Thư Mục Trên Máy.");

    } catch (e) {
        alert(`Lỗi xuất video: ${e.message}`);
    } finally {
        btnStartRender.disabled = false;
        btnStartRender.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="5 3 19 12 5 21 5 3"/></svg><span>XUẤT VIDEO KARAOKE MP4 (GPU NVENC)</span>`;
    }
}


/* ========================================================
   8. PROJECTS LIBRARY
   ======================================================== */
async function loadProjectsList() {
    btnRefreshLibrary.addEventListener("click", loadProjectsList);
    try {
        const res = await fetch("/api/projects");
        const data = await res.json();
        state.projectsList = data.projects || [];
        renderProjectsGrid();
    } catch (e) {
        console.error("Failed to load projects", e);
    }
}

function renderProjectsGrid() {
    projectsGrid.innerHTML = "";
    if (!state.projectsList.length) {
        projectsGrid.innerHTML = `<p style="color: var(--text-muted);">Chưa có bài hát nào. Hãy tạo bài đầu tiên ở tab Tạo Bài Mới!</p>`;
        return;
    }

    state.projectsList.forEach(p => {
        const card = document.createElement("div");
        card.className = "project-card";
        card.innerHTML = `
            <div class="p-title" title="${p.title}">🎵 ${p.title}</div>
            <div class="p-meta">Thời lượng: ${formatTime(p.duration)} • Ngôn ngữ: ${(p.language || 'vi').toUpperCase()}</div>
            <div class="p-actions">
                <button class="btn-primary btn-sm" onclick="loadExistingProject('${p.id}')">▶ Mở Phòng Thu</button>
                ${p.video_url ? `<a href="${p.video_url}" class="btn-secondary btn-sm" download>🎬 Tải MP4</a>` : ''}
            </div>
        `;
        projectsGrid.appendChild(card);
    });
}

window.loadExistingProject = async function(projectId) {
    try {
        const res = await fetch(`/api/status/${projectId}`);
        const data = await res.json();
        if (data.status === "ready") {
            loadProjectData(data.data);
            switchTab("playerTab");
        }
    } catch (e) {
        alert("Không thể tải dự án này.");
    }
};


/* ========================================================
   9. AUDIO VISUALIZER CANVAS
   ======================================================== */
function initVisualizer() {
    const canvas = visualizerCanvas;
    const ctx = canvas.getContext("2d");

    function resizeCanvas() {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
    }
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    function draw() {
        requestAnimationFrame(draw);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!state.isPlaying) return;

        const w = canvas.width;
        const h = canvas.height;
        const bars = 48;
        const barWidth = w / bars;

        for (let i = 0; i < bars; i++) {
            // Simulated audio wave amplitude for smooth ambient glow
            const time = Date.now() * 0.004;
            const barHeight = Math.sin(time + i * 0.3) * 60 + Math.cos(time * 0.7 + i * 0.2) * 40 + 80;

            const grad = ctx.createLinearGradient(0, h - barHeight, 0, h);
            grad.addColorStop(0, "rgba(0, 242, 254, 0.8)");
            grad.addColorStop(0.5, "rgba(140, 43, 238, 0.4)");
            grad.addColorStop(1, "transparent");

            ctx.fillStyle = grad;
            ctx.fillRect(i * barWidth + 2, h - barHeight, barWidth - 4, barHeight);
        }
    }
    draw();
}


/* ========================================================
   10. UTILITIES
   ======================================================== */
function formatTime(seconds) {
    if (isNaN(seconds)) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatTimeMs(seconds) {
    if (isNaN(seconds)) return "00:00.00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const cs = Math.floor((seconds - Math.floor(seconds)) * 100);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
}

function parseTimeMs(str) {
    try {
        const parts = str.trim().split(":");
        const m = parseFloat(parts[0]);
        const s = parseFloat(parts[1]);
        return m * 60 + s;
    } catch {
        return 0;
    }
}

function roundNum(val) {
    return Math.round(val * 100) / 100;
}

function hexToAssColor(hex) {
    // Convert #RRGGBB to &H00BBGGRR&
    hex = hex.replace("#", "");
    if (hex.length === 6) {
        const r = hex.substring(0, 2);
        const g = hex.substring(2, 4);
        const b = hex.substring(4, 6);
        return `&H00${b}${g}${r}&`.toUpperCase();
    }
    return "&H00FFFFFF&";
}


/* ========================================================
   11. LIBRARY & PROJECT MANAGEMENT (WITH DELETE)
   ======================================================== */
async function loadProjectsList() {
    if (!projectsGrid) return;
    try {
        const res = await fetch("/api/projects");
        if (!res.ok) return;
        const data = await res.json();
        state.projectsList = data.projects || [];
        renderProjectsGrid(state.projectsList);
    } catch (e) {
        console.error("Failed to load projects list:", e);
    }
}

function renderProjectsGrid(projects) {
    if (!projectsGrid) return;

    if (!projects || projects.length === 0) {
        projectsGrid.innerHTML = `
            <div class="library-empty-state">
                <h3 class="library-empty-title">Chưa có bài hát nào trong thư viện</h3>
                <p class="library-empty-desc">Hãy tải lên một file bài hát hoặc dán liên kết để AI tách Beat và tạo video Karaoke tức thì.</p>
                <button class="btn-primary" onclick="switchTab('createTab')">Tạo Bài Mới Ngay</button>
            </div>
        `;
        return;
    }

    projectsGrid.innerHTML = projects.map(p => {
        const status = p.status || "ready";
        const statusLabel = status === "ready" ? "Sẵn sàng" : (status === "processing" ? "Đang xử lý" : "Lỗi");
        const statusClass = status === "ready" ? "ready" : (status === "processing" ? "processing" : "error");
        const formattedDate = p.created_at ? new Date(p.created_at * 1000).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : "Vừa tạo";
        const safeTitle = (p.title || "Bài hát").replace(/"/g, "&quot;");
        const safeId = p.id;

        return `
            <div class="project-card glass-card" id="projCard_${safeId}">
                <div class="project-card-header">
                    <span class="project-status-badge ${statusClass}">${statusLabel}</span>
                    <span class="project-date">${formattedDate}</span>
                </div>
                <h3 class="project-title" title="${safeTitle}">${safeTitle}</h3>
                <div class="project-meta-row">
                    <span class="project-meta-pill">${formatTime(p.duration || 0)}</span>
                    <span class="project-meta-pill">Ngôn ngữ: ${p.language || 'vi'}</span>
                    <span class="project-meta-pill">${p.lyrics_source === 'hybrid_acoustic_aligned' ? 'Lời Chuẩn + AI' : (p.lyrics_source === 'imported_file' ? 'File Lời Ngoài' : 'Whisper AI')}</span>
                </div>
                <div class="project-card-actions">
                    <button class="btn-sm btn-primary" onclick="openProjectInStudio('${safeId}')" title="Mở phòng thu để hát và chỉnh nhạc">
                        Hát / Thu
                    </button>
                    <button class="btn-sm btn-secondary" onclick="openProjectInExport('${safeId}')" title="Xuất video MP4">
                        Xuất Video
                    </button>
                    <button class="btn-sm btn-secondary" onclick="openProjectFolder('${safeId}')" title="Mở thư mục chứa file trên máy">
                        Thư Mục
                    </button>
                    <button class="btn-sm btn-danger" onclick="confirmDeleteProject('${safeId}', '${encodeURIComponent(p.title || "Bài hát")}')" title="Xóa bài hát này khỏi máy">
                        Xóa
                    </button>
                </div>
            </div>
        `;
    }).join("");
}

async function openProjectInStudio(projectId) {
    try {
        const res = await fetch(`/api/status/${projectId}`);
        if (!res.ok) throw new Error("Không thể tải thông tin bài hát");
        const data = await res.json();
        if (data.data) {
            loadProjectData(data.data);
            switchTab("playerTab");
        } else {
            alert("Bài hát này chưa sẵn sàng hoặc bị lỗi.");
        }
    } catch (e) {
        alert("Lỗi: " + e.message);
    }
}

async function openProjectInExport(projectId) {
    try {
        const res = await fetch(`/api/status/${projectId}`);
        if (!res.ok) throw new Error("Không thể tải thông tin bài hát");
        const data = await res.json();
        if (data.data) {
            loadProjectData(data.data);
            switchTab("exportTab");
        }
    } catch (e) {
        alert("Lỗi: " + e.message);
    }
}

async function confirmDeleteProject(projectId, encodedTitle) {
    const title = decodeURIComponent(encodedTitle);
    const confirmed = confirm(`BẠN CÓ CHẮC MUỐN XÓA BÀI HÁT NÀY?\n\n"${title}"\n\nToàn bộ file beat, vocal tách rời và phụ đề liên quan sẽ được xóa vĩnh viễn khỏi máy tính.`);
    if (!confirmed) return;

    try {
        const res = await fetch(`/api/project/${projectId}`, {
            method: "DELETE"
        });
        const data = await res.json();

        if (res.ok && data.status === "success") {
            // Animate card removal
            const card = document.getElementById(`projCard_${projectId}`);
            if (card) {
                card.style.transition = "all 0.3s ease";
                card.style.opacity = "0";
                card.style.transform = "scale(0.9)";
            }

            setTimeout(() => {
                // If currently playing the deleted song, reset player
                if (state.currentProject && state.currentProject.id === projectId) {
                    beatAudio.pause();
                    vocalAudio.pause();
                    state.currentProject = null;
                    document.getElementById("songTitle").textContent = "Chưa chọn bài hát";
                }
                loadProjectsList();
            }, 300);
        } else {
            alert("Lỗi khi xóa bài hát: " + (data.detail || data.message || "Unknown error"));
        }
    } catch (e) {
        alert("Lỗi kết nối máy chủ: " + e.message);
    }
}

// Attach Refresh button handler
btnRefreshLibrary?.addEventListener("click", () => {
    btnRefreshLibrary.textContent = "Đang tải...";
    loadProjectsList().finally(() => {
        setTimeout(() => {
            btnRefreshLibrary.textContent = "Làm Mới";
        }, 400);
    });
});

