# 🎤 AI KARAOKE STUDIO PRO - TỔNG QUAN HỆ THỐNG & TÀI LIỆU DỰ ÁN

> **Phiên bản:** v5.2 Pro (Tích hợp Google Gemini Multimodal Audio + Adaptive Acoustic Aligner + ASS KTV 2 Dòng)  
> **Nền tảng hỗ trợ:** Windows 10/11 (NVIDIA GPU CUDA / CPU Đa Luồng) & macOS (Apple Silicon M1/M2/M3/M4)  
> **Cổng truy cập mặc định:** `http://127.0.0.1:8008`

---

## 📌 1. TỔNG QUAN DỰ ÁN

**AI Karaoke Studio Pro** là giải pháp phần mềm tự động hóa toàn diện quy trình sản xuất video Karaoke KTV chuẩn phòng thu thương mại:
1. **Tách nhạc nền & giọng hát (Stems Separation):** Sử dụng mô hình AI **Meta Demucs v4 (HTDemucs / HTDemucs Fine-Tuned)** chạy cục bộ trên GPU NVIDIA hoặc CPU, cho beat sạch trong trẻo, giữ nguyên chi tiết vocal.
2. **Nhận diện giọng hát (Offline Speech-to-Text):** Tích hợp mô hình **Faster-Whisper (large-v3, medium, small)** trích xuất từng từ kèm mốc thời gian mili-giây với bộ nhớ đệm cache siêu tốc.
3. **Bộ khớp nhịp âm học thích ứng (Adaptive Acoustic DP Aligner):** Tự động triệt tiêu độ trễ giữa lời bài hát chuẩn và giọng hát thực tế của ca sĩ, dò lệch nhịp tổng thể (Global Drift Tracking) và bù nhịp tự động.
4. **Khớp nhịp Gemini AI chuyên biệt cho Bài Mới & Nhạc Suno AI:** Lắng nghe trực tiếp luồng giọng hát (Vocal) qua Google Gemini Cloud (Gemini 2.5 Flash / 3.7 Flash) đối chiếu với lời prompt Suno đã được lọc sạch tag (`[Verse]`, `[Chorus]`), xuất phụ đề SRT chuẩn xác từng câu.
5. **Công cụ tạo phụ đề KTV 2 dòng so le luân phiên:** Xuất đồng thời 4 định dạng (`karaoke.ass`, `karaoke.lrc`, `karaoke.json`, `karaoke.srt`). Hiệu ứng đổi màu chữ mịn từng từ (`\kf`), đếm ngược vào bài 4 chấm KTV, tự động căn chỉnh tỷ lệ âm tiết và ngân dài từ cuối câu (Cadence Elongation 1.35x).
6. **Studio Biên Tập Web Trực Quan:** Kéo thả vị trí 2 dòng (2D X/Y), chỉnh font chữ, màu sắc vai hát (Nam / Nữ / Song ca), nghe thử từng từ, gõ nhịp trực tiếp bàn phím (Live Tap-to-Sync Spacebar) và render video MP4 1080p/4K bằng FFmpeg tăng tốc phần cứng.

---

## 📂 2. BẢN ĐỒ MÃ NGUỒN (CODEBASE DIRECTORY MAP)

