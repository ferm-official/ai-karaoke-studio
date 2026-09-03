# 🎤 AI Karaoke Studio Pro

Phần mềm tự động tách nhạc beat (Demucs v4) và nhận diện lời bài hát (Faster-Whisper) chạy 100% Local GPU, hỗ trợ tạo phụ đề Karaoke ASS/LRC và render video Karaoke chất lượng cao.

---

## 🛠️ Hướng Dẫn Cài Đặt (Dành cho nhân viên)

### 1. Yêu cầu hệ thống:
- **Windows:** Windows 10/11 64-bit, Card đồ họa NVIDIA (khuyên dùng RTX 3060 trở lên, tối thiểu 6GB VRAM) hoặc chạy CPU.
- **macOS:** Apple Silicon M1 / M2 / M3 / M4 (xem chi tiết tại `HD_SU_DUNG_MAC.md`).
- **Python:** Python 3.10 - 3.12.
- **FFmpeg:** Đã được cài đặt và thêm vào PATH hệ thống.

---

### 2. Cài đặt môi trường:
Mở Terminal / PowerShell tại thư mục dự án và chạy:

```bash
# Cài đặt thư viện phụ thuộc
pip install -r requirements.txt
```

> **Lưu ý với GPU NVIDIA (CUDA):** Nếu muốn tận dụng GPU trên Windows, hãy đảm bảo đã cài PyTorch với CUDA:
> ```bash
> pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121
> ```

---

### 3. Khởi động ứng dụng:

- **Trên Windows:** Nhấp đúp vào file `run_studio.bat` hoặc chạy:
  ```bash
  python server.py
  ```
- **Trên macOS:** Nhấp đúp vào file `run_mac.command`.

Trình duyệt sẽ tự động mở giao diện tại: **http://127.0.0.1:8008**

---

### 4. Cập nhật mã nguồn mới nhất:
Khi có bản cập nhật mới từ Git, nhân viên chỉ cần chạy:
```bash
git pull origin main
```
