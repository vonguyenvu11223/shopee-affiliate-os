# Shopee Affiliate ProfitOS

ProfitOS là vertical slice vận hành lợi nhuận affiliate dựa trên dữ liệu thật. North Star Metric là **Net Validated Affiliate Profit**, không phải lượt xem hoặc số video.

## Chạy local

```bash
npm install
npm run dev -- --port 3001
```

Mở `http://localhost:3001`.

## Những gì đang hoạt động

- Nhập file CSV “Lấy link sản phẩm hàng loạt” chính thức của Shopee Affiliate.
- Lưu nhiều snapshot và tính velocity, acceleration, trend, confidence bằng TypeScript deterministic.
- Không xếp hạng winner khi chưa đủ lịch sử và attribution.
- Tạo chuẩn Sub_id1–5 để nối sản phẩm → link → content → campaign.
- Đọc CSV Báo cáo click/chuyển đổi; khi có Supabase, lưu hash + summary + lineage và chống nhập trùng mà không lưu nguyên file nhạy cảm.
- Tính CTR, conversion, valid-order rate, EPC, Affiliate RPM, net profit và ROI.
- State machine `TESTING → VALIDATED → SCALING / DECLINING / KILLED`.
- Content Studio tạo cheap-test brief từ nội dung người dùng nhập, không tự bịa claim.
- AI video (TopView URL-to-Video) đi qua review gate bắt buộc: phát hiện claim bằng luật deterministic, người thật xác minh từng claim rủi ro cao, xác nhận nhãn AI, rồi mới được gắn vào experiment.
- Supabase schema/RLS, auth, lưu experiment và lưu quyết định hiệu suất đã có; tự khóa trong production nếu thiếu biến môi trường.
- `GET /api/health` cho biết liveness và capability, `GET /api/readiness` trả 503 cho đến khi đủ điều kiện production tối thiểu.

## Trạng thái capability

| Capability | Trạng thái hiện tại |
|---|---|
| Shopee product/link export | `AVAILABLE` qua CSV chính thức |
| Shopee click/conversion | `MANUAL_REQUIRED` qua báo cáo CSV |
| Shopee Open API | `REQUIRES_PERMISSION` |
| Shopee login cookie/internal endpoints | `UNAVAILABLE` — không thu thập hoặc replay session |
| Product Feed | `UNAVAILABLE` cho tài khoản hiện tại |
| TikTok Shop Affiliate | `MANUAL_REQUIRED` — nhập báo cáo Creator Center; API cần duyệt qua Partner Center |
| Auto publish YouTube | `AVAILABLE` khi có OAuth client; đăng công khai, API miễn phí |
| Auto publish TikTok | `AVAILABLE` khi có OAuth app; chỉ đẩy vào nháp cho tới khi qua audit |
| Auto publish Shopee Video | `UNAVAILABLE` — không có API đăng công khai |
| AI content generation | `MANUAL_REQUIRED` khi chưa có AI provider key |
| Prompt tạo ảnh/video | `AVAILABLE` — ghép bằng luật, không gọi AI, không tốn phí |
| AI video — nhập thủ công | `AVAILABLE`, chạy được trên gói TopView free |
| AI video — API TopView | `MANUAL_REQUIRED` khi chưa có `TOPVIEW_API_KEY`; API cần gói Pro/Business |
| Claim review gate | `REQUIRED` cho mọi nội dung AI, cưỡng chế tại DB |
| Supabase Auth/DB | `MANUAL_REQUIRED` khi chưa cấu hình project |

## Kiểm tra

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Dữ liệu riêng tư

Các CSV trong `data/imports/`, báo cáo và dữ liệu thí nghiệm bị loại khỏi Git. Affiliate link là dữ liệu riêng của tài khoản. Trong production, API import tự khóa nếu Supabase Auth chưa được cấu hình.

## Tài liệu

- `docs/ARCHITECTURE.md`
- `docs/SHOPEE_INTEGRATION.md`
- `docs/PRODUCT_RADAR.md`
- `docs/PROFIT_ENGINE.md`
- `docs/ATTRIBUTION.md`
- `docs/CONTENT_PIPELINE.md`
- `docs/AI_PIPELINE.md`
- `docs/AFFILIATE_PROGRAMS.md`
- `docs/PUBLISHING.md`
- `docs/AUTOPILOT.md`
- `docs/DEPLOYMENT.md`

Chạy lần lượt các migration trong `supabase/migrations/` từ `202608140001` đến `202608140012`. Các migration cuối lưu metric + decision + audit atomically, liên kết nguồn báo cáo, chống kỳ báo cáo chồng lấn và nhập product/snapshot/link trong một transaction. Migration `202608140010` thêm bảng `content_assets` và cưỡng chế review gate cho nội dung AI. Migration `202608140011` thêm kết nối nền tảng, nhật ký đăng bài và kho media; token OAuth chỉ service-role đọc được. Migration `202608140012` thêm chương trình affiliate thứ hai (TikTok Shop) với attribution theo video thay vì Sub_id. Chỉ chạy migration trên project do bạn sở hữu và không đưa service-role key vào browser.
