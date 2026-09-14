/**
 * AI Karaoke Studio Pro — Video Export & Rendering Module
 * Handles GPU NVENC rendering, export modal, export summary, and background uploads.
 */

import { state, dom } from "./state.js";
import { hexToAssColor, showToastNotification } from "./utils.js";
import { applyStageFont, applyStageActiveColor } from "./stage.js";

export function updateExportSummary() {
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
        const c = state.colorActive || "#0038FF";
        colorDot.style.background = c;
        const knownColors = {
            "#0038FF": "Xanh KTV Chuẩn",
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

export function openStudioExportResultModal() {
    if (!state.currentProject) return;
    const modal = document.getElementById("studioExportModal");
    const progressBox = document.getElementById("studioExportProgressBox");
    const resultBox = document.getElementById("studioExportResultBox");

    if (modal) modal.style.display = "flex";
    if (progressBox) progressBox.style.display = "none";
    if (resultBox) resultBox.style.display = "block";

    if (state.currentProject.video_url && dom.renderedVideoPlayer) {
        if (!dom.renderedVideoPlayer.src || !dom.renderedVideoPlayer.src.includes(state.currentProject.video_url)) {
            dom.renderedVideoPlayer.src = state.currentProject.video_url;
        }
    }
    if (dom.dlVideoBtn && state.currentProject.video_url) {
        dom.dlVideoBtn.href = state.currentProject.video_url;
    }
    const btnOpenLocalFolder = document.getElementById("btnOpenLocalFolder");
    if (btnOpenLocalFolder && state.currentProject.id) {
        btnOpenLocalFolder.onclick = async () => {
            try {
                await fetch(`/api/open-folder/${state.currentProject.id}`, { method: "POST" });
            } catch (err) {
                console.error("Open folder failed:", err);
            }
        };
    }
}

export function closeStudioExportModal() {
    const modal = document.getElementById("studioExportModal");
    if (modal) modal.style.display = "none";
    if (dom.renderedVideoPlayer) {
        try { dom.renderedVideoPlayer.pause(); } catch (e) {}
    }
}

export async function executeStudioVideoExport() {
    if (!state.currentProject) {
        showToastNotification("Chưa có bài hát nào được nạp để xuất video!");
        return;
    }

    const modal = document.getElementById("studioExportModal");
    const progressBox = document.getElementById("studioExportProgressBox");
    const resultBox = document.getElementById("studioExportResultBox");
    const progressStatus = document.getElementById("exportProgressStatus");
    const progressPercent = document.getElementById("exportProgressPercent");
    const progressFill = document.getElementById("exportProgressFill");
    const btnExportMaster = document.getElementById("btnExportMaster");

    // 1. Tự động lưu cấu hình sân khấu hiện tại
    if (typeof window.saveProjectStageSettings === "function") {
        try {
            await window.saveProjectStageSettings();
        } catch (e) {
            console.warn("Auto-save before export warning:", e);
        }
    }

    // 2. Mở Modal hiển thị trạng thái Render
    if (modal) modal.style.display = "flex";
    if (progressBox) progressBox.style.display = "block";
    if (resultBox) resultBox.style.display = "none";
    if (progressStatus) progressStatus.textContent = "Đang Render Video MP4 (GPU NVENC)...";
    if (progressPercent) progressPercent.textContent = "Khởi chạy GPU và kết xuất đồ hoạ...";
    if (progressFill) progressFill.style.width = "20%";

    if (btnExportMaster) {
        btnExportMaster.disabled = true;
        btnExportMaster.textContent = "Đang Xuất MP4...";
    }

    let progressPct = 20;
    const progressTimer = setInterval(() => {
        if (progressPct < 85) {
            progressPct += 3;
            if (progressFill) progressFill.style.width = `${progressPct}%`;
            if (progressPct > 45 && progressPercent) {
                progressPercent.textContent = "Đang nén khung hình H.264 1080p bằng GPU NVENC...";
            }
        }
    }, 450);

    const projectId = state.currentProject.id;
    const resolution = dom.videoResolutionSelect ? dom.videoResolutionSelect.value : "1920x1080";
    const fontName = state.fontName ? state.fontName.replace(/['"]/g, "").split(",")[0].trim() : "Tahoma";
    const fontSize = state.fontSizeLine1 || state.fontSizeLine2 || 52;
    const primColor = hexToAssColor(state.colorInactive || "#ffffff");
    const sungColor = hexToAssColor(state.colorActive || "#0038FF");

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
                font_size_line1: state.fontSizeLine1 || 52,
                font_size_line2: state.fontSizeLine2 || 52,
                align_line1: state.line1Align || "center",
                align_line2: state.line2Align || "center",
                layout_preset: state.layoutPreset || "center",
                display_mode: state.stageDisplayMode || "pingpong"
            })
        });

        clearInterval(progressTimer);
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Lỗi xuất video");

        // Cập nhật trạng thái video vào Project
        state.currentProject.video_url = data.video_url;

        // Chuyển Modal sang trạng thái Hoàn Tất & Xem Thử
        if (progressFill) progressFill.style.width = "100%";
        if (progressBox) progressBox.style.display = "none";
        if (resultBox) resultBox.style.display = "block";

        if (dom.renderedVideoPlayer) {
            dom.renderedVideoPlayer.src = data.video_url;
            dom.renderedVideoPlayer.style.display = "block";
            try { dom.renderedVideoPlayer.play(); } catch (e) {}
        }
        if (dom.emptyVideoPlaceholder) dom.emptyVideoPlaceholder.style.display = "none";
        if (dom.dlVideoBtn) {
            dom.dlVideoBtn.href = data.download_url || data.video_url;
            dom.dlVideoBtn.style.display = "flex";
        }

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

        // Kích hoạt nút Xem lại video ở Card 5
        const btnView = document.getElementById("btnViewExportedVideo");
        if (btnView) btnView.style.display = "block";

        showToastNotification("Xuất Video Karaoke MP4 Full HD thành công!");
    } catch (err) {
        clearInterval(progressTimer);
        console.error("Studio render error:", err);
        alert(`Lỗi xuất video: ${err.message}`);
        if (modal) modal.style.display = "none";
    } finally {
        if (btnExportMaster) {
            btnExportMaster.disabled = false;
            btnExportMaster.textContent = "XUẤT VIDEO MP4 FULL HD";
        }
    }
}