```
ai-karaoke-studio/
├── server.py                     # Máy chủ chính FastAPI (REST API + WebSocket/Event Stream + Background Tasks)
├── requirements.txt              # Danh sách thư viện phụ thuộc Python
├── run_studio.bat                # Script khởi động 1-click cho máy Windows
├── run_mac.command               # Script khởi động 1-click cho máy macOS
├── package_mac_release.py        # Script đóng gói bản phát hành cho macOS
├── package_full_project.py       # Script đóng gói toàn bộ dự án sạch chuyển sang máy khác
├── README.md                     # Hướng dẫn nhanh cài đặt & sử dụng
├── HUONG_DAN_CHO_NHAN_VIEN.md    # Hướng dẫn chi tiết cho nhân viên clone & cập nhật từ Git
├── HD_SU_DUNG_MAC.md             # Hướng dẫn riêng cho máy Mac Apple Silicon
├── TONG_QUAN_DU_AN.md            # [TÀI LIỆU NÀY] Tổng quan kiến trúc & tài liệu kỹ thuật dự án
│
├── backend/                      # Tầng xử lý logic & thuật toán AI
│   ├── __init__.py               # Khởi tạo package Python backend
│   ├── separator.py              # Xử lý tách beat bằng Demucs v4 (CUDA/CPU/MPS + Cache băm SHA256)
│   ├── transcriber.py            # Nhận diện giọng hát bằng Faster-Whisper + Batched Inference
│   ├── acoustic_aligner.py       # Bộ khớp nhịp cưỡng bức âm học (DP Forced Alignment + Dynamic Time Warping)
│   ├── gemini_service.py         # Kết nối Google Gemini Cloud, lọc tag Suno, phân bổ nhịp âm tiết & parse SRT
│   ├── lyrics_parser.py          # Bóc tách và chuẩn hóa định dạng phụ đề SRT, LRC sang cấu trúc segment KTV
│   ├── lyrics_fetcher.py         # Tra cứu lời đồng bộ tự động từ LRCLIB và làm sạch tiêu đề bài hát
│   ├── subtitle_gen.py           # Biên dịch phụ đề ASS 2 dòng so le luân phiên (\kf), LRC, JSON, SRT
│   ├── video_renderer.py         # Xuất video karaoke MP4 bằng FFmpeg (GPU NVENC / QSV / VideoToolbox / CPU)
│   ├── cache_manager.py          # Quản lý bộ nhớ đệm Stems & Whisper, dọn dẹp giải phóng ổ cứng
│   └── downloader.py             # Tải audio/video trực tiếp từ YouTube, Zing, URL mạng bằng yt-dlp
│
├── web/                          # Giao diện người dùng Web Frontend (HTML5 / CSS3 / Vanilla JS)
│   ├── index.html                # Cấu trúc giao diện: Upload modal, Studio Editor, thanh công cụ, các popup cài đặt
│   ├── app.js                    # Toàn bộ logic frontend: State management, audio player, video canvas, API call
│   └── style.css                 # Hệ thống giao diện Dark Glassmorphism, Responsive layout, Cyber theme
│
└── storage/                      # Thư mục lưu trữ dữ liệu & dự án (Không đồng bộ Git)
    ├── config.json               # Lưu trữ cấu hình API Key & Model Gemini
    ├── cache/                    # Bộ nhớ đệm các stem âm thanh và bản nhận diện Whisper
    └── projects/                 # Dữ liệu từng bài hát: input_audio, stems, subtitles, metadata.json
```

---

## 🧠 3. CÔNG NGHỆ CỐT LÕI & LUỒNG XỬ LÝ (PROCESSING PIPELINE)

### Sơ đồ luồng xử lý tổng thể:
```
[File Âm Thanh / Video / Link YouTube]
                  │
                  ▼
       [Demucs v4 Tách Beat]
        ├──> instrumental.mp3 (Nhạc Beat)
        └──> vocals.mp3 (Giọng Hát)
                  │
       ┌──────────┴──────────┐
       ▼                     ▼
[Nhạc Phổ Thông]      [Nhạc Mới / Nhạc Suno AI]
Faster-Whisper        Google Gemini AI Cloud
(GPU/CPU Cục Bộ)      (vocals.mp3 + Lời Suno)
       │                     │
       ▼                     ▼
Acoustic DP Aligner   Suno Sanitizer & Syllable
       │                     │
       └──────────┬──────────┘
                  ▼
       [Karaoke Segments (<= 8 từ)]
                  │
       ┌──────────┴──────────┐
       ▼                     ▼
[Phụ đề ASS KTV 2 dòng]   [LRC / JSON / SRT]
       │
       ▼
[Studio Web Editor & Player]
       │
       ▼
[FFmpeg Xuất Video MP4 (GPU NVENC/CPU)]
```

