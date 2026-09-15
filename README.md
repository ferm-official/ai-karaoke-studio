# AI Karaoke Studio Pro

Phan mem chuyen nghiep tu dong tach nhac nen (Demucs v4) va nhan dien loi bai hat (Faster-Whisper) chay 100% Offline / Local tren may tinh ca nhan. Ho tro tao phu de Karaoke chuan ASS / LRC, keo tha dong chu truc tiep tren man hinh, chon hieu ung dem nhip KTV va xuat video Karaoke MP4 chat luong cao.

---

## Cau Truc Thu Muc Khoi Dong & Cai Dat

De dam bao tuong thich va de su dung, cac tep cai dat va khoi dong duoc chia thanh 3 thu muc rieng biet:

### 1. Thu muc `Windows/` (May tinh Windows 10, 11)
- `1_Cai_Dat_Windows.bat`: Thiet lap moi truong ao venv, tu dong nhan dien card NVIDIA CUDA.
- `2_Khoi_Dong_Windows.bat`: Khoi dong server va tu dong mo trinh duyet web `http://127.0.0.1:8008`.
- `Huong_Dan_Windows.txt`: Tai lieu huong dan chi tiet cho Windows.

### 2. Thu muc `Mac_Chip_M/` (Mac chip Apple Silicon M1, M2, M3, M4)
- `1_Cai_Dat_Mac_M.command`: Cai dat moi truong, ho tro bo tang toc GPU Metal (MPS) va Apple VideoToolbox.
- `2_Khoi_Dong_Mac_M.command`: Khoi dong phong thu tren macOS.
- `Huong_Dan_Mac_M.txt`: Tai lieu huong dan chi tiet cho Mac chip M.

### 3. Thu muc `MacOS_Intel/` (Mac dung CPU Intel Core)
- `1_Cai_Dat_MacOS_Intel.command`: Cai dat moi truong cho he thong Intel.
- `2_Khoi_Dong_MacOS_Intel.command`: Khoi dong phong thu.
- `Huong_Dan_MacOS_Intel.txt`: Tai lieu huong dan cho Mac Intel.

---

## Cac Tinh Nang Chinh

1. **Nhap nguon nhac da dang:**
   - Ho tro dan link YouTube / SoundCloud hoac tai file MP3, WAV, FLAC, M4A tu may tinh.
2. **Tach nhac nen chat luong cao (Demucs v4):**
   - Tach giong hat (Vocals) va beat (Instrumental) rieng biet.
3. **Nhan dien loi va can nhip chinh xac (Faster-Whisper):**
   - Nhan dien loi tieng Viet, can thoi gian tung tu.
4. **Phong thu tinh chinh truc quan (Studio Editor):**
   - Keo tha truc tiep Dong 1 va Dong 2 ngay tren man hinh 16:9 de can chinh vi tri.
   - Dem nhip chuyen nghiep: Trai Tim Do, Mat Cuoi Vang, Cham KTV, So Dem 4-3-2-1.
   - Badge Tone giong ca: Tone Nam, Tone Nu, Tone Goc.
5. **Xuat video va file phu de:**
   - Xuat video MP4 chat luong Full HD 1080p.
   - Xuat file phu de chuan ASS (tuong thich Aegisub, Premiere, CapCut) hoac LRC.

---

## Yeu Cau He Thong

- **Windows:** Windows 10 / 11 64-bit, khuyen nghi Python 3.10 hoac 3.11. Ho tro card roi NVIDIA de tang toc CUDA.
- **macOS:** macOS 12 trở lên. Ho tro toan dien Apple Silicon M1/M2/M3/M4 (MPS GPU) va Mac Intel.
- **Cong cu bo tro:** FFmpeg de xuat video MP4.
