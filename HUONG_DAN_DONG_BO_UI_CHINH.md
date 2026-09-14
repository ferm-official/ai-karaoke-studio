# 🎤 TÀI LIỆU HƯỚNG DẪN ĐỒNG BỘ GIAO DIỆN STUDIO (3 CỘT) VỀ BẢN CHÍNH

> **Dành cho:** Nhà phát triển & Quản trị dự án AI Karaoke Studio Pro  
> **Nguồn nâng cấp:** Bản thử nghiệm đã tối ưu tại `test/index.html` (chuẩn UI/UX Pro Max)  
> **Đích đồng bộ:** Bản chính tại thư mục `web/` (`web/index.html` và `web/style.css`)  
> **Nguyên tắc cốt lõi:** **Chỉ thay đổi cấu trúc hiển thị HTML & Style CSS — Giữ nguyên 100% logic Backend và JavaScript `web/app.js`**.

---

## 📌 MỤC LỤC
1. [Tổng Quan Kiến Trúc Nâng Cấp](#1-tổng-quan-kiến-trúc-nâng-cấp)
2. [Bảng Tra Cứu & Đối Chiếu DOM IDs (ID Mapping Table)](#2-bảng-tra-cứu--đối-chiếu-dom-ids-id-mapping-table)
3. [Bước 1: Cập Nhật Cấu Trúc HTML (`web/index.html`)](#3-bước-1-cập-nhật-cấu-trúc-html-webindexhtml)
4. [Bước 2: Bổ Sung CSS Giao Diện 3 Cột (`web/style.css`)](#4-bước-2-bổ-sung-css-giao-diện-3-cột-webstylecss)
5. [Bước 3: Tương Thích JavaScript (`web/app.js`)](#5-bước-3-tương-thích-javascript-webappjs)
6. [Quy Trình Kiểm Thử Đảm Bảo Chất Lượng (QA Checklist)](#6-quy-trình-kiểm-thử-đảm-bảo-chất-lượng-qa-checklist)
7. [Phương Án Sao Lưu & Khôi Phục (Rollback Plan)](#7-phương-án-sao-lưu--khôi-phục-rollback-plan)

---

## 1. TỔNG QUAN KIẾN TRÚC NÂNG CẤP

### 1.1. Vấn Đề Ở Bản Cũ
- Bản cũ sắp xếp các khối công cụ **xếp chồng theo chiều dọc (Vertical Stacking)** bên dưới video.
- Khi người dùng muốn chỉnh âm lượng, đổi tone nhạc, căn nhịp hoặc đổi font chữ, họ phải cuộn chuột dài xuống dưới, che mất màn hình video đang chạy.
- Giao diện có nhiều hiệu ứng phát sáng neon (Neon Glow/Rainbow Halo) gây mỏi mắt trong phòng thu tối.

### 1.2. Giải Pháp Studio 3 Cột (Modern DAW Layout)
- **Cột Trái (280px - Vận Hành & Âm Thanh):**
  - Mixer Beat / Vocal (kèm vạch mốc 0% - 50% - 100%).
  - Nâng / Hạ Tone nhạc nhanh (-1 Nam, Gốc 0, +1 Nữ).
  - Căn nhịp thời gian thực (-50ms, 0s, +50ms).
  - Bật/Tắt Micro phòng thu kèm đèn tín hiệu sống (Live Indicator) và fader Volume/Echo/Reverb.
- **Cụm Giữa (1fr - Sân Khấu & Điều Khiển Phát):**
  - Màn hình Video giữ cứng tỷ lệ vàng **16:9** (`aspect-ratio: 16 / 9`), hỗ trợ Container Queries tự co dãn chữ phụ đề theo kích thước màn hình.
  - Cụm điều khiển Playback phẳng: Nút Play nổi bật, Lùi 10s, Tiến 10s, Vạch sóng âm (Waveform), Thanh tua (Scrub Seekbar).
- **Cột Phải (300px - Thẩm Mỹ, Tùy Biến & Xuất):**
  - 4 Mẫu phong cách nhanh: KTV Gia Huy, Bolero, Remix, Tối Giản (có chấm màu trực quan).
  - Bố cục chữ: So Le (chuẩn KTV) hoặc Căn Giữa.
  - Công tắc gạt Studio Switch: Đổ Bóng Đậm & Tự Động Co Chữ (Auto-Fit).
  - Bộ chọn Font chữ, Cỡ chữ, Độ mờ nền (Dimmer), Bảng màu chữ.
  - Nút **Rạp Chiếu (Toàn màn hình)** và **Xuất Video MP4**.

---

## 2. BẢNG TRA CỨU & ĐỐI CHIẾU DOM IDS (ID MAPPING TABLE)

Để `web/app.js` tự động nhận diện và kích hoạt tất cả tính năng mà **không cần viết lại JavaScript**, các phần tử trong giao diện 3 cột mới được gắn đúng các ID chuẩn của bản chính theo bảng sau:

| Chức Năng | ID Bản Thử Nghiệm (`test/`) | ID Chuẩn Bản Chính (`web/app.js`) | Ghi Chú |
| :--- | :--- | :--- | :--- |
| **Âm Lượng Beat** | `beatSlider`, `beatVal` | `beatVolSlider`, `beatVolText` | Thanh kéo âm lượng beat & % hiển thị |
| **Âm Lượng Vocal** | `vocalSlider`, `vocalVal` | `vocalVolSlider`, `vocalVolText` | Thanh kéo âm lượng ca sĩ & % hiển thị |
| **Hạ Tone (-1)** | `btnPitchDown` | `btnPitchDown` | Giữ nguyên (khớp 100%) |
| **Tăng Tone (+1)** | `btnPitchUp` | `btnPitchUp` | Giữ nguyên (khớp 100%) |
| **Tone Gốc (0)** | `btnPitchReset` | `btnPitchReset` | Giữ nguyên (khớp 100%) |
| **Hiển Thị Tone** | `pitchBadge` | `pitchValText` | Hiển thị số nửa cung nâng/hạ |
| **Chữ Sớm -50ms** | `btnSyncM50` | `btnOffsetMinus50` | Bấm để dịch chữ sớm hơn 50ms |
| **Chữ Trễ +50ms** | `btnSyncP50` | `btnOffsetPlus50` | Bấm để dịch chữ trễ hơn 50ms |
| **Đặt Lại Nhịp 0s** | `btnSyncZero` | `btnOffsetReset` | Đưa độ trễ về 0ms |
| **Thanh Trượt Nhịp** | `syncRange`, `syncValText` | `offsetRangeSlider`, `offsetValText` | Kéo bù nhịp mili-giây từ -2s đến +2s |
| **Lưu Nhịp Đã Chỉnh** | *(mới bổ sung)* | `btnSaveOffset` | Nút lưu mốc nhịp vào dự án |
| **Nút Bật/Tắt Micro** | `btnMicToggle` | `btnToggleMic` hoặc `btnToggleMicMaster` | Bật Web Audio Mic |
| **Âm Lượng Mic** | `micVolSlider`, `micVolVal` | `micVolSlider`, `micVolText` | Slider mic & text |
| **Tiếng Vang Echo** | `micEchoSlider`, `micEchoVal` | `micEchoSlider`, `micEchoText` | Slider echo & text |
| **Không Gian Reverb**| `micReverbSlider`, `micReverbVal`| `micReverbSlider`, `micReverbText` | Slider reverb & text |
| **Màn Hình Sân Khấu**| `stageViewport` | `stageScreen` | Khung 16:9 chứa video và chữ |
| **Video Nền** | `stageVideoBg` | `stageVideoBg` | Thẻ `<video>` nền stage |
| **Visualizer Sóng** | `visualizerCanvas` | `visualizerCanvas` | Thẻ `<canvas>` sóng âm |
| **Đếm Ngược Vào Bài**| `countdownDots` | `stageCountdownWrap` | 4 chấm KTV đếm ngược |
| **Dòng Chữ 1 & 2** | `kLine1`, `kLine2` | `kLine1`, `kLine2` | 2 dòng chữ karaoke kéo thả |
| **Nội Dung Chữ 1 & 2**| `activeLayer1`, `activeLayer2`| `kLine1Content`, `kLine2Content` | Thẻ span/div chứa text |
| **Nút Play/Pause** | `btnPlayHero` | `btnPlayPause` | Nút phát / tạm dừng |
| **Lùi 10s / Tiến 10s**| `btnRewind10`, `btnForward10` | `btnRewind10`, `btnForward10` | Giữ nguyên (khớp 100%) |
| **Thanh Tua Nhạc** | `timelineRangeNative` | `trackSeekBar` | Slider tua bài hát |
| **Thời Gian Hiện Tại**| `timeCurrent` | `currentTimeLabel` | Nhãn `00:00` |
| **Tổng Thời Lượng** | `timeDuration` | `durationLabel` | Nhãn `03:45` |
| **Mẫu KTV Gia Huy** | `btnThemeKtv` | `btnThemeTrongHieu` | Nút preset KTV |
| **Mẫu Bolero** | `btnThemeBolero` | `btnThemeBolero` | Giữ nguyên (khớp 100%) |
| **Mẫu Remix** | `btnThemeRemix` | `btnThemeRemix` | Giữ nguyên (khớp 100%) |
| **Mẫu Tối Giản** | `btnThemeMinimal` | `btnThemeMinimal` | Giữ nguyên (khớp 100%) |
| **Bố Cục Căn Giữa** | `btnLayoutCenter` | `btnPresetCenter` | Đặt 2 dòng căn giữa |
| **Bố Cục So Le** | `btnLayoutStaggered` | `btnPresetStaggered` | Dòng 1 trái, dòng 2 phải |
| **Tự Động Co Chữ** | `chkAutoFit` | `chkAutoFit` | Giữ nguyên (khớp 100%) |
| **Đổ Bóng Đậm** | `chkShadow` | `chkShadow` | Checkbox / switch bóng chữ |
| **Chọn Font Chữ** | `fontSelect` | `stageFontSelect` | Dropdown chọn font |
| **Cỡ Chữ Phụ Đề** | `fontSizeRange`, `fontSizeNum` | `masterFontSizeSlider`, `masterFontSizeVal` | Slider chỉnh cỡ chữ tổng |
| **Chọn Màu Hát** | `nativeColorInput` | `colorActive` hoặc `stageColorPickerInput` | Bộ chọn mã màu chữ khi hát qua |
| **Nút Rạp Chiếu** | `btnCinema` | `btnCinemaMaster` | Toàn màn hình sân khấu |
| **Nút Xuất Video** | `btnExport` | `btnExportMaster` | Chuyển sang Tab xuất MP4 |

---

## 3. BƯỚC 1: CẬP NHẬT CẤU TRÚC HTML (`web/index.html`)

Mở file `web/index.html`, tìm đến khối `<section class="tab-pane" id="playerTab">` (khoảng từ dòng 315 đến dòng 980) và thay thế toàn bộ nội dung bên trong bằng khối code 3 cột đã được chuẩn hóa ID như sau:

```html
<!-- TAB 2: PHÒNG THU KARAOKE (MODERN 3-COLUMN STUDIO LAYOUT) -->
<section class="tab-pane" id="playerTab">
    <div class="studio-3col-layout" id="studio3ColLayout">
        
        <!-- ==================== CỘT TRÁI: VẬN HÀNH & ÂM THANH ==================== -->
        <aside class="studio-side-col sidebar-left" id="sidebarLeft">
            <div class="col-header-main">
                <span class="col-header-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                </span>
                <span class="col-header-title">VẬN HÀNH & ÂM THANH</span>
                <span class="col-header-tag">LIVE</span>
            </div>

            <!-- Card 1: Mixer Âm Lượng -->
            <div class="c-card">
                <div class="c-card-title">
                    <div class="card-title-left">
                        <span class="card-title-icon">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
                        </span>
                        <span>Âm Lượng Track</span>
                    </div>
                </div>
                <!-- Beat Slider -->
                <div class="fader-group">
                    <div class="fader-head">
                        <span class="fader-name">Nhạc Beat:</span>
                        <span class="fader-val" id="beatVolText">100%</span>
                    </div>
                    <input type="range" class="fader-input" id="beatVolSlider" min="0" max="1" step="0.01" value="1">
                    <div class="fader-scale-ticks"><span>0%</span><span>50%</span><span>100%</span></div>
                </div>
                <!-- Vocal Slider -->
                <div class="fader-group" style="margin-top: 10px;">
                    <div class="fader-head">
                        <span class="fader-name">Ca Sĩ Mẫu:</span>
                        <span class="fader-val" id="vocalVolText">0%</span>
                    </div>
                    <input type="range" class="fader-input" id="vocalVolSlider" min="0" max="1" step="0.01" value="0">
                    <div class="fader-scale-ticks"><span>0%</span><span>50%</span><span>100%</span></div>
                </div>
            </div>

            <!-- Card 2: Nâng Hạ Tone -->
            <div class="c-card">
                <div class="c-card-title">
                    <div class="card-title-left">
                        <span class="card-title-icon">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                        </span>
                        <span>Tone Nhạc (Nửa Cung)</span>
                    </div>
                    <span class="fader-val" id="pitchValText">0</span>
                </div>
                <div class="tone-actions-row">
                    <button type="button" class="btn-tone-large" id="btnPitchDown" title="Hạ 1 nửa cung (giọng Nam)">-1 Nam</button>
                    <button type="button" class="tone-badge-large" id="btnPitchReset" title="Về tone gốc">Gốc 0</button>
                    <button type="button" class="btn-tone-large" id="btnPitchUp" title="Tăng 1 nửa cung (giọng Nữ)">+1 Nữ</button>
                </div>
            </div>

            <!-- Card 3: Căn Chỉnh Nhịp (Sync Offset) -->
            <div class="c-card">
                <div class="c-card-title">
                    <div class="card-title-left">
                        <span class="card-title-icon">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        </span>
                        <span>Đồng Bộ Lời & Nhịp</span>
                    </div>
                    <span class="fader-val" id="offsetValText">0 ms</span>
                </div>
                <div class="sync-actions-row">
                    <button type="button" class="btn-sync-pill" id="btnOffsetMinus50" title="Chữ sớm hơn 50ms">-50ms</button>
                    <button type="button" class="btn-sync-pill" id="btnOffsetReset" title="Đặt lại về 0">0s Chuẩn</button>
                    <button type="button" class="btn-sync-pill" id="btnOffsetPlus50" title="Chữ trễ hơn 50ms">+50ms</button>
                    <button type="button" class="btn-sync-pill" id="btnSaveOffset" title="Lưu nhịp">Lưu</button>
                </div>
                <div class="fader-group" style="margin-top: 10px;">
                    <input type="range" class="fader-input" id="offsetRangeSlider" min="-2000" max="2000" step="10" value="0">
                    <div class="fader-scale-ticks"><span>-2s (Sớm)</span><span>0s</span><span>+2s (Trễ)</span></div>
                </div>
            </div>

            <!-- Card 4: Micro Phòng Thu -->
            <div class="c-card">
                <div class="c-card-title">
                    <div class="card-title-left">
                        <span class="card-title-icon">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
                        </span>
                        <span>Micro Phòng Thu</span>
                    </div>
                    <span class="mic-status-indicator" id="micLiveIndicator"></span>
                </div>
                <button type="button" class="btn-mic-hero" id="btnToggleMic">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
                    <span id="micToggleText">Bật Micro Live</span>
                </button>
                
                <div class="mic-sliders-box">
                    <div class="fader-group">
                        <div class="fader-head"><span class="fader-name">Gain Mic:</span><span class="fader-val" id="micVolText">100%</span></div>
                        <input type="range" class="fader-input" id="micVolSlider" min="0" max="2" step="0.05" value="1">
                    </div>
                    <div class="fader-group" style="margin-top: 8px;">
                        <div class="fader-head"><span class="fader-name">Vang Echo:</span><span class="fader-val" id="micEchoText">30%</span></div>
                        <input type="range" class="fader-input" id="micEchoSlider" min="0" max="1" step="0.05" value="0.3">
                    </div>
                    <div class="fader-group" style="margin-top: 8px;">
                        <div class="fader-head"><span class="fader-name">Reverb:</span><span class="fader-val" id="micReverbText">35%</span></div>
                        <input type="range" class="fader-input" id="micReverbSlider" min="0" max="1" step="0.05" value="0.35">
                    </div>
                </div>
            </div>
        </aside>


        <!-- ==================== CỤM GIỮA: SÂN KHẤU 16:9 & PHÁT NHẠC ==================== -->
        <section class="center-stage-container" id="centerStageContainer">
            
            <!-- Stage Viewport (Cứng 16:9) -->
            <div class="stage-169-viewport" id="stageScreen">
                <div class="stage-aspect-badge">16:9 WIDESCREEN</div>
                <div class="stage-dimmer-overlay" id="stageDimmer"></div>
                
                <video id="stageVideoBg" class="stage-video-bg" loop muted playsinline style="display: none;"></video>
                <canvas id="visualizerCanvas" class="visualizer-canvas"></canvas>
                
                <!-- 4 Chấm Đếm Ngược Vào Bài -->
                <div class="countdown-wrap" id="stageCountdownWrap" style="display: none;">
                    <div class="countdown-label" id="stageCountdownLabel">CHUẨN BỊ</div>
                    <div class="countdown-dots-row" id="stageCountdownDots">
                        <span class="c-dot">4</span>
                        <span class="c-dot">3</span>
                        <span class="c-dot">2</span>
                        <span class="c-dot">1</span>
                    </div>
                </div>

                <!-- 2 Dòng Phụ Đề Karaoke -->
                <div class="karaoke-line line-1" id="kLine1">
                    <div class="karaoke-text-container" id="kLine1Content">
                        <span class="line-placeholder">AI Karaoke Studio Pro</span>
                    </div>
                </div>
                <div class="karaoke-line line-2" id="kLine2">
                    <div class="karaoke-text-container" id="kLine2Content">
                        <span class="line-placeholder">Nhấn Phát để bắt đầu hát</span>
                    </div>
                </div>
            </div>

            <!-- Cụm Điều Khiển Phát Nhạc Dưới Sân Khấu -->
            <div class="center-playback-deck" id="centerPlaybackDeck">
                <div class="deck-top-row">
                    <!-- Nút Điều Khiển Chính -->
                    <div class="deck-ctrls-left">
                        <button type="button" class="btn-step-seek" id="btnRewind10" title="Lùi 10s">« 10s</button>
                        <button type="button" class="btn-play-hero" id="btnPlayPause" title="Phát / Dừng">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" id="playIcon"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" id="pauseIcon" style="display:none;"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                            <span id="playIconText">Phát Nhạc</span>
                        </button>
                        <button type="button" class="btn-step-seek" id="btnForward10" title="Tiến 10s">10s »</button>
                    </div>

                    <!-- Hiển Thị Thời Gian -->
                    <div class="deck-time-display">
                        <span class="time-cur-highlight" id="currentTimeLabel">00:00</span>
                        <span class="time-sep">/</span>
                        <span class="time-total" id="durationLabel">00:00</span>
                    </div>
                </div>

                <!-- Thanh Tiến Trình & Vạch Sóng Âm -->
                <div class="timeline-bar-wrap" id="timelineBarWrap">
                    <div class="waveform-track" id="waveformTrack"></div>
                    <input type="range" class="timeline-range-native" id="trackSeekBar" min="0" max="100" value="0" step="0.1">
                </div>
            </div>
        </section>


        <!-- ==================== CỘT PHẢI: THẨM MỸ, TÙY BIẾN & XUẤT ==================== -->
        <aside class="studio-side-col sidebar-right" id="sidebarRight">
            <div class="col-header-main">
                <span class="col-header-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>
                </span>
                <span class="col-header-title">THẨM MỸ & XUẤT BẢN</span>
                <span class="col-header-tag">STYLES</span>
            </div>

            <!-- Card 1: 4 Mẫu Phong Cách Nhanh -->
            <div class="c-card">
                <div class="c-card-title"><span>Mẫu Phong Cách KTV</span></div>
                <div class="presets-grid-2x2">
                    <button type="button" class="btn-preset-pill active" id="btnThemeTrongHieu">
                        <span class="preset-preview-dot" style="background: #38bdf8;"></span>
                        <span>KTV Cổ Điển</span>
                    </button>
                    <button type="button" class="btn-preset-pill" id="btnThemeBolero">
                        <span class="preset-preview-dot" style="background: #fbbf24;"></span>
                        <span>Bolero Trữ Tình</span>
                    </button>
                    <button type="button" class="btn-preset-pill" id="btnThemeRemix">
                        <span class="preset-preview-dot" style="background: #22d3ee;"></span>
                        <span>Remix Sôi Động</span>
                    </button>
                    <button type="button" class="btn-preset-pill" id="btnThemeMinimal">
                        <span class="preset-preview-dot" style="background: #f8fafc;"></span>
                        <span>Tối Giản KTV</span>
                    </button>
                </div>
            </div>

            <!-- Card 2: Bố Cục & Chống Tràn Viền -->
            <div class="c-card">
                <div class="c-card-title"><span>Bố Cục 2 Dòng</span></div>
                <div class="layout-toggle-row">
                    <button type="button" class="btn-layout-pill active" id="btnPresetStaggered">So Le (Chuẩn)</button>
                    <button type="button" class="btn-layout-pill" id="btnPresetCenter">Căn Giữa</button>
                </div>
                <div class="switches-list">
                    <label class="studio-switch-row" title="Tự động thu nhỏ chữ với câu dài để không bị tràn viền 16:9">
                        <span class="switch-title">Tự Động Co Chữ (Auto-Fit)</span>
                        <span class="studio-switch-wrap">
                            <input type="checkbox" id="chkAutoFit" checked>
                            <span class="switch-slider"></span>
                        </span>
                    </label>
                    <label class="studio-switch-row" title="Đổ bóng viền đậm giúp chữ nổi rõ trên mọi cảnh video">
                        <span class="switch-title">Đổ Bóng Chữ Đậm</span>
                        <span class="studio-switch-wrap">
                            <input type="checkbox" id="chkShadow" checked>
                            <span class="switch-slider"></span>
                        </span>
                    </label>
                </div>
            </div>

            <!-- Card 3: Tùy Chỉnh Font & Màu Chữ -->
            <div class="c-card">
                <div class="c-card-title"><span>Phông Chữ & Màu Sắc</span></div>
                <div class="fader-group">
                    <label class="fader-name">Font Chữ Karaoke:</label>
                    <div class="select-wrapper">
                        <select class="c-select" id="stageFontSelect">
                            <option value="Tahoma" selected>Tahoma (Chuẩn KTV số 1)</option>
                            <option value="Be Vietnam Pro">Be Vietnam Pro (Hiện đại)</option>
                            <option value="Montserrat">Montserrat (Đậm đà)</option>
                            <option value="Baloo 2">Baloo 2 (Bo tròn)</option>
                            <option value="Outfit">Outfit (Công nghệ)</option>
                            <option value="Pattaya">Pattaya (Uốn lượn Bolero)</option>
                        </select>
                    </div>
                </div>

                <div class="fader-group" style="margin-top: 10px;">
                    <div class="fader-head"><span class="fader-name">Cỡ Chữ:</span><span class="fader-val" id="masterFontSizeVal">52px</span></div>
                    <input type="range" class="fader-input" id="masterFontSizeSlider" min="24" max="72" value="52">
                    <div class="fader-scale-ticks"><span>24px</span><span>48px</span><span>72px</span></div>
                </div>

                <div class="fader-group" style="margin-top: 10px;">
                    <div class="fader-head"><span class="fader-name">Màu Chữ Hát Qua:</span></div>
                    <div class="color-picker-studio-row">
                        <label class="color-picker-wrap">
                            <input type="color" id="colorActive" value="#0038FF" class="color-picker-native">
                        </label>
                        <span class="color-hex-label">Màu chữ chạy khi hát</span>
                    </div>
                </div>
            </div>

            <!-- Card 4: Hành Động Rạp Chiếu & Xuất File -->
            <div class="c-card" style="margin-top: auto;">
                <button type="button" class="btn-cinema-mode" id="btnCinemaMaster">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
                    <span>Rạp Chiếu (Toàn Màn Hình)</span>
                </button>
                <button type="button" class="btn-export-mp4" id="btnExportMaster" style="margin-top: 8px;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    <span>XUẤT VIDEO MP4 FULL HD</span>
                </button>
            </div>
        </aside>

    </div>
</section>
```

---

## 4. BƯỚC 2: BỔ SUNG CSS GIAO DIỆN 3 CỘT (`web/style.css`)

Mở file `web/style.css`, kéo xuống cuối cùng của file và thêm toàn bộ khối CSS chuyên biệt sau:

```css
/* ==========================================================================
   MODERN 3-COLUMN DAW STUDIO LAYOUT (UI/UX PRO MAX)
   ========================================================================== */

/* 1. Bố Cục Toàn Màn Hình 3 Cột */
.studio-3col-layout {
    display: grid;
    grid-template-columns: 280px minmax(0, 1fr) 300px;
    gap: 16px;
    width: 100%;
    min-height: calc(100vh - 140px);
    align-items: start;
    padding: 12px 16px;
    background: #080c14;
    color: #f1f5f9;
    box-sizing: border-box;
}

/* 2. Cột Bên (Sidebar Left & Right) */
.studio-side-col {
    background: #0d1322;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: calc(100vh - 150px);
    overflow-y: auto;
}

.studio-side-col::-webkit-scrollbar {
    width: 5px;
}
.studio-side-col::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 4px;
}

/* Header Cột */
.col-header-main {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.col-header-icon {
    color: #38bdf8;
    display: flex;
    align-items: center;
}
.col-header-title {
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: #94a3b8;
    flex: 1;
}
.col-header-tag {
    font-size: 0.62rem;
    font-weight: 700;
    background: rgba(56, 189, 248, 0.12);
    color: #38bdf8;
    padding: 2px 6px;
    border-radius: 4px;
}

/* Card Module */
.c-card {
    background: #111726;
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 10px;
    padding: 12px;
}
.c-card-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.78rem;
    font-weight: 700;
    color: #cbd5e1;
    margin-bottom: 10px;
}
.card-title-left {
    display: flex;
    align-items: center;
    gap: 6px;
}
.card-title-icon {
    color: #38bdf8;
    display: flex;
}

/* Fader Sliders & Scale Ticks */
.fader-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.fader-head {
    display: flex;
    justify-content: space-between;
    font-size: 0.72rem;
    color: #94a3b8;
}
.fader-name {
    font-weight: 600;
}
.fader-val {
    font-weight: 700;
    color: #38bdf8;
    font-family: 'JetBrains Mono', monospace;
}
.fader-input {
    -webkit-appearance: none;
    width: 100%;
    height: 6px;
    background: #1e293b;
    border-radius: 3px;
    outline: none;
    cursor: pointer;
}
.fader-input::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #38bdf8;
    border: 2px solid #ffffff;
    cursor: pointer;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
    transition: transform 0.1s ease;
}
.fader-input::-webkit-slider-thumb:hover {
    transform: scale(1.15);
}
.fader-scale-ticks {
    display: flex;
    justify-content: space-between;
    font-size: 0.6rem;
    color: #475569;
    font-weight: 600;
}

/* Nút Bấm Tone & Sync */
.tone-actions-row, .sync-actions-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 6px;
}
.sync-actions-row {
    grid-template-columns: 1fr 1.2fr 1fr 1fr;
}
.btn-tone-large, .tone-badge-large, .btn-sync-pill {
    background: #1e293b;
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #f1f5f9;
    padding: 7px 4px;
    border-radius: 6px;
    font-size: 0.72rem;
    font-weight: 700;
    cursor: pointer;
    text-align: center;
    transition: all 0.15s ease;
}
.btn-tone-large:hover, .btn-sync-pill:hover {
    background: #334155;
    border-color: #38bdf8;
}
.tone-badge-large {
    background: rgba(56, 189, 248, 0.1);
    color: #38bdf8;
    border-color: rgba(56, 189, 248, 0.3);
}

/* Micro Hero Button & Live Indicator */
.btn-mic-hero {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: #0284c7;
    color: #ffffff;
    border: none;
    padding: 10px;
    border-radius: 8px;
    font-weight: 700;
    font-size: 0.8rem;
    cursor: pointer;
    transition: background 0.15s ease;
}
.btn-mic-hero:hover {
    background: #0369a1;
}
.btn-mic-hero.active {
    background: #10b981;
}
.mic-status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #475569;
}
.mic-status-indicator.live {
    background: #10b981;
    box-shadow: 0 0 8px #10b981;
    animation: micBreathe 1.8s infinite;
}
@keyframes micBreathe {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
}

/* 3. Cụm Giữa (Center Stage & Playback Deck) */
.center-stage-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.stage-169-viewport {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    background: #030712;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
}
.stage-aspect-badge {
    position: absolute;
    top: 10px;
    left: 10px;
    font-size: 0.65rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    background: rgba(0, 0, 0, 0.6);
    color: #64748b;
    padding: 3px 8px;
    border-radius: 4px;
    z-index: 10;
}
.stage-dimmer-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
    z-index: 2;
    pointer-events: none;
}
.visualizer-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
}

/* 2 Dòng Phụ Đề Chuẩn */
.karaoke-line {
    position: absolute;
    z-index: 5;
    white-space: nowrap;
    user-select: none;
}
.karaoke-line.line-1 {
    top: 58%;
    left: 6%;
}
.karaoke-line.line-2 {
    top: 74%;
    right: 6%;
}
.line-placeholder {
    font-family: 'Tahoma', sans-serif;
    font-size: clamp(20px, 3.5vw, 44px);
    font-weight: 800;
    color: #ffffff;
    text-shadow: 2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 4px 10px rgba(0,0,0,0.8);
}

/* Cụm Điều Khiển Playback */
.center-playback-deck {
    background: #0d1322;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.deck-top-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.deck-ctrls-left {
    display: flex;
    align-items: center;
    gap: 8px;
}
.btn-step-seek {
    background: #1e293b;
    color: #cbd5e1;
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s ease;
}
.btn-step-seek:hover {
    background: #334155;
}
.btn-play-hero {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #0284c7;
    color: #ffffff;
    border: none;
    padding: 8px 20px;
    border-radius: 8px;
    font-size: 0.85rem;
    font-weight: 800;
    cursor: pointer;
    transition: background 0.15s ease;
}
.btn-play-hero:hover {
    background: #0369a1;
}
.deck-time-display {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.85rem;
    font-weight: 700;
    display: flex;
    gap: 4px;
}
.time-cur-highlight {
    color: #38bdf8;
}
.time-sep, .time-total {
    color: #64748b;
}

/* Timeline & Waveform */
.timeline-bar-wrap {
    position: relative;
    width: 100%;
    height: 14px;
    display: flex;
    align-items: center;
}
.timeline-range-native {
    -webkit-appearance: none;
    width: 100%;
    height: 6px;
    background: #1e293b;
    border-radius: 3px;
    outline: none;
    cursor: pointer;
    position: relative;
    z-index: 2;
}
.timeline-range-native::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #38bdf8;
    border: 2px solid #ffffff;
    cursor: pointer;
}

/* 4. Cột Phải (Presets, Switches, Export) */
.presets-grid-2x2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
}
.btn-preset-pill {
    display: flex;
    align-items: center;
    gap: 6px;
    background: #1e293b;
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #cbd5e1;
    padding: 8px;
    border-radius: 6px;
    font-size: 0.72rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s ease;
}
.btn-preset-pill:hover {
    background: #334155;
}
.btn-preset-pill.active {
    background: rgba(56, 189, 248, 0.12);
    border-color: #38bdf8;
    color: #38bdf8;
}
.preset-preview-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
}

.layout-toggle-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    margin-bottom: 10px;
}
.btn-layout-pill {
    background: #1e293b;
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #cbd5e1;
    padding: 7px;
    border-radius: 6px;
    font-size: 0.72rem;
    font-weight: 700;
    cursor: pointer;
}
.btn-layout-pill.active {
    background: rgba(56, 189, 248, 0.12);
    border-color: #38bdf8;
    color: #38bdf8;
}

/* Studio Switch */
.switches-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.studio-switch-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    font-size: 0.75rem;
    font-weight: 600;
    color: #94a3b8;
}
.studio-switch-wrap {
    position: relative;
    width: 38px;
    height: 20px;
}
.studio-switch-wrap input {
    opacity: 0;
    width: 0;
    height: 0;
}
.switch-slider {
    position: absolute;
    cursor: pointer;
    inset: 0;
    background: #1e293b;
    border-radius: 20px;
    transition: 0.2s;
    border: 1px solid rgba(255, 255, 255, 0.1);
}
.switch-slider:before {
    position: absolute;
    content: "";
    height: 14px;
    width: 14px;
    left: 2px;
    bottom: 2px;
    background: #ffffff;
    border-radius: 50%;
    transition: 0.2s;
}
.studio-switch-wrap input:checked + .switch-slider {
    background: #0284c7;
}
.studio-switch-wrap input:checked + .switch-slider:before {
    transform: translateX(18px);
}

/* Select & Color Picker */
.select-wrapper {
    position: relative;
}
.c-select {
    width: 100%;
    background: #1e293b;
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #f1f5f9;
    padding: 8px 10px;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    outline: none;
    cursor: pointer;
}
.color-picker-studio-row {
    display: flex;
    align-items: center;
    gap: 10px;
}
.color-picker-wrap {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: linear-gradient(135deg, #f43f5e, #3b82f6, #10b981, #f59e0b);
    padding: 2px;
    cursor: pointer;
    display: inline-block;
}
.color-picker-native {
    opacity: 0;
    width: 100%;
    height: 100%;
    cursor: pointer;
}
.color-hex-label {
    font-size: 0.72rem;
    color: #94a3b8;
}

/* Nút Toàn Màn Hình & Xuất MP4 */
.btn-cinema-mode, .btn-export-mp4 {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px;
    border-radius: 8px;
    font-weight: 800;
    font-size: 0.78rem;
    cursor: pointer;
    border: none;
    transition: all 0.15s ease;
}
.btn-cinema-mode {
    background: #1e293b;
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #f1f5f9;
}
.btn-cinema-mode:hover {
    background: #334155;
}
.btn-export-mp4 {
    background: #2563eb;
    color: #ffffff;
}
.btn-export-mp4:hover {
    background: #1d4ed8;
}

/* 5. Khả Năng Thích Ứng (Responsive) */
@media (max-width: 1200px) {
    .studio-3col-layout {
        grid-template-columns: 260px minmax(0, 1fr);
    }
    .sidebar-right {
        grid-column: span 2;
        max-height: none;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    }
}

@media (max-width: 860px) {
    .studio-3col-layout {
        grid-template-columns: 1fr;
    }
    .sidebar-left, .sidebar-right {
        max-height: none;
    }
}
```

---

## 5. BƯỚC 3: TƯƠNG THÍCH JAVASCRIPT (`web/app.js`)

Vì chúng ta đã giữ nguyên **100% các DOM IDs chuẩn**, toàn bộ các hàm xử lý cốt lõi trong `web/app.js`:
- `setupPlayer()`
- `togglePlayPause()`
- `seekRelative()`
- `applyPitchShift()`
- `applyOffsetDelta()`
- `setupDraggableSubtitle()`
- `initVisualizer()`

sẽ **tự động bắt sự kiện và hoạt động ngay lập tức**.

### Điểm Nhỏ Cần Lưu Ý Trong `web/app.js`:
1. Nút `btnExportMaster`: Trong `app.js`, nút này đã được gắn sự kiện chuyển sang tab xuất video:
   ```javascript
   btnExportMaster?.addEventListener("click", () => switchTab("exportTab"));
   ```
2. Nút `btnCinemaMaster`: Trong `app.js`, nút này đã gắn hàm `toggleCinemaMode()` để phóng to sân khấu toàn màn hình.
3. Nếu muốn thêm nút `Lưu` cho nhịp sync (`#btnSaveOffset`), `app.js` đã có sẵn listener gọi `handleSaveLyrics()`.

---

## 6. QUY TRÌNH KIỂM THỬ ĐẢM BẢO CHẤT LƯỢNG (QA CHECKLIST)

Sau khi hoàn tất paste code vào `web/index.html` và `web/style.css`, thực hiện kiểm tra nhanh theo bảng sau:

| STT | Hành Động Kiểm Thử | Kết Quả Mong Đợi | Đạt |
| :---: | :--- | :--- | :---: |
| 1 | Mở trang `http://127.0.0.1:8008`, nạp 1 bài hát | Tab Phòng Thu hiển thị chuẩn 3 cột, không bị lỗi layout | [ ] |
| 2 | Bấm nút `Phát Nhạc` | Nhạc phát mượt mà, vạch sóng nhấp nháy, chữ phụ đề chạy mịn | [ ] |
| 3 | Kéo slider `Nhạc Beat` và `Ca Sĩ Mẫu` | Âm lượng thay đổi tức thì, số % nhảy đúng | [ ] |
| 4 | Bấm `+1 Nữ` và `-1 Nam` | Nhạc đổi cao độ tức thì mà không làm thay đổi tốc độ bài hát | [ ] |
| 5 | Bấm `Bật Micro Live` | Micro thu âm, nói thử nghe thấy tiếng vang phòng thu | [ ] |
| 6 | Bấm `KTV Cổ Điển`, `Bolero`, `Remix` | Phong cách chữ, màu chữ và font thay đổi tức thì | [ ] |
| 7 | Bấm `So Le` và `Căn Giữa` | 2 dòng chữ tự động nhảy về vị trí tương ứng | [ ] |
| 8 | Bấm `Rạp Chiếu` | Màn hình 16:9 phóng to toàn cảnh rạp chiếu | [ ] |
| 9 | Bấm `XUẤT VIDEO MP4` | Tự động chuyển mượt mà sang Tab Xuất Video | [ ] |
| 10 | Thu nhỏ cửa sổ trình duyệt | Giao diện tự động co dãn thông minh (không bị vỡ khung hình) | [ ] |

---

## 7. PHƯƠNG ÁN SAO LƯU & KHÔI PHỤC (ROLLBACK PLAN)

Trước khi thực hiện chỉnh sửa trên bản chính, anh chỉ cần tạo 1 bản sao lưu nhanh:
```powershell
# Chạy trong PowerShell tại thư mục dự án
Copy-Item web/index.html web/index.html.bak
Copy-Item web/style.css web/style.css.bak
```

Nếu muốn khôi phục lại nguyên trạng bất kỳ lúc nào:
```powershell
Copy-Item web/index.html.bak web/index.html -Force
Copy-Item web/style.css.bak web/style.css -Force
```

---
*Tài liệu được biên soạn tự động và tối ưu hóa chuẩn xác bởi trợ lý Antigravity.*
