/**
 * AI Karaoke Studio Pro — Upload, YouTube Processing & Pipeline Polling
 */

import { state } from './state.js';
import { showToastNotification } from './utils.js';
import { switchTab } from './navigation.js';

let selectedFile = null;
let selectedInstFile = null;
let selectedVocalFile = null;

export function extractCleanMediaUrl(raw) {
    if (!raw) return "";
    let s = raw.trim();
    const lastHttp = s.lastIndexOf("http");
    if (lastHttp > 0) {
        return s.substring(lastHttp).trim();
    }
    return s;
}

export function resetCreationForm() {
    const urlInput = document.getElementById("urlInput");
    const audioFileInput = document.getElementById("audioFileInput");
    const selectedFilePill = document.getElementById("selectedFilePill");
    const instFileInput = document.getElementById("instFileInput");
    const instFilePill = document.getElementById("instFilePill");
    const vocalFileInput = document.getElementById("vocalFileInput");
    const vocalFilePill = document.getElementById("vocalFilePill");
    const stemsSongTitle = document.getElementById("stemsSongTitle");

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

    state.pendingBgFile = null;
    const createBgFileInput = document.getElementById("createBgFileInput");
    if (createBgFileInput) createBgFileInput.value = "";
    const createBgFileName = document.getElementById("createBgFileName");
    if (createBgFileName) createBgFileName.textContent = "Chưa chọn (Dùng nền Studio)";
    const btnClearCreateBg = document.getElementById("btnClearCreateBg");
    if (btnClearCreateBg) btnClearCreateBg.style.display = "none";
}

