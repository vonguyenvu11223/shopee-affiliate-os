# Autopilot

Autopilot chưa được bật. Trạng thái hiện tại là `UNAVAILABLE`, không phải simulation đang chạy.

## Điều kiện trước khi bật

- Supabase Auth/RLS và migrations đã được kiểm thử trên project thật.
- Redis và BullMQ worker chạy ở process riêng.
- Provider hành động có quyền chính thức.
- Mọi action có idempotency key, audit log, retry policy và kill switch.
- Expected value, cost, risk và learning objective được tính trước hành động tốn tài nguyên.

Các thao tác publish, chi ngân sách hoặc gọi provider trả phí không được tự động hóa bằng cookie/session hay endpoint nội bộ.

## Đã bật một phần

Đăng tự động lên YouTube và TikTok chạy qua API chính thức với OAuth do người dùng cấp quyền, và chỉ sau khi nội dung qua review gate. Đây là hành động do người dùng bấm, không phải autopilot tự quyết định. Xem `docs/PUBLISHING.md`.
