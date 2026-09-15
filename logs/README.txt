=======================================================================
   AI KARAOKE STUDIO PRO - THƯ MỤC NHẬT KÝ HỆ THỐNG (LOGS)
=======================================================================

Thư mục này tự động ghi lại toàn bộ các bước xử lý của hệ thống để
bạn và kỹ thuật viên có thể dễ dàng theo dõi, kiểm tra và debug khi cần:

1. app.log
   -> Nhật ký vận hành chung của máy chủ (Server API, cổng 8008, các sự kiện hệ thống).

2. pipeline_latest.log
   -> Toàn bộ tiến trình chi tiết của bài hát gần nhất vừa xử lý (từ nạp nhạc,
      tách beat, nhận diện giọng đến xuất video). Mở file này để xem toàn cảnh nhanh nhất.

3. demucs.log
   -> Chi tiết bước tách nhạc Beat & Vocal bằng AI Demucs (phần cứng CUDA/Apple Silicon/CPU,
      tốc độ xử lý, thời gian tách âm).

4. transcriber.log
   -> Chi tiết bước nhận diện giọng hát và căn nhịp từng từ (Whisper / Gemini AI,
      số câu phát hiện, độ khớp mili-giây từng từ).

5. render.log
   -> Chi tiết bước xuất video Full HD 1080p MP4 bằng FFmpeg (bộ giải mã phần cứng,
      tốc độ khung hình, kích thước file hoàn thiện).

6. install_mac.log / install.log
   -> Toàn bộ nhật ký cài đặt môi trường ảo (pip, PyTorch, thư viện AI) để kiểm tra
      nếu máy Mac hoặc Windows gặp trục trặc khi cài đặt lần đầu.

7. projects/
   -> Thư mục lưu nhật ký riêng biệt cho từng mã bài hát (project_xxxx.log) để
      dễ dàng tra cứu lịch sử xử lý của từng bài hát cụ thể.
=======================================================================
