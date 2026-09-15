/**
 * AI Karaoke Studio Pro — Global Application State & DOM References
 */

export const state = {
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
    line1PosY: 0.58,
    line2PosY: 0.76,
    line1PosX: 0.50,
    line2PosX: 0.50,
    line1Align: "center",
    line2Align: "center",
    layoutPreset: "center",
    isAutoFitEnabled: true,
    fontSizeLine1: 54,
    fontSizeLine2: 54,
    fontName: "Tahoma, sans-serif",
    bgTheme: "nebula",
    colorActive: "#0038FF",
    colorInactive: "#ffffff",
    currentPitchSemitones: 0,
    wipingFxMode: "smooth",
    showCountdownDots: true,
    countdownStyle: "hearts",
    countdownCount: 4,
    showToneBadge: false,
    stageDisplayMode: "pingpong",
    customBgPath: null,
    _memoizedTimeline: null,
    _memoizedTimelineSegsRef: null,
    _memoizedPairs: null,
    _memoizedSegsRef: null,
    _cachedSongSafeSize: null,
    _cachedSongSafeSizeSegsRef: null
};

// Dual-track synchronized audio elements
export const beatAudio = new Audio();
export const vocalAudio = new Audio();
beatAudio.preload = "auto";
vocalAudio.preload = "auto";

// Safe dynamic DOM element getters
export const dom = {
    get kLine1() { return document.getElementById("kLine1"); },
    get kLine2() { return document.getElementById("kLine2"); },
    get stageScreen() { return document.getElementById("stageScreen") || document.getElementById("karaokeScreen"); },
    get btnPlayPause() { return document.getElementById("btnPlayPause"); },
    get playIcon() { return document.getElementById("playIcon"); },
    get pauseIcon() { return document.getElementById("pauseIcon"); },
    get playIconText() { return document.getElementById("playIconText"); },
    get btnRewind10() { return document.getElementById("btnRewind10"); },
    get btnForward10() { return document.getElementById("btnForward10"); },
    get trackSeekBar() { return document.getElementById("trackSeekBar"); },
    get currentTimeLabel() { return document.getElementById("currentTimeLabel"); },
    get durationLabel() { return document.getElementById("durationLabel"); },
    get beatVolSlider() { return document.getElementById("beatVolSlider"); },
    get vocalVolSlider() { return document.getElementById("vocalVolSlider"); },
    get beatVolText() { return document.getElementById("beatVolText"); },
    get vocalVolText() { return document.getElementById("vocalVolText"); },
    get visualizerCanvas() { return document.getElementById("visualizerCanvas"); },
    get lyricsTableBody() { return document.getElementById("lyricsTableBody"); },
    get lyricsJumpList() { return document.getElementById("lyricsJumpList"); },
    get projectsGrid() { return document.getElementById("projectsGrid"); }
};
