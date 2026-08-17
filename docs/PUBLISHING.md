# Auto Publishing

Đăng tự động chỉ chạy cho nội dung đã qua review gate và có link affiliate gắn Sub_id. Không có attribution thì không đăng — vì đăng xong sẽ không đo được lãi.

## Nền tảng

| Nền tảng | Chế độ | Điều kiện |
|---|---|---|
| YouTube Shorts | `DIRECT_PUBLIC` — đăng công khai | OAuth client trong Google Cloud Console. API miễn phí. |
| TikTok | `DRAFT_INBOX` — đẩy vào nháp | App tại developers.tiktok.com, scope `video.upload`. |
| Shopee Video | `UNAVAILABLE` | Không có API đăng công khai cho tài khoản affiliate. |

Chương trình affiliate nào dùng được ở đâu, và vì sao caption TikTok không chứa link: xem `docs/AFFILIATE_PROGRAMS.md`.

YouTube Data API không tính tiền theo lượt gọi. Từ tháng 12/2025 `videos.insert` giảm còn khoảng 100 đơn vị quota, và từ 6/2026 upload có hạn mức riêng khoảng 100 lượt/ngày.

TikTok chưa qua audit Content Posting API thì mọi bài đăng trực tiếp bị ép thành riêng tư. Vì vậy mặc định là đẩy vào hộp nháp: bạn mở app TikTok và bấm đăng. Muốn đăng thẳng công khai phải nộp audit riêng cho scope `video.publish`.

## Ảnh

TikTok chỉ nhận bài ảnh qua `PULL_FROM_URL` và URL phải thuộc domain bạn đã xác minh trong TikTok Developer Portal. Đặt `TIKTOK_VERIFIED_URL_PREFIX` và host ảnh ở đó; nếu không, gate trả `PHOTO_REQUIRES_VERIFIED_DOMAIN`. YouTube không nhận bài ảnh.

## Luồng

```text
Gửi file video/ảnh → Supabase Storage (browser upload thẳng)
→ Content asset AI_GENERATED_UNVERIFIED
→ Claim review gate → APPROVED
→ Gắn Sub_id vào link affiliate
→ Publish gate → YouTube công khai / TikTok nháp
→ publish_attempts lưu tracking_key để đối chiếu báo cáo Shopee
```

File đi thẳng từ browser lên Supabase Storage để không chạm giới hạn body của serverless function. Server chỉ tải lại file khi cần đẩy sang nền tảng.

## Điều kiện của publish gate

Cưỡng chế hai lớp: `evaluatePublishGate` ở TypeScript và `record_publish_attempt` ở PostgreSQL.

1. Asset ở trạng thái `APPROVED`.
2. Có file media.
3. Có link affiliate và mã Sub_id.
4. Tài khoản nền tảng đã kết nối và token còn hạn.
5. Nhãn nội dung AI đã được xác nhận.
6. Đúng loại media mà nền tảng nhận.

## Bảo mật token

Token OAuth nằm trong `platform_connections`. Bảng này bật RLS và **cố tình không có policy nào**, nên session của browser không đọc được. Chỉ server dùng service-role key mới chạm tới. UI đọc trạng thái qua view `platform_connection_status` không chứa secret. Vì vậy `SUPABASE_SECRET_KEY` là bắt buộc để bật đăng tự động.

Logger đã redact `access_token`/`refresh_token`.

## Lưu ý vận hành

Đăng hàng loạt nội dung affiliate giống nhau dễ chạm chính sách spam của nền tảng. Dùng tính năng này để bớt thao tác tay, không phải để rải số lượng lớn.
