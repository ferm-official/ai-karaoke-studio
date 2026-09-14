/**
 * AI Karaoke Studio Pro — Audio Player, Pitch Shifter, Live Mic & Visualizer
 */

import { state, beatAudio, vocalAudio } from './state.js';
import { formatTime, showToastNotification } from './utils.js';

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

export async function initOrResumeStudioAudio() {
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

export function applyPitchShift(delta, directValue = null) {
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

    try {
        beatAudio.preservesPitch = true;
        beatAudio.playbackRate = 1.0;
        vocalAudio.preservesPitch = true;
        vocalAudio.playbackRate = 1.0;
    } catch (e) {}

    initOrResumeStudioAudio().then(() => {
        if (studioPitchShifter) {
            studioPitchShifter.setTranspose(currentPitch);
        }
    });

    if (typeof window.updateExportSummary === "function") {
        window.updateExportSummary();
    }
    if (typeof window.saveProjectStageSettings === "function") {
        window.saveProjectStageSettings();
    }
}

export function seekToTime(targetTime) {
    const dur = beatAudio.duration || state.currentProject?.duration || 1;
    const clamped = Math.max(0, Math.min(dur, targetTime));
    beatAudio.currentTime = clamped;
    vocalAudio.currentTime = clamped;
    const currentTimeLabel = document.getElementById("currentTimeLabel");
    const trackSeekBar = document.getElementById("trackSeekBar");
    if (currentTimeLabel) currentTimeLabel.textContent = formatTime(clamped);
    if (trackSeekBar) trackSeekBar.value = (clamped / dur) * 100;
    if (typeof window.updateKaraokeStage === "function") {
        window.updateKaraokeStage(clamped);
    }
}

export function seekRelative(delta) {
    const cur = beatAudio.currentTime;
    seekToTime(cur + delta);
}

export function togglePlayPause() {
    if (!state.currentProject) {
        alert("Chưa có bài hát nào được nạp vào Studio!");
        return;
    }

    const playIconText = document.getElementById("playIconText");
    const playIcon = document.getElementById("playIcon");
    const pauseIcon = document.getElementById("pauseIcon");

    if (state.isPlaying) {
        beatAudio.pause();
        vocalAudio.pause();
        state.isPlaying = false;
        if (playIconText) playIconText.textContent = "Phát";
        if (playIcon) playIcon.style.display = "block";
        if (pauseIcon) pauseIcon.style.display = "none";
    } else {
        initOrResumeStudioAudio().then(() => {
            beatAudio.playbackRate = 1.0;
            vocalAudio.playbackRate = 1.0;
            beatAudio.preservesPitch = true;
            vocalAudio.preservesPitch = true;

            beatAudio.play().then(() => {
                vocalAudio.play();
                state.isPlaying = true;
                if (playIconText) playIconText.textContent = "Tạm dừng";
                if (playIcon) playIcon.style.display = "none";
                if (pauseIcon) pauseIcon.style.display = "block";
            }).catch(err => {
                console.error("Playback error:", err);
            });
        });
    }
}

export function setupPlayer() {
    const btnPlayPause = document.getElementById("btnPlayPause");
    const btnRewind10 = document.getElementById("btnRewind10");
    const btnForward10 = document.getElementById("btnForward10");
    const trackSeekBar = document.getElementById("trackSeekBar");
    const currentTimeLabel = document.getElementById("currentTimeLabel");
    const durationLabel = document.getElementById("durationLabel");
    const beatVolSlider = document.getElementById("beatVolSlider");
    const vocalVolSlider = document.getElementById("vocalVolSlider");
    const beatVolText = document.getElementById("beatVolText");
    const vocalVolText = document.getElementById("vocalVolText");
    const playIcon = document.getElementById("playIcon");
    const pauseIcon = document.getElementById("pauseIcon");

    btnPlayPause?.addEventListener("click", togglePlayPause);
    btnRewind10?.addEventListener("click", () => seekRelative(-10));
    btnForward10?.addEventListener("click", () => seekRelative(10));

    let isDraggingSeek = false;
    trackSeekBar?.addEventListener("mousedown", () => { isDraggingSeek = true; });
    trackSeekBar?.addEventListener("touchstart", () => { isDraggingSeek = true; }, { passive: true });

    trackSeekBar?.addEventListener("input", (e) => {
        const pct = parseFloat(e.target.value) / 100;
        const dur = beatAudio.duration || state.currentProject?.duration || 1;
        const targetTime = pct * dur;
        if (currentTimeLabel) currentTimeLabel.textContent = formatTime(targetTime);
        beatAudio.currentTime = targetTime;
        vocalAudio.currentTime = targetTime;
        if (typeof window.updateKaraokeStage === "function") {
            window.updateKaraokeStage(targetTime);
        }
    });

    trackSeekBar?.addEventListener("change", (e) => {
        const pct = parseFloat(e.target.value) / 100;
        const dur = beatAudio.duration || state.currentProject?.duration || 1;
        const targetTime = pct * dur;
        seekToTime(targetTime);
        isDraggingSeek = false;
    });

    trackSeekBar?.addEventListener("mouseup", () => { isDraggingSeek = false; });
    trackSeekBar?.addEventListener("touchend", () => { isDraggingSeek = false; });

    beatVolSlider?.addEventListener("input", (e) => {
        const val = parseFloat(e.target.value);
        beatAudio.volume = val;
        if (beatVolText) beatVolText.textContent = `${Math.round(val * 100)}%`;
    });

    vocalVolSlider?.addEventListener("input", (e) => {
        const val = parseFloat(e.target.value);
        vocalAudio.volume = val;
        if (vocalVolText) vocalVolText.textContent = `${Math.round(val * 100)}%`;
    });

    document.getElementById("btnPitchDown")?.addEventListener("click", () => applyPitchShift(-1));
    document.getElementById("btnPitchUp")?.addEventListener("click", () => applyPitchShift(1));
    document.getElementById("btnPitchReset")?.addEventListener("click", () => applyPitchShift(0));

    beatAudio.addEventListener("timeupdate", () => {
        const cur = beatAudio.currentTime;
        const dur = beatAudio.duration || state.currentProject?.duration || 1;
        
        if (currentTimeLabel) currentTimeLabel.textContent = formatTime(cur);
        if (durationLabel) durationLabel.textContent = formatTime(dur);
        if (!isDraggingSeek && trackSeekBar) {
            trackSeekBar.value = (cur / dur) * 100;
        }

        if (Math.abs(vocalAudio.currentTime - cur) > 0.08) {
            vocalAudio.currentTime = cur;
        }

        const jumpItems = document.querySelectorAll(".lyric-jump-item, .segment-sync-card");
        jumpItems.forEach(item => {
            const itemTime = parseFloat(item.dataset.start);
            if (cur >= itemTime && cur < (itemTime + 4.5)) {
                item.classList.add("active-now");
            } else {
                item.classList.remove("active-now");
            }
        });

        if (typeof window.updateKaraokeStage === "function") {
            window.updateKaraokeStage(cur);
        }
    });

    let stageAnimFrameId = null;
    function stageRenderLoop() {
        if (!beatAudio.paused && !beatAudio.ended) {
            if (typeof window.updateKaraokeStage === "function") {
                window.updateKaraokeStage(beatAudio.currentTime);
            }
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
        if (playIcon) playIcon.style.display = "block";
        if (pauseIcon) pauseIcon.style.display = "none";
    });

    setupTimingOffsetControls();
}

function setupTimingOffsetControls() {
    let globalOffsetMs = 0;
    const offsetValText = document.getElementById("offsetValText");
    const offsetRangeSlider = document.getElementById("offsetRangeSlider");

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
            if (typeof window.renderEditorTable === "function") {
                window.renderEditorTable(state.currentProject.segments);
            }
            if (typeof window.renderLyricJumpList === "function") {
                window.renderLyricJumpList(state.currentProject.segments);
            }
        }
    }

    document.getElementById("btnOffsetMinus200")?.addEventListener("click", () => applyOffsetDelta(-200));
    document.getElementById("btnOffsetMinus50")?.addEventListener("click", () => applyOffsetDelta(-50));
    document.getElementById("btnOffsetMinus10")?.addEventListener("click", () => applyOffsetDelta(-10));
    document.getElementById("btnOffsetPlus10")?.addEventListener("click", () => applyOffsetDelta(10));
    document.getElementById("btnOffsetPlus50")?.addEventListener("click", () => applyOffsetDelta(50));
    document.getElementById("btnOffsetPlus200")?.addEventListener("click", () => applyOffsetDelta(200));
    document.getElementById("btnOffsetReset")?.addEventListener("click", () => {
        if (globalOffsetMs === 0) return;
        applyOffsetDelta(-globalOffsetMs);
        globalOffsetMs = 0;
        updateOffsetDisplay();
    });

    let lastSliderVal = 0;
    offsetRangeSlider?.addEventListener("input", (e) => {
        const currentVal = parseInt(e.target.value);
        const diff = currentVal - lastSliderVal;
        lastSliderVal = currentVal;
        applyOffsetDelta(diff);
    });

    document.getElementById("btnSaveOffset")?.addEventListener("click", () => {
        if (typeof window.handleSaveLyrics === "function") {
            window.handleSaveLyrics();
        }
    });
}

