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
    fontSizeLine1: 54,
    fontSizeLine2: 54,
    fontName: "Tahoma, sans-serif",
    bgTheme: "nebula",
    colorActive: "#0018F5",
    colorInactive: "#ffffff",
    currentPitchSemitones: 0,
    wipingFxMode: "smooth",
    showCountdownDots: true
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
const modeStemsBtn = document.getElementById("modeStemsBtn");
const dropZone = document.getElementById("dropZone");
const urlZone = document.getElementById("urlZone");
const stemsZone = document.getElementById("stemsZone");
const audioFileInput = document.getElementById("audioFileInput");
const selectedFilePill = document.getElementById("selectedFilePill");
const selectedFileName = document.getElementById("selectedFileName");
const clearFileBtn = document.getElementById("clearFileBtn");
const urlInput = document.getElementById("urlInput");
const clearUrlBtn = document.getElementById("clearUrlBtn");

const instDropZone = document.getElementById("instDropZone");
const instFileInput = document.getElementById("instFileInput");
const instFilePill = document.getElementById("instFilePill");
const instFileName = document.getElementById("instFileName");
const clearInstFileBtn = document.getElementById("clearInstFileBtn");

const vocalDropZone = document.getElementById("vocalDropZone");
const vocalFileInput = document.getElementById("vocalFileInput");
const vocalFilePill = document.getElementById("vocalFilePill");
const vocalFileName = document.getElementById("vocalFileName");
const clearVocalFileBtn = document.getElementById("clearVocalFileBtn");
const stemsSongTitle = document.getElementById("stemsSongTitle");

let selectedInstFile = null;
let selectedVocalFile = null;

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
const dlSrtSubBtn = document.getElementById("dlSrtSubBtn");


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
        state.cudaAvailable = data.cuda_available;
        const hwInput = document.getElementById("hardwareModeInput");
        const hwGpuBtn = document.getElementById("hwGpuBtn");
        const hwCpuBtn = document.getElementById("hwCpuBtn");

        if (data.cuda_available) {
            gpuStatusText.textContent = `${data.gpu_name} • GPU CUDA Online`;
            gpuStatusText.style.color = "#10B981";
            if (hwInput) hwInput.value = "gpu";
            if (hwGpuBtn && hwCpuBtn) {
                hwGpuBtn.classList.add("active");
                hwCpuBtn.classList.remove("active");
            }
        } else {
            const cpuLabel = data.gpu_name ? `Phần Cứng: ${data.gpu_name}` : "Phần Cứng: CPU Đa Luồng";
            gpuStatusText.textContent = cpuLabel;
            gpuStatusText.style.color = "#38BDF8";
            if (hwInput) hwInput.value = "cpu";
            if (hwGpuBtn && hwCpuBtn) {
                hwCpuBtn.classList.add("active");
                hwGpuBtn.classList.remove("active");
                hwGpuBtn.style.opacity = "0.6";
                const gpuSub = hwGpuBtn.querySelector(".hw-sub");
                if (gpuSub) gpuSub.textContent = "Máy không có card rời NVIDIA • Đã kích hoạt Chế Độ CPU Siêu Tốc";
            }
            if (whisperModelSelect) {
                whisperModelSelect.value = data.recommended_whisper || "tiny";
            }
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

    // Guided 3-Step Journey Bar for Beginners
    document.querySelectorAll(".stepper-step").forEach(step => {
        step.addEventListener("click", () => {
            const targetTab = step.getAttribute("data-tab");
            if (targetTab) switchTab(targetTab);
        });
    });

    document.getElementById("btnGoToEditor")?.addEventListener("click", () => switchTab("editorTab"));
    document.getElementById("btnGoToExport")?.addEventListener("click", () => switchTab("exportTab"));
    document.getElementById("btnRedirectToStudioExport")?.addEventListener("click", () => switchTab("exportTab"));
}

function scrollToStudioExport() {
    if (typeof openInspectorPane === "function") {
        openInspectorPane("paneExport");
    }
    setTimeout(() => {
        const el = document.getElementById("stageInspectorContainer");
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }, 100);
}

function syncGuidedStepper(activeTab, isExport = false) {
    const step1 = document.getElementById("step1Indicator");
    const step2 = document.getElementById("step2Indicator");
    const step3 = document.getElementById("step3Indicator");
    if (!step1 || !step2 || !step3) return;

    step1.classList.remove("active");
    step2.classList.remove("active");
    step3.classList.remove("active");

    if (activeTab === "createTab") {
        step1.classList.add("active");
    } else if (isExport || activeTab === "exportTab") {
        step3.classList.add("active");
    } else {
        step2.classList.add("active");
    }
}

function switchTab(targetId) {
    let shouldScrollExport = false;
    if (targetId === "exportTab") {
        targetId = "playerTab";
        shouldScrollExport = true;
    }

    navTabs.forEach(t => {
        t.classList.toggle("active", t.getAttribute("data-tab") === targetId);
    });
    tabPanes.forEach(p => {
        p.classList.toggle("active", p.id === targetId);
    });

    // Sync Guided Stepper Bar (1-2-3)
    syncGuidedStepper(targetId, shouldScrollExport);

    if (targetId === "libraryTab") {
        loadProjectsList();
    }
    if (shouldScrollExport) {
        scrollToStudioExport();
    }
}


/* ========================================================
   3. UPLOAD & JOB PROCESSING
   ======================================================== */
let selectedFile = null;

function extractCleanMediaUrl(raw) {
    if (!raw) return "";
    let s = raw.trim();
    const lastHttp = s.lastIndexOf("http");
    if (lastHttp > 0) {
        return s.substring(lastHttp).trim();
    }
    return s;
}

function resetCreationForm() {
    if (urlInput) urlInput.value = "";
    selectedFile = null;
    if (audioFileInput) audioFileInput.value = "";
    if (selectedFilePill) selectedFilePill.style.display = "none";
    selectedInstFile = null;
    if (instFileInput) instFileInput.value = "";
    if (instFilePill) instFilePill.style.display = "none";
    selectedVocalFile = null;
    if (vocalFileInput) vocalFileInput.value = "";
    if (vocalFilePill) vocalFilePill.style.display = "none";
    if (stemsSongTitle) stemsSongTitle.value = "";
    const lyricsInput = document.getElementById("customLyricsInput");
    if (lyricsInput) lyricsInput.value = "";
    const badge = document.getElementById("lyricsStatusBadge");
    if (badge) badge.style.display = "none";
}

function setupUploadHandlers() {
    modeFileBtn.addEventListener("click", () => {
        modeFileBtn.classList.add("active");
        modeUrlBtn.classList.remove("active");
        modeStemsBtn?.classList.remove("active");
        dropZone.style.display = "block";
        urlZone.style.display = "none";
        if (stemsZone) stemsZone.style.display = "none";
    });

    modeUrlBtn.addEventListener("click", () => {
        modeUrlBtn.classList.add("active");
        modeFileBtn.classList.remove("active");
        modeStemsBtn?.classList.remove("active");
        urlZone.style.display = "block";
        dropZone.style.display = "none";
        if (stemsZone) stemsZone.style.display = "none";
    });

    modeStemsBtn?.addEventListener("click", () => {
        modeStemsBtn.classList.add("active");
        modeFileBtn.classList.remove("active");
        modeUrlBtn.classList.remove("active");
        if (stemsZone) stemsZone.style.display = "block";
        dropZone.style.display = "none";
        urlZone.style.display = "none";
    });

    // Stems Dropzones & Inputs
    if (instDropZone && instFileInput) {
        instDropZone.addEventListener("click", () => instFileInput.click());
        instDropZone.addEventListener("dragover", (e) => { e.preventDefault(); instDropZone.classList.add("dragover"); });
        instDropZone.addEventListener("dragleave", () => instDropZone.classList.remove("dragover"));
        instDropZone.addEventListener("drop", (e) => {
            e.preventDefault();
            instDropZone.classList.remove("dragover");
            if (e.dataTransfer.files.length > 0) handleInstFileSelected(e.dataTransfer.files[0]);
        });
        instFileInput.addEventListener("change", (e) => {
            if (e.target.files.length > 0) handleInstFileSelected(e.target.files[0]);
        });
        clearInstFileBtn?.addEventListener("click", (e) => {
            e.stopPropagation();
            selectedInstFile = null;
            instFileInput.value = "";
            if (instFilePill) instFilePill.style.display = "none";
        });
    }

    if (vocalDropZone && vocalFileInput) {
        vocalDropZone.addEventListener("click", () => vocalFileInput.click());
        vocalDropZone.addEventListener("dragover", (e) => { e.preventDefault(); vocalDropZone.classList.add("dragover"); });
        vocalDropZone.addEventListener("dragleave", () => vocalDropZone.classList.remove("dragover"));
        vocalDropZone.addEventListener("drop", (e) => {
            e.preventDefault();
            vocalDropZone.classList.remove("dragover");
            if (e.dataTransfer.files.length > 0) handleVocalFileSelected(e.dataTransfer.files[0]);
        });
        vocalFileInput.addEventListener("change", (e) => {
            if (e.target.files.length > 0) handleVocalFileSelected(e.target.files[0]);
        });
        clearVocalFileBtn?.addEventListener("click", (e) => {
            e.stopPropagation();
            selectedVocalFile = null;
            vocalFileInput.value = "";
            if (vocalFilePill) vocalFilePill.style.display = "none";
        });
    }

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
        const badge = document.getElementById("lyricsStatusBadge");
        if (badge) badge.style.display = "none";
    });

    clearUrlBtn?.addEventListener("click", () => {
        if (urlInput) urlInput.value = "";
        const badge = document.getElementById("lyricsStatusBadge");
        if (badge) badge.style.display = "none";
    });

    urlInput?.addEventListener("focus", function() {
        this.select();
    });

    urlInput?.addEventListener("click", function() {
        if (this.value) this.select();
    });

    urlInput?.addEventListener("paste", function() {
        setTimeout(() => {
            if (!urlInput) return;
            const raw = urlInput.value;
            const cleaned = extractCleanMediaUrl(raw);
            if (cleaned !== raw) {
                urlInput.value = cleaned;
                showToastNotification("Đã tự động lọc đường link mới nhất!");
            }
        }, 10);
    });

    urlInput?.addEventListener("input", function() {
        const raw = urlInput.value;
        const cleaned = extractCleanMediaUrl(raw);
        if (cleaned !== raw) {
            urlInput.value = cleaned;
        }
    });

    // Auto-fetch Lyrics Button
    const btnAutoFetchLyrics = document.getElementById("btnAutoFetchLyrics");
    btnAutoFetchLyrics?.addEventListener("click", () => {
        let defaultVal = "";
        if (selectedFile) {
            defaultVal = selectedFile.name;
        } else if (urlInput && urlInput.value) {
            defaultVal = urlInput.value;
        }
        const userQuery = prompt("Nhập tên bài hát hoặc ca sĩ để tìm lời online:", defaultVal);
        if (userQuery && userQuery.trim()) {
            triggerOnlineLyricsSearch(userQuery.trim(), true);
        }
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

    // AI Transcription Engine Toggle (Whisper vs Gemini)
    const engineWhisperBtn = document.getElementById("engineWhisperBtn");
    const engineGeminiBtn = document.getElementById("engineGeminiBtn");
    const transcriptionEngineInput = document.getElementById("transcriptionEngineInput");
    const geminiIdeaGroup = document.getElementById("geminiIdeaGroup");

    engineWhisperBtn?.addEventListener("click", () => {
        engineWhisperBtn.classList.add("active");
        engineGeminiBtn?.classList.remove("active");
        if (transcriptionEngineInput) transcriptionEngineInput.value = "whisper";
        if (geminiIdeaGroup) geminiIdeaGroup.style.display = "none";
    });

    engineGeminiBtn?.addEventListener("click", async () => {
        engineGeminiBtn.classList.add("active");
        engineWhisperBtn?.classList.remove("active");
        if (transcriptionEngineInput) transcriptionEngineInput.value = "gemini";
        if (geminiIdeaGroup) geminiIdeaGroup.style.display = "block";

        // Check if API key is configured
        try {
            const res = await fetch("/api/config");
            if (res.ok) {
                const conf = await res.json();
                if (!conf.has_key) {
                    showToastNotification("Bạn chưa nhập Gemini API Key. Nhấn 'Cài Đặt Gemini' để cấu hình nhé!");
                } else {
                    showToastNotification("Đã bật Gemini AI Cloud. Nhập ý tưởng/lời nhắc nếu muốn tùy biến!");
                }
            }
        } catch (e) {}
    });

    // Preset: Suno AI / New Song Workflow
    const btnPresetSuno = document.getElementById("btnPresetSuno");
    btnPresetSuno?.addEventListener("click", () => {
        // Expand advanced accordion if closed
        const advAccordion = document.getElementById("advancedConfigAccordion");
        if (advAccordion) advAccordion.open = true;

        // Switch to Gemini engine
        engineGeminiBtn?.click();

        // Focus & highlight custom lyrics input
        const lyricsInput = document.getElementById("customLyricsInput");
        if (lyricsInput) {
            lyricsInput.scrollIntoView({ behavior: "smooth", block: "center" });
            lyricsInput.focus();
            lyricsInput.style.borderColor = "#a855f7";
            lyricsInput.style.boxShadow = "0 0 14px rgba(168, 85, 247, 0.4)";
            showToastNotification("Đã bật chế độ Suno AI / Bài mới! Hãy dán lời bài hát vào ô Lời Chuẩn.");
            setTimeout(() => {
                lyricsInput.style.borderColor = "";
                lyricsInput.style.boxShadow = "";
            }, 4000);
        }
    });

    // Idea Quick Pills
    document.querySelectorAll(".idea-pill").forEach(pill => {
        pill.addEventListener("click", () => {
            const ideaText = pill.getAttribute("data-idea");
            const ideaInput = document.getElementById("ideaPromptInput");
            if (ideaInput) {
                if (ideaInput.value.trim()) {
                    ideaInput.value = `${ideaInput.value.trim()}\n${ideaText}`;
                } else {
                    ideaInput.value = ideaText;
                }
                ideaInput.focus();
            }
        });
    });

    // Gemini Settings Modal
    const geminiModal = document.getElementById("geminiModal");
    const btnOpenGeminiSettings = document.getElementById("btnOpenGeminiSettings");
    const closeGeminiModalBtn = document.getElementById("closeGeminiModalBtn");
    const cancelGeminiModalBtn = document.getElementById("cancelGeminiModalBtn");
    const saveGeminiConfigBtn = document.getElementById("saveGeminiConfigBtn");
    const geminiApiKeyInput = document.getElementById("geminiApiKeyInput");
    const geminiModelSelect = document.getElementById("geminiModelSelect");

    const openGeminiModal = async () => {
        if (!geminiModal) return;
        geminiModal.style.display = "flex";
        try {
            const res = await fetch("/api/config");
            if (res.ok) {
                const conf = await res.json();
                if (geminiApiKeyInput) {
                    geminiApiKeyInput.value = "";
                    geminiApiKeyInput.placeholder = conf.has_key ? `Đã lưu: ${conf.masked_key} (nhập mới để đổi)` : "AIzaSy... (Dán API Key vào đây)";
                }
                if (geminiModelSelect && conf.gemini_model) {
                    geminiModelSelect.value = conf.gemini_model;
                }
            }
        } catch (e) {}
    };

    btnOpenGeminiSettings?.addEventListener("click", openGeminiModal);
    closeGeminiModalBtn?.addEventListener("click", () => { if (geminiModal) geminiModal.style.display = "none"; });
    cancelGeminiModalBtn?.addEventListener("click", () => { if (geminiModal) geminiModal.style.display = "none"; });

    saveGeminiConfigBtn?.addEventListener("click", async () => {
        const key = geminiApiKeyInput?.value.trim();
        const model = geminiModelSelect?.value || "gemini-2.5-flash";
        const form = new FormData();
        if (key) form.append("gemini_api_key", key);
        form.append("gemini_model", model);

        try {
            saveGeminiConfigBtn.textContent = "Đang lưu...";
            saveGeminiConfigBtn.disabled = true;
            const res = await fetch("/api/config", { method: "POST", body: form });
            const data = await res.json();
            if (res.ok && data.status === "success") {
                showToastNotification("Đã lưu cấu hình Gemini AI thành công!");
                if (geminiModal) geminiModal.style.display = "none";
            } else {
                alert("Lỗi khi lưu: " + (data.detail || data.message || "Unknown error"));
            }
        } catch (e) {
            alert("Lỗi kết nối: " + e.message);
        } finally {
            saveGeminiConfigBtn.textContent = "Lưu Cài Đặt";
            saveGeminiConfigBtn.disabled = false;
        }
    });

    whisperModelSelect?.addEventListener("change", () => {
        const isCpu = hardwareModeInput?.value === "cpu";
        if (isCpu && whisperModelSelect.value === "large-v3") {
            showToastNotification("Khuyên dùng bản 'Small' trên CPU để xử lý nhanh nhất (~30 giây)");
        }
    });

    startProcessBtn.addEventListener("click", handleStartProcessing);
    document.getElementById("startProcessBtnSimple")?.addEventListener("click", handleStartProcessing);
}

async function triggerOnlineLyricsSearch(query, isManual = false) {
    if (!query || !query.trim()) return;
    const btn = document.getElementById("btnAutoFetchLyrics");
    const badge = document.getElementById("lyricsStatusBadge");
    const lyricsInput = document.getElementById("customLyricsInput");

    if (btn) btn.textContent = "Đang tìm...";

    try {
        let url = `/api/search-lyrics?query=${encodeURIComponent(query.trim())}`;
        if (window._selectedFileDuration && window._selectedFileDuration > 0) {
            url += `&duration=${window._selectedFileDuration.toFixed(1)}`;
        }
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            if (data.status === "found" && (data.plain_lyrics || data.synced_lyrics)) {
                if (lyricsInput) {
                    lyricsInput.value = (data.is_synced_truncated && data.plain_lyrics) ? data.plain_lyrics : (data.synced_lyrics || data.plain_lyrics);
                }
                if (badge) {
                    badge.textContent = `Đã tìm thấy: ${data.title}`;
                    badge.style.display = "inline-block";
                }
                showToastNotification(`Đã tìm thấy lời chuẩn: ${data.title}`);
                if (btn) btn.textContent = "Tìm Lời Online";
                return;
            }
        }
    } catch (e) {
        console.error("Lyrics search error:", e);
    }

    if (btn) btn.textContent = "Tìm Lời Online";
    if (badge) badge.style.display = "none";
    if (isManual) {
        showToastNotification("Không tìm thấy lời bài hát online. AI sẽ tự động nghe từ giọng hát.");
    }
}