export function setupExport() {
    const stageFontSelect = document.getElementById("stageFontSelect");
    const exportFontSelect = document.getElementById("exportFontSelect");
    const stageFontSizeSlider = document.getElementById("stageFontSizeSlider");
    const stageFontSizeText = document.getElementById("stageFontSizeText");
    const bgChips = document.querySelectorAll(".bg-chip");
    const btnUploadStageBg = document.getElementById("btnUploadStageBg");
    const stageBgFileInput = document.getElementById("stageBgFileInput");
    const stageScreen = document.getElementById("stageScreen") || document.getElementById("karaokeScreen");

    function updateStageFont(fontFamily, fontNameClean) {
        applyStageFont(fontFamily);
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
        const k1 = document.getElementById("kLine1");
        const k2 = document.getElementById("kLine2");
        if (k1) k1.style.fontSize = `${sz}px`;
        if (k2) k2.style.fontSize = `${sz}px`;
    });

    // Preset background chips
    bgChips.forEach(chip => {
        chip.addEventListener("click", () => {
            bgChips.forEach(c => c.classList.remove("active"));
            chip.classList.add("active");
            const bgType = chip.dataset.bg;
            
            if (stageScreen) {
                const existingMedia = stageScreen.querySelector(".stage-screen-bg-media");
                if (existingMedia) existingMedia.remove();

                state.customBgPath = null;
                state.bgTheme = bgType;
                stageScreen.classList.remove("bg-nebula", "bg-cyber", "bg-gold", "bg-black", "bg-sunset", "bg-sakura");
                stageScreen.classList.add(`bg-${bgType}`);

                const bgFileName = document.getElementById("stageBgFileName");
                if (bgFileName) bgFileName.textContent = "Nền Studio: " + bgType.toUpperCase();
                const btnClearBg = document.getElementById("btnClearStageBg");
                if (btnClearBg) btnClearBg.style.display = "none";
                if (typeof window.saveProjectStageSettings === "function") {
                    window.saveProjectStageSettings();
                }
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

            bgChips.forEach(c => c.classList.remove("active"));
            const bgFileName = document.getElementById("stageBgFileName");
            if (bgFileName) bgFileName.textContent = `Đã chọn: ${file.name}`;
            const btnClearBg = document.getElementById("btnClearStageBg");
            if (btnClearBg) btnClearBg.style.display = "inline-flex";

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
                        if (typeof window.saveProjectStageSettings === "function") {
                            await window.saveProjectStageSettings();
                        }
                        showToastNotification("Đã lưu hình nền tùy chọn cho bài hát!");
                    }
                } catch (err) {
                    console.error("Upload BG failed:", err);
                    showToastNotification("Lỗi tải hình nền lên máy chủ.");
                }
            }
        }
    });

    // Clear custom background button
    const btnClearStageBg = document.getElementById("btnClearStageBg");
    btnClearStageBg?.addEventListener("click", async () => {
        const existingMedia = stageScreen?.querySelector(".stage-screen-bg-media");
        if (existingMedia) existingMedia.remove();

        state.customBgPath = null;
        state.bgTheme = "nebula";
        if (stageBgFileInput) stageBgFileInput.value = "";
        if (stageScreen) {
            stageScreen.classList.remove("bg-nebula", "bg-cyber", "bg-gold", "bg-black", "bg-sunset", "bg-sakura");
            stageScreen.classList.add("bg-nebula");
        }
        bgChips.forEach(c => c.classList.toggle("active", c.dataset.bg === "nebula"));
        const bgFileName = document.getElementById("stageBgFileName");
        if (bgFileName) bgFileName.textContent = "Hỗ trợ ảnh JPG/PNG hoặc Video MP4";
        if (btnClearStageBg) btnClearStageBg.style.display = "none";
        if (typeof window.saveProjectStageSettings === "function") {
            await window.saveProjectStageSettings();
        }
        showToastNotification("Đã xoá nền riêng, trở về nền Studio mặc định.");
    });

    // Floating Color Dock listeners
    document.querySelectorAll(".stage-color-dot").forEach(dot => {
        dot.addEventListener("click", () => {
            applyStageActiveColor(dot.dataset.color);
        });
    });
    document.getElementById("stageColorPickerInput")?.addEventListener("input", (e) => {
        applyStageActiveColor(e.target.value);
    });

    // Drawer Color Chips listeners
    document.querySelectorAll(".drawer-color-chip").forEach(chip => {
        chip.addEventListener("click", () => {
            applyStageActiveColor(chip.dataset.color);
        });
    });
    document.getElementById("drawerColorPickerInput")?.addEventListener("input", (e) => {
        applyStageActiveColor(e.target.value);
    });

    // Master Export Trigger Buttons
    const btnExportMaster = document.getElementById("btnExportMaster");
    btnExportMaster?.addEventListener("click", async () => {
        await executeStudioVideoExport();
    });

    const btnViewExportedVideo = document.getElementById("btnViewExportedVideo");
    btnViewExportedVideo?.addEventListener("click", () => {
        openStudioExportResultModal();
    });

    const btnCloseStudioExportModal = document.getElementById("btnCloseStudioExportModal");
    btnCloseStudioExportModal?.addEventListener("click", () => {
        closeStudioExportModal();
    });

    const studioExportModal = document.getElementById("studioExportModal");
    studioExportModal?.addEventListener("click", (e) => {
        if (e.target === studioExportModal) {
            closeStudioExportModal();
        }
    });

    dom.btnStartRender?.addEventListener("click", executeStudioVideoExport);

    const chkShadow = document.getElementById("chkShadow");
    chkShadow?.addEventListener("change", (e) => {
        if (stageScreen) {
            stageScreen.classList.toggle("no-shadow", !e.target.checked);
        }
    });
}