export function setupUploadHandlers() {
    const modeFileBtn = document.getElementById("modeFileBtn");
    const modeUrlBtn = document.getElementById("modeUrlBtn");
    const modeStemsBtn = document.getElementById("modeStemsBtn");
    const dropZone = document.getElementById("dropZone");
    const urlZone = document.getElementById("urlZone");
    const stemsZone = document.getElementById("stemsZone");
    const audioFileInput = document.getElementById("audioFileInput");
    const selectedFilePill = document.getElementById("selectedFilePill");
    const clearFileBtn = document.getElementById("clearFileBtn");
    const urlInput = document.getElementById("urlInput");
    const clearUrlBtn = document.getElementById("clearUrlBtn");

    const instDropZone = document.getElementById("instDropZone");
    const instFileInput = document.getElementById("instFileInput");
    const instFilePill = document.getElementById("instFilePill");
    const clearInstFileBtn = document.getElementById("clearInstFileBtn");

    const vocalDropZone = document.getElementById("vocalDropZone");
    const vocalFileInput = document.getElementById("vocalFileInput");
    const vocalFilePill = document.getElementById("vocalFilePill");
    const clearVocalFileBtn = document.getElementById("clearVocalFileBtn");
    const stemsSongTitle = document.getElementById("stemsSongTitle");

    const startProcessBtn = document.getElementById("startProcessBtn");

    // Initial Background Upload (Tab 1)
    const btnChooseCreateBg = document.getElementById("btnChooseCreateBg");
    const createBgFileInput = document.getElementById("createBgFileInput");
    const createBgFileName = document.getElementById("createBgFileName");
    const btnClearCreateBg = document.getElementById("btnClearCreateBg");

    btnChooseCreateBg?.addEventListener("click", () => createBgFileInput?.click());
    createBgFileInput?.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            state.pendingBgFile = file;
            if (createBgFileName) createBgFileName.textContent = `${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`;
            if (btnClearCreateBg) btnClearCreateBg.style.display = "inline-flex";
        }
    });
    btnClearCreateBg?.addEventListener("click", () => {
        state.pendingBgFile = null;
        if (createBgFileInput) createBgFileInput.value = "";
        if (createBgFileName) createBgFileName.textContent = "Chưa chọn (Dùng nền Studio)";
        btnClearCreateBg.style.display = "none";
    });

    modeFileBtn?.addEventListener("click", () => {
        modeFileBtn.classList.add("active");
        modeUrlBtn?.classList.remove("active");
        modeStemsBtn?.classList.remove("active");
        if (dropZone) dropZone.style.display = "block";
        if (urlZone) urlZone.style.display = "none";
        if (stemsZone) stemsZone.style.display = "none";
    });

    modeUrlBtn?.addEventListener("click", () => {
        modeUrlBtn.classList.add("active");
        modeFileBtn?.classList.remove("active");
        modeStemsBtn?.classList.remove("active");
        if (urlZone) urlZone.style.display = "block";
        if (dropZone) dropZone.style.display = "none";
        if (stemsZone) stemsZone.style.display = "none";
    });

    modeStemsBtn?.addEventListener("click", () => {
        modeStemsBtn.classList.add("active");
        modeFileBtn?.classList.remove("active");
        modeUrlBtn?.classList.remove("active");
        if (stemsZone) stemsZone.style.display = "block";
        if (dropZone) dropZone.style.display = "none";
        if (urlZone) urlZone.style.display = "none";
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

    if (dropZone && audioFileInput) {
        dropZone.addEventListener("click", () => audioFileInput.click());
        dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("dragover"); });
        dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
        dropZone.addEventListener("drop", (e) => {
            e.preventDefault();
            dropZone.classList.remove("dragover");
            if (e.dataTransfer.files.length > 0) handleFileSelected(e.dataTransfer.files[0]);
        });
        audioFileInput.addEventListener("change", (e) => {
            if (e.target.files.length > 0) handleFileSelected(e.target.files[0]);
        });
    }

    clearFileBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        selectedFile = null;
        if (audioFileInput) audioFileInput.value = "";
        if (selectedFilePill) selectedFilePill.style.display = "none";
        const badge = document.getElementById("lyricsStatusBadge");
        if (badge) badge.style.display = "none";
    });

    clearUrlBtn?.addEventListener("click", () => {
        if (urlInput) urlInput.value = "";
        const badge = document.getElementById("lyricsStatusBadge");
        if (badge) badge.style.display = "none";
    });

    urlInput?.addEventListener("focus", function() { this.select(); });
    urlInput?.addEventListener("click", function() { if (this.value) this.select(); });
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
        if (selectedFile) defaultVal = selectedFile.name;
        else if (urlInput && urlInput.value) defaultVal = urlInput.value;
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
        hwCpuBtn?.classList.remove("active");
        if (hardwareModeInput) hardwareModeInput.value = "gpu";
    });

    hwCpuBtn?.addEventListener("click", () => {
        hwCpuBtn.classList.add("active");
        hwGpuBtn?.classList.remove("active");
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
        const advAccordion = document.getElementById("advancedConfigAccordion");
        if (advAccordion) advAccordion.open = true;

        engineGeminiBtn?.click();

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

    const whisperModelSelect = document.getElementById("whisperModelSelect");
    whisperModelSelect?.addEventListener("change", () => {
        const isCpu = hardwareModeInput?.value === "cpu";
        if (isCpu && whisperModelSelect.value === "large-v3") {
            showToastNotification("Khuyên dùng bản 'Small' trên CPU để xử lý nhanh nhất (~30 giây)");
        }
    });

    startProcessBtn?.addEventListener("click", handleStartProcessing);
    document.getElementById("startProcessBtnSimple")?.addEventListener("click", handleStartProcessing);
}

export async function triggerOnlineLyricsSearch(query, isManual = false) {
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

export function handleFileSelected(file) {
    selectedFile = file;
    const selectedFileName = document.getElementById("selectedFileName");
    const selectedFilePill = document.getElementById("selectedFilePill");
    if (selectedFileName) selectedFileName.textContent = `${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`;
    if (selectedFilePill) selectedFilePill.style.display = "inline-flex";

    try {
        const audio = new Audio();
        audio.src = URL.createObjectURL(file);
        audio.onloadedmetadata = () => {
            window._selectedFileDuration = audio.duration;
            URL.revokeObjectURL(audio.src);
        };
    } catch(e) {}

    triggerOnlineLyricsSearch(file.name);
}

export function handleInstFileSelected(file) {
    selectedInstFile = file;
    const instFileName = document.getElementById("instFileName");
    const instFilePill = document.getElementById("instFilePill");
    const stemsSongTitle = document.getElementById("stemsSongTitle");

    if (instFileName) instFileName.textContent = `${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`;
    if (instFilePill) instFilePill.style.display = "inline-flex";

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

export function handleVocalFileSelected(file) {
    selectedVocalFile = file;
    const vocalFileName = document.getElementById("vocalFileName");
    const vocalFilePill = document.getElementById("vocalFilePill");
    if (vocalFileName) vocalFileName.textContent = `${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`;
    if (vocalFilePill) vocalFilePill.style.display = "inline-flex";
}

export async function handleStartProcessing() {
    const modeStemsBtn = document.getElementById("modeStemsBtn");
    const modeFileBtn = document.getElementById("modeFileBtn");
    const langSelect = document.getElementById("langSelect");
    const whisperModelSelect = document.getElementById("whisperModelSelect");
    const demucsModelSelect = document.getElementById("demucsModelSelect");
    const stemsSongTitle = document.getElementById("stemsSongTitle");
    const urlInput = document.getElementById("urlInput");

    const isStemsMode = modeStemsBtn?.classList.contains("active");
    const isFileMode = modeFileBtn?.classList.contains("active");
    const lang = langSelect?.value || "vi";
    const whisperModel = whisperModelSelect?.value || "large-v3";
    const demucsModel = demucsModelSelect?.value || "htdemucs";
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
        const url = extractCleanMediaUrl(urlInput?.value || "");
        if (!url) {
            alert("Vui lòng nhập đường dẫn URL bài hát!");
            return;
        }
        formData.append("url", url);
        endpoint = "/api/from-url";
    }

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

export function showProgressModal() {
    const processModal = document.getElementById("processModal");
    const modalProgressFill = document.getElementById("modalProgressFill");
    const modalProgressPct = document.getElementById("modalProgressPct");
    const modalTitle = document.getElementById("modalTitle");
    const modalSub = document.getElementById("modalSub");
    const stepUpload = document.getElementById("stepUpload");
    const stepDemucs = document.getElementById("stepDemucs");
    const stepWhisper = document.getElementById("stepWhisper");
    const stepSub = document.getElementById("stepSub");
    const modeStemsBtn = document.getElementById("modeStemsBtn");

    if (processModal) processModal.style.display = "flex";
    if (modalProgressFill) modalProgressFill.style.width = "5%";
    if (modalProgressPct) modalProgressPct.textContent = "5%";

    if (modeStemsBtn?.classList.contains("active")) {
        if (modalTitle) modalTitle.textContent = "Đang Nạp Beat & Bắt Nhịp Lời...";
        if (modalSub) modalSub.textContent = "Bỏ qua tách Beat (0s) - Bắt nhịp phụ đề tức thì!";
        if (stepUpload) stepUpload.className = "step-item completed";
        if (stepDemucs) stepDemucs.className = "step-item completed";
        if (stepWhisper) stepWhisper.className = "step-item active";
        if (stepSub) stepSub.className = "step-item";
    } else {
        if (modalTitle) modalTitle.textContent = "AI Đang Xử Lý Bài Hát...";
        if (modalSub) modalSub.textContent = state.cudaAvailable 
            ? "Đang tách Beat và nhận diện lời trên GPU CUDA..." 
            : "Đang tách Beat và nhận diện lời trên CPU Đa Luồng...";
        
        if (stepUpload) stepUpload.className = "step-item active";
        if (stepDemucs) stepDemucs.className = "step-item";
        if (stepWhisper) stepWhisper.className = "step-item";
        if (stepSub) stepSub.className = "step-item";
    }
}

export function hideProgressModal() {
    const processModal = document.getElementById("processModal");
    if (processModal) processModal.style.display = "none";
}

export function startPollingStatus(projectId) {
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
                setTimeout(async () => {
                    hideProgressModal();
                    if (state.pendingBgFile) {
                        const bgFile = state.pendingBgFile;
                        state.pendingBgFile = null;
                        const bgFormData = new FormData();
                        bgFormData.append("file", bgFile);
                        try {
                            const bgRes = await fetch(`/api/upload-background/${projectId}`, {
                                method: "POST",
                                body: bgFormData
                            });
                            if (bgRes.ok) {
                                const bgData = await bgRes.json();
                                job.data.custom_background_url = bgData.url;
                            }
                        } catch(e) {
                            console.error("Upload pending background failed:", e);
                        }
                    }
                    if (typeof window.loadProjectData === "function") {
                        window.loadProjectData(job.data);
                    }
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

export function updateModalProgress(job) {
    const modalProgressFill = document.getElementById("modalProgressFill");
    const modalProgressPct = document.getElementById("modalProgressPct");
    const modalSub = document.getElementById("modalSub");
    const stepUpload = document.getElementById("stepUpload");
    const stepDemucs = document.getElementById("stepDemucs");
    const stepWhisper = document.getElementById("stepWhisper");
    const stepSub = document.getElementById("stepSub");

    const pct = job.progress || 10;
    if (modalProgressFill) modalProgressFill.style.width = `${pct}%`;
    if (modalProgressPct) modalProgressPct.textContent = `${pct}%`;
    if (modalSub) modalSub.textContent = job.message || "Đang xử lý...";

    if (!stepUpload) return;
    if (pct < 20) {
        stepUpload.className = "step-item active";
    } else if (pct < 55) {
        stepUpload.className = "step-item done";
        if (stepDemucs) stepDemucs.className = "step-item active";
    } else if (pct < 80) {
        if (stepDemucs) stepDemucs.className = "step-item done";
        if (stepWhisper) stepWhisper.className = "step-item active";
    } else {
        if (stepWhisper) stepWhisper.className = "step-item done";
        if (stepSub) stepSub.className = "step-item active";
    }
}
