/**
 * AI Karaoke Studio Pro — Main Application Coordinator (ES6 Entry Point)
 * Modularized Architecture:
 * - js/state.js       : Shared application state and DOM cache
 * - js/utils.js       : Formatting, color helpers, and toasts
 * - js/system.js      : System telemetry (CUDA/GPU) and 1-click git updates
 * - js/navigation.js  : Tab switching, step indicators, and anchor navigation
 * - js/upload.js      : Audio/stems upload, YouTube fetch, and pipeline polling
 * - js/audio.js       : Dual stems playback, pitch shifting, studio mic, and visualizer
 * - js/stage.js       : 60 FPS karaoke wipe renderer, countdown dots, auto-fit
 * - js/controls.js    : Inspector deck, line position sliders, presets, data loader
 * - js/editor.js      : Lyrics table, syllable timing badges, tap-to-sync
 * - js/export.js      : GPU NVENC video render modal and summary updates
 * - js/library.js     : Projects library grid, deletion, and folder opening
 */

import { state, beatAudio, vocalAudio, dom } from "./js/state.js";
import { 
    formatTime, 
    formatTimeMs, 
    parseTimeMs, 
    roundNum, 
    clamp, 
    hexToAssColor, 
    assColorToHex, 
    showToastNotification 
} from "./js/utils.js";
import { fetchSystemInfo, initAppVersionAndUpdateSystem } from "./js/system.js";
import { setupNavigation, switchTab, syncGuidedStepper, scrollToStudioExport } from "./js/navigation.js";
import { 
    setupUploadHandlers, 
    handleFileSelected, 
    handleInstFileSelected, 
    handleVocalFileSelected, 
    resetCreationForm 
} from "./js/upload.js";
import { 
    setupPlayer, 
    togglePlayPause, 
    seekRelative, 
    seekToTime, 
    applyPitchShift, 
    setupStudioMic, 
    initVisualizer,
    playSegmentAudio,
    playSegmentAudition
} from "./js/audio.js";
import { 
    updateKaraokeStage, 
    applyStageFont, 
    applyStageActiveColor, 
    synchronizeLinesAutoFit, 
    calculateCoupletMaxSafeSize, 
    calculateGlobalMaxSafeFontSize, 
    startStageInlineEdit,
    renderKaraokeLine,
    renderCountdownDots
} from "./js/stage.js";
import { 
    openInspectorPane, 
    closeInspector, 
    initStudioInspector, 
    applyWipingFxMode, 
    initTimingSyncPopover, 
    initMasterQuickActions, 
    applyLinePositionX, 
    applyLinePositionY, 
    applyLinePosition, 
    applyLineFontSize, 
    applyMasterFontSize, 
    applyLayoutPreset, 
    applyStyleTheme, 
    applyPresetTrongHieu, 
    saveProjectStageSettings, 
    setupDraggableSubtitle, 
    setupControls,
    loadProjectData 
} from "./js/controls.js";
import { 
    ensureConciseSegments, 
    renderEditorTable, 
    renderLyricJumpList, 
    setSegmentRole, 
    nudgeSingleSegment, 
    deleteSegment, 
    updateSegmentText, 
    autoSplitProjectSegments, 
    handleSaveLyrics, 
    setupTapToSync, 
    setupEditor 
} from "./js/editor.js";
import { 
    executeStudioVideoExport, 
    openStudioExportResultModal, 
    closeStudioExportModal, 
    updateExportSummary, 
    setupExport 
} from "./js/export.js";
import { 
    loadProjectsList, 
    renderProjectsGrid, 
    loadExistingProject, 
    openProjectInStudio, 
    openProjectInExport, 
    openProjectFolder, 
    confirmDeleteProject, 
    setupLibraryHandlers 
} from "./js/library.js";

/* ========================================================
   GLOBAL WINDOW BRIDGE (For HTML onclick & inline events)
   ======================================================== */
window.state = state;
window.beatAudio = beatAudio;
window.vocalAudio = vocalAudio;
window.dom = dom;

// Utilities
window.formatTime = formatTime;
window.formatTimeMs = formatTimeMs;
window.parseTimeMs = parseTimeMs;
window.roundNum = roundNum;
window.clamp = clamp;
window.hexToAssColor = hexToAssColor;
window.assColorToHex = assColorToHex;
window.showToast = showToastNotification;
window.showToastNotification = showToastNotification;

// Navigation
window.switchTab = switchTab;
window.syncGuidedStepper = syncGuidedStepper;
window.scrollToStudioExport = scrollToStudioExport;

// Audio & Player
window.togglePlayPause = togglePlayPause;
window.seekRelative = seekRelative;
window.seekToTime = seekToTime;
window.applyPitchShift = applyPitchShift;
window.playSegmentAudio = playSegmentAudio;
window.playSegmentAudition = playSegmentAudition;

// Stage & Presentation
window.updateKaraokeStage = updateKaraokeStage;
window.applyStageFont = applyStageFont;
window.applyStageActiveColor = applyStageActiveColor;
window.startStageInlineEdit = startStageInlineEdit;
window.calculateGlobalMaxSafeFontSize = calculateGlobalMaxSafeFontSize;

// Controls, Deck & Presets
window.openInspectorPane = openInspectorPane;
window.closeInspector = closeInspector;
window.applyLinePositionX = applyLinePositionX;
window.applyLinePositionY = applyLinePositionY;
window.applyLinePosition = applyLinePosition;
window.applyLineFontSize = applyLineFontSize;
window.applyMasterFontSize = applyMasterFontSize;
window.applyLayoutPreset = applyLayoutPreset;
window.applyStyleTheme = applyStyleTheme;
window.applyPresetTrongHieu = applyPresetTrongHieu;
window.saveProjectStageSettings = saveProjectStageSettings;
window.loadProjectData = loadProjectData;

// Lyrics Editor
window.setSegmentRole = setSegmentRole;
window.nudgeSingleSegment = nudgeSingleSegment;
window.deleteSegment = deleteSegment;
window.updateSegmentText = updateSegmentText;
window.autoSplitProjectSegments = autoSplitProjectSegments;
window.handleSaveLyrics = handleSaveLyrics;

// Video Export
window.executeStudioVideoExport = executeStudioVideoExport;
window.openStudioExportResultModal = openStudioExportResultModal;
window.closeStudioExportModal = closeStudioExportModal;
window.updateExportSummary = updateExportSummary;

// Library
window.loadProjectsList = loadProjectsList;
window.loadExistingProject = loadExistingProject;
window.openProjectInStudio = openProjectInStudio;
window.openProjectInExport = openProjectInExport;
window.openProjectFolder = openProjectFolder;
window.confirmDeleteProject = confirmDeleteProject;

/* ========================================================
   APPLICATION BOOTSTRAPPER
   ======================================================== */
function initApp() {
    fetchSystemInfo();
    initAppVersionAndUpdateSystem();
    setupNavigation();
    setupUploadHandlers();
    setupPlayer();
    setupControls();
    setupEditor();
    setupExport();
    setupLibraryHandlers();
    loadProjectsList();
    initVisualizer();

    // Auto-load project and tab from URL query params
    const urlParams = new URLSearchParams(window.location.search);
    const projId = urlParams.get("project");
    const targetTab = urlParams.get("tab");
    if (projId) {
        loadExistingProject(projId, targetTab || "playerTab");
    } else if (targetTab) {
        switchTab(targetTab);
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
} else {
    initApp();
}