function handleFileSelected(file) {
    selectedFile = file;
    selectedFileName.textContent = `${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`;
    selectedFilePill.style.display = "inline-flex";

    try {
        const audio = new Audio();
        audio.src = URL.createObjectURL(file);
        audio.onloadedmetadata = () => {
            window._selectedFileDuration = audio.duration;
            URL.revokeObjectURL(audio.src);
        };
    } catch(e) {}

    // Auto search lyrics when file is selected
    triggerOnlineLyricsSearch(file.name);
}

function handleInstFileSelected(file) {
    selectedInstFile = file;
    instFileName.textContent = `${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`;
    instFilePill.style.display = "inline-flex";

    if (stemsSongTitle && !stemsSongTitle.value.trim()) {
        let cleanTitle = file.name.replace(/\.[^/.]+$/, "");
        ["instrumental", "beat", "karaoke", "no_vocals", "minus_vocals", "vocal_remover"].forEach(kw => {
            cleanTitle = cleanTitle.replace(new RegExp(kw, "gi"), "");
        });
        cleanTitle = cleanTitle.replace(/[-_]+/g, " ").trim();
        if (cleanTitle) stemsSongTitle.value = cleanTitle;
    }

    try {
        const audio = new Audio();
        audio.src = URL.createObjectURL(file);
        audio.onloadedmetadata = () => {
            window._selectedFileDuration = audio.duration;
            URL.revokeObjectURL(audio.src);
        };
    } catch(e) {}

    triggerOnlineLyricsSearch(stemsSongTitle?.value || file.name);
}

function handleVocalFileSelected(file) {
    selectedVocalFile = file;
    vocalFileName.textContent = `${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`;
    vocalFilePill.style.display = "inline-flex";
}

async function handleStartProcessing() {
    const isStemsMode = modeStemsBtn?.classList.contains("active");
    const isFileMode = modeFileBtn.classList.contains("active");
    const lang = langSelect.value;
    const whisperModel = whisperModelSelect.value;
    const demucsModel = demucsModelSelect.value;
    const customLyrics = document.getElementById("customLyricsInput")?.value.trim() || "";
    const useCache = document.getElementById("useCacheCheckbox")?.checked ?? true;
    const deviceMode = document.getElementById("hardwareModeInput")?.value || "gpu";
    const transcriptionEngine = document.getElementById("transcriptionEngineInput")?.value || "whisper";
    const ideaPrompt = document.getElementById("ideaPromptInput")?.value.trim() || "";

    let formData = new FormData();
    formData.append("language", lang);
    formData.append("whisper_model", whisperModel);
    formData.append("demucs_model", demucsModel);
    formData.append("use_cache", useCache ? "true" : "false");
    formData.append("device_mode", deviceMode);
    formData.append("transcription_engine", transcriptionEngine);
    formData.append("idea_prompt", ideaPrompt);
    if (customLyrics) {
        formData.append("custom_lyrics", customLyrics);
    }

    let endpoint = "";

    if (isStemsMode) {
        if (!selectedInstFile) {
            alert("Vui lòng chọn hoặc kéo thả File Nhạc Beat (Instrumental)!");
            return;
        }
        formData.append("instrumental_file", selectedInstFile);
        if (selectedVocalFile) {
            formData.append("vocal_file", selectedVocalFile);
        }
        const songTitle = stemsSongTitle?.value.trim() || selectedInstFile.name.replace(/\.[^/.]+$/, "");
        formData.append("song_title", songTitle);
        endpoint = "/api/upload-stems";
    } else if (isFileMode) {
        if (!selectedFile) {
            alert("Vui lòng chọn hoặc kéo thả 1 file âm thanh / video!");
            return;
        }
        formData.append("file", selectedFile);
        endpoint = "/api/upload";
    } else {
        const url = extractCleanMediaUrl(urlInput.value);
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

    if (modeStemsBtn?.classList.contains("active")) {
        modalTitle.textContent = "Đang Nạp Beat & Bắt Nhịp Lời...";
        modalSub.textContent = "Bỏ qua tách Beat (0s) - Bắt nhịp phụ đề tức thì!";
        stepUpload.className = "step-item completed";
        stepDemucs.className = "step-item completed";
        stepWhisper.className = "step-item active";
        stepSub.className = "step-item";
    } else {
        modalTitle.textContent = "AI Đang Xử Lý Bài Hát...";
        modalSub.textContent = state.cudaAvailable 
            ? "Đang tách Beat và nhận diện lời trên GPU CUDA..." 
            : "Đang tách Beat và nhận diện lời trên CPU Đa Luồng...";
        
        stepUpload.className = "step-item active";
        stepDemucs.className = "step-item";
        stepWhisper.className = "step-item";
        stepSub.className = "step-item";
    }
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
                updateModalProgress({ progress: 100, message: "Đã hoàn tất xử lý! Đang mở phòng thu Karaoke..." });
                setTimeout(() => {
                    hideProgressModal();
                    loadProjectData(job.data);
                    switchTab("playerTab");
                    resetCreationForm();
                }, 500);
            } else if (job.status === "error" || job.status === "failed") {
                clearInterval(state.pollTimer);
                alert(`Xử lý thất bại: ${job.error || job.message}`);
                hideProgressModal();
            }
        } catch (e) {
            console.error("Poll error:", e);
        }
    }, 400);
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
function ensureConciseSegments(segments, maxWords = 6, maxChars = 28, maxDur = 4.0) {
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
    if (dlSrtSubBtn) {
        dlSrtSubBtn.href = projectData.subtitles?.srt || "#";
    }


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

    // Ensure segments conform to natural singable line lengths (concise, <= 7 words per line)
    projectData.segments = ensureConciseSegments(projectData.segments || [], 7);
    state.currentProject.segments = projectData.segments;
    state._memoizedPairs = null;
    state._memoizedSegsRef = null;
    state._cachedSongSafeSize = null;
    state._cachedSongSafeSizeSegsRef = null;

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
        applyLayoutPreset("staggered", false);
    }

    const savedSize = saved.font_size_line1 || saved.font_size_line2 || projectData.font_size_line1 || projectData.font_size_line2 || 52;
    applyMasterFontSize(savedSize);

    state.bgTheme = saved.bg_theme || "nebula";

    const fontToApply = saved.font_name || projectData.font_name || "Tahoma, sans-serif";
    applyStageFont(fontToApply);

    const savedColor = saved.color_active_hex || "#0018F5";
    applyStageActiveColor(savedColor);

    state.wipingFxMode = saved.wiping_fx || "smooth";
    if (typeof applyWipingFxMode === "function") {
        applyWipingFxMode();
    }

    state.showCountdownDots = (saved.show_countdown !== undefined) ? !!saved.show_countdown : true;
    const chkCountdown = document.getElementById("chkCountdownDots");
    if (chkCountdown) chkCountdown.checked = state.showCountdownDots;

    state.stageDisplayMode = saved.display_mode || saved.stage_display_mode || "pingpong";
    document.querySelectorAll(".display-mode-btn").forEach(b => {
        b.classList.toggle("active", b.dataset.mode === state.stageDisplayMode);
    });

    const savedPitch = (saved.pitch_semitones !== undefined) ? parseInt(saved.pitch_semitones) : 0;
    if (typeof applyPitchShift === "function") {
        applyPitchShift(0, savedPitch);
    }
    updateExportSummary();

    // Reset Player
    beatAudio.currentTime = 0;
    vocalAudio.currentTime = 0;
    trackSeekBar.value = 0;
    currentTimeLabel.textContent = "00:00";
    durationLabel.textContent = formatTime(projectData.duration || 0);

    // Initial Stage: display first couplet preview ready on screen
    updateKaraokeStage(0);
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

// Global alias for notification toast
window.showToast = showToastNotification;