### Chi tiết các công nghệ nổi bật:

1. **Bộ lọc làm sạch lời Suno AI (`clean_suno_lyrics`)**:
   - Tự động nhận diện và loại bỏ hoàn toàn các tag cấu trúc từ prompt Suno: `[Verse 1]`, `[Chorus]`, `[Pre-Chorus]`, `[Bridge]`, `[Guitar Solo]`, `[Drop]`, `[Outro]`, `(Instrumental Fade Out)`, `Style:...`, `BPM:...`.
   - Giữ nguyên 100% văn bản ca từ để đưa vào prompt Gemini.

2. **Phân bổ thời lượng âm tiết tự nhiên (`distribute_words_in_timespan`)**:
   - Từ nhiều ký tự được phân bổ thời gian dài hơn từ ngắn.
   - **Cadence Elongation 1.35x**: Từ cuối cùng của mỗi câu hát được tăng trọng số 1.35 lần để mô phỏng chính xác độ ngân dài khi ca sĩ nhả chữ ở cuối câu trong nhạc Việt.

3. **Thuật toán Dynamic Programming Acoustic Aligner (`acoustic_aligner.py`)**:
   - Dò quét độ lệch nhịp tổng thể (Offset Detection) trên dải `±6.5s`.
   - Thuật toán quy hoạch động (DP) đối chiếu từng âm tiết nhận diện được với lời bài hát chuẩn, triệt tiêu hoàn toàn hiện tượng chữ chạy trước hoặc sau giọng hát.

4. **Trình tạo phụ đề KTV 2 dòng chuẩn phòng thu (`subtitle_gen.py`)**:
   - Hiệu ứng đổi màu chữ mịn từng từ (`\kf`).
   - 4 chấm tròn đếm ngược nhịp vào bài hát.
   - Hỗ trợ đầy đủ phân vai Song ca (Nam / Nữ / Cả hai).
   - Tọa độ hiển thị 2D độc lập cho dòng 1 và dòng 2 (kéo thả tự do).

---

## 💻 4. HƯỚNG DẪN CÀI ĐẶT TRÊN "MÁY GỐC" (PRODUCTION SETUP)

### Bước 1: Chuẩn bị môi trường trên máy gốc
1. **Cài đặt Python:** Phiên bản **Python 3.10, 3.11 hoặc 3.12** (Nhớ tích chọn **"Add python.exe to PATH"**).
2. **Cài đặt FFmpeg:** Tải FFmpeg và thêm thư mục `bin` vào biến môi trường `PATH` của Windows. Kiểm tra bằng lệnh `ffmpeg -version` trong CMD.
3. **Cài đặt Git:** Tải và cài đặt Git for Windows.

### Bước 2: Chép mã nguồn vào máy gốc
Có 2 cách:
- **Cách 1 (Khuyên dùng nếu dùng Git):**
  ```bash
  git clone https://github.com/ferm-official/ai-karaoke-studio.git
  cd ai-karaoke-studio
  ```
- **Cách 2 (Giải nén file ZIP trọn gói):**
  - Giải nén file `AI_Karaoke_Studio_Full_Source.zip` vào thư mục làm việc (ví dụ `D:\ai-karaoke-studio`).
  - Mở PowerShell / Terminal tại thư mục đó.

### Bước 3: Cài đặt các thư viện Python
Trong thư mục dự án, chạy:
```bash
pip install -r requirements.txt
```

### Bước 4: Cài đặt PyTorch hỗ trợ GPU NVIDIA CUDA (Quan trọng)
Nếu máy gốc có card màn hình rời NVIDIA (RTX 2060, 3060, 4060, 4070, v.v.):
```bash
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121
```
*(Nếu máy chỉ có CPU, bước 3 đã cài sẵn PyTorch CPU).*

