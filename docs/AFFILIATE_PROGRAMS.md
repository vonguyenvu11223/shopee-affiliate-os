# Affiliate Programs

ProfitOS chạy song song hai chương trình affiliate. Chúng khác nhau ở **cách quy đơn**, nên gần như mọi thứ phía sau đều phải phân biệt.

| | Shopee Affiliate | TikTok Shop Affiliate |
|---|---|---|
| Attribution | `SUB_ID` — bạn tự gắn mã vào link | `NATIVE_CONTENT` — TikTok tự quy đơn về video |
| Link đặt ở đâu | Mô tả video | Giỏ hàng gắn sẵn trong video |
| Bán được trên | YouTube, TikTok, Shopee Video | Chỉ TikTok |
| Nguồn báo cáo | Báo cáo click/chuyển đổi Shopee | Báo cáo hiệu suất TikTok Shop Creator Center |
| Đối soát | Đơn hoàn thành trong báo cáo chuyển đổi | Chỉ khi báo cáo có cột hoa hồng đã thanh toán |

## TikTok không cho link bấm được trong caption

Đây là ràng buộc nền tảng, không phải lỗi cấu hình. Chỉ ô **Website trong hồ sơ** mới bấm được, và ô đó cần tài khoản Business (miễn phí, không yêu cầu 1.000 follower).

Vì vậy `buildPublishCaption` chọn chiến lược link theo chương trình và nền tảng:

- `IN_DESCRIPTION` — YouTube + Shopee: dán link đầy đủ kèm Sub_id.
- `BIO_REDIRECT` — TikTok + Shopee: **không dán URL**, chỉ dẫn sang link trong hồ sơ. Gate bắt xác nhận đã đặt link ở đó (`BIO_LINK_NOT_CONFIGURED`).
- `NATIVE_SHOWCASE` — TikTok Shop: dẫn sang sản phẩm gắn trong video.

Dán URL vào caption TikTok tạo ra chữ chết: người xem không bấm được, báo cáo Shopee không ghi nhận click, và attribution coi như hỏng. Đó là lý do gate chặn thay vì để chạy.

## Publish gate theo chương trình

`evaluatePublishGate` đổi điều kiện theo `attributionMode`:

- `SUB_ID` → bắt buộc có link affiliate và tracking key.
- `NATIVE_CONTENT` → bắt buộc có `showcaseProductId`; không cần link hay Sub_id.

Ngoài ra chặn `PROGRAM_PLATFORM_MISMATCH` khi chọn sai cặp — ví dụ sản phẩm TikTok Shop không bán được qua YouTube.

Cưỡng chế lần hai ở `record_publish_attempt`, kèm ràng buộc bảng: mỗi lần đăng phải có tracking key (Shopee) hoặc showcase product (TikTok Shop).

## Hoa hồng ước tính không phải hoa hồng đã về

`parseTikTokShopReportCsv` chỉ đưa vào `validatedCommission` khi báo cáo có cột hoa hồng **đã thanh toán/đã đối soát**. Không có cột đó thì:

- toàn bộ hoa hồng nằm ở `pendingCommission`,
- `validOrders` giữ ở 0,
- báo cáo trả về cảnh báo.

Hệ quả là state machine trong `performance-engine` không thể tuyên bố `VALIDATED` hay `SCALING` trên tiền chưa về. Đây là lựa chọn có chủ ý: TikTok Shop có clawback và hoàn đơn, hoa hồng ước tính không phải tiền thật.

## Nhập báo cáo TikTok Shop

Creator Center → xuất báo cáo hiệu suất → `POST /api/imports/tiktok-shop-report` kèm khoảng ngày.

Parser nhận diện cột theo nhiều tên gọi (Anh và Việt) và **ném lỗi khi không nhận ra file**, thay vì đoán. Chỉ hash + tổng hợp + attribution theo video được lưu; không lưu nguyên file.

Attribution lưu ở `content_attributions`, khoá theo mã video do TikTok cấp.

## Trạng thái API

Affiliate Creator API của TikTok Shop có tồn tại, nhưng truy cập phải qua TikTok Shop Partner Center và cần được duyệt. Vì chưa xác minh được điều kiện cấp quyền cho người sáng tạo đơn lẻ, ProfitOS giữ luồng nhập báo cáo thủ công làm đường chính và không code sẵn endpoint chưa kiểm chứng.
