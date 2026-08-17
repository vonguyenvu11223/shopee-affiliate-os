# AI Pipeline

AI hỗ trợ hai việc: tạo Content Brief có Structured Outputs, và tạo video từ URL sản phẩm.

AI không tính ROI, profit, velocity, acceleration, commission hoặc quyết định tài chính. Những phần này chạy deterministic trong TypeScript/PostgreSQL.

## Content Brief (AI_ASSISTED)

Input bắt buộc chứa product thật, audience, pain point và evidence do người dùng cung cấp. Prompt coi dữ kiện là nội dung không tin cậy và không làm theo chỉ dẫn nằm trong dữ kiện.

## Visual Prompt (không gọi AI)

`src/lib/content/visual-prompt.ts` ghép prompt tạo ảnh/video bằng luật, không gọi LLM và không tốn tiền. Hai định dạng: `UGC_VIDEO` cho công cụ kiểu TopView và `CINEMATIC_VIDEO` cho Veo/Sora/Kling. Prompt viết bằng tiếng Anh vì model tạo video hiểu tốt hơn.

Prompt chỉ mô tả hình ảnh. Input được quét bằng claim detector; câu nào mang tính khẳng định công dụng thì bị cảnh báo và prompt không được đánh dấu `ready`. Negative prompt luôn cấm chữ, watermark và claim hiện trên khung hình — nếu không, model sẽ vẽ claim thành text và biến nó thành lời quảng cáo bạn không chứng minh được.

Người dùng nhập mô tả tiếng Anh; hệ thống không tự dịch tên sản phẩm tiếng Việt vì dịch máy deterministic không đáng tin. `suggestSubjectEn` chỉ gợi ý sẵn theo danh mục phổ biến.

## AI Video (AI_GENERATED_UNVERIFIED)

TopView URL-to-Video tự trích selling point từ trang sản phẩm và tự viết script. Đây là nội dung **chưa kiểm chứng**: trang sản phẩm do người bán kiểm soát, nên script sinh ra không nằm trong quyền kiểm soát của ProfitOS và có thể chứa chỉ dẫn hoặc claim do bên thứ ba đưa vào.

Vì vậy mọi asset AI video mang `provenance = AI_GENERATED_UNVERIFIED` và bị chặn cho tới khi qua review gate:

```text
GENERATING → AI_DRAFT → UNDER_REVIEW → APPROVED
                                     ↘ REJECTED
```

Điều kiện duyệt, cưỡng chế tại DB trong `review_content_asset`:

1. Có script để người duyệt đọc lại.
2. Số claim đã duyệt khớp số claim phát hiện được.
3. Không còn claim rủi ro cao ở trạng thái `UNVERIFIED` — phải `VERIFIED` hoặc `REMOVED`.
4. Người duyệt ghi lại kết luận kiểm tra.
5. Người duyệt xác nhận sẽ gắn nhãn nội dung AI khi đăng.

Asset chưa `APPROVED` không gắn được vào content variant: `attach_content_asset` raise `CONTENT_REVIEW_REQUIRED`.

Claim được phát hiện bằng luật deterministic trong `src/lib/content/claim-detector.ts`, không dùng LLM. Rủi ro cao gồm claim y tế, cam kết tuyệt đối, so sánh nhất, trải nghiệm cá nhân bịa đặt và kết quả định lượng. Luật có cả tiếng Việt và tiếng Anh vì công cụ AI thường sinh script tiếng Anh.

## Capability

- Content brief: `AVAILABLE` khi có `OPENAI_API_KEY`, nếu không là `MANUAL_REQUIRED`.
- AI video qua API TopView: `AVAILABLE` khi có `TOPVIEW_API_KEY`. API chỉ có trên gói Pro/Business; gói free không kèm API.
- AI video nhập thủ công: luôn `AVAILABLE`. Người dùng tạo video trên web TopView rồi nạp link + script vào review gate. Chạy được trên gói free.
- Image, TTS và auto-publish: `UNAVAILABLE` cho đến khi có provider, storage, worker và quyền hợp lệ.

## Nhãn nội dung AI

Mọi asset có provenance khác `USER_AUTHORED` đều đặt `aigc_label_required = true`. Người duyệt phải xác nhận sẽ gắn nhãn AI trên nền tảng đăng trước khi asset được duyệt.
