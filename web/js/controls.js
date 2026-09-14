/**
 * AI Karaoke Studio Pro — Stage Controls & Inspector Deck Module
 * Handles inspector panes, position sliders, styles, presets, and project data loading
 */

import { state, beatAudio, vocalAudio, dom } from "./state.js";
import { hexToAssColor, showToastNotification, formatTime } from "./utils.js";
import { 
    updateKaraokeStage, 
    applyStageFont, 
    applyStageActiveColor, 
    synchronizeLinesAutoFit, 
    calculateCoupletMaxSafeSize, 
    calculateGlobalMaxSafeFontSize, 
    startStageInlineEdit 
} from "./stage.js";
import { 
    renderEditorTable, 
    renderLyricJumpList, 
    ensureConciseSegments, 
    autoSplitProjectSegments 
} from "./editor.js";
import { updateExportSummary, openStudioExportResultModal, closeStudioExportModal } from "./export.js";
import { syncGuidedStepper } from "./navigation.js";

export function openInspectorPane(paneId) {
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

export function closeInspector() {
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

export function applyWipingFxMode() {
    const stage = document.getElementById("karaokeStage") || document.getElementById("stageScreen");
    if (!stage) return;
    stage.classList.remove("fx-mode-comet", "fx-mode-smooth", "fx-mode-bounce");
    const mode = state.wipingFxMode || "smooth";
    stage.classList.add(`fx-mode-${mode}`);

    document.querySelectorAll(".fx-style-btn").forEach(b => {
        b.classList.toggle("active", b.dataset.fx === mode);
    });
}

export function initTimingSyncPopover() {
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

export function initMasterQuickActions() {
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
                closeInspector();
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
            if (btnToggleMic && !btnToggleMic.classList.contains("active")) {
                btnToggleMic.click();
            }
            micDeck.scrollIntoView({ behavior: "smooth", block: "nearest" });
        } else {
            if (btnToggleMic && btnToggleMic.classList.contains("active")) {
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
        btnToggleCinema?.click();
    });
}

export function initStudioInspector() {
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
        calculateGlobalMaxSafeFontSize(true);
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
            if (color) {
                applyStageActiveColor(color);
            }
        });
    });

    const drawerColorPicker = document.getElementById("drawerColorPickerInput");
    drawerColorPicker?.addEventListener("input", (e) => {
        if (e.target.value) {
            applyStageActiveColor(e.target.value);
        }
    });

    // Preset color buttons in paneColors
    document.getElementById("btnColorPresetTrongHieu")?.addEventListener("click", () => {
        applyStageActiveColor("#0038FF");
        showToastNotification("Đã chọn màu: Xanh Chuẩn KTV Gia Huy Beat (#0038FF)!");
    });
    document.getElementById("btnColorPresetGold")?.addEventListener("click", () => {
        applyStageActiveColor("#FFE259");
        showToastNotification("Đã chọn màu: Vàng Gold Bolero (#FFE259)!");
    });
    document.getElementById("btnColorPresetCyan")?.addEventListener("click", () => {
        applyStageActiveColor("#00F2FE");
        showToastNotification("Đã chọn màu: Cyber Cyan (#00F2FE)!");
    });
    document.getElementById("btnColorPresetPink")?.addEventListener("click", () => {
        applyStageActiveColor("#FF758C");
        showToastNotification("Đã chọn màu: Hồng Neon Pop (#FF758C)!");
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

export function applyLinePositionX(lineNum, posXFraction) {
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

export function applyLinePositionY(lineNum, posYFraction) {
    const stageScreen = document.getElementById("stageScreen");
    const lineEl = document.getElementById(lineNum === 1 ? "kLine1" : "kLine2");
    if (!stageScreen || !lineEl) return;

    const clamped = Math.max(0.15, Math.min(0.95, parseFloat(posYFraction)));
    if (lineNum === 1) state.line1PosY = clamped;
    else state.line2PosY = clamped;

    const pctY = Math.round(clamped * 100);
    lineEl.style.top = `${pctY}%`;

    const textEl = document.getElementById(lineNum === 1 ? "stagePosY1Text" : "stagePosY2Text");
    const sliderEl = document.getElementById(lineNum === 1 ? "stagePosY1Slider" : "stagePosY2Slider");
    if (textEl) textEl.textContent = `${pctY}%`;
    if (sliderEl) sliderEl.value = pctY;

    // Show preview placeholder if line is currently empty so user immediately sees slider movement
    const contentEl = lineEl.querySelector(".line-content") || lineEl;
    if (contentEl && (!contentEl.textContent || !contentEl.textContent.trim())) {
        contentEl.innerHTML = `<span class="line-placeholder">${lineNum === 1 ? "AI Karaoke Studio Pro" : "Nhấn Phát để bắt đầu hát"}</span>`;
    }

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

export function applyLinePosition(lineNum, posFraction) {
    applyLinePositionY(lineNum, posFraction);
}

export function applyLineFontSize(lineNum, sizePx) {
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

export function applyMasterFontSize(sizePx) {
    const val = Math.max(18, Math.min(120, parseInt(sizePx) || 52));
    applyLineFontSize(1, val);
    applyLineFontSize(2, val);
}

export function applyLayoutPreset(presetName, notify = true) {
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

export function applyStyleTheme(themeKey, notify = true) {
    document.querySelectorAll(".btn-dock-theme").forEach(b => b.classList.remove("active"));

    if (themeKey === "tronghieu") {
        document.getElementById("btnThemeTrongHieu")?.classList.add("active");
        applyStageFont("Tahoma, sans-serif");
        applyLayoutPreset("staggered", false);
        applyStageActiveColor("#0038FF");
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

export function applyPresetTrongHieu(notify = true) {
    applyStyleTheme("tronghieu", notify);
}

export async function saveProjectStageSettings() {
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
        karaoke_color: hexToAssColor(state.colorActive || "#0038FF"),
        color_active_hex: state.colorActive || "#0038FF",
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

export function setupDraggableSubtitle() {
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

    // Auto split button in Studio Card 2
    document.getElementById("btnAutoSplitInStudio")?.addEventListener("click", () => {
        autoSplitProjectSegments(5, 24);
    });

    // Position sliders for Line 1 and Line 2
    const stagePosY1Slider = document.getElementById("stagePosY1Slider");
    stagePosY1Slider?.addEventListener("input", (e) => {
        const val = parseInt(e.target.value);
        applyLinePositionY(1, val / 100);
    });

    const stagePosY2Slider = document.getElementById("stagePosY2Slider");
    stagePosY2Slider?.addEventListener("input", (e) => {
        const val = parseInt(e.target.value);
        applyLinePositionY(2, val / 100);
    });

    document.getElementById("btnY1Minus")?.addEventListener("click", () => {
        const cur = parseInt(stagePosY1Slider?.value || (state.line1PosY ? Math.round(state.line1PosY * 100) : 58));
        const next = Math.max(25, cur - 1);
        applyLinePositionY(1, next / 100);
    });

    document.getElementById("btnY1Plus")?.addEventListener("click", () => {
        const cur = parseInt(stagePosY1Slider?.value || (state.line1PosY ? Math.round(state.line1PosY * 100) : 58));
        const next = Math.min(80, cur + 1);
        applyLinePositionY(1, next / 100);
    });

    document.getElementById("btnY2Minus")?.addEventListener("click", () => {
        const cur = parseInt(stagePosY2Slider?.value || (state.line2PosY ? Math.round(state.line2PosY * 100) : 76));
        const next = Math.max(45, cur - 1);
        applyLinePositionY(2, next / 100);
    });

    document.getElementById("btnY2Plus")?.addEventListener("click", () => {
        const cur = parseInt(stagePosY2Slider?.value || (state.line2PosY ? Math.round(state.line2PosY * 100) : 76));
        const next = Math.min(95, cur + 1);
        applyLinePositionY(2, next / 100);
    });

    document.getElementById("btnResetLinePos")?.addEventListener("click", () => {
        applyLinePositionY(1, 0.58);
        applyLinePositionY(2, 0.76);
        showToastNotification("Đã đặt lại vị trí 2 dòng về chuẩn KTV (58% & 76%)");
    });

    document.getElementById("stagePosY1Text")?.addEventListener("click", () => {
        const cur = parseInt(stagePosY1Slider?.value || 58);
        const input = prompt("Nhập vị trí Dòng Trên (Y %) [25 - 80]:", cur);
        if (input !== null) {
            const parsed = parseInt(input);
            if (!isNaN(parsed)) {
                applyLinePositionY(1, Math.max(25, Math.min(80, parsed)) / 100);
            }
        }
    });

    document.getElementById("stagePosY2Text")?.addEventListener("click", () => {
        const cur = parseInt(stagePosY2Slider?.value || 76);
        const input = prompt("Nhập vị trí Dòng Dưới (Y %) [45 - 95]:", cur);
        if (input !== null) {
            const parsed = parseInt(input);
            if (!isNaN(parsed)) {
                applyLinePositionY(2, Math.max(45, Math.min(95, parsed)) / 100);
            }
        }
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

    const openMasterFontSizePrompt = () => {
        promptFontSize(state.fontSizeLine1 || 52, (sz) => applyMasterFontSize(sz));
    };
    document.getElementById("masterFontSizeText")?.addEventListener("click", openMasterFontSizePrompt);
    document.getElementById("masterFontSizeVal")?.addEventListener("click", openMasterFontSizePrompt);
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

export function loadProjectData(projectData) {
    state.currentProject = projectData;
    state.activeLineIndex = -1;

    // Load Audio Stems
    if (projectData.stems) {
        beatAudio.src = projectData.stems.instrumental_mp3;
        vocalAudio.src = projectData.stems.vocals_mp3;
    }

    // Set Download Links
    if (dom.dlInstrumentalBtn) dom.dlInstrumentalBtn.href = projectData.stems?.instrumental_mp3 || "#";
    if (dom.dlVocalBtn) dom.dlVocalBtn.href = projectData.stems?.vocals_mp3 || "#";
    if (dom.dlAssSubBtn) dom.dlAssSubBtn.href = projectData.subtitles?.ass || "#";
    if (dom.dlLrcSubBtn) dom.dlLrcSubBtn.href = projectData.subtitles?.lrc || "#";
    if (dom.dlSrtSubBtn) dom.dlSrtSubBtn.href = projectData.subtitles?.srt || "#";

    const btnViewExportedVideo = document.getElementById("btnViewExportedVideo");
    if (projectData.video_url) {
        if (dom.renderedVideoPlayer) {
            dom.renderedVideoPlayer.src = projectData.video_url;
            dom.renderedVideoPlayer.style.display = "block";
        }
        if (dom.emptyVideoPlaceholder) dom.emptyVideoPlaceholder.style.display = "none";
        if (dom.dlVideoBtn) {
            dom.dlVideoBtn.href = projectData.video_url;
            dom.dlVideoBtn.style.display = "flex";
        }
        if (btnViewExportedVideo) btnViewExportedVideo.style.display = "block";
    } else {
        if (dom.renderedVideoPlayer) {
            dom.renderedVideoPlayer.style.display = "none";
        }
        if (dom.emptyVideoPlaceholder) dom.emptyVideoPlaceholder.style.display = "flex";
        if (dom.dlVideoBtn) dom.dlVideoBtn.style.display = "none";
        if (btnViewExportedVideo) btnViewExportedVideo.style.display = "none";
    }

    const btnOpenLocalFolder = document.getElementById("btnOpenLocalFolder");
    if (btnOpenLocalFolder && projectData.id) {
        btnOpenLocalFolder.onclick = async () => {
            try {
                await fetch(`/api/open-folder/${projectData.id}`, { method: "POST" });
            } catch (err) {
                console.error("Open folder failed:", err);
            }
        };
    }

    // Ensure segments conform to natural singable line lengths (concise, <= 7 words per line)
    projectData.segments = ensureConciseSegments(projectData.segments || [], 7);
    state.currentProject.segments = projectData.segments;
    state._memoizedTimeline = null;
    state._memoizedTimelineSegsRef = null;
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

    const savedY1 = (saved.line1_pos_y !== undefined) ? parseFloat(saved.line1_pos_y) : 0.58;
    const savedY2 = (saved.line2_pos_y !== undefined) ? parseFloat(saved.line2_pos_y) : 0.76;
    applyLinePositionY(1, savedY1);
    applyLinePositionY(2, savedY2);

    const savedSize = saved.font_size_line1 || saved.font_size_line2 || projectData.font_size_line1 || projectData.font_size_line2 || 52;
    applyMasterFontSize(savedSize);

    // Restore Background (Custom Image/Video or Preset Theme)
    const stageScreen = document.getElementById("stageScreen") || document.getElementById("karaokeScreen");
    if (stageScreen) {
        const oldMedia = stageScreen.querySelector(".stage-screen-bg-media");
        if (oldMedia) oldMedia.remove();

        const customBg = projectData.custom_background_url || saved.custom_background_url || null;
        if (customBg) {
            state.customBgPath = customBg;
            const isVideo = customBg.match(/\.(mp4|webm|mov|mkv)$/i);
            let mediaEl;
            if (isVideo) {
                mediaEl = document.createElement("video");
                mediaEl.src = customBg;
                mediaEl.autoplay = true;
                mediaEl.loop = true;
                mediaEl.muted = true;
                mediaEl.playsInline = true;
            } else {
                mediaEl = document.createElement("img");
                mediaEl.src = customBg;
            }
            mediaEl.className = "stage-screen-bg-media";
            stageScreen.prepend(mediaEl);

            const bgFileName = document.getElementById("stageBgFileName");
            if (bgFileName) bgFileName.textContent = "Nền tùy chỉnh: " + customBg.split("/").pop();
            const btnClearBg = document.getElementById("btnClearStageBg");
            if (btnClearBg) btnClearBg.style.display = "inline-flex";
            document.querySelectorAll(".bg-chip").forEach(c => c.classList.remove("active"));
        } else {
            state.customBgPath = null;
            const bgTheme = saved.bg_theme || "nebula";
            state.bgTheme = bgTheme;
            stageScreen.classList.remove("bg-nebula", "bg-cyber", "bg-gold", "bg-black", "bg-sunset", "bg-sakura");
            stageScreen.classList.add(`bg-${bgTheme}`);
            document.querySelectorAll(".bg-chip").forEach(c => {
                c.classList.toggle("active", c.getAttribute("data-bg") === bgTheme);
            });
            const bgFileName = document.getElementById("stageBgFileName");
            if (bgFileName) bgFileName.textContent = "Hỗ trợ ảnh JPG/PNG hoặc Video MP4";
            const btnClearBg = document.getElementById("btnClearStageBg");
            if (btnClearBg) btnClearBg.style.display = "none";
        }
    }

    const fontToApply = saved.font_name || projectData.font_name || "Tahoma, sans-serif";
    applyStageFont(fontToApply);

    const savedColor = saved.color_active_hex || "#0038FF";
    applyStageActiveColor(savedColor);

    state.wipingFxMode = saved.wiping_fx || "smooth";
    applyWipingFxMode();

    state.showCountdownDots = (saved.show_countdown !== undefined) ? !!saved.show_countdown : true;
    const chkCountdown = document.getElementById("chkCountdownDots");
    if (chkCountdown) chkCountdown.checked = state.showCountdownDots;

    state.stageDisplayMode = saved.display_mode || saved.stage_display_mode || "pingpong";
    document.querySelectorAll(".display-mode-btn").forEach(b => {
        b.classList.toggle("active", b.dataset.mode === state.stageDisplayMode);
    });

    const savedPitch = (saved.pitch_semitones !== undefined) ? parseInt(saved.pitch_semitones) : 0;
    if (typeof window.applyPitchShift === "function") {
        window.applyPitchShift(0, savedPitch);
    }
    updateExportSummary();

    // Reset Player
    beatAudio.currentTime = 0;
    vocalAudio.currentTime = 0;
    if (dom.trackSeekBar) dom.trackSeekBar.value = 0;
    if (dom.currentTimeLabel) dom.currentTimeLabel.textContent = "00:00";
    if (dom.durationLabel) dom.durationLabel.textContent = formatTime(projectData.duration || 0);

    // Clear stage lines immediately so old song lyrics never linger
    const kLine1 = document.getElementById("kLine1");
    const kLine2 = document.getElementById("kLine2");
    const c1 = kLine1?.querySelector(".line-content") || kLine1;
    const c2 = kLine2?.querySelector(".line-content") || kLine2;
    if (kLine1) kLine1.dataset.segIdx = "";
    if (kLine2) kLine2.dataset.segIdx = "";
    if (c1) c1.innerHTML = "";
    if (c2) c2.innerHTML = "";

    if (!projectData.segments || !projectData.segments.length) {
        if (c1) c1.innerHTML = `<span class="line-placeholder">Chưa có lời bài hát (Bấm vào Chỉnh Sửa Lời để thêm)</span>`;
        showToastNotification("Bài hát này chưa có lời! Bạn có thể vào tab 'Chỉnh Sửa Lời' để dán lời hoặc bấm 'Tìm Lời Online'.");
    }

    // Initial Stage: display first couplet preview ready on screen
    updateKaraokeStage(0);
}

export function setupControls() {
    initStudioInspector();
    initTimingSyncPopover();
    initMasterQuickActions();
    setupDraggableSubtitle();
}

