# 🎤 AI Karaoke Studio Pro

Phần mềm chuyên nghiệp tự động tách nhạc nền (Demucs v4) và nhận diện lời bài hát (Faster-Whisper) chạy 100% Offline / Local trên máy tính cá nhân. Hỗ trợ tạo phụ đề Karaoke chuẩn ASS / LRC, chỉnh sửa từng từ và xuất video Karaoke MP4 chất lượng cao.

---

## ⚡ Hướng Dẫn Khởi Động Nhanh

### 🔹 Bước 1: Cài đặt môi trường tự động (Chỉ cần chạy 1 lần đầu tiên)
- Nhấp đúp vào file: **`1_CAI_DAT_MOI_TRUONG.bat`**
- Tool sẽ tự động tạo môi trường ảo độc lập (`venv`), cấu hình card đồ họa NVIDIA (nếu có) và tải các thư viện AI cần thiết.
- *Lưu ý:* Máy tính cần có sẵn **Python 3.10 hoặc 3.11** (khi cài Python nhớ tích chọn ô `[Add Python to PATH]`).

### 🔹 Bước 2: Khởi động phòng thu
- Nhấp đúp vào file: **`2_KHOI_DONG_TOOL.bat`**
- Trình duyệt web sẽ tự động mở giao diện tại: **http://127.0.0.1:8008**
- Bắt đầu tạo bài hát karaoke ngay lập tức!

---

## 🌟 Các Tính Năng Nổi Bật

1. **Nhập nguồn nhạc linh hoạt:**
   - Hỗ trợ tải trực tiếp từ link YouTube / SoundCloud hoặc tải lên file MP3, WAV, FLAC, M4A, MP4 từ máy tính.
2. **Tách nhạc nền AI chất lượng phòng thu (Demucs v4):**
   - Tự động tách âm thanh thành giọng hát (Vocals) và nhạc beat (Instrumental) nguyên gốc.
3. **Nhận diện lời & Canh nhịp tự động (Faster-Whisper):**
   - Nhận diện lời tiếng Việt chính xác, căn thời gian từng từ chuẩn xác.
4. **Phòng thu chỉnh sửa trực quan (Studio Editor):**
   - Trình phát đa kênh (bật/tắt giọng ca sĩ, chỉnh âm lượng nhạc nền).
   - Tinh chỉnh thời gian từng từ, sửa từ ngữ trực tiếp trên giao diện dạng sóng âm (Waveform).
   - Tùy biến vị trí phụ đề: điều chỉnh thanh trượt độ cao Dòng trên (Line 1) và Dòng dưới (Line 2) tiện lợi.
5. **Đa dạng phong cách hiển thị (Karaoke Styles):**
   - Phong cách Neon Phát Sáng, Truyền Thống, Hiện Đại, Gradient Rực Rỡ.
   - Hỗ trợ đổi hình nền video hoặc tải lên ảnh nền riêng theo sở thích.
6. **Xuất file & Video Karaoke chuyên nghiệp:**
   - Xuất video chuẩn MP4 chất lượng cao Full HD.
   - Xuất file phụ đề Karaoke chuẩn ASS (tương thích Aegisub, Premiere, CapCut) hoặc LRC.

---

## 💡 Yêu Cầu Hệ Thống Khuyến Nghị
- **Hệ điều hành:** Windows 10 / 11 64-bit.
- **Phần cứng:**
  - Chạy mượt mà trên CPU đa nhân.
  - Tối ưu tốt nhất với card màn hình rời NVIDIA (GTX 1660, RTX 2060, RTX 3060 trở lên) để xử lý nhanh gấp 5-10 lần.
- **Công cụ bổ trợ:** Đã cài đặt FFmpeg trên máy tính để xuất video MP4.
