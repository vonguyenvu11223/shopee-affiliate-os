# Content Test Pipeline

Hai đường tạo nội dung, chung một điểm ra:

```text
REAL PRODUCT ─┬─ [A] MANUAL BRIEF ──────────────────────────┐
              │                                             │
              └─ [B] AI VIDEO (TopView)                     │
                     → AI_GENERATED_UNVERIFIED              │
                     → CLAIM REVIEW GATE ───────────────────┤
                                                            ↓
                              TRACKED LINK
                              → AUTO PUBLISH (YouTube công khai / TikTok nháp)
                                hoặc MANUAL PUBLISH
                              → CLICK/CONVERSION REPORT
                              → PROFIT → TEST/SCALE/KILL
```

## Đường A — brief thủ công

Content Studio không tự tạo claim. Brief chỉ sẵn sàng khi có khách hàng mục tiêu, nỗi đau, hook 3 giây, cảnh demo/bằng chứng và CTA. Đây là đường mặc định cho sản phẩm bạn thực sự đã dùng.

## Đường B — AI video chưa kiểm chứng

Dùng cho cheap test số lượng lớn khi bạn chưa có trải nghiệm thật với sản phẩm.

Hai cách nạp:

- **Miễn phí**: tạo video trên web topview.ai, dán link video và script vào Content Studio.
- **API**: cần `TOPVIEW_API_KEY` (gói Pro/Business). ProfitOS gửi job, nhận `taskId`, client poll cho tới khi xong. Không có worker riêng vì công việc dài chạy ở phía TopView.

Nội dung đường B **không được dùng cho experiment** cho tới khi một người thật duyệt từng claim. Xem `docs/AI_PIPELINE.md` cho điều kiện duyệt.

Khi Supabase chưa cấu hình, review gate chỉ hiển thị ở UI và không được cưỡng chế. Cấu hình Supabase trước khi dùng đường B nghiêm túc.

## Trước khi đăng

1. Kiểm tra link có đúng Sub_id.
2. Chỉ dùng claim có thể chứng minh; với video AI, claim rủi ro cao phải đã `VERIFIED` hoặc đã cắt bỏ.
3. Gắn nhãn nội dung AI trên nền tảng nếu asset yêu cầu.
4. Ghi chi phí thực của content, gồm cả credit đã tiêu cho video.
5. Đăng thủ công trên nền tảng được phép.
6. Sau cửa sổ test, xuất báo cáo cùng khoảng ngày để đo.

Đăng tự động lên YouTube (công khai) và TikTok (nháp) đã khả dụng khi cấu hình OAuth — xem `docs/PUBLISHING.md`. Shopee Video giữ `UNAVAILABLE` vì không có API đăng công khai cho tài khoản affiliate.