async function deleteSegment(segIdx) {
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
window.deleteSegment = deleteSegment;

async function updateSegmentText(segIdx, newText) {
    if (!state.currentProject || !state.currentProject.segments) return;
    const segments = state.currentProject.segments;
    if (segIdx < 0 || segIdx >= segments.length) return;

    const trimmed = (newText || "").trim();
    if (!trimmed) {
        // User erased all text - delete this segment from the song!
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

    // Save to backend in background
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

function startDrawerInlineEdit(cardEl, segIdx) {
    const seg = state.currentProject?.segments?.[segIdx];
    if (!seg) return;
    const previewEl = cardEl.querySelector(".seg-text-preview");
    if (!previewEl || cardEl.classList.contains("in-edit-mode")) return;

    cardEl.classList.add("in-edit-mode");

    previewEl.innerHTML = `
        <div class="drawer-inline-edit-wrap">
            <input type="text" class="drawer-inline-input" value="${seg.text || ''}" placeholder="Nhập lời hoặc xóa hết để xóa câu..." />
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

        const doSave = async () => {
            const val = input.value;
            cardEl.classList.remove("in-edit-mode");
            await updateSegmentText(segIdx, val);
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
            await updateSegmentText(segIdx, val);
        };

        const doDelete = async () => {
            lineEl.classList.remove("editing-text");
            lineEl.dataset.segIdx = "";
            await deleteSegment(segIdx);
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
                    <span class="seg-time-pill">${formatTimeMs(seg.start)} - ${formatTimeMs(seg.end)}</span>
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
   STUDIO PITCH SHIFTER ENGINE (PRESERVES TEMPO / DURATION)
   Granular delay crossfade technique (Miller Puckette / Chris Wilson)
   Shifts musical key/pitch (-6 to +6 semitones) with 100% constant tempo.
   ======================================================== */

function createFadeBuffer(ctx, activeTime, fadeTime) {
    const length1 = Math.round(activeTime * ctx.sampleRate);
    const length2 = Math.round(Math.max(0, (activeTime - 2 * fadeTime) * ctx.sampleRate));
    const length = Math.max(1, length1 + length2);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const p = buffer.getChannelData(0);
    const fadeLength = Math.round(fadeTime * ctx.sampleRate);
    const fadeIndex1 = fadeLength;
    const fadeIndex2 = length1 - fadeLength;

    for (let i = 0; i < length1; ++i) {
        let value;
        if (i < fadeIndex1) {
            value = Math.sqrt(i / Math.max(1, fadeLength));
        } else if (i >= fadeIndex2) {
            value = Math.sqrt(Math.max(0, 1 - (i - fadeIndex2) / Math.max(1, fadeLength)));
        } else {
            value = 1;
        }
        p[i] = value;
    }
    for (let i = length1; i < length; ++i) {
        p[i] = 0;
    }
    return buffer;
}

function createDelayTimeBuffer(ctx, activeTime, fadeTime, shiftUp) {
    const length1 = Math.round(activeTime * ctx.sampleRate);
    const length2 = Math.round(Math.max(0, (activeTime - 2 * fadeTime) * ctx.sampleRate));
    const length = Math.max(1, length1 + length2);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const p = buffer.getChannelData(0);

    for (let i = 0; i < length1; ++i) {
        if (shiftUp) {
            p[i] = (length1 - i) / Math.max(1, length);
        } else {
            p[i] = i / Math.max(1, length1);
        }
    }
    for (let i = length1; i < length; ++i) {
        p[i] = 0;
    }
    return buffer;
}

function getPitchMultiplier(x) {
    if (x < 0) {
        return x / 12.0;
    }
    const a5 = 1.8149080040913423e-7;
    const a4 = -0.000019413043101157434;
    const a3 = 0.0009795096626987743;
    const a2 = -0.014147877819596033;
    const a1 = 0.23005591195033048;
    const a0 = 0.02278153473118749;
    return a0 + x*a1 + (x*x)*a2 + (x*x*x)*a3 + (x*x*x*x)*a4 + (x*x*x*x*x)*a5;
}

class StudioPitchShifter {
    constructor(context) {
        this.context = context;
        this.input = context.createGain();
        this.output = context.createGain();
        this.dryGain = context.createGain();
        this.wetGain = context.createGain();

        // Default bypass mode (0 semitones)
        this.dryGain.gain.setValueAtTime(1.0, context.currentTime);
        this.wetGain.gain.setValueAtTime(0.0, context.currentTime);

        const delayTime = 0.100;
        const fadeTime = 0.050;
        const bufferTime = 0.100;

        const mod1 = context.createBufferSource();
        const mod2 = context.createBufferSource();
        const mod3 = context.createBufferSource();
        const mod4 = context.createBufferSource();

        const shiftDownBuffer = createDelayTimeBuffer(context, bufferTime, fadeTime, false);
        const shiftUpBuffer = createDelayTimeBuffer(context, bufferTime, fadeTime, true);

        mod1.buffer = shiftDownBuffer;
        mod2.buffer = shiftDownBuffer;
        mod3.buffer = shiftUpBuffer;
        mod4.buffer = shiftUpBuffer;

        mod1.loop = true;
        mod2.loop = true;
        mod3.loop = true;
        mod4.loop = true;

        const mod1Gain = context.createGain();
        const mod2Gain = context.createGain();
        const mod3Gain = context.createGain();
        const mod4Gain = context.createGain();

        mod3Gain.gain.setValueAtTime(0, context.currentTime);
        mod4Gain.gain.setValueAtTime(0, context.currentTime);

        mod1.connect(mod1Gain);
        mod2.connect(mod2Gain);
        mod3.connect(mod3Gain);
        mod4.connect(mod4Gain);

        const modGain1 = context.createGain();
        const modGain2 = context.createGain();

        const delay1 = context.createDelay(1.0);
        const delay2 = context.createDelay(1.0);

        mod1Gain.connect(modGain1);
        mod2Gain.connect(modGain2);
        mod3Gain.connect(modGain1);
        mod4Gain.connect(modGain2);

        modGain1.connect(delay1.delayTime);
        modGain2.connect(delay2.delayTime);

        const fade1 = context.createBufferSource();
        const fade2 = context.createBufferSource();
        const fadeBuffer = createFadeBuffer(context, bufferTime, fadeTime);
        fade1.buffer = fadeBuffer;
        fade2.buffer = fadeBuffer;
        fade1.loop = true;
        fade2.loop = true;

        const mix1 = context.createGain();
        const mix2 = context.createGain();
        mix1.gain.setValueAtTime(0, context.currentTime);
        mix2.gain.setValueAtTime(0, context.currentTime);

        fade1.connect(mix1.gain);
        fade2.connect(mix2.gain);

        const wetInput = context.createGain();
        wetInput.connect(delay1);
        wetInput.connect(delay2);
        delay1.connect(mix1);
        delay2.connect(mix2);
        mix1.connect(this.output);
        mix2.connect(this.output);

        this.input.connect(this.dryGain);
        this.dryGain.connect(this.output);

        this.input.connect(this.wetGain);
        this.wetGain.connect(wetInput);

        const t = context.currentTime + 0.050;
        const t2 = t + bufferTime - fadeTime;
        mod1.start(t);
        mod2.start(t2);
        mod3.start(t);
        mod4.start(t2);
        fade1.start(t);
        fade2.start(t2);

        this.mod1Gain = mod1Gain;
        this.mod2Gain = mod2Gain;
        this.mod3Gain = mod3Gain;
        this.mod4Gain = mod4Gain;
        this.modGain1 = modGain1;
        this.modGain2 = modGain2;
        this.delayTime = delayTime;
    }

    setTranspose(semitones) {
        const now = this.context.currentTime;
        if (semitones === 0) {
            // Bypass mode: pure uncolored dry audio, zero delay, zero DSP
            this.dryGain.gain.setTargetAtTime(1.0, now, 0.020);
            this.wetGain.gain.setTargetAtTime(0.0, now, 0.020);
        } else {
            const mult = getPitchMultiplier(semitones);
            if (mult > 0) {
                this.mod1Gain.gain.setValueAtTime(0, now);
                this.mod2Gain.gain.setValueAtTime(0, now);
                this.mod3Gain.gain.setValueAtTime(1, now);
                this.mod4Gain.gain.setValueAtTime(1, now);
            } else {
                this.mod1Gain.gain.setValueAtTime(1, now);
                this.mod2Gain.gain.setValueAtTime(1, now);
                this.mod3Gain.gain.setValueAtTime(0, now);
                this.mod4Gain.gain.setValueAtTime(0, now);
            }
            const dt = this.delayTime * Math.abs(mult);
            this.modGain1.gain.setTargetAtTime(0.5 * dt, now, 0.010);
            this.modGain2.gain.setTargetAtTime(0.5 * dt, now, 0.010);

            this.dryGain.gain.setTargetAtTime(0.0, now, 0.020);
            this.wetGain.gain.setTargetAtTime(1.0, now, 0.020);
        }
    }
}

let studioAudioCtx = null;
let studioBeatSource = null;
let studioVocalSource = null;
let studioPitchShifter = null;

async function initOrResumeStudioAudio() {
    try {
        if (!studioAudioCtx) {
            studioAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
            state.audioContext = studioAudioCtx;
        }
        if (studioAudioCtx.state === "suspended") {
            await studioAudioCtx.resume();
        }
        if (!studioBeatSource) {
            beatAudio.crossOrigin = "anonymous";
            vocalAudio.crossOrigin = "anonymous";

            studioBeatSource = studioAudioCtx.createMediaElementSource(beatAudio);
            studioVocalSource = studioAudioCtx.createMediaElementSource(vocalAudio);

            studioPitchShifter = new StudioPitchShifter(studioAudioCtx);

            studioBeatSource.connect(studioPitchShifter.input);
            studioVocalSource.connect(studioPitchShifter.input);

            studioPitchShifter.output.connect(studioAudioCtx.destination);

            if (state.currentPitchSemitones) {
                studioPitchShifter.setTranspose(state.currentPitchSemitones);
            }
        }
    } catch (e) {
        console.warn("Studio audio graph setup note:", e);
    }
}

function applyPitchShift(delta, directValue = null) {
    if (directValue !== null) {
        state.currentPitchSemitones = Math.max(-6, Math.min(6, directValue));
    } else if (delta === 0) {
        state.currentPitchSemitones = 0;
    } else {
        state.currentPitchSemitones = Math.max(-6, Math.min(6, (state.currentPitchSemitones || 0) + delta));
    }
    const currentPitch = state.currentPitchSemitones || 0;
    const pitchValText = document.getElementById("pitchValText");
    if (pitchValText) {
        if (currentPitch === 0) {
            pitchValText.textContent = "0";
        } else {
            pitchValText.textContent = `${currentPitch > 0 ? '+' : ''}${currentPitch}`;
        }
    }

    // CRITICAL: Ensure playbackRate is STRICTLY 1.0 (tempo NEVER changes!)
    try {
        beatAudio.preservesPitch = true;
        beatAudio.playbackRate = 1.0;
        vocalAudio.preservesPitch = true;
        vocalAudio.playbackRate = 1.0;
    } catch (e) {}

    // Apply granular pitch shifting without tempo alteration
    initOrResumeStudioAudio().then(() => {
        if (studioPitchShifter) {
            studioPitchShifter.setTranspose(currentPitch);
        }
    });

    if (typeof updateExportSummary === "function") {
        updateExportSummary();
    }
    if (typeof saveProjectStageSettings === "function") {
        saveProjectStageSettings();
    }
}

/* ========================================================
   5. UNIFIED STUDIO INSPECTOR & MODULAR DECK ENGINE
   ======================================================== */
function openInspectorPane(paneId) {
    const container = document.getElementById("stageInspectorContainer") || document.getElementById("studioInspectorDrawer");
    if (!container) return;
    const targetPane = document.getElementById(paneId);
    if (!targetPane) return;

    // If clicking currently open pane, toggle closed
    const isCurrentlyOpen = (container.style.display !== "none" && targetPane.style.display !== "none");
    if (isCurrentlyOpen) {
        closeInspector();
        return;
    }

    container.style.display = "block";
    document.querySelectorAll(".inspector-tab-pane").forEach(p => p.style.display = "none");
    targetPane.style.display = "block";

    // Set tab trigger active
    document.querySelectorAll(".btn-tab-trigger").forEach(btn => {
        btn.classList.toggle("active", btn.getAttribute("data-pane") === paneId);
    });

    // Update btnToggleProTools label
    const btnToggleProTools = document.getElementById("btnToggleProTools");
    if (btnToggleProTools) {
        btnToggleProTools.classList.add("active");
        btnToggleProTools.textContent = "Đóng Tùy Biến ▲";
    }

    // Update Header Title
    const headerTitle = document.getElementById("inspectorHeaderTitle");
    if (paneId === "paneTypography") {
        if (headerTitle) headerTitle.textContent = "Phông Chữ & Cỡ Chữ";
    } else if (paneId === "paneColors") {
        if (headerTitle) headerTitle.textContent = "Màu Sắc Lời Hát Karaoke & Hiệu Ứng";
    } else if (paneId === "paneBackground") {
        if (headerTitle) headerTitle.textContent = "Hình Nền Sân Khấu";
    } else if (paneId === "panePosition") {
        if (headerTitle) headerTitle.textContent = "Vị Trí & Ma Trận 9 Điểm";
    } else if (paneId === "paneLyricJump") {
        if (headerTitle) headerTitle.textContent = "Canh Nhịp Từng Câu";
        if (typeof renderLyricJumpList === "function" && state.currentProject?.segments) {
            renderLyricJumpList(state.currentProject.segments);
        }
    } else if (paneId === "paneExport") {
        if (headerTitle) headerTitle.textContent = "Xuất Video MP4 (GPU NVENC) & Tải Về";
        if (typeof updateExportSummary === "function") {
            updateExportSummary();
        }
    }

    // Scroll into view
    setTimeout(() => {
        container.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 50);

    // Sync Guided Stepper
    if (typeof syncGuidedStepper === "function") {
        syncGuidedStepper("playerTab", paneId === "paneExport");
    }
}

function closeInspector() {
    const container = document.getElementById("stageInspectorContainer") || document.getElementById("studioInspectorDrawer");
    if (container) container.style.display = "none";
    document.querySelectorAll(".inspector-tab-pane").forEach(p => p.style.display = "none");
    document.querySelectorAll(".btn-tab-trigger").forEach(btn => btn.classList.remove("active"));
    
    const btnToggleProTools = document.getElementById("btnToggleProTools");
    if (btnToggleProTools) {
        btnToggleProTools.classList.remove("active");
        btnToggleProTools.textContent = "Tùy Biến Nâng Cao ▼";
    }

    if (typeof syncGuidedStepper === "function") {
        syncGuidedStepper("playerTab", false);
    }
}

window.openInspectorPane = openInspectorPane;
window.closeInspector = closeInspector;

function initStudioInspector() {
    // Tab Buttons in Studio Action Dock
    document.querySelectorAll(".btn-tab-trigger").forEach(btn => {
        btn.addEventListener("click", () => {
            const paneId = btn.getAttribute("data-pane");
            if (paneId) openInspectorPane(paneId);
        });
    });

    // Close Inspector Button
    document.getElementById("btnCloseInspector")?.addEventListener("click", closeInspector);

    // Master Font Size Slider (Pane Typography)
    const masterSlider = document.getElementById("masterFontSizeSlider");
    masterSlider?.addEventListener("input", (e) => {
        applyMasterFontSize(e.target.value);
    });

    document.getElementById("btnMasterZoomIn")?.addEventListener("click", () => {
        const cur = parseInt(document.getElementById("masterFontSizeSlider")?.value || state.fontSizeLine1 || 52);
        applyMasterFontSize(cur + 4);
    });

    document.getElementById("btnMasterZoomOut")?.addEventListener("click", () => {
        const cur = parseInt(document.getElementById("masterFontSizeSlider")?.value || state.fontSizeLine1 || 52);
        applyMasterFontSize(cur - 4);
    });

    // Size Preset Pills (36, 44, 52, 68, 84)
    document.querySelectorAll(".size-preset-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const sz = parseInt(btn.dataset.size);
            if (sz) applyMasterFontSize(sz);
        });
    });

    // Global Safe Size Button (Scan whole song)
    document.getElementById("btnGlobalSafeSize")?.addEventListener("click", () => {
        if (typeof calculateGlobalMaxSafeFontSize === "function") {
            calculateGlobalMaxSafeFontSize(true);
        }
    });

    // Background preset chips in Pane Background
    document.querySelectorAll(".bg-preset-chips .bg-chip").forEach(chip => {
        chip.addEventListener("click", () => {
            const bgType = chip.getAttribute("data-bg");
            const stageScreen = document.getElementById("stageScreen") || document.getElementById("karaokeScreen");
            document.querySelectorAll(".bg-preset-chips .bg-chip").forEach(c => c.classList.remove("active"));
            chip.classList.add("active");
            if (stageScreen && bgType) {
                const existingMedia = stageScreen.querySelector(".stage-screen-bg-media");
                if (existingMedia) existingMedia.remove();
                stageScreen.className = "stage-screen";
                stageScreen.classList.add(`bg-${bgType}`);
            }
        });
    });

    // Color chips in Pane Background
    document.querySelectorAll(".stage-color-chips-row .drawer-color-chip").forEach(chip => {
        chip.addEventListener("click", () => {
            const color = chip.getAttribute("data-color");
            if (color && typeof applyStageActiveColor === "function") {
                applyStageActiveColor(color);
            }
        });
    });

    const drawerColorPicker = document.getElementById("drawerColorPickerInput");
    drawerColorPicker?.addEventListener("input", (e) => {
        if (e.target.value && typeof applyStageActiveColor === "function") {
            applyStageActiveColor(e.target.value);
        }
    });

    // Preset color buttons in paneColors
    document.getElementById("btnColorPresetTrongHieu")?.addEventListener("click", () => {
        if (typeof applyStageActiveColor === "function") {
            applyStageActiveColor("#0018F5");
            showToastNotification("Đã chọn màu: Xanh Chuẩn KTV Trọng Hiếu (#0018F5)!");
        }
    });
    document.getElementById("btnColorPresetGold")?.addEventListener("click", () => {
        if (typeof applyStageActiveColor === "function") {
            applyStageActiveColor("#FFE259");
            showToastNotification("Đã chọn màu: Vàng Gold Bolero (#FFE259)!");
        }
    });
    document.getElementById("btnColorPresetCyan")?.addEventListener("click", () => {
        if (typeof applyStageActiveColor === "function") {
            applyStageActiveColor("#00F2FE");
            showToastNotification("Đã chọn màu: Cyber Cyan (#00F2FE)!");
        }
    });
    document.getElementById("btnColorPresetPink")?.addEventListener("click", () => {
        if (typeof applyStageActiveColor === "function") {
            applyStageActiveColor("#FF758C");
            showToastNotification("Đã chọn màu: Hồng Neon Pop (#FF758C)!");
        }
    });

    // Visual Wiping FX Mode Switcher (Tia Sáng Comet, Quét Mượt, Nảy Nhịp Bounce)
    document.querySelectorAll(".fx-style-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".fx-style-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            state.wipingFxMode = btn.dataset.fx || "smooth";
            applyWipingFxMode();
            saveProjectStageSettings();
            showToastNotification(`Đã chuyển hiệu ứng: ${btn.textContent.trim()}`);
        });
    });

    // Subtitle Display Mode Switcher (So Le Luân Phiên Ping-Pong vs Cặp Câu Đồng Thời Couplet)
    document.querySelectorAll(".display-mode-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".display-mode-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            state.stageDisplayMode = btn.dataset.mode || "pingpong";
            state._memoizedTimeline = null;
            state._memoizedTimelineSegsRef = null;
            updateKaraokeStage(beatAudio.currentTime);
            saveProjectStageSettings();
            showToastNotification(`Đã chuyển chế độ hiển thị: ${btn.textContent.trim()}`);
        });
    });

    // Lead-in Countdown Dots Toggle
    const chkCountdown = document.getElementById("chkCountdownDots");
    chkCountdown?.addEventListener("change", (e) => {
        state.showCountdownDots = e.target.checked;
        saveProjectStageSettings();
        showToastNotification(state.showCountdownDots ? "Đã bật chấm đếm nhịp vào câu" : "Đã tắt chấm đếm nhịp vào câu");
    });

    applyWipingFxMode();
}

function applyWipingFxMode() {
    const stage = document.getElementById("karaokeStage") || document.getElementById("stageScreen");
    if (!stage) return;
    stage.classList.remove("fx-mode-comet", "fx-mode-smooth", "fx-mode-bounce");
    const mode = state.wipingFxMode || "smooth";
    stage.classList.add(`fx-mode-${mode}`);

    document.querySelectorAll(".fx-style-btn").forEach(b => {
        b.classList.toggle("active", b.dataset.fx === mode);
    });
}

function initTimingSyncPopover() {
    const btnToggle = document.getElementById("btnToggleSyncPopover");
    const popover = document.getElementById("syncPopoverMenu");
    const caret = document.getElementById("syncCaret");

    btnToggle?.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!popover) return;
        const isHidden = popover.style.display === "none" || !popover.style.display;
        popover.style.display = isHidden ? "block" : "none";
        btnToggle.classList.toggle("active", isHidden);
        if (caret) caret.style.transform = isHidden ? "rotate(180deg)" : "rotate(0deg)";
    });

    document.addEventListener("click", (e) => {
        if (popover && popover.style.display !== "none") {
            if (!popover.contains(e.target) && !btnToggle?.contains(e.target)) {
                popover.style.display = "none";
                btnToggle?.classList.remove("active");
                if (caret) caret.style.transform = "rotate(0deg)";
            }
        }
    });
}

function initMasterQuickActions() {
    // 1. Toggle Pro Tools Dock
    const btnToggleProTools = document.getElementById("btnToggleProTools");
    const studioActionDock = document.getElementById("studioActionDock");
    if (btnToggleProTools && studioActionDock) {
        btnToggleProTools.addEventListener("click", () => {
            const isHidden = studioActionDock.classList.contains("dock-hidden") || studioActionDock.style.display === "none";
            if (isHidden) {
                studioActionDock.classList.remove("dock-hidden");
                studioActionDock.style.display = "flex";
                btnToggleProTools.classList.add("active");
                btnToggleProTools.textContent = "Tùy Biến Nâng Cao ▲";
                showToastNotification("Đã mở Bảng tùy biến nâng cao (Phông chữ, vị trí, căn lề)");
            } else {
                studioActionDock.classList.add("dock-hidden");
                studioActionDock.style.display = "none";
                btnToggleProTools.classList.remove("active");
                btnToggleProTools.textContent = "Tùy Biến Nâng Cao ▼";
                if (typeof closeInspector === "function") {
                    closeInspector();
                }
            }
        });
    }

    // 2. Toggle Mic from Master Strip
    const btnToggleMicMaster = document.getElementById("btnToggleMicMaster");
    const micDeck = document.getElementById("studioMicDeckCard");
    const btnToggleMic = document.getElementById("btnToggleMic");
    btnToggleMicMaster?.addEventListener("click", () => {
        if (!micDeck) return;
        const isHidden = micDeck.style.display === "none" || !micDeck.style.display;
        if (isHidden) {
            micDeck.style.display = "block";
            btnToggleMicMaster.classList.add("active");
            btnToggleMicMaster.textContent = "Tắt Micro";
            if (!micStream && btnToggleMic) {
                btnToggleMic.click();
            }
            micDeck.scrollIntoView({ behavior: "smooth", block: "nearest" });
        } else {
            if (micStream && btnToggleMic) {
                btnToggleMic.click();
            }
            micDeck.style.display = "none";
            btnToggleMicMaster.classList.remove("active");
            btnToggleMicMaster.textContent = "Bật Micro";
        }
    });

    // 3. Cinema Master Toggle
    const btnCinemaMaster = document.getElementById("btnCinemaMaster");
    const btnToggleCinema = document.getElementById("btnToggleCinema");
    btnCinemaMaster?.addEventListener("click", () => {
        if (btnToggleCinema) {
            btnToggleCinema.click();
        } else {
            const stageWrapper = document.querySelector(".karaoke-stage-wrapper") || document.querySelector(".studio-main-col") || document.body;
            const isCinema = stageWrapper.classList.toggle("cinema-active");
            btnCinemaMaster.classList.toggle("active", isCinema);
            btnCinemaMaster.textContent = isCinema ? "Thoát Rạp" : "Rạp Chiếu";
        }
    });

    // 4. Quick Export Master Jump
    const btnExportMaster = document.getElementById("btnExportMaster");
    btnExportMaster?.addEventListener("click", () => {
        scrollToStudioExport();
    });
}

/* ========================================================
   6. SYNCHRONIZED KARAOKE PLAYER & STAGE ANIMATION
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

    // Studio Modular Deck Inspector & Popover Initializations
    initStudioInspector();
    initTimingSyncPopover();
    initMasterQuickActions();

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

    // Key Pitch Transpose (-6 to +6 semitones, 100% constant tempo)
    const btnPitchDown = document.getElementById("btnPitchDown");
    const btnPitchUp = document.getElementById("btnPitchUp");
    const btnPitchReset = document.getElementById("btnPitchReset");

    btnPitchDown?.addEventListener("click", () => applyPitchShift(-1));
    btnPitchUp?.addEventListener("click", () => applyPitchShift(1));
    btnPitchReset?.addEventListener("click", () => applyPitchShift(0));

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
        const jumpItems = document.querySelectorAll(".lyric-jump-item, .segment-sync-card");
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

    // 60 FPS Smooth Stage Render Loop (High-speed zero-latency progressive fill)
    let stageAnimFrameId = null;
    function stageRenderLoop() {
        if (!beatAudio.paused && !beatAudio.ended) {
            updateKaraokeStage(beatAudio.currentTime);
            stageAnimFrameId = requestAnimationFrame(stageRenderLoop);
        } else {
            stageAnimFrameId = null;
        }
    }

    beatAudio.addEventListener("play", () => {
        if (stageAnimFrameId) cancelAnimationFrame(stageAnimFrameId);
        stageAnimFrameId = requestAnimationFrame(stageRenderLoop);
    });

    beatAudio.addEventListener("pause", () => {
        if (stageAnimFrameId) {
            cancelAnimationFrame(stageAnimFrameId);
            stageAnimFrameId = null;
        }
    });

    beatAudio.addEventListener("ended", () => {
        state.isPlaying = false;
        if (stageAnimFrameId) {
            cancelAnimationFrame(stageAnimFrameId);
            stageAnimFrameId = null;
        }
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

    const btnStudioRealign = document.getElementById("btnStudioRealign");
    btnStudioRealign?.addEventListener("click", async () => {
        if (!state.currentProject) {
            alert("Chưa có bài hát nào được mở trong Studio!");
            return;
        }
        const projId = state.currentProject.id;
        const btn = btnStudioRealign;
        const origHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<span class="realign-symbol">↻</span> Đang Căn Lại...`;

        try {
            const resp = await fetch(`/api/projects/${projId}/realign`, { method: "POST" });
            const data = await resp.json();
            if (resp.ok && data.status === "success") {
                state.currentProject = data.data;
                state._memoizedPairs = null;
                state._memoizedSegsRef = null;
                if (typeof renderLyricJumpList === "function") {
                    renderLyricJumpList();
                }
                if (typeof renderLyricsEditor === "function") {
                    renderLyricsEditor();
                }
                showToastNotification("Đã tự động căn lại nhịp và ghép cặp câu KTV thành công!");
            } else {
                alert("Lỗi căn nhịp: " + (data.detail || data.message || "Không xác định"));
            }
        } catch (err) {
            console.error("Realign error:", err);
            alert("Lỗi kết nối khi căn lại nhịp: " + err.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = origHtml;
        }
    });

    const btnSplitLongSegments = document.getElementById("btnSplitLongSegments");
    btnSplitLongSegments?.addEventListener("click", async () => {
        if (!state.currentProject) {
            alert("Chưa có bài hát nào được mở trong Studio!");
            return;
        }
        const projId = state.currentProject.id;
        const btn = btnSplitLongSegments;
        const origHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<span class="realign-symbol">↻</span> Đang Tách...`;

        try {
            const resp = await fetch(`/api/split-long-segments/${projId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ max_words: 7 })
            });
            const data = await resp.json();
            if (resp.ok && data.status === "success") {
                state.currentProject.segments = data.segments;
                state._memoizedPairs = null;
                state._memoizedSegsRef = null;
                if (typeof renderLyricJumpList === "function") {
                    renderLyricJumpList(data.segments);
                }
                if (typeof renderEditorTable === "function") {
                    renderEditorTable(data.segments);
                }
                showToastNotification(`Đã chia nhỏ các câu dài thành ${data.segments.length} câu ngắn (≤7 chữ)!`);
            } else {
                alert("Lỗi tách câu: " + (data.detail || data.message || "Không xác định"));
            }
        } catch (err) {
            console.error("Split error:", err);
            alert("Lỗi kết nối khi tách câu: " + err.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = origHtml;
        }
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
        initOrResumeStudioAudio().then(() => {
            // Guarantee playback speed is strictly 1.0 (constant tempo)
            beatAudio.playbackRate = 1.0;
            vocalAudio.playbackRate = 1.0;
            beatAudio.preservesPitch = true;
            vocalAudio.preservesPitch = true;

            beatAudio.play().then(() => {
                vocalAudio.play();
                state.isPlaying = true;
                if (playIconText) playIconText.textContent = "Tạm dừng";
            }).catch(err => {
                console.error("Playback error:", err);
            });
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
    state._cachedSongSafeSize = null;
    state._cachedSongSafeSizeSegsRef = null;

    const kLine1 = document.getElementById("kLine1");
    const kLine2 = document.getElementById("kLine2");
    const kLine1Content = document.getElementById("kLine1Content");
    const kLine2Content = document.getElementById("kLine2Content");

    if (kLine1) kLine1.style.fontFamily = fontFamily;
    if (kLine2) kLine2.style.fontFamily = fontFamily;
    if (kLine1Content) kLine1Content.style.fontFamily = fontFamily;
    if (kLine2Content) kLine2Content.style.fontFamily = fontFamily;

    document.querySelectorAll(".draggable-karaoke-line, .draggable-karaoke-line .line-content, .k-word, .k-word-wrap, .k-word-base, .k-word-fill-inner, .line-placeholder").forEach(el => {
        el.style.fontFamily = fontFamily;
    });

    const stageFontSelect = document.getElementById("stageFontSelect");
    if (stageFontSelect && stageFontSelect.value !== fontFamily) {
        stageFontSelect.value = fontFamily;
    }

    const exportFontSelect = document.getElementById("exportFontSelect") || document.getElementById("fontSelect");
    if (exportFontSelect) {
        const cleanFont = fontFamily.split(",")[0].replace(/['"]/g, "").trim();
        for (let opt of exportFontSelect.options) {
            if (opt.value === fontFamily || opt.value === cleanFont) {
                exportFontSelect.value = opt.value;
                break;
            }
        }
    }
    updateExportSummary();
}

function applyLinePositionX(lineNum, posXFraction) {
    const stageScreen = document.getElementById("stageScreen");
    const lineEl = document.getElementById(lineNum === 1 ? "kLine1" : "kLine2");
    if (!stageScreen || !lineEl) return;

    const clamped = Math.max(0.02, Math.min(0.98, parseFloat(posXFraction)));
    if (lineNum === 1) state.line1PosX = clamped;
    else state.line2PosX = clamped;

    const isCenter = Math.abs(clamped - 0.50) < 0.04;
    const isRight = (lineNum === 2 && state.layoutPreset === "staggered") || (clamped >= 0.78);

    if (isCenter) {
        lineEl.classList.add("align-center");
        lineEl.classList.remove("align-right");
        lineEl.dataset.align = "center";
        lineEl.style.left = "50%";
        lineEl.style.right = "auto";
        lineEl.style.transform = "translateX(-50%)";
        lineEl.style.textAlign = "center";
    } else if (isRight) {
        lineEl.classList.remove("align-center");
        lineEl.classList.add("align-right");
        lineEl.dataset.align = "right";
        lineEl.style.left = "auto";
        const rightPct = Math.max(4, Math.min(30, Math.round((1.0 - clamped) * 100)));
        lineEl.style.right = `${rightPct}%`;
        lineEl.style.transform = "none";
        lineEl.style.textAlign = "right";
    } else {
        lineEl.classList.remove("align-center");
        lineEl.classList.remove("align-right");
        lineEl.dataset.align = "left";
        lineEl.style.right = "auto";
        lineEl.style.transform = "none";
        lineEl.style.textAlign = "left";
        const stageW = stageScreen.clientWidth || 800;
        const lineW = lineEl.clientWidth || 200;
        const safeMargin = 28;
        const maxLeft = Math.max(safeMargin, stageW - lineW - safeMargin);
        const targetLeft = Math.max(safeMargin, Math.min(maxLeft, stageW * clamped));
        lineEl.style.left = `${targetLeft}px`;
    }

    const textEl = document.getElementById(lineNum === 1 ? "stagePosX1Text" : "stagePosX2Text");
    const sliderEl = document.getElementById(lineNum === 1 ? "stagePosX1Slider" : "stagePosX2Slider");
    const pctX = Math.round(clamped * 100);
    if (textEl) {
        if (isCenter) textEl.textContent = "50% (Giữa)";
        else if (isRight) textEl.textContent = `${pctX}% (Phải)`;
        else textEl.textContent = `${pctX}% (Trái)`;
    }
    if (sliderEl) sliderEl.value = pctX;

    // Update Floating HUD Badge position label
    const hudPosEl = document.getElementById(lineNum === 1 ? "kLine1HudPos" : "kLine2HudPos");
    const curY = lineNum === 1 ? (state.line1PosY || 0.60) : (state.line2PosY || 0.76);
    const pctY = Math.round(curY * 100);
    if (hudPosEl) {
        if (isCenter) hudPosEl.textContent = `Giữa (50%) • Y: ${pctY}%`;
        else if (isRight) hudPosEl.textContent = `Phải (${pctX}%) • Y: ${pctY}%`;
        else hudPosEl.textContent = `X: ${pctX}% • Y: ${pctY}%`;
    }

    const btnSelector = lineNum === 1 ? ".posX1-btn" : ".posX2-btn";
    document.querySelectorAll(btnSelector).forEach(btn => {
        const btnPos = parseFloat(btn.dataset.posx);
        btn.classList.toggle("active", Math.abs(btnPos - clamped) < 0.08);
    });

    if (state.isAutoFitEnabled !== false) {
        synchronizeLinesAutoFit(document.getElementById("kLine1"), document.getElementById("kLine2"));
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
    const val = Math.max(18, Math.min(120, parseInt(sizePx) || 52));
    // Always keep Line 1 and Line 2 in perfect synchronization for studio balance
    state.fontSizeLine1 = val;
    state.fontSizeLine2 = val;

    const textEl1 = document.getElementById("stageFontSize1Text");
    const sliderEl1 = document.getElementById("stageFontSize1Slider");
    if (textEl1) textEl1.textContent = `${val}px`;
    if (sliderEl1) sliderEl1.value = val;

    const textEl2 = document.getElementById("stageFontSize2Text");
    const sliderEl2 = document.getElementById("stageFontSize2Slider");
    if (textEl2) textEl2.textContent = `${val}px`;
    if (sliderEl2) sliderEl2.value = val;

    // Sync master font size slider & text in Tab 1
    const masterSlider = document.getElementById("masterFontSizeSlider");
    const masterText = document.getElementById("masterFontSizeText");
    const masterVal = document.getElementById("masterFontSizeVal");
    if (masterSlider) masterSlider.value = val;
    if (masterText) masterText.textContent = `${val}px`;
    if (masterVal) masterVal.textContent = `${val}px`;

    // Sync export font size slider & text in Export Tab
    const exportSlider = document.getElementById("exportFontSizeSlider");
    const exportText = document.getElementById("exportFontSizeText");
    if (exportSlider) exportSlider.value = val;
    if (exportText) exportText.textContent = `${val}px`;

    // Sync active size preset chips and pills
    document.querySelectorAll(".btn-size-preset, .size-preset-btn").forEach(btn => {
        const btnSize = parseInt(btn.dataset.size);
        btn.classList.toggle("active", Math.abs(btnSize - val) < 4);
    });

    // Update Floating HUD Badges for both lines
    const hudSizeEl1 = document.getElementById("kLine1HudSize");
    const hudSizeEl2 = document.getElementById("kLine2HudSize");
    if (hudSizeEl1) hudSizeEl1.textContent = `${val}px`;
    if (hudSizeEl2) hudSizeEl2.textContent = `${val}px`;

    const k1 = document.getElementById("kLine1");
    const k2 = document.getElementById("kLine2");
    if (k1) {
        const c1 = k1.querySelector(".line-content") || k1;
        c1.style.fontSize = `${val}px`;
    }
    if (k2) {
        const c2 = k2.querySelector(".line-content") || k2;
        c2.style.fontSize = `${val}px`;
    }

    if (state.isAutoFitEnabled !== false) {
        synchronizeLinesAutoFit(k1, k2);
    }
    updateExportSummary();
}

function applyMasterFontSize(sizePx) {
    const val = Math.max(18, Math.min(120, parseInt(sizePx) || 52));
    applyLineFontSize(1, val);
    applyLineFontSize(2, val);
}

let _measureCanvas = null;
function measureKaraokeTextWidth(text, fontSize, fontFamily) {
    if (!text) return 0;
    if (!_measureCanvas) _measureCanvas = document.createElement("canvas");
    const ctx = _measureCanvas.getContext("2d");
    if (!ctx) return text.length * fontSize * 0.62;
    const cleanFont = (fontFamily || state.fontName || "Tahoma").replace(/['"]/g, "").split(",")[0].trim();
    ctx.font = `800 ${fontSize}px ${cleanFont}, sans-serif`;
    return ctx.measureText(text).width;
}

function getLineSafeAvailableWidth(lineEl, stageW) {
    const safeMargin = Math.round(stageW * 0.06);
    const maxSafeW = Math.max(200, stageW - (safeMargin * 2));
    if (!lineEl) return maxSafeW;

    const isCenter = lineEl.classList.contains("align-center") || lineEl.dataset.align === "center";
    if (isCenter) return maxSafeW;

    const isRight = lineEl.classList.contains("align-right") || lineEl.dataset.align === "right";
    if (isRight) return maxSafeW;

    // Left-aligned or custom offset:
    const leftPx = lineEl.offsetLeft;
    const avail = (stageW - safeMargin) - leftPx;
    return Math.max(120, Math.min(maxSafeW, avail));
}

function getSongGlobalSafeFontSize() {
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

function calculateCoupletMaxSafeSize(k1, k2, stageW) {
    return (state.isAutoFitEnabled !== false) ? getSongGlobalSafeFontSize() : 115;
}

window.calculateGlobalMaxSafeFontSize = function(notify = true) {
    if (!state.currentProject || !state.currentProject.segments || !state.currentProject.segments.length) {
        if (notify) showToastNotification("Chưa có danh sách câu hát để quét!");
        return 56;
    }

    state._cachedSongSafeSize = null;
    state._cachedSongSafeSizeSegsRef = null;
    const recommendedSize = getSongGlobalSafeFontSize();
    applyMasterFontSize(recommendedSize);
    saveProjectStageSettings();

    if (notify) {
        showToastNotification(`Đã cân bằng toàn bài: Cỡ chữ ${recommendedSize}px đồng đều 100% không tràn viền!`);
    }
    return recommendedSize;
};

function synchronizeLinesAutoFit(kLine1, kLine2) {
    const stageScreen = document.getElementById("stageScreen");
    if (!stageScreen) return;
    const stageW = stageScreen.clientWidth || 800;
    const safeMargin = Math.round(stageW * 0.06);
    const maxSafeW = Math.round(stageW * 0.82); // 82% max width prevents either left or right overflow

    kLine1 = kLine1 || document.getElementById("kLine1");
    kLine2 = kLine2 || document.getElementById("kLine2");
    if (!kLine1 || !kLine2) return;

    const content1 = kLine1.querySelector(".line-content") || kLine1;
    const content2 = kLine2.querySelector(".line-content") || kLine2;

    const baseFontSize = (state.fontSizeLine1 || state.fontSizeLine2 || 52);

    let uniformFontSize = baseFontSize;

    if (state.isAutoFitEnabled !== false) {
        const songSafeSize = getSongGlobalSafeFontSize();
        uniformFontSize = Math.min(baseFontSize, songSafeSize);
    }

    // Apply 100% uniform font size to BOTH lines across ALL couplets throughout the song
    if (content1) content1.style.fontSize = `${uniformFontSize}px`;
    if (content2) content2.style.fontSize = `${uniformFontSize}px`;

    // Secondary safety step-down: if rendered DOM still breaches maxSafeW,
    // reduce uniformFontSize and update cached song safe size so the entire song remains uniform!
    if (state.isAutoFitEnabled !== false) {
        let curW1 = content1 ? (content1.scrollWidth || 0) : 0;
        let curW2 = content2 ? (content2.scrollWidth || 0) : 0;
        let steps = 0;
        let adjusted = false;
        while ((curW1 > maxSafeW || curW2 > maxSafeW) && uniformFontSize > 22 && steps < 5) {
            uniformFontSize -= 2;
            if (content1) content1.style.fontSize = `${uniformFontSize}px`;
            if (content2) content2.style.fontSize = `${uniformFontSize}px`;
            curW1 = content1 ? (content1.scrollWidth || 0) : 0;
            curW2 = content2 ? (content2.scrollWidth || 0) : 0;
            steps++;
            adjusted = true;
        }
        if (adjusted) {
            state._cachedSongSafeSize = uniformFontSize;
        }
    }

    // 1. Reset each line to its correct preset anchor
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

    // 2. TWO-WAY POSITION CLAMPING SAFEGUARD:
    // Guarantees left edge is NEVER < safeMargin, and right edge NEVER > stageW - safeMargin!
    [kLine1, kLine2].forEach(lineEl => {
        if (!lineEl) return;
        const isCenter = lineEl.classList.contains("align-center") || lineEl.dataset.align === "center";
        if (isCenter) return; // Centered lines are balanced by transform: translateX(-50%)

        const leftPx = lineEl.offsetLeft;
        const width = lineEl.offsetWidth || lineEl.scrollWidth || 0;

        if (leftPx < safeMargin) {
            // PUSH RIGHT: left edge breached left safe margin or went negative!
            lineEl.style.left = `${safeMargin}px`;
            lineEl.style.right = "auto";
        } else if (leftPx + width > stageW - safeMargin) {
            // PUSH LEFT: right edge breached right safe margin!
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

function adjustLineAutoFit(container, lineNum, baseFontSize) {
    const k1 = document.getElementById("kLine1");
    const k2 = document.getElementById("kLine2");
    synchronizeLinesAutoFit(k1, k2);
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

        kLine1.classList.remove("align-right");
        kLine2.classList.remove("align-right");
        kLine1.classList.add("align-center");
        kLine2.classList.add("align-center");
        kLine1.dataset.align = "center";
        kLine2.dataset.align = "center";

        kLine1.style.left = "50%";
        kLine1.style.right = "auto";
        kLine1.style.transform = "translateX(-50%)";
        kLine1.style.textAlign = "center";

        kLine2.style.left = "50%";
        kLine2.style.right = "auto";
        kLine2.style.transform = "translateX(-50%)";
        kLine2.style.textAlign = "center";

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
        if (notify) showToastNotification("Đã bật bố cục Căn Giữa Chuẩn Studio (Hình 2)!");
    } else if (presetName === "staggered") {
        state.layoutPreset = "staggered";
        state.line1Align = "left";
        state.line2Align = "right";

        kLine1.classList.remove("align-center", "align-right");
        kLine2.classList.remove("align-center");
        kLine2.classList.add("align-right");

        kLine1.dataset.align = "left";
        kLine2.dataset.align = "right";

        kLine1.style.left = "8%";
        kLine1.style.right = "auto";
        kLine1.style.transform = "none";
        kLine1.style.textAlign = "left";

        kLine2.style.left = "auto";
        kLine2.style.right = "8%";
        kLine2.style.transform = "none";
        kLine2.style.textAlign = "right";

        state.line1PosX = 0.08;
        state.line2PosX = 0.92;
        state.line1PosY = 0.60;
        state.line2PosY = 0.76;

        applyLinePositionY(1, 0.60);
        applyLinePositionY(2, 0.76);
        applyLineFontSize(1, state.fontSizeLine1 || 52);
        applyLineFontSize(2, state.fontSizeLine2 || 52);

        const sliderX1 = document.getElementById("stagePosX1Slider");
        const sliderX2 = document.getElementById("stagePosX2Slider");
        const textX1 = document.getElementById("stagePosX1Text");
        const textX2 = document.getElementById("stagePosX2Text");
        if (sliderX1) sliderX1.value = 8;
        if (sliderX2) sliderX2.value = 92;
        if (textX1) textX1.textContent = "8% (Trái)";
        if (textX2) textX2.textContent = "92% (Phải)";

        const hudPos1 = document.getElementById("kLine1HudPos");
        const hudPos2 = document.getElementById("kLine2HudPos");
        if (hudPos1) hudPos1.textContent = "Trái (8%) • Y: 60%";
        if (hudPos2) hudPos2.textContent = "Phải (92%) • Y: 76%";

        document.getElementById("btnPresetStaggered")?.classList.add("active");

        updateKaraokeStage(beatAudio.currentTime);
        if (notify) showToastNotification("Đã bật bố cục So Le Trái - Phải Chuẩn KTV!");
    } else if (presetName === "autofit_all") {
        document.getElementById("btnPresetAutoFit")?.classList.add("active");
        calculateGlobalMaxSafeFontSize(notify);
    }

    if (state.currentProject) {
        saveProjectStageSettings();
    }
    updateExportSummary();
}

function applyStyleTheme(themeKey, notify = true) {
    document.querySelectorAll(".btn-dock-theme").forEach(b => b.classList.remove("active"));

    if (themeKey === "tronghieu") {
        document.getElementById("btnThemeTrongHieu")?.classList.add("active");
        applyStageFont("Tahoma, sans-serif");
        applyLayoutPreset("staggered", false);
        applyStageActiveColor("#0018F5");
        applyMasterFontSize(54);
        state.wipingFxMode = "smooth";
        applyWipingFxMode();
        state.stageDisplayMode = "pingpong";
        state.showCountdownDots = true;
        const chk = document.getElementById("chkCountdownDots");
        if (chk) chk.checked = true;
        if (notify) showToastNotification("Đã chọn Mẫu Chuẩn KTV Gia Huy Beat (Tahoma Bold, Xanh KTV, Viền Trắng, So Le)!");
    } else if (themeKey === "bolero") {
        document.getElementById("btnThemeBolero")?.classList.add("active");
        applyStageFont("'Pattaya', sans-serif");
        applyLayoutPreset("staggered", false);
        applyStageActiveColor("#FFE259");
        applyMasterFontSize(50);
        state.wipingFxMode = "smooth";
        applyWipingFxMode();
        state.stageDisplayMode = "pingpong";
        state.showCountdownDots = true;
        const chk = document.getElementById("chkCountdownDots");
        if (chk) chk.checked = true;
        if (notify) showToastNotification("Đã chọn Mẫu Trữ Tình Bolero (Font Thư Pháp, Vàng Gold)!");
    } else if (themeKey === "remix") {
        document.getElementById("btnThemeRemix")?.classList.add("active");
        applyStageFont("'Outfit', sans-serif");
        applyLayoutPreset("center", false);
        applyStageActiveColor("#00F2FE");
        applyMasterFontSize(54);
        state.wipingFxMode = "comet";
        applyWipingFxMode();
        state.stageDisplayMode = "pingpong";
        state.showCountdownDots = true;
        const chk = document.getElementById("chkCountdownDots");
        if (chk) chk.checked = true;
        if (notify) showToastNotification("Đã chọn Mẫu Hiện Đại Remix (Font Outfit, Cyber Cyan, Tia Sáng)!");
    } else if (themeKey === "minimal") {
        document.getElementById("btnThemeMinimal")?.classList.add("active");
        applyStageFont("'Be Vietnam Pro', sans-serif");
        applyLayoutPreset("center", false);
        applyStageActiveColor("#FFFFFF");
        applyMasterFontSize(48);
        state.wipingFxMode = "smooth";
        applyWipingFxMode();
        state.stageDisplayMode = "pingpong";
        state.showCountdownDots = true;
        const chk = document.getElementById("chkCountdownDots");
        if (chk) chk.checked = true;
        if (notify) showToastNotification("Đã chọn Mẫu Tối Giản Trắng (Be Vietnam Pro, Viền Đen, Căn Giữa)!");
    }

    // Synchronize inputs in inspector
    const stageFontSelect = document.getElementById("stageFontSelect");
    if (stageFontSelect && state.stageFontFamily) {
        stageFontSelect.value = state.stageFontFamily;
    }
    document.querySelectorAll(".display-mode-btn").forEach(b => {
        b.classList.toggle("active", b.dataset.mode === (state.stageDisplayMode || "pingpong"));
    });
    document.querySelectorAll(".fx-style-btn").forEach(b => {
        b.classList.toggle("active", b.dataset.fx === (state.wipingFxMode || "smooth"));
    });
    document.querySelectorAll(".drawer-color-chip, .stage-color-dot").forEach(b => {
        b.classList.toggle("active", b.dataset.color === state.stageActiveColor);
    });

    if (state.currentProject) {
        saveProjectStageSettings();
    }
    updateKaraokeStage(beatAudio.currentTime);
}

function applyPresetTrongHieu(notify = true) {
    applyStyleTheme("tronghieu", notify);
}

async function saveProjectStageSettings() {
    if (!state.currentProject) return;
    const stageFontSelect = document.getElementById("stageFontSelect");

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
        font_name: stageFontSelect ? stageFontSelect.value : "Tahoma",
        primary_color: hexToAssColor(state.colorInactive || "#ffffff"),
        karaoke_color: hexToAssColor(state.colorActive || "#0018F5"),
        color_active_hex: state.colorActive || "#0018F5",
        color_inactive_hex: state.colorInactive || "#ffffff",
        bg_theme: state.bgTheme || "nebula",
        pitch_semitones: state.currentPitchSemitones || 0,
        wiping_fx: state.wipingFxMode || "smooth",
        show_countdown: state.showCountdownDots !== false,
        display_mode: state.stageDisplayMode || "pingpong"
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
            const newSize = Math.max(24, Math.min(115, cur + delta));
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

            if (lineEl.classList.contains("align-center") || lineEl.classList.contains("align-right")) {
                lineEl.classList.remove("align-center", "align-right");
                delete lineEl.dataset.align;
                lineEl.style.left = `${initialLeftPx}px`;
                lineEl.style.right = "auto";
                lineEl.style.transform = "none";
                document.querySelectorAll(".btn-preset-chip, .btn-dock-pill").forEach(b => b.classList.remove("active"));
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

                if (lineEl.classList.contains("align-center") || lineEl.classList.contains("align-right")) {
                    lineEl.classList.remove("align-center", "align-right");
                    delete lineEl.dataset.align;
                    lineEl.style.left = `${initialLeftPx}px`;
                    lineEl.style.right = "auto";
                    lineEl.style.transform = "none";
                    document.querySelectorAll(".btn-preset-chip, .btn-dock-pill").forEach(b => b.classList.remove("active"));
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
                const stageW = stageScreen.clientWidth || 800;
                const maxSafe = calculateCoupletMaxSafeSize(kLine1, kLine2, stageW);
                const rawTarget = Math.round(initialSize + delta);
                const isClamped = rawTarget > maxSafe;
                const newSize = Math.max(24, Math.min(maxSafe, rawTarget));

                lineEl.classList.toggle("clamped-boundary", isClamped);
                applyLineFontSize(lineNum, newSize);

                if (isClamped) {
                    const hud = document.getElementById(lineNum === 1 ? "kLine1HudSize" : "kLine2HudSize");
                    if (hud) hud.textContent = `${newSize}px (Đạt giới hạn viền)`;
                }
                return;
            }

            if (!isDragging) return;
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            const stageW = stageScreen.clientWidth || 800;
            const stageH = stageScreen.clientHeight || 480;
            const lineW = lineEl.clientWidth || 200;
            const lineH = lineEl.clientHeight || 50;
            const safeMargin = Math.round(stageW * 0.06);

            const maxLeft = Math.max(safeMargin, stageW - lineW - safeMargin);
            const maxTop = stageH - lineH - 10;

            const newLeft = Math.max(safeMargin, Math.min(maxLeft, initialLeftPx + deltaX));
            const newTop = Math.max(10, Math.min(maxTop, initialTopPx + deltaY));

            applyLinePositionX(lineNum, newLeft / stageW);
            applyLinePositionY(lineNum, newTop / stageH);
        });

        window.addEventListener("touchmove", (e) => {
            if (isResizing && e.touches.length === 1) {
                const delta = ((e.touches[0].clientX - startX) + (e.touches[0].clientY - startY)) * 0.35;
                const stageW = stageScreen.clientWidth || 800;
                const maxSafe = calculateCoupletMaxSafeSize(kLine1, kLine2, stageW);
                const rawTarget = Math.round(initialSize + delta);
                const isClamped = rawTarget > maxSafe;
                const newSize = Math.max(24, Math.min(maxSafe, rawTarget));

                lineEl.classList.toggle("clamped-boundary", isClamped);
                applyLineFontSize(lineNum, newSize);

                if (isClamped) {
                    const hud = document.getElementById(lineNum === 1 ? "kLine1HudSize" : "kLine2HudSize");
                    if (hud) hud.textContent = `${newSize}px (Đạt giới hạn viền)`;
                }
                return;
            }

            if (!isDragging || e.touches.length !== 1) return;
            const deltaX = e.touches[0].clientX - startX;
            const deltaY = e.touches[0].clientY - startY;
            const stageW = stageScreen.clientWidth || 800;
            const stageH = stageScreen.clientHeight || 480;
            const lineW = lineEl.clientWidth || 200;
            const lineH = lineEl.clientHeight || 50;
            const safeMargin = Math.round(stageW * 0.06);

            const maxLeft = Math.max(safeMargin, stageW - lineW - safeMargin);
            const maxTop = stageH - lineH - 10;

            const newLeft = Math.max(safeMargin, Math.min(maxLeft, initialLeftPx + deltaX));
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
                lineEl.classList.remove("resizing", "clamped-boundary");
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
                lineEl.classList.remove("resizing", "clamped-boundary");
            }
        });
    }

    attachDraggableToLine(kLine1, 1);
    attachDraggableToLine(kLine2, 2);

    // Keep lines calibrated to exact 16:9 stage geometry on any window resize or scale
    if (window.ResizeObserver && stageScreen) {
        const stageResizeObserver = new ResizeObserver(() => {
            state._cachedSongSafeSize = null;
            state._cachedSongSafeSizeSegsRef = null;
            if (state.line1PosY !== undefined) applyLinePositionY(1, state.line1PosY);
            if (state.line2PosY !== undefined) applyLinePositionY(2, state.line2PosY);
            if (state.line1PosX !== undefined) applyLinePositionX(1, state.line1PosX);
            if (state.line2PosX !== undefined) applyLinePositionX(2, state.line2PosX);
            synchronizeLinesAutoFit(kLine1, kLine2);
        });
        stageResizeObserver.observe(stageScreen);
    }

    // 1-Click Style Themes & Quick Layout Listeners
    document.getElementById("btnThemeTrongHieu")?.addEventListener("click", () => applyStyleTheme("tronghieu", true));
    document.getElementById("btnThemeBolero")?.addEventListener("click", () => applyStyleTheme("bolero", true));
    document.getElementById("btnThemeRemix")?.addEventListener("click", () => applyStyleTheme("remix", true));
    document.getElementById("btnThemeMinimal")?.addEventListener("click", () => applyStyleTheme("minimal", true));

    document.getElementById("btnPresetTrongHieu")?.addEventListener("click", () => applyStyleTheme("tronghieu", true));
    document.getElementById("btnPresetCenter")?.addEventListener("click", () => applyLayoutPreset("center"));
    document.getElementById("btnPresetStaggered")?.addEventListener("click", () => applyLayoutPreset("staggered"));
    document.getElementById("btnDrawerLayoutCenter")?.addEventListener("click", () => applyLayoutPreset("center"));
    document.getElementById("btnDrawerLayoutStaggered")?.addEventListener("click", () => applyLayoutPreset("staggered"));
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

    // Master Font Size Slider & Zoom Buttons (Tab 1)
    const masterSlider = document.getElementById("masterFontSizeSlider");
    masterSlider?.addEventListener("input", (e) => {
        applyMasterFontSize(e.target.value);
    });
    document.getElementById("btnMasterZoomIn")?.addEventListener("click", () => {
        const cur = parseInt(document.getElementById("masterFontSizeSlider")?.value || state.fontSizeLine1 || 52);
        applyMasterFontSize(cur + 4);
    });
    document.getElementById("btnMasterZoomOut")?.addEventListener("click", () => {
        const cur = parseInt(document.getElementById("masterFontSizeSlider")?.value || state.fontSizeLine1 || 52);
        applyMasterFontSize(cur - 4);
    });

    // Preset size chips click
    document.querySelectorAll(".size-preset-chips .btn-size-preset").forEach(btn => {
        btn.addEventListener("click", () => {
            const sz = parseInt(btn.dataset.size);
            if (sz) applyMasterFontSize(sz);
        });
    });

    // Font Size Sliders (Tab 2)
    const size1Slider = document.getElementById("stageFontSize1Slider");
    const size2Slider = document.getElementById("stageFontSize2Slider");

    size1Slider?.addEventListener("input", (e) => {
        applyLineFontSize(1, e.target.value);
    });

    size2Slider?.addEventListener("input", (e) => {
        applyLineFontSize(2, e.target.value);
    });

    // Quick Zoom Buttons in Tab 2
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

    // Export Tab Font Size Controls
    const exportSlider = document.getElementById("exportFontSizeSlider");
    exportSlider?.addEventListener("input", (e) => {
        applyMasterFontSize(e.target.value);
    });
    document.getElementById("btnExportZoomIn")?.addEventListener("click", () => {
        const cur = parseInt(document.getElementById("exportFontSizeSlider")?.value || state.fontSizeLine1 || 52);
        applyMasterFontSize(cur + 4);
    });
    document.getElementById("btnExportZoomOut")?.addEventListener("click", () => {
        const cur = parseInt(document.getElementById("exportFontSizeSlider")?.value || state.fontSizeLine1 || 52);
        applyMasterFontSize(cur - 4);
    });

    // Custom Font Size Direct Prompt on Badge Click
    const promptFontSize = (currentVal, callback) => {
        const input = prompt(`Nhập cỡ chữ mong muốn (18 - 120 px):`, currentVal);
        if (input !== null) {
            const parsed = parseInt(input.trim());
            if (!isNaN(parsed) && parsed >= 18 && parsed <= 120) {
                callback(parsed);
            }
        }
    };

    document.getElementById("masterFontSizeText")?.addEventListener("click", () => {
        promptFontSize(state.fontSizeLine1 || 52, (sz) => applyMasterFontSize(sz));
    });
    document.getElementById("stageFontSize1Text")?.addEventListener("click", () => {
        promptFontSize(state.fontSizeLine1 || 52, (sz) => applyLineFontSize(1, sz));
    });
    document.getElementById("stageFontSize2Text")?.addEventListener("click", () => {
        promptFontSize(state.fontSizeLine2 || 52, (sz) => applyLineFontSize(2, sz));
    });
    document.getElementById("exportFontSizeText")?.addEventListener("click", () => {
        promptFontSize(state.fontSizeLine1 || 52, (sz) => applyMasterFontSize(sz));
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



    // Cinema / Clean Immersion Mode Toggle
    const btnToggleCinema = document.getElementById("btnToggleCinema");
    const btnCinemaMaster = document.getElementById("btnCinemaMaster");
    btnToggleCinema?.addEventListener("click", () => {
        const stageWrapper = document.querySelector(".karaoke-stage-wrapper") || document.querySelector(".studio-main-col") || document.body;
        const isCinema = stageWrapper.classList.toggle("cinema-active");
        btnToggleCinema.classList.toggle("active", isCinema);
        btnToggleCinema.innerHTML = isCinema ? "<span>Thoát Rạp</span>" : "<span>Rạp Chiếu</span>";
        if (btnCinemaMaster) {
            btnCinemaMaster.classList.toggle("active", isCinema);
            btnCinemaMaster.textContent = isCinema ? "Thoát Rạp" : "Rạp Chiếu";
        }
        showToastNotification(isCinema ? "Đã bật Chế độ Rạp Chiếu (Toàn màn hình sạch)" : "Đã trở về chế độ Studio");
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
        showToastNotification("Đã lưu cấu hình bài hát thành công!");
    });

    btnResetProjectSettings?.addEventListener("click", () => {
        applyLayoutPreset("center");
        showToastNotification("Đã đặt lại cấu hình mặc định!");
    });
}


/**
 * Professional Couplet Stage Engine (Chuẩn Karaoke Quân Masu / KTV)
 * - Dòng 1 (Top Line): LUÔN LUÔN là câu hát trước trong cặp
/**
 * Professional Alternating Rolling Stage Engine (Chuẩn Karaoke KTV / Trọng Hiếu YouTube)
 * - Khổ hát (Stanza): Các câu liên tiếp có gap < 2.0s được gom thành một khổ.
 * - Hàng 1 (Top Line): Phụ trách các câu chẵn trong khổ (0, 2, 4...)
 * - Hàng 2 (Bottom Line): Phụ trách các câu lẻ trong khổ (1, 3, 5...)
 * - Đầu khổ: Cả 2 câu xuất hiện cùng lúc (chữ trắng) trước ~2.5s để người hát đọc trước.
 * - Khi Hàng 1 hát xong: Giữ chữ 0.25s (retention) rồi lật ngay sang câu tiếp theo của Hàng 1 (chữ trắng),
 *   trong khi Hàng 2 đang quét hát.
 * - Khi Hàng 2 hát xong: Giữ chữ 0.25s rồi lật ngay sang câu tiếp theo của Hàng 2 (chữ trắng),
 *   trong khi Hàng 1 đang quét hát.
 * - Đoạn dạo solo / nghỉ giữa các khổ (gap >= 2.0s): Màn hình sạch chữ hoàn toàn trong lúc solo.
 *   Trước khi vào khổ mới ~2.0s: 4 chấm nhịp xuất hiện và 2 hàng mới được nạp vào.
 */
function getAlternatingTimeline(segments) {
    if (!segments || !segments.length) return [];
    if (state._memoizedTimeline && state._memoizedTimelineSegsRef === segments) {
        return state._memoizedTimeline;
    }

    const validSegs = segments.filter(s => s && (s.words?.length || s.text));
    if (!validSegs.length) return [];

    const interludeThreshold = 5.0;
    const retention = 0.25;
    const defaultLeadIn = 2.5;

    // Partition into stanzas: only split on substantial interlude (>= 5.0s)
    // AND require current stanza to have at least 2 lines so Row 1 and Row 2 are both populated
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
        const stanzaEntry = stIdx > 0 ? Math.max(prevStanzaEnd + 0.1, s0Lead) : s0Lead;

        const slot1Segs = []; // Even indices within stanza (Hàng 1)
        const slot2Segs = []; // Odd indices within stanza (Hàng 2)

        for (let j = 0; j < stanza.length; j++) {
            if (j % 2 === 0) {
                slot1Segs.push({ j, seg: stanza[j] });
            } else {
                slot2Segs.push({ j, seg: stanza[j] });
            }
        }

        // Process Slot 1 (Hàng 1 - Top)
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

        // Process Slot 2 (Hàng 2 - Bottom)
        for (let k = 0; k < slot2Segs.length; k++) {
            const { j, seg } = slot2Segs[k];
            const isFirst = (k === 0);
            const isLast = (k === slot2Segs.length - 1);

            const dispStart = isFirst
                ? stanzaEntry // Appears along with Slot 1 so singer previews both lines
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

function getCoupletPairs(segments) {
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

function updateKaraokeStageCouplet(currentTime, segments) {
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
        const pairLeadIn = pIdx === 0 ? Math.max(0.0, segA.start - 2.5) : Math.max(prevEnd, segA.start - 2.5);
        
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
        if (nextPair) {
            const timeToNext = nextPair[0].start - currentTime;
            if (timeToNext <= 2.5) {
                activePair = nextPair;
            } else if (prevPair && (currentTime - prevPair[prevPair.length - 1].end) <= 0.8) {
                activePair = prevPair;
            } else {
                renderKaraokeLine(kLine1, null, currentTime);
                renderKaraokeLine(kLine2, null, currentTime);
                return;
            }
        } else {
            if (prevPair && (currentTime - prevPair[prevPair.length - 1].end) <= 0.8) {
                activePair = prevPair;
            } else {
                renderKaraokeLine(kLine1, null, currentTime);
                renderKaraokeLine(kLine2, null, currentTime);
                return;
            }
        }
    }

    const line1Seg = activePair[0] || null;
    const line2Seg = activePair.length > 1 ? activePair[1] : null;

    renderKaraokeLine(kLine1, line1Seg, currentTime);
    renderKaraokeLine(kLine2, line2Seg, currentTime);
    synchronizeLinesAutoFit(kLine1, kLine2);
}

function updateKaraokeStage(currentTime) {
    const segments = state.currentProject?.segments || [];
    if (!segments.length) return;

    // 1. Lead-in Countdown Dots Check
    renderCountdownDots(currentTime, segments);

    // 2. Mode Check: If user explicitly chose legacy couplet mode
    if (state.stageDisplayMode === "couplet") {
        updateKaraokeStageCouplet(currentTime, segments);
        return;
    }

    // 3. Default: Professional Alternating Rolling Ping-Pong Mode (So Le Luân Phiên Cuốn Chiếu)
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

    renderKaraokeLine(kLine1, slot1Seg, currentTime);
    renderKaraokeLine(kLine2, slot2Seg, currentTime);
    synchronizeLinesAutoFit(kLine1, kLine2);
}

function renderCountdownDots(currentTime, segments) {
    const wrap = document.getElementById("stageCountdownWrap");
    if (!wrap) return;

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

    // Show countdown only for song intro (prevEnd <= 1.0) or substantial musical interlude (gap >= 3.5s)
    if ((prevEnd <= 1.0 || gapDuration >= 3.5) && timeLeft > 0.05 && timeLeft <= 2.0) {
        // Smart vertical positioning: center above Line 1 if Line 1 has top offset
        const kLine1 = document.getElementById("kLine1");
        if (kLine1 && kLine1.offsetTop > 60) {
            wrap.style.top = `${Math.max(32, kLine1.offsetTop - 56)}px`;
            wrap.style.transform = "translateX(-50%)";
        } else {
            wrap.style.top = "50%";
            wrap.style.transform = "translate(-50%, -50%)";
        }

        wrap.style.display = "flex";
        const dots = wrap.querySelectorAll(".c-dot");
        const label = document.getElementById("stageCountdownLabel");
        if (label) {
            label.textContent = timeLeft <= 0.5 ? "HÁT!" : "VÀO NHỊP";
        }
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

function renderKaraokeLine(container, segment, currentTime) {
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

    // 1. Rebuild DOM ONLY when the segment changes or content is empty
    if (container.dataset.segIdx !== segId || !contentEl.firstElementChild) {
        container.dataset.segIdx = segId;
        let html = "";
        words.forEach((w, wIdx) => {
            html += `<span class="k-word-wrap ${roleClass}" data-widx="${wIdx}">` +
                    `<span class="k-word-base">${w.word}</span>` +
                    `<span class="k-word-fill"><span class="k-word-fill-inner">${w.word}</span></span>` +
                    `</span> `;
        });
        contentEl.innerHTML = html;

        if (state.fontName) {
            contentEl.querySelectorAll(".k-word-base, .k-word-fill-inner").forEach(el => {
                el.style.fontFamily = state.fontName;
            });
        }

        const baseFontSize = (state.fontSizeLine1 || state.fontSizeLine2 || 52);
        const uniformFs = (state.isAutoFitEnabled !== false) ? Math.min(baseFontSize, getSongGlobalSafeFontSize()) : baseFontSize;
        contentEl.style.fontSize = `${uniformFs}px`;
    }

    // 2. High-performance 60 FPS Progressive Wipe (Update fill width without reflow)
    const fillEls = contentEl.querySelectorAll(".k-word-fill");
    words.forEach((w, wIdx) => {
        const fillEl = fillEls[wIdx];
        if (!fillEl) return;
        const wrapEl = fillEl.parentElement;
        let pct = 0;
        if (currentTime >= w.end) {
            pct = 100;
            if (wrapEl && wrapEl.classList.contains("wiping")) {
                wrapEl.classList.remove("wiping");
                wrapEl.classList.add("sung");
            }
        } else if (currentTime > w.start) {
            const dur = Math.max(0.04, w.end - w.start);
            pct = Math.min(100, Math.max(0, ((currentTime - w.start) / dur) * 100));
            if (wrapEl && !wrapEl.classList.contains("wiping")) {
                wrapEl.classList.add("wiping");
                wrapEl.classList.remove("sung");
            }
        } else {
            pct = 0;
            if (wrapEl && (wrapEl.classList.contains("wiping") || wrapEl.classList.contains("sung"))) {
                wrapEl.classList.remove("wiping", "sung");
            }
        }
        fillEl.style.width = `${pct.toFixed(1)}%`;
    });
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

    // Gemini Alignment in Studio (Suno AI & New Song Specialist)
    const btnAlignGemini = document.getElementById("btnAlignGemini");
    const geminiAlignModal = document.getElementById("geminiAlignModal");
    const closeGeminiAlignModalBtn = document.getElementById("closeGeminiAlignModalBtn");
    const cancelGeminiAlignModalBtn = document.getElementById("cancelGeminiAlignModalBtn");
    const startGeminiAlignBtn = document.getElementById("startGeminiAlignBtn");
    const geminiAlignLyricsInput = document.getElementById("geminiAlignLyricsInput");
    const geminiAlignModelSelect = document.getElementById("geminiAlignModelSelect");
    const geminiAlignStatusMsg = document.getElementById("geminiAlignStatusMsg");
    const btnCleanSunoLyricsPrompt = document.getElementById("btnCleanSunoLyricsPrompt");

    const openGeminiAlignModal = () => {
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
    };

    btnAlignGemini?.addEventListener("click", openGeminiAlignModal);
    closeGeminiAlignModalBtn?.addEventListener("click", () => { if (geminiAlignModal) geminiAlignModal.style.display = "none"; });
    cancelGeminiAlignModalBtn?.addEventListener("click", () => { if (geminiAlignModal) geminiAlignModal.style.display = "none"; });

    btnCleanSunoLyricsPrompt?.addEventListener("click", () => {
        if (!geminiAlignLyricsInput) return;
        let text = geminiAlignLyricsInput.value;
        // Clean square bracket tags like [Verse 1], [Chorus], [Guitar Solo]
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
                if (typeof loadSubtitles === "function") {
                    loadSubtitles(projId);
                }
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
                <button class="btn-micro-step" onclick="deleteSegment(${idx})" title="Xóa câu này" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.4);">Xóa</button>
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

window.setSegmentRole = function(segIdx, newRole) {
    if (!state.currentProject || !state.currentProject.segments) return;
    const seg = state.currentProject.segments[segIdx];
    if (!seg) return;
    seg.role = newRole;
    renderLyricJumpList(state.currentProject.segments);
    renderEditorTable(state.currentProject.segments);
    updateKaraokeStage(beatAudio.currentTime);
    saveProjectStageSettings();
    showToastNotification(`Đã gán vai câu #${segIdx + 1}: ${newRole === 'male' ? 'Nam' : newRole === 'female' ? 'Nữ' : newRole === 'duet' ? 'Song ca' : 'Chung'}`);
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
        const btnToggleMicMaster = document.getElementById("btnToggleMicMaster");
        if (micStream) {
            micStream.getTracks().forEach(t => t.stop());
            micStream = null;
            btnToggleMic.classList.remove("active");
            const toggleText = document.getElementById("micToggleText");
            if (toggleText) toggleText.textContent = "Bật Micro Hát Live";
            if (micLiveIndicator) micLiveIndicator.style.display = "none";
            if (btnToggleMicMaster) {
                btnToggleMicMaster.classList.remove("active");
                btnToggleMicMaster.textContent = "Bật Micro";
            }
            showToastNotification("Đã tắt Micro");
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
            if (btnToggleMicMaster) {
                btnToggleMicMaster.classList.add("active");
                btnToggleMicMaster.textContent = "Tắt Micro";
            }
            showToastNotification("Đã bật Micro Hát Live (Echo & Reverb Studio)!");
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
            showToastNotification("Đã hoàn thành bản thu âm!");
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
            showToastNotification("Đang thu âm giọng hát...");
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
                font_name: state.fontName || "Tahoma",
                font_size: state.fontSizeLine1 || 54,
                primary_color: hexToAssColor(colorInactive.value),
                karaoke_color: hexToAssColor(colorActive.value),
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


/* ========================================================
   7. VIDEO EXPORT & CUSTOMIZER
   ======================================================== */
function setupExport() {
    const stageFontSelect = document.getElementById("stageFontSelect");
    const exportFontSelect = document.getElementById("exportFontSelect");
    const stageFontSizeSlider = document.getElementById("stageFontSizeSlider");
    const stageFontSizeText = document.getElementById("stageFontSizeText");
    const bgChips = document.querySelectorAll(".bg-chip");
    const btnUploadStageBg = document.getElementById("btnUploadStageBg");
    const stageBgFileInput = document.getElementById("stageBgFileInput");
    const stageScreen = document.getElementById("stageScreen") || document.getElementById("karaokeScreen");

    // Font change
    function updateStageFont(fontFamily, fontNameClean) {
        if (typeof applyStageFont === "function") {
            applyStageFont(fontFamily);
        } else {
            if (kLine1) kLine1.style.fontFamily = fontFamily;
            if (kLine2) kLine2.style.fontFamily = fontFamily;
            if (stageFontSelect && stageFontSelect.value !== fontFamily) stageFontSelect.value = fontFamily;
        }
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

    // 1. Stage Screen Floating Color Dock listeners (Chỉnh màu ngay trên màn hình)
    document.querySelectorAll(".stage-color-dot").forEach(dot => {
        dot.addEventListener("click", () => {
            applyStageActiveColor(dot.dataset.color);
        });
    });
    document.getElementById("stageColorPickerInput")?.addEventListener("input", (e) => {
        applyStageActiveColor(e.target.value);
    });

    // 2. Drawer Color Chips listeners
    document.querySelectorAll(".drawer-color-chip").forEach(chip => {
        chip.addEventListener("click", () => {
            applyStageActiveColor(chip.dataset.color);
        });
    });
    document.getElementById("drawerColorPickerInput")?.addEventListener("input", (e) => {
        applyStageActiveColor(e.target.value);
    });

    // 3. Initialize default color & summary
    applyStageActiveColor(state.colorActive || "#0018F5");
    updateExportSummary();

    btnStartRender?.addEventListener("click", handleStartRender);
}

function applyStageActiveColor(colorHex) {
    if (!colorHex) return;
    state.colorActive = colorHex;

    // 1. Set CSS variables on stageScreen
    const stageScreen = document.getElementById("stageScreen") || document.getElementById("karaokeScreen");
    if (stageScreen) {
        stageScreen.style.setProperty("--stage-color-active", colorHex);
        const hex = colorHex.replace("#", "");
        const r = parseInt(hex.substring(0, 2), 16) || 0;
        const g = parseInt(hex.substring(2, 4), 16) || 0;
        const b = parseInt(hex.substring(4, 6), 16) || 0;
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        if (lum < 160) {
            // Dark / Saturated like KTV Royal Blue: White outline + Black drop shadow
            stageScreen.style.setProperty("--stage-stroke-active", "3px #ffffff");
            stageScreen.style.setProperty("--stage-shadow-active", "drop-shadow(2px 3px 0px #000000)");
        } else {
            // Light color (Yellow, White): Black outline + Black drop shadow
            stageScreen.style.setProperty("--stage-stroke-active", "2.5px #000000");
            stageScreen.style.setProperty("--stage-shadow-active", "drop-shadow(2px 3px 0px #000000)");
        }
    }

    // 2. Sync Screen floating toolbar dots
    document.querySelectorAll(".stage-color-dot").forEach(dot => {
        const dotColor = (dot.dataset.color || "").toUpperCase();
        dot.classList.toggle("active", dotColor === colorHex.toUpperCase());
    });
    const stagePicker = document.getElementById("stageColorPickerInput");
    if (stagePicker && stagePicker.value.toUpperCase() !== colorHex.toUpperCase()) {
        stagePicker.value = colorHex;
    }

    // 3. Sync Drawer color chips
    document.querySelectorAll(".drawer-color-chip").forEach(chip => {
        const chipColor = (chip.dataset.color || "").toUpperCase();
        chip.classList.toggle("active", chipColor === colorHex.toUpperCase());
    });
    const drawerPicker = document.getElementById("drawerColorPickerInput");
    if (drawerPicker && drawerPicker.value.toUpperCase() !== colorHex.toUpperCase()) {
        drawerPicker.value = colorHex;
    }

    // 4. Update Export summary badge
    updateExportSummary();
}

function updateExportSummary() {
    const fontEl = document.getElementById("exportSummaryFont");
    const sizeEl = document.getElementById("exportSummarySize");
    const colorDot = document.getElementById("exportSummaryColorDot");
    const colorText = document.getElementById("exportSummaryColorText");
    const layoutEl = document.getElementById("exportSummaryLayout");

    if (fontEl) {
        const fontName = state.fontName ? state.fontName.replace(/['"]/g, "").split(",")[0].trim() : "Tahoma";
        fontEl.textContent = fontName;
    }
    if (sizeEl) {
        const fs = state.fontSizeLine1 || state.fontSizeLine2 || 52;
        sizeEl.textContent = `${fs}px`;
    }
    if (colorDot && colorText) {
        const c = state.colorActive || "#0018F5";
        colorDot.style.background = c;
        const knownColors = {
            "#0018F5": "Xanh KTV Chuẩn",
            "#0022FF": "Xanh KTV Chuẩn",
            "#0000FF": "Xanh KTV Chuẩn",
            "#FFE259": "Vàng Gold",
            "#00F2FE": "Xanh Cyan",
            "#FF758C": "Hồng Neon",
            "#FFFFFF": "Trắng Minimal",
            "#FFA751": "Cam Sunset",
            "#10B981": "Xanh Emerald"
        };
        colorText.textContent = knownColors[c.toUpperCase()] || c;
    }
    if (layoutEl) {
        layoutEl.textContent = (state.layoutPreset === "staggered") ? "So Le Trái - Phải" : "Căn Giữa 16:9";
    }
    const toneEl = document.getElementById("exportSummaryTone");
    if (toneEl) {
        const pitch = state.currentPitchSemitones || 0;
        if (pitch === 0) {
            toneEl.textContent = "Gốc (0)";
        } else {
            toneEl.textContent = `${pitch > 0 ? '+' : ''}${pitch} Tone`;
        }
    }
}

async function handleStartRender() {
    if (!state.currentProject) {
        alert("Chưa có bài hát nào được nạp để xuất video!");
        return;
    }

    const projectId = state.currentProject.id;
    const resolution = videoResolutionSelect ? videoResolutionSelect.value : "1920x1080";
    const fontName = state.fontName ? state.fontName.replace(/['"]/g, "").split(",")[0].trim() : "Tahoma";
    const fontSize = state.fontSizeLine1 || state.fontSizeLine2 || 54;
    const primColor = hexToAssColor(state.colorInactive || "#ffffff");
    const sungColor = hexToAssColor(state.colorActive || "#0018F5");

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
                pitch_semitones: state.currentPitchSemitones || 0,
                line1_pos_x: state.line1PosX !== undefined ? state.line1PosX : 0.50,
                line2_pos_x: state.line2PosX !== undefined ? state.line2PosX : 0.50,
                line1_pos_y: state.line1PosY !== undefined ? state.line1PosY : 0.58,
                line2_pos_y: state.line2PosY !== undefined ? state.line2PosY : 0.76,
                font_size_line1: state.fontSizeLine1 || 56,
                font_size_line2: state.fontSizeLine2 || 56,
                align_line1: state.line1Align || "center",
                align_line2: state.line2Align || "center",
                layout_preset: state.layoutPreset || "center",
                display_mode: state.stageDisplayMode || "pingpong"
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
            <div class="p-title" title="${p.title}">${p.title}</div>
            <div class="p-meta">Thời lượng: ${formatTime(p.duration)} • Ngôn ngữ: ${(p.language || 'vi').toUpperCase()}</div>
            <div class="p-actions">
                <button class="btn-primary btn-sm" onclick="loadExistingProject('${p.id}')">Mở Phòng Thu</button>
                ${p.video_url ? `<a href="${p.video_url}" class="btn-secondary btn-sm" download>Tải MP4</a>` : ''}
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

    // 1. GIẢI PHÓNG TOÀN BỘ FILE HANDLE / MEDIA STREAM TRONG TRÌNH DUYỆT NGAY LẬP TỨC
    // Tránh lỗi Windows [WinError 32] khi file âm thanh/video đang được trình duyệt mở
    const isCurrentActive = state.currentProject && (state.currentProject.id === projectId);
    const isBeatLoaded = beatAudio.src && beatAudio.src.includes(projectId);
    const isVocalLoaded = vocalAudio.src && vocalAudio.src.includes(projectId);
    const isVideoLoaded = renderedVideoPlayer && renderedVideoPlayer.src && renderedVideoPlayer.src.includes(projectId);

    if (isCurrentActive || isBeatLoaded || isVocalLoaded || isVideoLoaded) {
        beatAudio.pause();
        beatAudio.removeAttribute("src");
        beatAudio.load();

        vocalAudio.pause();
        vocalAudio.removeAttribute("src");
        vocalAudio.load();

        if (renderedVideoPlayer) {
            renderedVideoPlayer.pause();
            renderedVideoPlayer.removeAttribute("src");
            renderedVideoPlayer.load();
            renderedVideoPlayer.style.display = "none";
            if (emptyVideoPlaceholder) emptyVideoPlaceholder.style.display = "flex";
        }

        if (isCurrentActive) {
            state.currentProject = null;
            state.isPlaying = false;
            const playPauseBtn = document.getElementById("playPauseBtn");
            if (playPauseBtn) playPauseBtn.textContent = "Phát";
            const songTitle = document.getElementById("songTitle");
            if (songTitle) songTitle.textContent = "Chưa chọn bài hát";
        }

        // Chờ 150ms để trình duyệt đóng socket và Windows giải phóng file descriptor
        await new Promise(resolve => setTimeout(resolve, 150));
    }

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

// Attach Clear Cache button handler
const btnClearCache = document.getElementById("btnClearCache");
btnClearCache?.addEventListener("click", async () => {
    if (!confirm("Bạn có chắc chắn muốn xóa toàn bộ bộ nhớ đệm (cache beat & lời) để giải phóng ổ cứng không?")) {
        return;
    }
    const originalText = btnClearCache.textContent;
    btnClearCache.textContent = "Đang xóa...";
    btnClearCache.disabled = true;
    try {
        const res = await fetch("/api/clear-cache", { method: "POST" });
        const data = await res.json();
        if (res.ok && data.status === "success") {
            try { sessionStorage.clear(); } catch (e) {}
            alert(data.message || "Đã xóa sạch cache thành công!");
        } else {
            alert("Lỗi khi xóa cache: " + (data.detail || data.message || "Unknown error"));
        }
    } catch (e) {
        alert("Lỗi kết nối máy chủ: " + e.message);
    } finally {
        btnClearCache.textContent = originalText;
        btnClearCache.disabled = false;
    }
});