export function playSegmentAudio(startTime) {
    seekToTime(startTime);
    if (beatAudio.paused) {
        togglePlayPause();
    }
}

let activeLoopSegment = null;
export function playSegmentAudition(startTime, endTime, isLoop = false) {
    if (activeLoopSegment && activeLoopSegment.timer) {
        clearTimeout(activeLoopSegment.timer);
        activeLoopSegment = null;
    }

    seekToTime(startTime);
    if (beatAudio.paused) togglePlayPause();

    const durationMs = Math.max(200, (endTime - startTime) * 1000);

    const checkTimer = setTimeout(() => {
        if (isLoop) {
            playSegmentAudition(startTime, endTime, true);
        } else {
            if (!beatAudio.paused) togglePlayPause();
        }
    }, durationMs + 80);

    activeLoopSegment = { startTime, endTime, isLoop, timer: checkTimer };
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

export function createStudioImpulseResponse(ctx, duration = 2.0, decay = 2.0) {
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

export function setupStudioMic() {
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
            if (toggleText) toggleText.textContent = "Bật Micro Live";
            if (micLiveIndicator) micLiveIndicator.classList.remove("live");
            if (btnToggleMicMaster) {
                btnToggleMicMaster.classList.remove("active");
                btnToggleMicMaster.textContent = "Bật Micro";
            }
            showToastNotification("Đã tắt Micro");
            return;
        }

        try {
            micStream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
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

            micEchoDelay = micContext.createDelay();
            micEchoDelay.delayTime.value = 0.28;
            micEchoFeedback = micContext.createGain();
            micEchoFeedback.gain.value = 0.40;
            micEchoGain = micContext.createGain();
            micEchoGain.gain.value = parseFloat(micEchoSlider?.value || 0.30);

            micEchoDelay.connect(micEchoFeedback);
            micEchoFeedback.connect(micEchoDelay);
            micEchoDelay.connect(micEchoGain);

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
            if (toggleText) toggleText.textContent = "Tắt Micro Live";
            if (micLiveIndicator) micLiveIndicator.classList.add("live");
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

export function initVisualizer() {
    const canvas = document.getElementById("visualizerCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    function resizeCanvas() {
        if (!canvas.parentElement) return;
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
