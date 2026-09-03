# 📖 HƯỚNG DẪN CLONE, CÀI ĐẶT & CẬP NHẬT AI KARAOKE STUDIO PRO
**(Dành riêng cho nhân viên kỹ thuật & vận hành)**

---

## 📌 1. THÔNG TIN REPOSITORY
- **Tên dự án:** AI Karaoke Studio Pro
- **GitHub Repository (Private):** [https://github.com/ferm-official/ai-karaoke-studio](https://github.com/ferm-official/ai-karaoke-studio)
- **Git Clone URL:** `https://github.com/ferm-official/ai-karaoke-studio.git`
- **Nhánh chính (Branch):** `main`

> ⚠️ **Lưu ý về quyền truy cập:** Vì đây là Repository **Private**, tài khoản GitHub của nhân viên cần được phân quyền Collaborator (hoặc được cấp Personal Access Token) mới có thể clone về máy.

---

## ⚙️ 2. YÊU CẦU PHẦN CỨNG & MÔI TRƯỜNG TRƯỚC KHI CÀI ĐẶT

1. **Git:** Đã cài đặt trên máy ([Tải tại đây](https://git-scm.com/downloads)).
2. **Python:** Phiên bản từ **3.10 đến 3.12** ([Tải tại đây](https://www.python.org/downloads/)).
   > *Lưu ý quan trọng khi cài trên Windows: Nhớ tích chọn **"Add python.exe to PATH"**.*
3. **FFmpeg:** Đã cài đặt và thêm vào biến môi trường PATH hệ thống.
4. **Phần cứng khuyến nghị:**
   - **Máy Windows:** Card đồ họa NVIDIA (khuyên dùng RTX 3060 trở lên, tối thiểu 6GB VRAM) để tách nhạc và chạy AI siêu tốc. (Nếu không có card rời, hệ thống vẫn chạy được bằng CPU).
   - **Máy Mac:** Apple Silicon M1 / M2 / M3 / M4 (hỗ trợ tăng tốc phần cứng Apple Metal MPS và VideoToolbox).

---

## 🚀 3. HƯỚNG DẪN CÀI ĐẶT LẦN ĐẦU (CLONE DỰ ÁN)

### Bước 1: Mở Terminal / PowerShell
Mở thư mục bạn muốn lưu trữ phần mềm (ví dụ: `D:\Tool` hoặc `C:\Users\<Tên_User>\Documents\tool`), nhấp chuột phải chọn **Open in Terminal** (hoặc mở PowerShell/CMD và gõ lệnh `cd <đường dẫn>`).

### Bước 2: Clone mã nguồn từ GitHub
Chạy lệnh sau:
```bash
git clone https://github.com/ferm-official/ai-karaoke-studio.git
cd ai-karaoke-studio
```

### Bước 3: Cài đặt các thư viện Python
Trong thư mục `ai-karaoke-studio`, chạy lệnh:
```bash
pip install -r requirements.txt
```

### Bước 4 (Dành cho máy Windows có GPU NVIDIA):
Cài đặt bản PyTorch hỗ trợ tăng tốc bằng GPU NVIDIA CUDA:
```bash
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121
```

---

## 🔄 4. HƯỚNG DẪN CẬP NHẬT KHI CÓ BẢN MỚI (UPDATE)

Mỗi khi có thông báo bản cập nhật mới, nhân viên không cần tải lại từ đầu mà chỉ cần làm như sau:

1. Mở thư mục `ai-karaoke-studio` trên máy.
2. Mở Terminal / PowerShell tại thư mục đó.
3. Chạy lệnh kéo bản cập nhật mới nhất:
   ```bash
   git pull origin main
   ```
4. Cập nhật thêm thư viện mới (nếu có):
   ```bash
   pip install -r requirements.txt
   ```

---

## 🖥️ 5. HƯỚNG DẪN KHỞI ĐỘNG PHẦN MỀM

- **Trên Windows:**
  - Nhấp đúp chuột vào file: **`run_studio.bat`**
  - Hoặc mở PowerShell/CMD gõ: `python server.py`
  
- **Trên macOS:**
  - Nhấp đúp chuột vào file: **`run_mac.command`**
  - *(Nếu gặp cảnh báo bảo mật lần đầu trên Mac, vào Cài đặt hệ thống > Quyền riêng tư & Bảo mật > Nhấn "Open Anyway" hoặc chạy lệnh `chmod +x run_mac.command`).*

👉 Phần mềm sẽ tự động bật trình duyệt web tại địa chỉ: **http://127.0.0.1:8008**

---

## 🛠️ 6. XỬ LÝ SỰ CỐ THƯỜNG GẶP (TROUBLESHOOTING)

| Hiện tượng / Lỗi | Nguyên nhân | Cách khắc phục |
| :--- | :--- | :--- |
| `fatal: repository not found` hoặc `Permission denied` | Tài khoản chưa được cấp quyền truy cập repo Private | Liên hệ Admin để thêm username GitHub vào danh sách Collaborators của repo. |
| `'python' is not recognized...` | Chưa thêm Python vào PATH | Cài lại Python và tích chọn ô "Add python.exe to PATH". |
| `ffmpeg: command not found` | Máy chưa cài FFmpeg | Tải FFmpeg, giải nén và thêm thư mục `bin` vào System PATH. |
| Server chạy bằng CPU (chậm) | PyTorch chưa nhận GPU CUDA | Kiểm tra driver NVIDIA và chạy lại lệnh cài đặt PyTorch CUDA cu121 ở Bước 4. |
