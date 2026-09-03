# 🍎 HƯỚNG DẪN CÀI ĐẶT & SỬ DỤNG TRÊN MACOS (APPLE SILICON M1 / M2 / M3 / M4)

Phần mềm **AI Karaoke Studio Pro** đã được tối ưu hóa toàn diện cho kiến trúc chip Apple Silicon ARM64, tận dụng **Apple Metal Performance Shaders (MPS)** và **Apple VideoToolbox** để tách beat và render video MP4 siêu tốc.

---

## ⚡ 1. Yêu Cầu Cài Đặt Ban Đầu (Chỉ làm 1 lần duy nhất)

Trước khi chạy lần đầu, máy Mac cần có **Python 3** và **FFmpeg**:

### Bước 1: Mở ứng dụng `Terminal` trên Mac và cài đặt Homebrew (nếu chưa có):
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### Bước 2: Cài đặt Python 3.11 và FFmpeg:
```bash
brew install python@3.11 ffmpeg
```

---

## 🚀 2. Khởi Động Phần Mềm 1-Click

1. Mở thư mục phần mềm `karaoke` trên Finder.
2. Nhấp đúp vào tệp **`run_mac.command`**.
3. Hệ thống sẽ tự động khởi động server và mở ngay giao diện Studio tại **`http://127.0.0.1:8008`** trên Safari / Chrome.

> **Mẹo (Nếu macOS cảnh báo lần đầu):**  
> Nếu macOS hiển thị thông báo *"Cannot be opened because it is from an unidentified developer"*, bạn chỉ cần vào **System Settings (Cài đặt hệ thống)** ➔ **Privacy & Security (Quyền riêng tư & Bảo mật)** ➔ cuộn xuống và nhấn **Open Anyway (Vẫn mở)**. Hoặc mở Terminal trong thư mục và gõ:
> ```bash
> chmod +x run_mac.command
> ```

---

## 🌟 3. Ưu Điểm Tối Ưu Hóa Riêng Cho Chip Apple Silicon (Mac M)

* **Tách Beat Meta Demucs:** Chạy trên nhân GPU **Apple Metal (MPS)** và bộ nhớ hợp nhất (Unified Memory), tốc độ nhanh tương đương GPU rời và máy cực kỳ mát.
* **Xuất Video MP4 Karaoke:** Tích hợp bộ mã hóa phần cứng **`h264_videotoolbox`** của Apple, cho phép xuất video Full HD 1080p/4K 60fps trong vài giây mà không làm nóng CPU.
* **Tự động mở thư mục:** Lệnh `Mở Thư Mục Chứa Video` tự động kích hoạt Finder của macOS.