### Bước 5: Cấu hình Google Gemini API Key
1. Lấy API Key miễn phí tại: [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Có thể nhập trực tiếp trên giao diện web (bấm nút bánh răng **"Cài Đặt Gemini"**).
3. Hoặc mở file `storage/config.json` và điền:
   ```json
   {
     "gemini_api_key": "AIzaSyYourActualKeyHere...",
     "gemini_model": "gemini-2.5-flash"
   }
   ```

### Bước 6: Khởi động Studio
- **Cách 1:** Nhấp đúp chuột vào file **`run_studio.bat`**.
- **Cách 2:** Mở Terminal và gõ:
  ```bash
  python server.py
  ```
Trình duyệt web sẽ tự động mở tại địa chỉ: **`http://127.0.0.1:8008`**.

---

## 🔌 5. DANH SÁCH REST API CHÍNH (BACKEND ENDPOINTS)

| Phương thức | Endpoint | Chức năng | Tham số chính |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/process-music` | Tách beat & nhận diện lời từ file/URL | `file`, `url`, `language`, `whisper_model`, `transcription_engine` |
| `POST` | `/api/process-stems` | Xử lý khi người dùng đã có sẵn file beat và vocal | `beat_file`, `vocal_file`, `song_title` |
| `POST` | `/api/projects/{id}/realign` | Khớp lại nhịp giọng hát bằng Whisper Acoustic DP | `project_id` |
| `POST` | `/api/projects/{id}/align-gemini` | **Khớp nhịp bằng Gemini AI (Suno / Bài Mới)** | `project_id`, `custom_lyrics`, `model_name` |
| `POST` | `/api/import-subtitles/{id}` | Nạp file SRT hoặc LRC bên ngoài vào Studio | `file` (.srt / .lrc) |
| `POST` | `/api/split-long-lines/{id}` | Tự động chia các câu dài trên 8 từ thành 2 dòng | `max_words`, `max_chars` |
| `POST` | `/api/save-lyrics/{id}` | Lưu nội dung bảng lời sau khi chỉnh sửa | `segments` (JSON) |
| `POST` | `/api/export-video/{id}` | Render video Karaoke MP4 bằng FFmpeg | `resolution`, `aspect_ratio`, `encoder` |
| `GET` | `/api/config` | Lấy cấu hình hệ thống & Gemini API Key | Không |
| `POST` | `/api/config` | Cập nhật Gemini API Key và chọn Model | `gemini_api_key`, `gemini_model` |
| `POST` | `/api/clear-cache` | Dọn dẹp toàn bộ file tạm và cache để giải phóng ổ cứng | Không |

---

## ⌨️ 6. PHÍM TẮT & TÍNH NĂNG TRONG STUDIO EDITOR

- **[Space]:** Bật/Tắt phát nhạc, hoặc gõ nhịp từ tiếp theo khi đang bật chế độ **Live Tap-to-Sync**.
- **Click vào từng từ trong bảng:** Nghe lại chính xác đoạn âm thanh của từ đó (Audio Word Auditioning).
- **Kéo thả 2D trên khung Video Preview:** Di chuyển vị trí Dòng 1 và Dòng 2 trực quan theo trục X/Y.
- **Nút "Nhạc Suno AI / Bài Mới Ra" (Trang chủ):** Tự động chuyển bộ não sang Gemini Cloud và làm nổi bật ô dán lời prompt Suno.
- **Nút "Khớp Lời Bằng Gemini" (Studio Editor):** Mở hộp thoại dán lời Suno, lọc sạch tag tự động và gửi luồng vocal lên Gemini để lấy nhịp mới trong vài giây.
- **Nút "Tự Động Chia Câu Dài":** Tự ngắt các câu dài thành 2 dòng so le chuẩn nhịp thơ tiếng Việt (4-7 từ/dòng).

---

## 🔄 7. QUY TRÌNH ĐỒNG BỘ & CẬP NHẬT KHI CÓ BẢN MỚI

Khi repository trên máy phát triển có bản cập nhật mới:
1. Mở Terminal tại thư mục `ai-karaoke-studio` trên máy gốc.
2. Chạy lệnh:
   ```bash
   git pull origin main
   pip install -r requirements.txt
   ```
3. Khởi động lại bằng file `run_studio.bat`.
